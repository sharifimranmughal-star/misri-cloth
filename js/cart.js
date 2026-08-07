const CART_KEY = "misri_cart";
const API_BASE = "/api";
const DELIVERY_CHARGE = 250;
const FREE_DELIVERY_MIN = 5000;
const EASYPAYSA_NUMBER = "03348711716";
const EASYPAYSA_NAME = "Imran Sabir";

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

  if (isOutOfStock(product)) {
    showToast("This product is out of stock");
    return;
  }

  const selectedSize = size || product.sizes[0];
  const selectedColor = color || product.colors[0];
  const cart = getCart();
  const key = buildCartKey(productId, selectedSize, selectedColor);
  const existing = cart.find(item => item.key === key);

  console.log('Adding to cart:', { productId, productName: product.name, productPrice: product.price, selectedSize, selectedColor });

  if (isFabricProduct(product)) {
    const meters = parseMetersFromSize(selectedSize);
    if (meters < 4) {
      showToast("Minimum fabric order is 4 meters");
      return;
    }
    const unitPrice = getPerMeterPrice(product);
    console.log('Fabric unit price:', unitPrice);

    if (existing) {
      existing.meters = meters;
      existing.size = selectedSize;
      existing.unitPrice = Number(unitPrice) || 0;
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
        unitPrice: Number(unitPrice) || 0,
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
    const cartItem = {
      key,
      id: product.id,
      name: product.name,
      image: product.image,
      size: selectedSize,
      color: selectedColor,
      isFabric: false,
      unitPrice: Number(product.price) || 0,
      qty
    };
    console.log('Cart item being added:', cartItem);
    cart.push(cartItem);
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

function getCartSubtotal() {
  return getCart().reduce((sum, item) => sum + getLineTotal(item), 0);
}

function getDeliveryCharge(subtotal) {
  return subtotal >= FREE_DELIVERY_MIN ? 0 : DELIVERY_CHARGE;
}

function getOrderTotal(subtotal) {
  return subtotal + getDeliveryCharge(subtotal);
}

function getCartTotal() {
  return getCartSubtotal();
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

function formatDeliveryLine(subtotal) {
  return getDeliveryCharge(subtotal) === 0 ? "FREE" : formatPrice(DELIVERY_CHARGE);
}

function updateCheckoutTotals() {
  const subtotal = getCartSubtotal();
  const subtotalEl = document.querySelector("#checkout-subtotal");
  const deliveryEl = document.querySelector("#checkout-delivery");
  const totalEl = document.querySelector("#checkout-total");
  const paymentMethodEl = document.querySelector("#checkout-payment-method");

  if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
  if (deliveryEl) {
    deliveryEl.textContent = formatDeliveryLine(subtotal);
    deliveryEl.classList.toggle("delivery-free", getDeliveryCharge(subtotal) === 0);
  }
  if (totalEl) totalEl.textContent = formatPrice(getOrderTotal(subtotal));
  if (paymentMethodEl) {
    const method = document.querySelector("#checkout-payment")?.value || "COD";
    paymentMethodEl.textContent = method === "Online Payment" ? "Online Payment" : "COD";
  }

  const easypaisaAmount = document.querySelector(".easypaisa-amount");
  if (easypaisaAmount) easypaisaAmount.textContent = formatPrice(getOrderTotal(subtotal));
}

function toggleOnlinePaymentInfo() {
  const method = document.querySelector("#checkout-payment")?.value;
  const panel = document.querySelector("#online-payment-info");
  if (!panel) return;
  panel.hidden = method !== "Online Payment";
  updateCheckoutTotals();
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
    console.log('Cart item:', { name: item.name, unitPrice: item.unitPrice, lineTotal });
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

  const subtotal = getCartSubtotal();
  if (totalEl) {
    totalEl.innerHTML = `${formatPrice(subtotal)}<small class="cart-delivery-note">+ delivery at checkout</small>`;
  }
}

function injectCheckoutModal() {
  document.querySelector(".checkout-modal")?.remove();

  const modal = document.createElement("div");
  modal.className = "checkout-modal";
  modal.innerHTML = `
    <div class="checkout-overlay"></div>
    <div class="checkout-box">
      <button type="button" class="checkout-close" aria-label="Close checkout"><i class="fas fa-times"></i></button>
      <h3>Complete Your Order</h3>
      <p class="checkout-subtitle">Enter your details. We will confirm your order by phone or WhatsApp.</p>
      <form id="checkout-form" novalidate>
        <div class="form-group">
          <label for="checkout-name">Full Name *</label>
          <input type="text" id="checkout-name" name="name" required placeholder="Your full name" autocomplete="name">
        </div>
        <div class="form-group">
          <label for="checkout-country">Country *</label>
          <select id="checkout-country" name="country" required>${phoneCountryOptions("PK")}</select>
        </div>
        <div class="form-group">
          <label for="checkout-phone">Phone Number *</label>
          <input type="tel" id="checkout-phone" name="phone" required inputmode="numeric" autocomplete="tel-national">
          <small id="phone-hint" class="field-hint"></small>
        </div>
        <div class="form-group">
          <label for="checkout-email">Email *</label>
          <input type="email" id="checkout-email" name="email" required placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label for="checkout-address">Address / City *</label>
          <textarea id="checkout-address" name="address" required placeholder="Full delivery address with city"></textarea>
        </div>
        <div class="form-group">
          <label for="checkout-notes">Order Notes</label>
          <textarea id="checkout-notes" name="notes" placeholder="Measurements, special instructions..."></textarea>
        </div>
        <div class="form-group">
          <label for="checkout-payment">Payment Method *</label>
          <select id="checkout-payment" name="payment_method" required>
            <option value="COD">Cash on Delivery (COD)</option>
            <option value="Online Payment">Online Payment (Easypaisa)</option>
          </select>
        </div>
        <div id="online-payment-info" class="online-payment-info" hidden>
          <p><strong>EasyPaisa</strong></p>
          <p>Account Name: <strong>${EASYPAYSA_NAME}</strong></p>
          <p>Number: <strong>${EASYPAYSA_NUMBER}</strong></p>
          <p>Amount to send: <strong class="easypaisa-amount">${formatPrice(0)}</strong></p>
          <p class="field-hint">Send payment for the order total above, then click Place Order. We will verify before dispatch.</p>
        </div>
        <div class="checkout-summary-block">
          <div class="checkout-line"><span>Subtotal</span><span id="checkout-subtotal">${formatPrice(0)}</span></div>
          <div class="checkout-line"><span>Delivery</span><span id="checkout-delivery">${formatPrice(DELIVERY_CHARGE)}</span></div>
          <div class="checkout-line"><span>Payment Method</span><span id="checkout-payment-method">COD</span></div>
          <div class="checkout-line checkout-line-total"><span>Total</span><strong id="checkout-total">${formatPrice(DELIVERY_CHARGE)}</strong></div>
          <p class="delivery-note">Delivery Rs. ${DELIVERY_CHARGE.toLocaleString()} · FREE on orders over ${formatPrice(FREE_DELIVERY_MIN)}</p>
        </div>
        <button type="submit" class="btn btn-primary checkout-submit" style="width:100%">
          <i class="fas fa-check"></i> Place Order
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  bindPhoneCountryField(
    modal.querySelector("#checkout-country"),
    modal.querySelector("#checkout-phone"),
    modal.querySelector("#phone-hint")
  );

  modal.querySelector("#checkout-payment")?.addEventListener("change", toggleOnlinePaymentInfo);
  modal.querySelector(".checkout-overlay")?.addEventListener("click", closeCheckout);
  modal.querySelector(".checkout-close")?.addEventListener("click", closeCheckout);
  modal.querySelector("#checkout-form")?.addEventListener("submit", submitOrder);

  modal.querySelectorAll("#checkout-phone, #checkout-email").forEach((input) => {
    input.addEventListener("input", () => clearFieldError(input));
  });
}

function openCheckout() {
  const cart = getCart();
  if (!cart.length) {
    showToast("Your cart is empty");
    return;
  }
  injectCheckoutModal();
  updateCheckoutTotals();
  toggleOnlinePaymentInfo();
  document.querySelector(".checkout-modal")?.classList.add("open");
  document.body.style.overflow = "hidden";
  document.querySelector(".cart-drawer")?.classList.remove("open");
  document.querySelector(".cart-overlay")?.classList.remove("open");
}

function closeCheckout() {
  document.querySelector(".checkout-modal")?.classList.remove("open");
  document.body.style.overflow = "";
}

function validateCheckoutForm(form) {
  let valid = true;
  const country = form.country.value;
  const phoneInput = form.phone;
  const emailInput = form.email;

  clearFieldError(phoneInput);
  clearFieldError(emailInput);

  const phoneResult = validatePhone(country, phoneInput.value);
  if (!phoneResult.valid) {
    showFieldError(phoneInput, phoneResult.message);
    valid = false;
  }

  const emailResult = validateEmail(emailInput.value, true);
  if (!emailResult.valid) {
    showFieldError(emailInput, emailResult.message);
    valid = false;
  }

  if (!form.name.value.trim()) {
    showToast("Please enter your full name");
    valid = false;
  }
  if (!form.address.value.trim()) {
    showToast("Please enter your delivery address");
    valid = false;
  }

  return valid ? { phoneResult, emailResult } : null;
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

  const validated = validateCheckoutForm(form);
  if (!validated) return;

  const subtotal = getCartSubtotal();
  const deliveryCharge = getDeliveryCharge(subtotal);
  const total = getOrderTotal(subtotal);
  const paymentMethod = form.payment_method.value;

  if (paymentMethod === "Online Payment") {
    const confirmed = confirm(
      `Have you sent ${formatPrice(total)} to Easypaisa ${EASYPAYSA_NUMBER} (${EASYPAYSA_NAME})?\n\nClick OK only after payment is sent.`
    );
    if (!confirmed) {
      showToast("Please complete Easypaisa payment first");
      return;
    }
  }

  const payload = {
    name: form.name.value.trim(),
    phone: validated.phoneResult.formatted,
    phone_country: form.country.value,
    email: validated.emailResult.email,
    address: form.address.value.trim(),
    notes: form.notes.value.trim(),
    payment_method: paymentMethod,
    subtotal,
    delivery_charge: deliveryCharge,
    total,
    items: cart.map(item => ({
      product_id: item.id,
      product_name: item.name,
      image: item.image,
      size: item.size,
      color: item.color,
      meters: item.isFabric ? item.meters : null,
      unit_price: item.unitPrice,
      quantity: item.isFabric ? 1 : item.qty,
      line_total: getLineTotal(item)
    }))
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
  } catch {
    showToast("Cannot reach server. Run: npm start in misri-cloth folder, then open http://localhost:3000");
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-check"></i> Place Order';
}

function initCartDrawer() {
  injectCheckoutModal();
  updateCartCount();

  document.addEventListener("cartUpdated", () => {
    updateCartCount();
    renderCartDrawer();
  });

  document.addEventListener("click", async e => {
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
      if (btn.disabled) return;
      const id = Number(btn.dataset.id);
      const product = getProductById(id);
      if (product && isFabricProduct(product)) {
        await addToCart(id, "4 Meter", product.colors[0], 1);
      } else {
        await addToCart(id);
      }
    }
  });
}
