const CATEGORY_LABELS = {
  fabric: "Men's Fabric",
  suits: "Suits",
  "shalwar-kameez": "Shalwar Kameez",
  coats: "Coats",
  waistcoats: "Waistcoats"
};

const DEFAULT_TAILORING_CHARGES = {
  "shalwar-kameez": 2500,
  suits: 8000,
  "prince-coat": 6000,
  waistcoats: 3500
};

let TAILORING_CHARGES = { ...DEFAULT_TAILORING_CHARGES };
let TAILORING_TYPES = [
  { id: "shalwar-kameez", label: "Shalwar Qameez" },
  { id: "suits", label: "Suit" },
  { id: "prince-coat", label: "Prince Coat" },
  { id: "waistcoats", label: "Waistcoat" }
];
let tailoringChargesLoaded = false;

function getAllProducts() {
  return PRODUCTS;
}

const PRODUCTS = [
  {
    id: 1,
    name: "Premium Wash & Wear Fabric",
    category: "fabric",
    price: 2500,
    originalPrice: 3000,
    badge: "sale",
    rating: 4.9,
    reviews: 186,
    image: "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800&q=80",
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80"
    ],
    sizes: ["4 Meter", "5 Meter", "6 Meter", "7 Meter", "8 Meter"],
    colors: ["Navy", "Charcoal", "Black", "Brown"],
    referenceMeters: 4,
    stitchingEnabled: true,
    stitchingTypes: ["shalwar-kameez", "suits", "prince-coat", "waistcoats"],
    description: "High-quality wash & wear fabric ideal for suits and formal wear. Priced per meter — minimum order 4 meters. Wrinkle-resistant and durable.",
    featured: true,
    new: false
  },
  {
    id: 2,
    name: "Imported Wool Blend Fabric",
    category: "fabric",
    price: 4500,
    originalPrice: null,
    badge: "premium",
    rating: 4.8,
    reviews: 94,
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80"
    ],
    sizes: ["4 Meter", "5 Meter", "6 Meter", "7 Meter", "8 Meter"],
    colors: ["Dark Grey", "Navy", "Burgundy"],
    stitchingEnabled: true,
    stitchingTypes: ["shalwar-kameez", "suits", "prince-coat", "waistcoats"],
    referenceMeters: 4,
    description: "Imported wool blend suiting fabric with a refined finish. Priced per meter — minimum order 4 meters.",
    featured: true,
    new: true
  },
  {
    id: 3,
    name: "Custom Tailored 2-Piece Suit",
    category: "suits",
    price: 15000,
    originalPrice: 18000,
    badge: "sale",
    rating: 4.9,
    reviews: 145,
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80",
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["Navy", "Charcoal", "Black", "Brown"],
    description: "Expertly tailored 2-piece suit with jacket and trousers. Precision stitching, perfect fit guaranteed.",
    featured: true,
    new: false
  },
  {
    id: 4,
    name: "Executive 3-Piece Suit",
    category: "suits",
    price: 22000,
    originalPrice: null,
    badge: "premium",
    rating: 5,
    reviews: 78,
    image: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["Navy", "Charcoal", "Black"],
    description: "Premium 3-piece suit with jacket, waistcoat, and trousers. Ideal for weddings and formal events.",
    featured: true,
    new: true
  },
  {
    id: 5,
    name: "Classic Shalwar Kameez",
    category: "shalwar-kameez",
    price: 5500,
    originalPrice: null,
    badge: "bestseller",
    rating: 4.8,
    reviews: 267,
    image: "https://images.unsplash.com/photo-1622445275463-afa2ab1c0c44?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1622445275463-afa2ab1c0c44?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["White", "Cream", "Light Grey", "Navy"],
    description: "Traditional shalwar kameez tailored to your measurements. Clean finishing and timeless Pakistani style.",
    featured: true,
    new: false
  },
  {
    id: 6,
    name: "Embroidered Shalwar Kameez",
    category: "shalwar-kameez",
    price: 8500,
    originalPrice: null,
    badge: "new",
    rating: 4.9,
    reviews: 112,
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["White", "Ivory", "Gold", "Maroon"],
    description: "Elegant embroidered shalwar kameez for Eid, weddings, and special occasions.",
    featured: true,
    new: true
  },
  {
    id: 7,
    name: "Designer Kurta Shalwar",
    category: "shalwar-kameez",
    price: 6500,
    originalPrice: 7500,
    badge: "sale",
    rating: 4.7,
    reviews: 89,
    image: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["Black", "Navy", "Olive", "Maroon"],
    description: "Modern designer kurta with matching shalwar. Contemporary cut with traditional craftsmanship.",
    featured: false,
    new: false
  },
  {
    id: 8,
    name: "Winter Overcoat",
    category: "coats",
    price: 12000,
    originalPrice: null,
    badge: "new",
    rating: 4.8,
    reviews: 56,
    image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["Black", "Charcoal", "Camel", "Navy"],
    description: "Warm tailored overcoat for winter season. Premium lining and elegant long cut.",
    featured: false,
    new: true
  },
  {
    id: 9,
    name: "Formal Blazer Coat",
    category: "coats",
    price: 9500,
    originalPrice: null,
    badge: null,
    rating: 4.7,
    reviews: 73,
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["Navy", "Black", "Brown"],
    description: "Single-breasted formal blazer coat. Versatile layering piece for business occasions.",
    featured: false,
    new: false
  },
  {
    id: 10,
    name: "Classic Waistcoat",
    category: "waistcoats",
    price: 4000,
    originalPrice: 4000,
    badge: "sale",
    rating: 4.6,
    reviews: 134,
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["Grey", "Navy", "Brown", "Black"],
    description: "Timeless waistcoat tailored to fit perfectly under suits or worn standalone. Clean lines and expert finishing.",
    featured: false,
    new: false
  }
];

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function getFeaturedProducts() {
  return PRODUCTS.filter(p => p.featured);
}

