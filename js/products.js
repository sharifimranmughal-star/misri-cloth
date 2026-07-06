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
    name: "Cotton Lawn Fabric",
    category: "fabric",
    price: 1200,
    originalPrice: null,
    badge: "bestseller",
    rating: 4.7,
    reviews: 312,
    image: "https://images.unsplash.com/photo-1622445275463-afa2ab1c0c44?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1622445275463-afa2ab1c0c44?w=800&q=80"
    ],
    sizes: ["4 Meter", "5 Meter", "6 Meter", "7 Meter", "8 Meter"],
    colors: ["White", "Cream", "Light Blue", "Beige"],
    referenceMeters: 4,
    description: "Soft cotton lawn fabric for shalwar kameez and kurta. Priced per meter — minimum order 4 meters.",
    featured: true,
    new: false
  },
  {
    id: 4,
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
    description: "Expertly tailored 2-piece suit with jacket and trousers. Precision stitching, perfect fit guaranteed. Bring your fabric or choose from our collection.",
    featured: true,
    new: false
  },
  {
    id: 5,
    name: "Executive 3-Piece Suit",
    category: "suits",
    price: 22000,
    originalPrice: null,
    badge: "premium",
    rating: 5.0,
    reviews: 78,
    image: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["Navy", "Charcoal", "Black"],
    description: "Premium 3-piece suit with jacket, waistcoat, and trousers. Ideal for weddings, business meetings, and formal events.",
    featured: true,
    new: true
  },
  {
    id: 6,
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
    description: "Traditional shalwar kameez tailored to your measurements. Clean finishing, comfortable fit, and timeless Pakistani style.",
    featured: true,
    new: false
  },
  {
    id: 7,
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
    description: "Elegant embroidered shalwar kameez for Eid, weddings, and special occasions. Fine thread work with premium fabric.",
    featured: true,
    new: true
  },
  {
    id: 8,
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
    id: 9,
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
    description: "Warm tailored overcoat for winter season. Premium lining, structured shoulders, and elegant long cut.",
    featured: false,
    new: true
  },
  {
    id: 10,
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
    description: "Single-breasted formal blazer coat. Versatile layering piece for business and semi-formal occasions.",
    featured: false,
    new: false
  },
  {
    id: 11,
    name: "Velvet Waistcoat",
    category: "waistcoats",
    price: 4500,
    originalPrice: null,
    badge: "premium",
    rating: 4.9,
    reviews: 98,
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80",
    images: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80"
    ],
    sizes: ["Custom Measurement"],
    colors: ["Burgundy", "Navy", "Black", "Emerald"],
    description: "Luxurious velvet waistcoat with satin back and fine button detailing. Perfect for weddings and formal events.",
    featured: false,
    new: false
  },
  {
    id: 12,
    name: "Classic Waistcoat",
    category: "waistcoats",
    price: 3500,
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

function getProductById(id) {
  return PRODUCTS.find(p => p.id === Number(id));
}

function getFeaturedProducts() {
  return PRODUCTS.filter(p => p.featured);
}

function getProductsByCategory(category) {
  if (!category || category === "all") return PRODUCTS;
  return PRODUCTS.filter(p => p.category === category);
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function isFabricProduct(product) {
  return product && product.category === "fabric";
}

function parseMetersFromSize(size) {
  const match = String(size).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 4;
}

function getReferenceMeters(product) {
  return product.referenceMeters || 4;
}

function getPerMeterPrice(product) {
  return product.price / getReferenceMeters(product);
}

function getFabricLineTotal(product, meters) {
  return Math.round(getPerMeterPrice(product) * meters);
}

function getLineTotal(item) {
  if (item.isFabric) {
    return Math.round(item.unitPrice * item.meters);
  }
  return item.unitPrice * item.qty;
}

function formatPrice(price) {
  return "Rs. " + price.toLocaleString("en-PK");
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let html = "";
  for (let i = 0; i < full; i++) html += '<i class="fas fa-star"></i>';
  if (half) html += '<i class="fas fa-star-half-alt"></i>';
  for (let i = full + (half ? 1 : 0); i < 5; i++) html += '<i class="far fa-star"></i>';
  return html;
}

function badgeLabel(badge) {
  const labels = {
    sale: "Sale",
    new: "New",
    bestseller: "Best Seller",
    premium: "Premium"
  };
  return labels[badge] || badge;
}

function productCardHTML(product) {
  const badgeHTML = product.badge
    ? `<span class="product-badge badge-${product.badge}">${badgeLabel(product.badge)}</span>`
    : "";

  let priceHTML;
  if (isFabricProduct(product)) {
    const perMeter = getPerMeterPrice(product);
    const minTotal = getFabricLineTotal(product, 4);
    priceHTML = `<span class="price-current">${formatPrice(perMeter)}/meter</span><span class="price-note">from ${formatPrice(minTotal)} (4m)</span>`;
  } else if (product.originalPrice) {
    priceHTML = `<span class="price-old">${formatPrice(product.originalPrice)}</span><span class="price-current">${formatPrice(product.price)}</span>`;
  } else {
    priceHTML = `<span class="price-current">${formatPrice(product.price)}</span>`;
  }

  return `
    <article class="product-card" data-id="${product.id}">
      <a href="product.html?id=${product.id}" class="product-card-link">
        <div class="product-image-wrap">
          ${badgeHTML}
          <img src="${product.image}" alt="${product.name}" loading="lazy">
          <div class="product-overlay">
            <span class="overlay-btn">Quick View</span>
          </div>
        </div>
        <div class="product-info">
          <span class="product-category">${getCategoryLabel(product.category)}</span>
          <h3 class="product-name">${product.name}</h3>
          <div class="product-rating">${renderStars(product.rating)} <span>(${product.reviews})</span></div>
          <div class="product-price">${priceHTML}</div>
        </div>
      </a>
      <button class="btn-add-cart" data-id="${product.id}" aria-label="Add ${product.name} to cart">
        <i class="fas fa-shopping-bag"></i> Add to Cart
      </button>
    </article>
  `;
}
