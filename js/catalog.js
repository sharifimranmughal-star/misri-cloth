/* Shared catalog classification; keep category=fabric for existing pricing and orders. */
(function(root) {
  const fabricTypes = {"cotton": "Cotton", "wash-and-wear": "Wash & Wear", "latha": "Latha", "linen": "Linen", "karandi": "Karandi", "khaddar": "Khaddar", "wool": "Wool & Blends", "boski": "Boski", "other": "Other Fabrics"};
  function fabricType(product) {
    if (typeof product.fabricType === 'string' && product.fabricType.trim()) return product.fabricType;
    const name = String(product.name || '').toLowerCase();
    const patterns = [['wash-and-wear', /wash\s*(?:&|and|n)\s*wear/], ['cotton', /cotton/], ['latha', /lath[ae]/], ['linen', /linen/], ['karandi', /karandi/], ['khaddar', /khaddar|khadi/], ['wool', /wool/], ['boski', /boski/]];
    return patterns.find(([, pattern]) => pattern.test(name))?.[0] || 'other';
  }
  const measurementTypes = { 'shalwar-kameez': 'Shalwar Kameez / Kurta', suits: 'Suit', 'prince-coat': 'Prince Coat', waistcoats: 'Waistcoat', coats: 'Coat / Blazer' };
  const readyMadeSizes = ['XS', 'Small', 'Medium', 'Large', 'XL', 'XXL'];
  const isCustomSize = size => /^custom(?: measurement| stitching)?$/i.test(String(size || '').trim());
  function garmentOptions(product) {
    const saved = product?.garmentOptions;
    const sizes = (Array.isArray(product?.sizes) ? product.sizes : []).filter(s => !isCustomSize(s));
    return {
      readyMadeSizes: [...new Set((Array.isArray(saved?.readyMadeSizes) ? saved.readyMadeSizes : sizes).map(s => String(s).trim()).filter(s => s && !isCustomSize(s)))],
      customEnabled: typeof saved?.customEnabled === 'boolean' ? saved.customEnabled : (product?.sizes || []).some(isCustomSize),
      measurementType: measurementTypes[saved?.measurementType] ? saved.measurementType : (measurementTypes[product?.category] ? product.category : 'suits')
    };
  }
  const defaultCategories = {"collections": [{"id": "cotton", "name": "Cotton", "image": "pics/menss.jpg", "position": "center"}, {"id": "wash-and-wear", "name": "Wash & Wear", "image": "pics/11.png", "position": "center"}, {"id": "latha", "name": "Latha", "image": "pics/menss.jpg", "position": "center 25%"}, {"id": "linen", "name": "Linen", "image": "pics/11.png", "position": "left center"}, {"id": "karandi", "name": "Karandi", "image": "pics/mens.png", "position": "center"}, {"id": "khaddar", "name": "Khaddar", "image": "pics/menss.jpg", "position": "center 75%"}, {"id": "wool", "name": "Wool & Blends", "image": "pics/mens.png", "position": "right center"}, {"id": "boski", "name": "Boski", "image": "pics/11.png", "position": "right center"}, {"id": "other", "name": "Other Fabrics", "image": "pics/mens.png", "position": "left center"}], "stitching": [{"id": "suits", "name": "Suits (2, 3 & 4 Piece)", "image": "pics/13.png", "position": "center"}, {"id": "shalwar-kameez", "name": "Shalwar Kameez & Kurtas", "image": "pics/12.jpg", "position": "center"}, {"id": "waistcoats", "name": "Waistcoats", "image": "pics/15.png", "position": "center"}, {"id": "prince-coat", "name": "Prince Coat", "image": "pics/20.jpg", "position": "center 25%"}, {"id": "coats", "name": "Coats & Blazers", "image": "pics/22.png", "position": "center"}]};
  let categories = JSON.parse(JSON.stringify(defaultCategories));
  function applyCategories(value) {
    categories = value;
    Object.keys(fabricTypes).forEach(key => delete fabricTypes[key]);
    categories.collections.forEach(category => { fabricTypes[category.id] = category.name; });
  }
  function categoryLabel(section, id) {
    return categories[section]?.find(category => category.id === id)?.name || id;
  }
  const catalog = { defaultCategories, applyCategories, categoryLabel, get categories() { return categories; }, fabricTypes, fabricType, measurementTypes, readyMadeSizes, isCustomSize, garmentOptions };
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
  else root.MisriCatalog = catalog;
})(typeof window !== 'undefined' ? window : globalThis);
