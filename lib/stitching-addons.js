const { getAllowedStitchingTypes } = require('./tailoring-settings');
const DEFAULT_ADDONS = [
  { id: 'karhai', name: 'Karhai / Embroidery', price: 0, enabled: false },
  { id: 'double-stitch', name: 'Double Stitching', price: 0, enabled: false }
];
function normalizeAddons(raw) {
  if (!Array.isArray(raw) || raw.length > 50) throw new Error('Provide up to 50 stitching extras');
  const ids = new Set();
  return raw.map(item => {
    const id = String(item.id || '');
    const name = String(item.name || '').trim();
    const price = Number(item.price);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw new Error('Each extra needs a unique ID');
    if (!name || name.length > 100) throw new Error('Each extra needs a name of up to 100 characters');
    if (item.price === '' || item.price == null || !Number.isFinite(price) || price < 0) throw new Error('Extra prices must be zero or positive');
    ids.add(id);
    return { id, name, price: Math.round(price * 100) / 100, enabled: item.enabled === true };
  });
}
function validateAddonOrderItem(product, item, available, charges) {
  const raw = item.stitching_addons || [];
  if (!Array.isArray(raw) || raw.length > 50) return { valid: false, message: 'Invalid stitching extras' };
  item.stitching_addons = [];
  if (!raw.length) return { valid: true };
  if (!item.tailoring_enabled || item.tailoring_type !== 'shalwar-kameez') return { valid: false, message: 'Extras are available only with custom Shalwar Kameez stitching' };
  if (product.category === 'fabric' && !getAllowedStitchingTypes(product).includes('shalwar-kameez')) return { valid: false, message: 'Shalwar Kameez stitching is no longer available for this fabric' };
  const ids = new Set();
  for (const selected of raw) {
    const option = available.find(a => a.id === selected?.id && a.enabled);
    if (!option || ids.has(option.id)) return { valid: false, message: 'A stitching extra is unavailable. Please select your options again' };
    if (!Number.isFinite(Number(selected.price)) || Math.abs(Number(selected.price) - option.price) > 0.005) return { valid: false, message: 'Stitching extra prices have changed. Please add this product to your cart again' };
    ids.add(option.id);
    item.stitching_addons.push({ id: option.id, name: option.name, price: option.price });
  }
  const isFabric = product.category === 'fabric';
  const count = isFabric ? 1 : Number(item.quantity);
  const base = isFabric ? Number(product.price) / Number(product.referenceMeters || 4) * Number(item.meters) + Number(charges['shalwar-kameez']) : Number(product.price) * count;
  const expected = Math.round((base + item.stitching_addons.reduce((sum, a) => sum + a.price, 0) * count) * 100) / 100;
  if (!Number.isFinite(expected) || count <= 0 || !Number.isFinite(Number(item.line_total)) || Math.abs(Number(item.line_total) - expected) > 0.01) return { valid: false, message: 'The stitching total has changed. Please add this product to your cart again' };
  item.line_total = expected;
  return { valid: true };
}
module.exports = { DEFAULT_ADDONS, normalizeAddons, validateAddonOrderItem };