function getProductsByCategory(category) {
  if (category === "all") return PRODUCTS;
  return PRODUCTS.filter(p => p.category === category);
}

function isFabricProduct(product) {
  return product && product.category === "fabric";
}

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

function isOutOfStock(product, color) {
  if (!product) return true;
  if (hasColorVariants(product) && color) {
    return getColorStock(product, color) <= 0;
  }
  return getColorStock(product) <= 0;
}

function getProductById(id) {
  if (id == null || id === "") return undefined;
  const numId = Number(id);
  const product = PRODUCTS.find(p => Number(p.id) === numId);
  return product ? normalizeProductStock({ ...product }) : undefined;
}

function parseMetersFromSize(size) {
  const match = String(size).match(/(\d+)\s*Meter/);
  return match ? Number(match[1]) : 4;
}

function getPerMeterPrice(product) {
  return product.price / product.referenceMeters;
}

function getFabricLineTotal(product, meters) {
  return getPerMeterPrice(product) * meters;
}

function getTailoringLabel(typeId) {
  return TAILORING_TYPES.find((t) => t.id === typeId)?.label || typeId || "";
}

function getTailoringCharge(typeId) {
  if (!typeId) return 0;
  return Number(TAILORING_CHARGES[typeId]) || 0;
}

function getProductStitchingTypes(product) {
  if (!product || product.category !== "fabric") return [];
  const validIds = TAILORING_TYPES.map((type) => type.id);
  const hasExplicitEnabled = typeof product.stitchingEnabled === "boolean";
  const hasExplicitTypes = Array.isArray(product.stitchingTypes);

  if (!hasExplicitEnabled && !hasExplicitTypes) {
    return validIds;
  }

  if (product.stitchingEnabled === false) return [];

  if (hasExplicitTypes) {
    return product.stitchingTypes.filter((id) => validIds.includes(id));
  }

  return validIds;
}

function productOffersStitching(product) {
  return getProductStitchingTypes(product).length > 0;
}

function getLineTotal(item) {
  const fabricTotal = item.isFabric ? item.unitPrice * item.meters : item.unitPrice * item.qty;
  const tailoringTotal = item.tailoringEnabled ? Number(item.tailoringCharge || 0) : 0;
  return fabricTotal + tailoringTotal;
}

async function loadTailoringChargesFromAPI() {
  try {
    const response = await fetch("/api/tailoring-charges");
    const data = await response.json();
    if (data.success) {
      TAILORING_CHARGES = { ...DEFAULT_TAILORING_CHARGES, ...(data.charges || {}) };
      if (Array.isArray(data.types) && data.types.length) {
        TAILORING_TYPES = data.types;
      }
      tailoringChargesLoaded = true;
    }
  } catch (err) {
    console.error("Error loading tailoring charges:", err);
  }
}

