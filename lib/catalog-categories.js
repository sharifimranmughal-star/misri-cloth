const { defaultCategories, fabricType } = require('../js/catalog');
const SECTIONS = ['collections', 'stitching'];
function defaults() { return JSON.parse(JSON.stringify(defaultCategories)); }
function normalizeCategories(raw) {
  const result = {}, ids = new Set();
  for (const section of SECTIONS) {
    if (!Array.isArray(raw?.[section]) || !raw[section].length || raw[section].length > 50) throw new Error('Keep between 1 and 50 categories in each section');
    const names = new Set();
    result[section] = raw[section].map(value => {
      const id = String(value.id || '');
      const name = String(value.name || '').trim();
      const image = String(value.image || '').trim();
      const position = String(value.position || 'center').trim();
      if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(id) || ['all','fabric','constructor','prototype'].includes(id) || ids.has(id)) throw new Error('Category IDs must be unique');
      if (!name || name.length > 80 || names.has(name.toLowerCase())) throw new Error('Use a unique category name of 1–80 characters within each section');
      if (image && !/^(?:https:\/\/[^\s<>"']+|\/?(?:pics|uploads)\/[^\s<>"']+)$/.test(image)) throw new Error('Banner image must be an HTTPS URL or a pics/ or uploads/ path');
      if (image.includes('..')) throw new Error('Invalid image path');
      if (!/^(?:center|left|right|top|bottom|\d{1,3}%)(?: (?:center|left|right|top|bottom|\d{1,3}%))?$/.test(position)) throw new Error('Use a valid banner position such as center or center 25%');
      ids.add(id); names.add(name.toLowerCase());
      return { id, name, image, position };
    });
  }
  return result;
}
function categoryForProduct(product) { return product.category === 'fabric' ? { section: 'collections', id: fabricType(product) } : { section: 'stitching', id: product.category }; }
function validateRemoval(next, products) {
  for (const product of products) {
    const { section, id } = categoryForProduct(product);
    if (!next[section].some(category => category.id === id)) throw new Error(`Move the product "${product.name}" to another ${section} category before removing "${id}". Inactive products also count.`);
  }
}
module.exports = { defaults, normalizeCategories, categoryForProduct, validateRemoval };
