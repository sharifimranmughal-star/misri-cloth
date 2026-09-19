const crypto = require('crypto');
const { getMeasurementFields } = require('./measurement-fields');
const { getTailoringLabel } = require('./tailoring-settings');
const numberOrNull = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
function customerItem(item) {
  const type = item.tailoring_type || item.tailoringType || '';
  const raw = item.tailoring_measurements || item.tailoringMeasurements || {};
  const fields = getMeasurementFields(type);
  const measurements = Object.entries(raw).filter(([,v]) => v !== null && v !== '' && ['string','number'].includes(typeof v)).map(([key,value]) => {
    const field = fields.find(f => f.key === key);
    return { label: field?.label || key.replace(/[_-]/g,' '), value: String(value), unit: field?.unit || '' };
  });
  return {
    product_name: item.product_name || 'Ordered item', size: item.size ?? item.size_label ?? '', color: item.color || '',
    quantity: numberOrNull(item.quantity), meters: numberOrNull(item.meters), unit_price: numberOrNull(item.unit_price), line_total: numberOrNull(item.line_total),
    tailoring_enabled: Boolean(item.tailoring_enabled || item.tailoringEnabled),
    tailoring_type: getTailoringLabel(type) || type, tailoring_charge: numberOrNull(item.tailoring_charge ?? item.tailoringCharge),
    measurements, stitching_addons: (Array.isArray(item.stitching_addons) ? item.stitching_addons : []).map(a => ({name: a.name || a.id || 'Stitching extra', price: numberOrNull(a.price)}))
  };
}
function phoneKey(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^03\d{9}$/.test(digits)) digits = '92' + digits.slice(1);
  return digits;
}
function registerCustomerSupport(app, { dbPool, useDb, readJson, ORDERS_FILE, saveContact }) {
  const attempts = new Map();
  function limit(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const now = Date.now();
    for (const [key, v] of attempts) if (v.until <= now) attempts.delete(key);
    const key = req.ip;
    const v = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    attempts.set(key, v);
    if (++v.count > 30) { res.set('Retry-After', String(Math.ceil((v.until-now)/1000))); return res.status(429).json({ success:false, message:'Too many attempts. Please try again in 15 minutes.' }); }
    next();
  }
  async function lookup(body) {
    const ref = typeof body.order_ref === 'string' ? body.order_ref.trim().toUpperCase() : '';
    const phone = typeof body.phone === 'string' ? phoneKey(body.phone) : '';
    if (!ref || ref.length > 64 || phone.length < 10 || phone.length > 15) return null;
    let order;
    if (dbPool) {
      if (!useDb()) throw new Error('Order database unavailable');
      const result = await dbPool.query('SELECT id, order_ref, customer_phone, status, created_at, subtotal, delivery_charge, total_amount, payment_method, payment_status FROM orders WHERE UPPER(order_ref) = $1 LIMIT 1', [ref]);
      order = result.rows[0];
    } else order = readJson(ORDERS_FILE).find(o => String(o.order_ref).toUpperCase() === ref);
    if (!order || phoneKey(order.customer_phone) !== phone) return null;
    let items = Array.isArray(order.items) ? order.items : [];
    if (dbPool) items = (await dbPool.query(`SELECT product_name, size_label, color, meters, unit_price, quantity, line_total,
      tailoring_enabled, tailoring_type, tailoring_charge, tailoring_measurements, stitching_addons
      FROM order_items WHERE order_id = $1 ORDER BY id`, [order.id])).rows;
    let history = order.statusHistory || [];
    if (dbPool) history = (await dbPool.query('SELECT status, changed_at AS "changedAt" FROM order_status_history WHERE order_id = $1 ORDER BY changed_at DESC', [order.id])).rows;
    return { items: items.map(customerItem), subtotal: numberOrNull(order.subtotal), delivery_charge: numberOrNull(order.delivery_charge),
      total_amount: numberOrNull(order.total_amount), payment_method: order.payment_method || null, payment_status: order.payment_status || null,
      order_ref: order.order_ref, status: order.status, created_at: order.created_at,
      history: history.map(h => ({ status: h.status, changed_at: h.changedAt || h.changed_at })) };
  }
  app.post('/api/track_order', limit, async (req,res) => {
    try {
      const order = await lookup(req.body || {});
      if (!order) return res.status(404).json({ success:false, message:'No matching order. Check your order reference and the phone number used at checkout.' });
      res.json({ success:true, order });
    } catch { res.status(503).json({ success:false, message:'Order tracking is temporarily unavailable. Please try again or contact the shop.' }); }
  });
  app.post('/api/request_return', limit, async (req,res) => {
    const b = req.body || {};
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 60 || typeof b.email !== 'string' || b.email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || typeof b.reason !== 'string' || b.reason.trim().length < 10 || b.reason.length > 2000) {
      return res.status(400).json({success:false, message:'Enter your name, a valid email and a reason of 10–2,000 characters.'});
    }
    try {
      const order = await lookup(b);
      if (!order) return res.status(404).json({success:false, message:'No matching order. Check your order reference and checkout phone number.'});
      const reference = 'RET-' + crypto.randomBytes(6).toString('hex').toUpperCase();
      const entry = {id:Date.now(), first_name:b.name.trim(), last_name:'', email:b.email.trim(), subject:'Returns & Exchanges', message:`Request: ${reference}\nOrder: ${order.order_ref}\nPhone: ${b.phone}\n\n${b.reason.trim()}`, created_at:new Date().toISOString()};
      if (dbPool) await dbPool.query('INSERT INTO contact_messages (first_name, last_name, email, subject, message) VALUES ($1,$2,$3,$4,$5)', [entry.first_name,entry.last_name,entry.email,entry.subject,entry.message]);
      else await saveContact(entry);
      res.json({success:true, reference, message:'Your request has been saved. The shop will contact you by email or phone. Please wait for approval before sending an item.'});
    } catch { res.status(503).json({success:false, message:'We could not save your request. Please try again or contact the shop.'}); }
  });
}
module.exports = { registerCustomerSupport, phoneKey };