function formatPrice(price) {
  return "Rs. " + Number(price).toLocaleString();
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

function productCardHTML(product) {
  const badgeHTML = product.badge
    ? `<span class="product-badge badge-${product.badge}">${product.badge}</span>`
    : "";

  const priceHTML = product.originalPrice
    ? `<span class="price-old">${formatPrice(product.originalPrice)}</span><span>${formatPrice(product.price)}</span>`
    : `<span>${formatPrice(product.price)}</span>`;

  const stock = product.stockQuantity || 0;
  const isOutOfStock = stock === 0;
  const stockText = stock <= 5 && stock > 0 ? `Only ${stock} left in stock` : (stock > 5 ? `${stock} in stock` : "Out of Stock");
  const stockClass = stock === 0 ? "out-of-stock" : (stock <= 5 ? "low-stock" : "in-stock");

  return `
    <div class="product-card ${product.new ? 'new' : ''} ${isOutOfStock ? 'out-of-stock' : ''}">
      ${badgeHTML}
      <div class="product-image">
        <a href="product.html?id=${product.id}">
          <img src="${product.image}" alt="${product.name}" loading="lazy">
        </a>
      </div>
      <div class="product-info">
        <span class="product-category">${getCategoryLabel(product.category)}</span>
        <h3><a href="product.html?id=${product.id}">${product.name}</a></h3>
        <div class="product-rating">${renderStars(product.rating)} <span>(${product.reviews})</span></div>
        <div class="product-price">${priceHTML}</div>
        <div class="product-stock ${stockClass}">${stockText}</div>
        <button class="btn btn-primary btn-add-cart" data-id="${product.id}" ${isOutOfStock ? 'disabled' : ''}>
          ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  `;
}

// Real-time updates via SSE
let eventSource = null;
let productsLoadedFromApi = false;

async function loadProductsFromAPI() {
  try {
    const response = await fetch('/api/products');
    const data = await response.json();
    if (data.success && data.products) {
      // Normalize product fields to match expected structure
      const normalizedProducts = data.products.map(p => normalizeProductStock({
        ...p,
        id: Number(p.id),
        price: p.price || 0,
        stockQuantity: p.stockQuantity || p.stock_quantity || 0,
        colorStock: p.colorStock || p.color_stock || {},
        originalPrice: p.originalPrice || p.original_price || null,
        category: p.category || 'fabric',
        sizes: p.sizes || ["Custom Measurement"],
        colors: p.colors || [],
        images: p.images || [p.image || ""],
        referenceMeters: p.referenceMeters || p.reference_meters || 4,
        stitchingEnabled: p.stitchingEnabled,
        stitchingTypes: p.stitchingTypes
      }));
      
      // Replace the static PRODUCTS array with API data
      PRODUCTS.length = 0;
      PRODUCTS.push(...normalizedProducts);
      productsLoadedFromApi = true;
      console.log('Products loaded from API:', PRODUCTS.length);
      console.log('Sample product:', PRODUCTS[0]);
      refreshProductDisplays();
    }
  } catch (err) {
    console.error('Error loading products from API:', err);
  }
}

function connectToEvents() {
  if (eventSource) {
    eventSource.close();
  }
  
  try {
    eventSource = new EventSource('/api/events');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE Event received:', data);
        handleProductEvent(data);
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };
    
    eventSource.onerror = (error) => {
      console.log('SSE connection error:', error);
      console.log('Reconnecting in 3 seconds...');
      setTimeout(connectToEvents, 3000);
    };
    
    console.log('SSE connection established');
  } catch (err) {
    console.error('Error connecting to SSE:', err);
    setTimeout(connectToEvents, 3000);
  }
}

function handleProductEvent(event) {
  console.log('Handling product event:', event.type);
  switch(event.type) {
    case 'product_updated':
      console.log('Product updated event received, reloading products');
      loadProductsFromAPI(); // Reload all products from API
      break;
    case 'product_deleted':
      console.log('Product deleted event received, reloading products');
      loadProductsFromAPI(); // Reload all products from API
      break;
    case 'stock_updated':
      console.log('Stock updated event received:', event);
      updateStockInArray(event.productId, event.stock, event.colorStock);
      break;
    case 'connected':
      console.log('Connected to real-time product updates');
      loadProductsFromAPI(); // Load initial products
      break;
    default:
      console.log('Unknown event type:', event.type);
  }
}

