(() => {
  const form = document.getElementById('support-form');
  if (!form) return;
  const msg = document.getElementById('support-message');
  const result = document.getElementById('tracking-result');
  const labels = {pending:'Order received',confirmed:'Confirmed',processing:'Being prepared',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'};
  const date = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(); };
  function text(tag, value, parent=result) { const e=document.createElement(tag); e.textContent=value; parent.append(e); return e; }
  const money = value => value == null || value === '' || !Number.isFinite(Number(value)) ? 'Not recorded' : 'Rs. ' + Number(value).toLocaleString('en-PK', {minimumFractionDigits:2, maximumFractionDigits:2});
  const readable = value => value ? String(value).replace(/[_-]/g, ' ') : 'Not recorded';
  function detail(parent, label, value) {
    const row = text('div', '', parent); row.className = 'order-detail-row';
    text('dt', label, row); text('dd', value, row);
  }
  function showItems(order) {
    const section = text('section', ''); section.className = 'order-details';
    text('h3', 'What you ordered', section);
    if (!order.items?.length) text('p', 'Item details are not available for this order. Contact the shop with your order reference.', section);
    (order.items || []).forEach((item, index) => {
      const card = text('article', '', section); card.className = 'order-item-card';
      text('h4', `${index + 1}. ${item.product_name}`, card);
      const specs = text('dl', '', card);
      detail(specs, 'Quantity', item.quantity == null ? 'Not recorded' : String(item.quantity));
      if(item.color) detail(specs, 'Colour', item.color);
      if(item.size) detail(specs, 'Size / selection', item.size);
      if(item.meters != null) detail(specs, 'Fabric length (per item)', `${item.meters} metres`);
      detail(specs, 'Base unit price', money(item.unit_price));
      if(item.tailoring_enabled) {
        detail(specs, 'Custom stitching', readable(item.tailoring_type));
        if(item.tailoring_charge != null) detail(specs, 'Stitching charge (per item)', money(item.tailoring_charge));
      }
      if(item.stitching_addons?.length) {
        text('h5', 'Selected extras (per item)', card);
        const extras = text('ul', '', card);
        item.stitching_addons.forEach(a => text('li', `${a.name} — ${money(a.price)}`, extras));
      }
      if(item.measurements?.length) {
        const fold = text('details', '', card); text('summary', 'View your measurements', fold);
        const list = text('dl', '', fold);
        item.measurements.forEach(m => detail(list, m.label, `${m.value}${m.unit ? ' ' + m.unit : ''}`));
      }
      const total = text('p', `Item total: ${money(item.line_total)}`, card); total.className = 'order-item-total';
    });
    const summary = text('section', '', section); summary.className = 'order-cost-summary';
    text('h3', 'Order total & payment', summary);
    const totals = text('dl', '', summary);
    detail(totals, 'Subtotal', money(order.subtotal));
    detail(totals, 'Delivery', money(order.delivery_charge));
    detail(totals, 'Total', money(order.total_amount));
    detail(totals, 'Payment method', readable(order.payment_method));
    detail(totals, 'Payment status', readable(order.payment_status));
    text('p', 'Amounts are from your saved order. Item totals include any selected stitching extras; they are not added again here.', summary);
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button=form.querySelector('button[type=submit]');
    button.disabled=true; result.hidden=true; result.replaceChildren(); msg.dataset.error='false'; msg.textContent='Please wait…';
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(form.dataset.mode==='return'?'/api/request_return':'/api/track_order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form))),signal:controller.signal});
      const data=await response.json();
      if(!response.ok || !data.success) throw new Error(data.message || 'Unable to complete your request. Please try again.');
      if(form.dataset.mode==='return') { msg.textContent=`${data.message} Your request reference: ${data.reference}`; form.reset(); }
      else {
        msg.textContent='Order found.';const order=data.order;
        text('h2',order.order_ref);text('p',labels[order.status] || order.status).className='order-status';text('p',`Placed: ${date(order.created_at)}`);
        showItems(order);
        if(order.history.length){text('h3','Status updates');const list=text('ol','');order.history.forEach(h=>text('li',`${labels[h.status] || h.status} — ${date(h.changed_at)}`,list));}
        text('p','For delivery details or changes, contact the shop with your order reference.');result.hidden=false;result.focus();
      }
    } catch(error) {msg.dataset.error='true';msg.textContent=error.name==='AbortError'?'The request timed out. Please check tracking again, or contact the shop before resubmitting a return request.':error.message;}
    finally{clearTimeout(timeout);button.disabled=false;}
  });
})();
