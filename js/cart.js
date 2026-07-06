const CART_KEY = "misri_cart";
const API_BASE = "/api";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
  document.dispatchEvent(new CustomEvent("cartUpdated"));
}

function buildCartKey(productId, size, color) {
  return `${productId}-${size}-${color}`;
}

function addToCart(productId, size, color, qty = 1) {
  const product = getProductById(productId);
  if (!product) return;

  const selectedSize = size || product.sizes[0];
  const selectedColor = color || product.colors[0];
  const cart = getCart();
  const key = buildCartKey(productId, selectedSize, selectedColor);
  const existing = cart.find(item => item.key === key);

  if (isFabricProduct(product)) {
    const meters = parseMetersFromSize(selectedSize);
    if (meters < 4) {
      showToast("Minimum fabric order is 4 meters");
      return;
    }
    const unitPrice = getPerMeterPrice(product);

    if (existing) {
      existing.meters = meters;
      existing.size = selectedSize;
      existing.unitPrice = unitPrice;
    } else {
      cart.push({
        key,
        id: product.id,
        name: product.name,
        image: product.image,
        size: selectedSize,
        color: selectedColor,
        isFabric: true,
        meters,
        unitPrice,
        qty: 1
      });
    }
    saveCart(cart);
    showToast(`${product.name} — ${meters}m added (${formatPrice(getFabricLineTotal(product, meters))})`);
    return;
  }

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      key,
      id: product.id,
      name: product.name,
      image: product.image,
      size: selectedSize,
      color: selectedColor,
      isFabric: false,
      unitPrice: product.price,
      qty
    });
  }

  saveCart(cart);
  showToast(`${product.name} added to cart`);
}

function removeFromCart(key) {
  saveCart(getCart().filter(item => item.key !== key));
}

function updateFabricMeters(key, meters) {
  if (meters < 4) {
    showToast("Minimum fabric order is 4 meters");
    return;
  }
  const cart = getCart();
  const item = cart.find(i => i.key === key);
  if (!item || !item.isFabric) return;
  item.meters = meters;
  item.size = `${meters} Meter`;
  saveCart(cart);
}

function updateCartQty(key, qty) {
  const cart = getCart();
  const item = cart.find(i => i.key === key);
  if (!item || item.isFabric) return;
  if (qty <= 0) {
    removeFromCart(key);
    return;
  }
  item.qty = qty;
  saveCart(cart);
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + getLineTotal(item), 0);
}

function getCartCount() {
  return getCart().length;
}

