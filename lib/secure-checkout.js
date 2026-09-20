const crypto = require('crypto');
const {getAllowedStitchingTypes}=require('./tailoring-settings');
const {getMeasurementFields}=require('./measurement-fields');
const {validateGarmentOrderItem}=require('./garment-orders');
const {validateAddonOrderItem}=require('./stitching-addons');
const {calcDeliveryCharge}=require('./order-utils');
const {normalizeProductStock,getColorStock}=require('./stock-utils');
function invalid(message){const error=new Error(message);error.status=400;throw error;}
function text(value,name,max,required=true){
  if (value == null && !required) return '';
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))invalid(`${name} is invalid.`);
  return value.trim();
}
function money(value){const n=Number(value);if(!Number.isFinite(n)||n<0||n>10000000)invalid('Invalid price. Please contact the shop.');return Math.round(n*100)/100;}
function measurements(type,raw){
  const fields=getMeasurementFields(type);if(!fields.length)invalid('Invalid stitching type.');
  if(!raw||typeof raw!=='object'||Array.isArray(raw))invalid('Please provide your measurements.');
  const result={};
  for(const field of fields){
    const v=raw[field.key];
    if(v==null||v===''){if(field.required)invalid(`Please provide ${field.label}.`);continue;}
    if(field.type==='text')result[field.key]=text(v,field.label,1000);
    else {const n=Number(v);if(!['number','string'].includes(typeof v)||!Number.isFinite(n)||n<=0||n>1000)invalid(`Invalid ${field.label}.`);result[field.key]=n;}
  }
  return result;
}
async function normalizeOrder(body,api){
  if(!body||typeof body!=='object'||Array.isArray(body))invalid('Invalid order.');
  const name=text(body.name,'Name',120),phone=text(body.phone,'Phone',30),address=text(body.address,'Address',2000);
  if(!/^\+?[\d ()-]{10,30}$/.test(phone)||phone.replace(/\D/g,'').length<10||phone.replace(/\D/g,'').length>15)invalid('Invalid phone number.');
  const email=text(body.email??'','Email',120,false);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))invalid('Invalid email.');
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)invalid('Cart must contain 1–50 items.');
  if(!['COD','Online Payment'].includes(body.payment_method||'COD'))invalid('Invalid payment method.');
  const [addons,charges]=await Promise.all([api.getStitchingAddons(),api.getTailoringCharges()]);
  const items=[],demand=new Map(),products=new Map();
  for(const raw of body.items){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))invalid('Invalid item.');
    const id=Number(raw.product_id),quantity=Number(raw.quantity);
    if(!Number.isSafeInteger(id)||id<=0||!['number','string'].includes(typeof raw.quantity)||!Number.isSafeInteger(quantity)||quantity<1||quantity>100)invalid('Quantity must be a whole number from 1 to 100.');
    let product=products.get(id);
    if(!product){product=normalizeProductStock(await api.getProductById(id,false));if(!product)invalid('A product is no longer available.');products.set(id,product);}
    const color=text(raw.color??'','Color',80,false);
    if(product.colors.length&&!product.colors.includes(color))invalid('Please choose an available color.');
    if(!product.colors.length&&color)invalid('Invalid product color.');
    const size=text(raw.size??'','Size',80,false);
    if(raw.tailoring_enabled!=null&&typeof raw.tailoring_enabled!=='boolean')invalid('Invalid stitching choice.');
    const item={product_id:id,product_name:String(product.name),color,size,quantity,unit_price:money(product.price),meters:null,tailoring_enabled:raw.tailoring_enabled===true,tailoring_type:raw.tailoring_type||null,tailoring_charge:0,tailoring_measurements:null,stitching_addons:raw.stitching_addons||[]};
    if(product.category==='fabric'){
      if(!Array.isArray(product.sizes)||!product.sizes.includes(size))invalid('Please choose an available fabric size.');
      // The existing shop sells a piece at the listed price; metres describe its size.
      item.meters=Number(size.match(/(\d+(?:\.\d+)?)\s*Meter/i)?.[1]||product.referenceMeters||4);
      if(!Number.isFinite(item.meters)||item.meters<=0||item.meters>1000)invalid('Invalid fabric size.');
      if(item.tailoring_enabled){
        if(!getAllowedStitchingTypes(product).includes(item.tailoring_type))invalid('This stitching option is unavailable.');
        item.tailoring_charge=money(charges[item.tailoring_type]);
        item.tailoring_measurements=measurements(item.tailoring_type,raw.tailoring_measurements);
      }else item.tailoring_type=null;
    } else {
      item.tailoring_measurements=raw.tailoring_measurements;
      const check=validateGarmentOrderItem(product,item);if(!check.valid)invalid(check.message);
      if(item.tailoring_enabled)item.tailoring_measurements=measurements(item.tailoring_type,item.tailoring_measurements);
    }
    if(!Array.isArray(item.stitching_addons)||item.stitching_addons.length>50)invalid('Invalid stitching extras.');
    const seen=new Set();
    item.stitching_addons=item.stitching_addons.map(a=>{
      const option=addons.find(x=>x.id===a?.id&&x.enabled);
      if(!option||seen.has(option.id))invalid('A stitching extra is unavailable.');seen.add(option.id);
      return {id:option.id,name:option.name,price:money(option.price)};
    });
    item.line_total=money((item.unit_price+item.tailoring_charge+item.stitching_addons.reduce((sum,a)=>sum+a.price,0))*quantity);
    const check=validateAddonOrderItem(product,item,addons,charges);if(!check.valid)invalid(check.message);
    const key=JSON.stringify([id,color]);const entry=demand.get(key)||{id,color,quantity:0,product};entry.quantity+=quantity;demand.set(key,entry);
    items.push(item);
  }
  for(const entry of demand.values())if(entry.quantity>getColorStock(entry.product,entry.color))invalid(`${entry.product.name} has insufficient stock.`);
  const subtotal=money(items.reduce((sum,item)=>sum+item.line_total,0)),delivery_charge=calcDeliveryCharge(subtotal),total_amount=money(subtotal+delivery_charge);
  // Reject stale/tampered quotes; never silently charge a different amount.
  if(typeof body.total!=='number'||!Number.isFinite(body.total)||Math.abs(body.total-total_amount)>0.01)invalid('Prices have changed or the cart total is invalid. Please refresh your cart and review the total.');
  return {order:{id:crypto.randomInt(1,2**48),order_ref:'MC'+crypto.randomBytes(10).toString('hex').toUpperCase(),customer_name:name,customer_phone:phone,customer_email:email,customer_address:address,notes:text(body.notes??'','Notes',2000,false),items,subtotal,delivery_charge,total_amount,payment_method:body.payment_method||'COD',payment_status:'pending',status:'pending',statusHistory:[{status:'pending',changedAt:new Date().toISOString(),adminName:'System'}],created_at:new Date().toISOString()},demand,products};
}
function createCheckout({dbPool,api,saveOrder,readJson,writeJson,PRODUCTS_FILE,ORDERS_FILE}){
  let tail=Promise.resolve();
  return async function checkout(body){
    const previous=tail;let unlock;tail=new Promise(resolve=>unlock=resolve);await previous;
    let client;
    try{
      const key=body?.request_key;
      if(key!=null && (typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(key)))invalid('Invalid checkout request key.');
      const hash=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
      if(dbPool){
        client=await dbPool.connect();await client.query('BEGIN');
        if(key){
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
          const prior=await client.query('SELECT order_ref,request_hash FROM orders WHERE request_key=$1',[key]);
          if(prior.rows.length){
            if(prior.rows[0].request_hash!==hash)invalid('The checkout request changed. Please try again.');
            await client.query('COMMIT');return {order_ref:prior.rows[0].order_ref,duplicate:true};
          }
        }
        if(!Array.isArray(body?.items)||body.items.length>50)invalid('Invalid cart.');
        const ids=[...new Set(body.items.map(i=>Number(i?.product_id)))].sort((a,b)=>a-b);
        if(ids.some(id=>!Number.isSafeInteger(id)||id<=0))invalid('Invalid product.');
        await client.query('SELECT id FROM products WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE',[ids]);
      }
      if(!dbPool&&key){
        const prior=readJson(ORDERS_FILE).find(o=>o.request_key===key);
        if(prior){if(prior.request_hash!==hash)invalid('The checkout request changed. Please try again.');return {order_ref:prior.order_ref,duplicate:true};}
      }
      const {order,demand,products}=await normalizeOrder(body,api);
      order.request_key=key||null;order.request_hash=key?hash:null;
      for(const {product,color,quantity} of demand.values()){
        if(product.colors.length)product.colorStock[color]-=quantity;
        product.stockQuantity-=quantity;
        if(product.stockQuantity===0){product.status='inactive';product.isVisible=false;}
      }
      if(client){
        for(const [id,p] of products)await client.query('UPDATE products SET stock_quantity=$1,color_stock=$2::jsonb,status=$3,is_visible=$4,updated_at=NOW() WHERE id=$5',[p.stockQuantity,JSON.stringify(p.colorStock||{}),p.status||'active',p.isVisible!==false,id]);
        await saveOrder(order,client);await client.query('COMMIT');
      }else{
        // Serialize localhost checkout and roll back inventory if writing the order fails.
        const before=readJson(PRODUCTS_FILE);
        writeJson(PRODUCTS_FILE,before.map(p=>products.has(Number(p.id))?{...p,stockQuantity:products.get(Number(p.id)).stockQuantity,colorStock:products.get(Number(p.id)).colorStock,status:products.get(Number(p.id)).status,isVisible:products.get(Number(p.id)).isVisible}:p));
        try{await saveOrder(order);}catch(err){writeJson(PRODUCTS_FILE,before);throw err;}
      }
      api.notifyCatalogChange?.();
      return order;
    }catch(err){if(client)await client.query('ROLLBACK').catch(()=>{});throw err;}
    finally{client?.release();unlock();}
  };
}
module.exports={normalizeOrder,createCheckout};
