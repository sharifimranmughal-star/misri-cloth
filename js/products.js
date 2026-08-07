const CATEGORY_LABELS = {
  fabric: "Men's Fabric",
  suits: "Suits",
  "shalwar-kameez": "Shalwar Kameez",
  coats: "Coats",
  waistcoats: "Waistcoats"
};

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

function getProductById(id) {
  if (id == null || id === "") return undefined;
  const numId = Number(id);
  return PRODUCTS.find(p => Number(p.id) === numId);
}

function isFabricProduct(product) {
  return product && product.category === "fabric";
}

function isOutOfStock(product) {
  const stock = product.stockQuantity ?? 0;
  return stock === 0;
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

function getLineTotal(item) {
  if (item.isFabric) {
    return item.unitPrice * item.meters;
  }
  return item.unitPrice * item.qty;
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
      <a href="product.html?id=${product.id}" class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
      </a>
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
      const normalizedProducts = data.products.map(p => ({
        ...p,
        id: Number(p.id),
        // Ensure price field exists
        price: p.price || 0,
        // Normalize field names for cart compatibility
        stockQuantity: p.stockQuantity || p.stock_quantity || 0,
        originalPrice: p.originalPrice || p.original_price || null,
        // Ensure required fields
        category: p.category || 'fabric',
        sizes: p.sizes || ["Custom Measurement"],
        colors: p.colors || [],
        images: p.images || [p.image || ""],
        referenceMeters: p.referenceMeters || p.reference_meters || 4
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
      loadProductsFromAPI(); // Reload all products from API
      break;
    case 'product_deleted':
      loadProductsFromAPI(); // Reload all products from API
      break;
    case 'stock_updated':
      updateStockInArray(event.productId, event.stock);
      break;
    case 'connected':
      console.log('Connected to real-time product updates');
      loadProductsFromAPI(); // Load initial products
      break;
    default:
      console.log('Unknown event type:', event.type);
  }
}

function updateStockInArray(productId, newStock) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (product) {
    product.stockQuantity = newStock;
    console.log(`Stock updated for ${product.name}: ${newStock} units`);
    refreshProductDisplays();
  }
}

function updateProductDetailStock(productId) {
  const addBtn = document.querySelector("#add-to-cart-btn");
  if (!addBtn) return;

  const product = getProductById(productId);
  if (!product) return;

  const outOfStock = isOutOfStock(product);
  const actions = document.querySelector(".product-actions");
  const existingNotice = actions?.querySelector(".stock-notice");

  if (outOfStock) {
    addBtn.disabled = true;
    addBtn.textContent = "Out of Stock";
    if (actions && !existingNotice) {
      actions.insertAdjacentHTML("afterbegin", '<p class="stock-notice" style="color:#8b2942;font-weight:600;margin-bottom:12px">This item is currently out of stock.</p>');
    }
  } else {
    addBtn.disabled = false;
    addBtn.innerHTML = '<i class="fas fa-shopping-bag"></i> Add to Cart';
    existingNotice?.remove();
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
    if (typeof initProductPage === "function") initProductPage();
    updateProductDetailStock(productId);
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
}