function updateStockInArray(productId, newStock, colorStock) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (product) {
    // Handle color variants
    if (colorStock && typeof colorStock === "object" && Object.keys(colorStock).length > 0) {
      product.colorStock = { ...colorStock };
      product.stockQuantity = sumColorStock(product.colorStock);
      console.log(`Color stock updated for ${product.name}:`, product.colorStock, `Total: ${product.stockQuantity} units`);
    } else if (!hasColorVariants(product)) {
      // Handle products without color variants
      product.stockQuantity = newStock;
      product.colorStock = {};
      console.log(`Stock updated for ${product.name}: ${product.stockQuantity} units`);
    } else {
      // Handle color variant products where specific color stock wasn't provided
      // Update total stock but preserve existing color stock distribution
      product.stockQuantity = newStock;
      console.log(`Total stock updated for color variant ${product.name}: ${product.stockQuantity} units (color stock preserved)`);
    }
    
    // Force immediate refresh of all product displays
    refreshProductDisplays();
    
    // Also update specific product detail page if open
    const currentProductId = new URLSearchParams(window.location.search).get("id");
    if (currentProductId && Number(currentProductId) === productId) {
      if (typeof updateProductDetailStock === "function") {
        const selectedColor = document.querySelector(".color-btn.active")?.dataset.color;
        updateProductDetailStock(productId, selectedColor);
      }
    }
  } else {
    console.warn(`Product with ID ${productId} not found in local array, reloading from API`);
    loadProductsFromAPI();
  }
}

function updateProductDetailStock(productId, selectedColor) {
  const addBtn = document.querySelector("#add-to-cart-btn");
  if (!addBtn) return;

  const product = getProductById(productId);
  if (!product) return;

  const color = selectedColor || product.colors?.[0];
  const outOfStock = isOutOfStock(product, color);
  const available = getColorStock(product, color);
  const actions = document.querySelector(".product-actions");
  const existingNotice = actions?.querySelector(".stock-notice");

  if (outOfStock) {
    addBtn.disabled = true;
    addBtn.textContent = "Out of Stock";
    if (actions && !existingNotice) {
      actions.insertAdjacentHTML("afterbegin", `<p class="stock-notice" style="color:#8b2942;font-weight:600;margin-bottom:12px">${color ? `${color} is currently out of stock.` : "This item is currently out of stock."}</p>`);
    } else if (existingNotice) {
      existingNotice.textContent = color ? `${color} is currently out of stock.` : "This item is currently out of stock.";
    }
  } else {
    addBtn.disabled = false;
    addBtn.innerHTML = '<i class="fas fa-shopping-bag"></i> Add to Cart';
    if (existingNotice) {
      if (available <= 5) {
        existingNotice.textContent = color
          ? `Only ${available} left in ${color}.`
          : `Only ${available} left in stock.`;
        existingNotice.style.display = "";
      } else {
        existingNotice.remove();
      }
    } else if (actions && available <= 5) {
      actions.insertAdjacentHTML(
        "afterbegin",
        `<p class="stock-notice" style="color:#8b2942;font-weight:600;margin-bottom:12px">${color ? `Only ${available} left in ${color}.` : `Only ${available} left in stock.`}</p>`
      );
    }
  }
}

function refreshProductDisplays() {
  console.log('Refreshing product displays');
  // Re-render product cards on current page
  const featured = document.querySelector("#featured-products");
  if (featured) {
    featured.innerHTML = getFeaturedProducts().map(productCardHTML).join("");
    console.log('Featured products refreshed');
  }
  
  const shopGrid = document.querySelector("#shop-products");
  if (shopGrid) {
    // Re-render shop page based on current filters
    const activeCategory = document.querySelector('input[name="category"]:checked')?.value || "all";
    const products = getProductsByCategory(activeCategory);
    shopGrid.innerHTML = products.map(productCardHTML).join("");
    const countEl = document.querySelector(".shop-count");
    if (countEl) countEl.textContent = `Showing ${products.length} products`;
    console.log('Shop products refreshed');
  }

  const productId = new URLSearchParams(window.location.search).get("id");
  if (productId) {
    const product = getProductById(productId);
    if (product) {
      const selectedColor = document.querySelector(".color-btn.active")?.dataset.color || product.colors?.[0];
      updateProductDetailStock(productId, selectedColor);
    }
  }
}

// Initialize SSE connection when DOM is ready
if (typeof window !== 'undefined') {
  console.log('Window detected, initializing SSE');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM loaded, connecting to SSE');
      connectToEvents();
    });
  } else {
    console.log('DOM already loaded, connecting to SSE immediately');
    connectToEvents();
  }
}

// Also load products immediately for initial render
if (typeof window !== 'undefined') {
  loadProductsFromAPI();
  loadTailoringChargesFromAPI();
}