function updateCartCount() {
  const els = document.querySelectorAll(".cart-count");
  const count = getCartCount();
  els.forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? "flex" : "none";
  });
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateCartCount();
  document.dispatchEvent(new CustomEvent("cartUpdated"));
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function renderCartDrawer() {
  const cart = getCart();
  const itemsEl = document.querySelector(".cart-items");
  const totalEl = document.querySelector(".cart-total-amount");
  const emptyEl = document.querySelector(".cart-empty");
  const footerEl = document.querySelector(".cart-footer");
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = "";
    if (emptyEl) emptyEl.style.display = "block";
    if (footerEl) footerEl.style.display = "none";
    if (totalEl) totalEl.textContent = formatPrice(0);
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";
  if (footerEl) footerEl.style.display = "block";

  itemsEl.innerHTML = cart.map(item => {
    const lineTotal = getLineTotal(item);
    const detailLine = item.isFabric
      ? `${item.meters} meter${item.meters > 1 ? "s" : ""} · ${item.color} · ${formatPrice(item.unitPrice)}/m`
      : `${item.size} · ${item.color}`;

    const qtyControls = item.isFabric
      ? `<div class="qty-control">
          <button class="qty-btn" data-action="decrease" data-key="${item.key}" aria-label="Decrease meters">−</button>
          <span>${item.meters}m</span>
          <button class="qty-btn" data-action="increase" data-key="${item.key}" aria-label="Increase meters">+</button>
        </div>`
      : `<div class="qty-control">
          <button class="qty-btn" data-action="decrease" data-key="${item.key}">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" data-action="increase" data-key="${item.key}">+</button>
        </div>`;

    return `
      <div class="cart-item" data-key="${item.key}">
        <img src="${item.image}" alt="${item.name}">
        <div class="cart-item-details">
          <h4>${item.name}</h4>
          <p>${detailLine}</p>
          <div class="cart-item-bottom">
            ${qtyControls}
            <span class="cart-item-price">${formatPrice(lineTotal)}</span>
          </div>
        </div>
        <button class="cart-remove" data-key="${item.key}" aria-label="Remove item">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }).join("");

  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
}

function injectCheckoutModal() {
  if (document.querySelector(".checkout-modal")) return;

  const modal = document.createElement("div");
  modal.className = "checkout-modal";
  modal.innerHTML = `
    <div class="checkout-overlay"></div>
    <div class="checkout-box">
      <button class="checkout-close" aria-label="Close checkout"><i class="fas fa-times"></i></button>
      <h3>Complete Your Order</h3>
      <p class="checkout-subtitle">Enter your details. We will confirm your order by phone or WhatsApp.</p>
      <form id="checkout-form">
        <div class="form-group">
          <label for="checkout-name">Full Name *</label>
          <input type="text" id="checkout-name" name="name" required placeholder="Your full name">
        </div>
        <div class="form-group">
          <label for="checkout-phone">Phone Number *</label>
          <input type="tel" id="checkout-phone" name="phone" required placeholder="03XX-XXXXXXX">
        </div>
        <div class="form-group">
          <label for="checkout-email">Email</label>
          <input type="email" id="checkout-email" name="email" placeholder="your@email.com">
        </div>
        <div class="form-group">
          <label for="checkout-address">Address / City *</label>
          <textarea id="checkout-address" name="address" required placeholder="Delivery or pickup address"></textarea>
        </div>
        <div class="form-group">
          <label for="checkout-notes">Order Notes</label>
          <textarea id="checkout-notes" name="notes" placeholder="Measurements, special instructions..."></textarea>
        </div>
        <div class="checkout-summary">
          <span>Order Total</span>
          <strong id="checkout-total">${formatPrice(0)}</strong>
        </div>
        <button type="submit" class="btn btn-primary checkout-submit" style="width:100%">
          <i class="fas fa-check"></i> Place Order
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".checkout-overlay").addEventListener("click", closeCheckout);
  modal.querySelector(".checkout-close").addEventListener("click", closeCheckout);
  modal.querySelector("#checkout-form").addEventListener("submit", submitOrder);
}

function openCheckout() {
  const cart = getCart();
  if (!cart.length) {
    showToast("Your cart is empty");
    return;
  }
  injectCheckoutModal();
  const modal = document.querySelector(".checkout-modal");
  const totalEl = document.querySelector("#checkout-total");
  if (totalEl) totalEl.textContent = formatPrice(getCartTotal());
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  document.querySelector(".cart-drawer")?.classList.remove("open");
  document.querySelector(".cart-overlay")?.classList.remove("open");
}

function closeCheckout() {
  document.querySelector(".checkout-modal")?.classList.remove("open");
  document.body.style.overflow = "";
}

async function submitOrder(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector(".checkout-submit");
  const cart = getCart();
  if (!cart.length) {
    showToast("Your cart is empty");
    return;
  }

  const payload = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    address: form.address.value.trim(),
    notes: form.notes.value.trim(),
    items: cart.map(item => ({
      product_id: item.id,
      product_name: item.name,
      size: item.size,
      color: item.color,
      meters: item.isFabric ? item.meters : null,
      unit_price: item.unitPrice,
      quantity: item.isFabric ? 1 : item.qty,
      line_total: getLineTotal(item)
    })),
    total: getCartTotal()
  };

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';

  try {
    const res = await fetch(`${API_BASE}/submit_order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      clearCart();
      closeCheckout();
      form.reset();
      renderCartDrawer();
      showToast(`Order placed! Ref: ${data.order_ref}. We will contact you soon.`);
    } else {
      showToast(data.message || "Could not place order. Please call us.");
    }
  } catch (err) {
    showToast("Cannot reach server. Run: npm start in misri-cloth folder, then open http://localhost:3000");
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-check"></i> Place Order';
}

function initCartDrawer() {
  injectCheckoutModal();

  document.addEventListener("click", e => {
    if (e.target.closest(".cart-toggle")) {
      document.querySelector(".cart-drawer")?.classList.add("open");
      document.querySelector(".cart-overlay")?.classList.add("open");
      renderCartDrawer();
    }
    if (e.target.closest(".cart-close") || e.target.classList.contains("cart-overlay")) {
      document.querySelector(".cart-drawer")?.classList.remove("open");
      document.querySelector(".cart-overlay")?.classList.remove("open");
    }
    if (e.target.closest(".cart-remove")) {
      removeFromCart(e.target.closest(".cart-remove").dataset.key);
      renderCartDrawer();
    }
    if (e.target.closest(".checkout-btn")) {
      e.preventDefault();
      openCheckout();
    }
    const qtyBtn = e.target.closest(".qty-btn");
    if (qtyBtn) {
      const key = qtyBtn.dataset.key;
      const item = getCart().find(i => i.key === key);
      if (!item) return;
      if (item.isFabric) {
        const delta = qtyBtn.dataset.action === "increase" ? 1 : -1;
        updateFabricMeters(key, item.meters + delta);
      } else {
        const delta = qtyBtn.dataset.action === "increase" ? 1 : -1;
        updateCartQty(key, item.qty + delta);
      }
      renderCartDrawer();
    }
    if (e.target.closest(".btn-add-cart")) {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.target.closest(".btn-add-cart");
      const id = Number(btn.dataset.id);
      const product = getProductById(id);
      if (product && isFabricProduct(product)) {
        addToCart(id, "4 Meter", product.colors[0], 1);
      } else {
        addToCart(id);
      }
    }
  });

  document.addEventListener("cartUpdated", renderCartDrawer);
  updateCartCount();
}
