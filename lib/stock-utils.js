function sumColorStock(colorStock) {
  if (!colorStock || typeof colorStock !== "object") return 0;
  return Object.values(colorStock).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function initColorStockFromLegacyTotal(total, colors) {
  const colorStock = {};
  if (!Array.isArray(colors) || !colors.length) return colorStock;

  const safeTotal = Math.max(0, Number(total) || 0);
  colors.forEach((color, index) => {
    colorStock[color] = index === 0 ? safeTotal : 0;
  });

  return colorStock;
}

function parseColorStock(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function hasColorVariants(product) {
  return Array.isArray(product?.colors) && product.colors.length > 0;
}

function normalizeProductStock(product) {
  if (!product) return product;

  const colors = Array.isArray(product.colors) ? product.colors.map((c) => String(c).trim()).filter(Boolean) : [];
  product.colors = colors;

  if (!colors.length) {
    product.colorStock = parseColorStock(product.colorStock);
    product.stockQuantity = Math.max(0, Number(product.stockQuantity) || 0);
    return product;
  }

  const colorStock = parseColorStock(product.colorStock);

  colors.forEach((color) => {
    colorStock[color] = colorStock[color] != null
      ? Math.max(0, Number(colorStock[color]) || 0)
      : 0;
  });

  Object.keys(colorStock).forEach((color) => {
    if (!colors.includes(color)) delete colorStock[color];
  });

  product.colorStock = colorStock;
  product.stockQuantity = sumColorStock(colorStock);
  return product;
}

function hasExplicitColorStock(product) {
  const colorStock = parseColorStock(product?.colorStock);
  return Object.keys(colorStock).length > 0;
}

function getColorStock(product, color) {
  normalizeProductStock(product);
  if (!hasColorVariants(product)) {
    return Math.max(0, Number(product.stockQuantity) || 0);
  }
  if (!color) {
    return Math.max(0, Number(product.stockQuantity) || 0);
  }
  return Math.max(0, Number(product.colorStock?.[color]) || 0);
}

function isOutOfStock(product, color) {
  if (!product) return true;
  if (hasColorVariants(product) && color) {
    return getColorStock(product, color) <= 0;
  }
  return getColorStock(product) <= 0;
}

function getColorForImageIndex(product, index) {
  const colors = product?.colors || [];
  if (!colors.length || index < 0 || index >= colors.length) return null;
  return colors[index];
}

function getImageIndexForColor(product, color) {
  const colors = product?.colors || [];
  const images = product?.images || [];
  if (!colors.length || !images.length) return 0;

  const colorIndex = colors.indexOf(color);
  if (colorIndex >= 0 && colorIndex < images.length) return colorIndex;
  return 0;
}

module.exports = {
  sumColorStock,
  initColorStockFromLegacyTotal,
  parseColorStock,
  hasColorVariants,
  hasExplicitColorStock,
  normalizeProductStock,
  getColorStock,
  isOutOfStock,
  getColorForImageIndex,
  getImageIndexForColor
};
