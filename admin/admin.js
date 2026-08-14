/* MISRI CLOTH Admin Dashboard */
const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];
const CATEGORIES = [
  { value: "fabric", label: "Men's Fabric" },
  { value: "suits", label: "Suits" },
  { value: "shalwar-kameez", label: "Shalwar Kameez" },
  { value: "coats", label: "Coats" },
  { value: "waistcoats", label: "Waistcoats" }
];
const LOW_STOCK_THRESHOLD = 5;

function toggleAdminTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  
  const icon = document.querySelector(".admin-theme-toggle i");
  if (icon) {
    icon.className = newTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
  }
}

let adminPassword = sessionStorage.getItem("misri_admin_pw") || "";
let adminName = sessionStorage.getItem("misri_admin_name") || "Admin";
let currentSection = "dashboard";
let orderFilter = "";
let orderSearch = "";
let orderStatusFilter = "";
let reportPeriod = "month";
let productImages = [];
let eventSource = null;
let unreadCount = 0;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showLoading(show) {
  $("#loading-overlay")?.classList.toggle("show", show);
}

function showToast(msg, type = "") {
  let t = $("#admin-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "admin-toast";
    t.className = "admin-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = "admin-toast show" + (type ? ` ${type}` : "");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3500);
}

function apiUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("password", adminPassword);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}

async function apiFetch(path, options = {}) {
  const method = options.method || "GET";
  let url = path.startsWith("/") ? path : `/api/admin/${path}`;

  if (method === "GET") {
    url = apiUrl(url, options.params || {});
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }

  url = apiUrl(url);
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body ? JSON.stringify({ ...JSON.parse(options.body), adminName }) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function fmtDate(d) {
  return new Date(d).toLocaleString();
}

function fmtMoney(n) {
  return "Rs. " + Number(n || 0).toLocaleString();
}

function statusBadge(status) {
  return `<span class="status-badge status-${esc(status)}">${esc(status)}</span>`;
}

/* ── Auth ── */
async function login() {
  adminPassword = $("#password").value;
  adminName = $("#admin-name")?.value?.trim() || "Admin";
  showLoading(true);
  try {
    const ok = await loadDashboard();
    if (ok) {
      sessionStorage.setItem("misri_admin_pw", adminPassword);
      sessionStorage.setItem("misri_admin_name", adminName);
      $("#login-view").style.display = "none";
      $("#app").style.display = "flex";
      document.body.classList.add("admin-app");
      await fetch(apiUrl("/api/admin/login-log"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "Admin Login", adminName, password: adminPassword })
      });
      connectSSE();
      showToast("Welcome back!", "success");
    } else {
      $("#login-error").style.display = "block";
      $("#login-error").textContent = "Wrong password or server not running";
    }
  } catch {
    $("#login-error").style.display = "block";
    $("#login-error").textContent = "Could not connect to server";
  }
  showLoading(false);
}

async function logout() {
  try {
    await fetch(apiUrl("/api/admin/login-log"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "Admin Logout", adminName, password: adminPassword })
    });
  } catch { /* ignore */ }
  eventSource?.close();
  sessionStorage.removeItem("misri_admin_pw");
  sessionStorage.removeItem("misri_admin_name");
  location.reload();
}

/* ── Navigation ── */
function showSection(name) {
  currentSection = name;
  const titles = {
    dashboard: "Dashboard",
    products: "Products",
    orders: "Orders",
    customers: "Customers",
    reports: "Reports",
    activity: "Activity Log",
    messages: "Messages"
  };
  const titleEl = $("#page-title");
  if (titleEl) titleEl.textContent = titles[name] || "Dashboard";
  $$(".admin-section").forEach((s) => s.classList.remove("active"));
  $(`#section-${name}`)?.classList.add("active");
  $$(".admin-nav button").forEach((b) => b.classList.toggle("active", b.dataset.section === name));

  const loaders = {
    dashboard: loadDashboard,
    products: loadProducts,
    orders: loadOrders,
    customers: loadCustomers,
    reports: loadReports,
    activity: loadActivity,
    messages: loadMessages
  };
  loaders[name]?.();
}

/* ── SSE Notifications ── */
function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(apiUrl("/api/admin/events"));
  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "notification") {
        handleNewNotification(data.notification);
      }
    } catch { /* ignore */ }
  };
  loadNotifications();
}

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* ignore */ }
}

function showOrderPopup(notif) {
  const el = document.createElement("div");
  el.className = "order-popup";
  el.innerHTML = `<strong>${esc(notif.title)}</strong><p>${esc(notif.message)}</p>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

function handleNewNotification(notif) {
  unreadCount++;
  updateNotifBadge();
  playNotifSound();
  showOrderPopup(notif);
  if (currentSection === "orders") loadOrders();
  if (currentSection === "dashboard") loadDashboard();
}

async function loadNotifications() {
  try {
    const data = await apiFetch("/api/admin/notifications", { params: { unread: "true" } });
    unreadCount = (data.notifications || []).length;
    updateNotifBadge();
  } catch { /* ignore */ }
}

function updateNotifBadge() {
  const badge = $("#notif-badge");
  if (!badge) return;
  badge.textContent = unreadCount;
  badge.style.display = unreadCount > 0 ? "flex" : "none";
}

async function markAllNotificationsRead() {
  try {
    await apiFetch("/api/admin/notifications/read", { method: "POST", body: "{}" });
    unreadCount = 0;
    updateNotifBadge();
    showToast("Notifications marked as read", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* ── Dashboard ── */
async function loadDashboard() {
  try {
    const [statsRes, healthRes] = await Promise.all([
      apiFetch("/api/admin/stats"),
      fetch("/api/health").then((r) => r.json()).catch(() => null)
    ]);
    renderStorage(healthRes);
    renderStats(statsRes.stats);
    return true;
  } catch {
    return false;
  }
}

function renderStorage(health) {
  const el = $("#storage-status");
  if (!el || !health) return;
  if (health.persistent) {
    el.className = "storage-badge ok";
    el.textContent = "Storage: PostgreSQL (orders saved permanently)";
  } else {
    el.className = "storage-badge warn";
    el.textContent = health.warning || "Storage: temporary — add DATABASE_URL on Render";
  }
}

function renderStats(s) {
  if (!s) return;
  $("#stats-grid").innerHTML = `
    <div class="stat-card"><div class="label">Total Orders</div><div class="value">${s.totalOrders}</div></div>
    <div class="stat-card"><div class="label">Orders Today</div><div class="value">${s.ordersToday}</div></div>
    <div class="stat-card"><div class="label">This Week</div><div class="value">${s.ordersWeek}</div></div>
    <div class="stat-card"><div class="label">This Month</div><div class="value">${s.ordersMonth}</div></div>
    <div class="stat-card"><div class="label">This Year</div><div class="value">${s.ordersYear}</div></div>
    <div class="stat-card"><div class="label">Total Revenue</div><div class="value">${fmtMoney(s.totalRevenue)}</div></div>
    <div class="stat-card"><div class="label">Monthly Revenue</div><div class="value">${fmtMoney(s.monthlyRevenue)}</div></div>
    <div class="stat-card"><div class="label">Total Products</div><div class="value">${s.totalProducts}</div></div>
    <div class="stat-card warn"><div class="label">Low Stock</div><div class="value">${s.lowStockProducts}</div></div>
    <div class="stat-card danger"><div class="label">Out of Stock</div><div class="value">${s.outOfStockProducts}</div></div>
  `;

  const alerts = [];
  (s.lowStockList || []).forEach((p) => alerts.push(`<li class="stock-low">${esc(p.name)} — ${p.stockQuantity} left</li>`));
  (s.outOfStockList || []).forEach((p) => alerts.push(`<li class="stock-out">${esc(p.name)} — Out of stock</li>`));
  $("#stock-alerts").innerHTML = alerts.length
    ? `<ul style="margin:0;padding-left:20px">${alerts.join("")}</ul>`
    : `<p class="empty-state" style="padding:12px">All products stocked adequately.</p>`;
}

/* ── Products ── */
async function loadProducts() {
  showLoading(true);
  try {
    const data = await apiFetch("/api/admin/products");
    renderProductsTable(data.products || []);
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function renderProductsTable(products) {
  if (!products.length) {
    $("#products-table").innerHTML = `<p class="empty-state">No products yet. Add your first product.</p>`;
    return;
  }
  const rows = products.map((p) => {
    const stockClass = p.stockQuantity <= 0 ? "stock-out" : p.stockQuantity <= LOW_STOCK_THRESHOLD ? "stock-low" : "";
    const stockWarning = p.stockQuantity <= LOW_STOCK_THRESHOLD && p.stockQuantity > 0 ? `⚠️` : "";
    return `<tr>
      <td><img src="${esc(p.image)}" class="product-thumb" alt=""></td>
      <td><strong>${esc(p.name)}</strong><br><small>${esc(p.sku || "—")}</small></td>
      <td>${esc(p.category)}</td>
      <td>${fmtMoney(p.price)}</td>
      <td class="${stockClass}">
        <div class="stock-control">
          <button onclick="adjustStock(${p.id}, -1)">−</button>
          <span>${p.stockQuantity}${stockWarning}</span>
          <button onclick="adjustStock(${p.id}, 1)">+</button>
        </div>
      </td>
      <td>${statusBadge(p.status)} ${p.isVisible ? "" : '<span class="status-badge status-inactive">Hidden</span>'}</td>
      <td>${p.featured ? "★" : "—"}</td>
      <td>
        <div class="action-btns">
          <button onclick="editProduct(${p.id})">Edit</button>
          <button onclick="toggleProductVisibility(${p.id}, ${p.isVisible})">${p.isVisible ? "Hide" : "Show"}</button>
          <button onclick="duplicateProduct(${p.id})">Duplicate</button>
          <button onclick="deleteProduct(${p.id})">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join("");
  $("#products-table").innerHTML = `
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Image</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Featured</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

async function adjustStock(productId, delta) {
  try {
    const data = await apiFetch(`/api/admin/products/${productId}/stock`, {
      method: "POST",
      body: JSON.stringify({ delta, adminName, reason: "Manual stock adjustment from admin panel" })
    });
    if (data.success) {
      showToast(`Stock updated: ${delta > 0 ? '+' : ''}${delta} units`);
      loadProducts();
    } else {
      showToast(data.message, "error");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

function openProductModal(product = null) {
  productImages = product ? [...(product.images || [])] : [];
  if (product?.image && !productImages.includes(product.image)) productImages.unshift(product.image);

  $("#product-modal-title").textContent = product ? "Edit Product" : "Add Product";
  $("#product-form").dataset.id = product?.id || "";
  $("#pf-name").value = product?.name || "";
  $("#pf-desc").value = product?.description || "";
  $("#pf-price").value = product?.price || "";
  $("#pf-original").value = product?.originalPrice || "";
  $("#pf-category").value = product?.category || "fabric";
  $("#pf-sku").value = product?.sku || "";
  $("#pf-stock").value = product?.stockQuantity ?? 0;
  $("#pf-status").value = product?.status || "active";
  $("#pf-badge").value = product?.badge || "";
  $("#pf-rating").value = product?.rating ?? 4.5;
  $("#pf-reviews").value = product?.reviews ?? 0;
  $("#pf-sizes").value = (product?.sizes || ["Custom Measurement"]).join(", ");
  $("#pf-colors").value = (product?.colors || []).join(", ");
  $("#pf-ref-meters").value = product?.referenceMeters || "";
  $("#pf-featured").checked = Boolean(product?.featured);
  $("#pf-new").checked = Boolean(product?.new);
  $("#pf-visible").checked = product ? product.isVisible !== false : true;
  renderImagePreviews();
  $("#product-modal").classList.add("open");
}

function renderImagePreviews() {
  $("#image-previews").innerHTML = productImages.map((url, i) => `
    <div class="preview-item">
      <img src="${esc(url)}" alt="">
      <button type="button" onclick="removeProductImage(${i})">×</button>
    </div>`).join("");
}

function removeProductImage(idx) {
  productImages.splice(idx, 1);
  renderImagePreviews();
}

async function uploadImages(files) {
  if (!files?.length) return;
  const fd = new FormData();
  for (const f of files) fd.append("images", f);
  showLoading(true);
  try {
    const res = await fetch(apiUrl("/api/admin/upload"), { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    productImages.push(...data.urls);
    renderImagePreviews();
    showToast("Images uploaded", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function setupUploadZone() {
  const zone = $("#upload-zone");
  if (!zone || zone._bound) return;
  zone._bound = true;
  zone.addEventListener("click", () => $("#image-file-input").click());
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("dragover"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    uploadImages(e.dataTransfer.files);
  });
  $("#image-file-input")?.addEventListener("change", (e) => uploadImages(e.target.files));
}

async function saveProductForm(e) {
  e.preventDefault();
  const id = $("#product-form").dataset.id;
  const payload = {
    name: $("#pf-name").value.trim(),
    description: $("#pf-desc").value.trim(),
    price: Number($("#pf-price").value),
    originalPrice: $("#pf-original").value ? Number($("#pf-original").value) : null,
    category: $("#pf-category").value,
    sku: $("#pf-sku").value.trim(),
    stockQuantity: Number($("#pf-stock").value),
    status: $("#pf-status").value,
    badge: $("#pf-badge").value || null,
    rating: Number($("#pf-rating").value),
    reviews: Number($("#pf-reviews").value),
    sizes: $("#pf-sizes").value.split(",").map((s) => s.trim()).filter(Boolean),
    colors: $("#pf-colors").value.split(",").map((s) => s.trim()).filter(Boolean),
    referenceMeters: $("#pf-ref-meters").value ? Number($("#pf-ref-meters").value) : null,
    featured: $("#pf-featured").checked,
    new: $("#pf-new").checked,
    isVisible: $("#pf-visible").checked,
    image: productImages[0] || "",
    images: productImages
  };

  if (!payload.name || !payload.price) {
    showToast("Name and price are required", "error");
    return;
  }

  showLoading(true);
  try {
    if (id) {
      await apiFetch(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Product updated", "success");
    } else {
      await apiFetch("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
      showToast("Product added", "success");
    }
    closeModal("#product-modal");
    loadProducts();
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

async function editProduct(id) {
  showLoading(true);
  try {
    const data = await apiFetch("/api/admin/products");
    const product = (data.products || []).find((p) => p.id === id);
    if (product) openProductModal(product);
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

async function toggleProductVisibility(id, currentlyVisible) {
  showLoading(true);
  try {
    const data = await apiFetch("/api/admin/products");
    const product = (data.products || []).find((p) => p.id === id);
    if (!product) return;
    product.isVisible = !currentlyVisible;
    await apiFetch(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(product) });
    showToast(currentlyVisible ? "Product hidden" : "Product visible", "success");
    loadProducts();
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

async function duplicateProduct(id) {
  showLoading(true);
  try {
    await apiFetch(`/api/admin/products/${id}/duplicate`, { method: "POST", body: "{}" });
    showToast("Product duplicated", "success");
    loadProducts();
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

async function deleteProduct(id) {
  if (!confirm("Delete this product? It will be archived and hidden from the store.")) return;
  showLoading(true);
  try {
    const res = await fetch(apiUrl(`/api/admin/products/${id}`), { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Delete failed");
    showToast("Product deleted", "success");
    loadProducts();
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

/* ── Orders ── */
function setOrderFilter(filter) {
  orderFilter = filter;
  $$(".filter-pills button").forEach((b) => b.classList.toggle("active", b.dataset.filter === filter));
  loadOrders();
}

async function loadOrders() {
  showLoading(true);
  try {
    const params = { filter: orderFilter, search: orderSearch, status: orderStatusFilter };
    if (orderFilter === "custom") {
      params.from = $("#order-from")?.value;
      params.to = $("#order-to")?.value;
    }
    const data = await apiFetch("/api/admin/orders", { params });
    renderOrdersTable(data.orders || []);
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function renderOrdersTable(orders) {
  $("#order-count").textContent = orders.length;
  if (!orders.length) {
    $("#orders-table").innerHTML = `<p class="empty-state">No orders match your filters.</p>`;
    return;
  }
  
  // Apply search filter if searching (including color search)
  let filteredOrders = orders;
  if (orderSearch) {
    const searchLower = orderSearch.toLowerCase();
    filteredOrders = orders.filter(o => {
      const itemsText = (o.items || []).map(i => 
        `${i.product_name} ${i.color || ''} ${i.size || ''}`
      ).join(' ').toLowerCase();
      const searchableText = `${o.order_ref} ${o.customer_name} ${o.customer_phone} ${itemsText}`.toLowerCase();
      return searchableText.includes(searchLower);
    });
  }
  
  if (filteredOrders.length === 0) {
    $("#orders-table").innerHTML = `<p class="empty-state">No orders match your search criteria.</p>`;
    return;
  }
  
  const rows = filteredOrders.map((o) => {
    const items = (o.items || []).map((i) => {
      const colorInfo = i.color ? `<span class="item-color">Color: ${esc(i.color)}</span>` : '';
      const sizeInfo = i.size ? `<span class="item-size">Size: ${esc(i.size)}</span>` : '';
      const itemDetails = [colorInfo, sizeInfo].filter(Boolean).join(' · ');
      const quantityInfo = i.meters ? `${i.meters}m × ${i.quantity || 1}` : `×${i.quantity}`;
      return `${esc(i.product_name)} ${itemDetails ? `(${itemDetails})` : ''} ${quantityInfo}`;
    }).join("<br>");
    const statusOpts = ORDER_STATUSES.map((s) =>
      `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`
    ).join("");
    const paymentOpts = PAYMENT_STATUSES.map((s) =>
      `<option value="${s}" ${(o.payment_status || "pending") === s ? "selected" : ""}>${s}</option>`
    ).join("");
    return `<tr>
      <td><strong>${esc(o.order_ref)}</strong><div class="items-list">${items}</div></td>
      <td>${esc(o.customer_name)}<br><a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a><br><small>${esc(o.customer_email)}</small></td>
      <td>${esc(o.customer_address)}</td>
      <td>${fmtMoney(o.total_amount)}</td>
      <td>${esc(o.payment_method || "COD")}</td>
      <td><select onchange="updatePaymentStatus(${o.id}, this.value)" style="padding:4px;font-size:0.82rem">${paymentOpts}</select></td>
      <td><select onchange="updateOrderStatus(${o.id}, this.value)" style="padding:4px;font-size:0.82rem">${statusOpts}</select></td>
      <td>${fmtDate(o.created_at)}</td>
      <td>
        <div class="action-btns">
          <button onclick="viewOrderDetails(${o.id})">View</button>
          <button class="btn-danger-sm" style="padding:4px 8px;font-size:0.75rem" onclick="deleteOrder(${o.id}, '${esc(o.order_ref)}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join("");
  
  $("#orders-table").innerHTML = `
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Order / Items</th><th>Customer</th><th>Address</th><th>Total</th><th>Payment Method</th><th>Payment Status</th><th>Order Status</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

async function updateOrderStatus(orderId, status) {
  showLoading(true);
  try {
    await apiFetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    showToast(`Order status updated to ${status}`, "success");
    loadOrders();
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

async function updatePaymentStatus(orderId, paymentStatus) {
  showLoading(true);
  try {
    await apiFetch(`/api/admin/orders/${orderId}/payment-status`, {
      method: "PATCH",
      body: JSON.stringify({ paymentStatus })
    });
    showToast(`Payment status updated to ${paymentStatus}`, "success");
    loadOrders();
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

async function deleteOrder(orderId, orderRef) {
  if (!confirm(`Delete order ${orderRef}? This cannot be undone.`)) return;
  showLoading(true);
  try {
    const res = await fetch(apiUrl(`/api/admin/orders/${orderId}`), { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Delete failed");
    showToast(`Order ${orderRef} deleted`, "success");
    loadOrders();
    if (currentSection === "dashboard") loadDashboard();
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

async function viewOrderDetails(orderId) {
  showLoading(true);
  try {
    const data = await apiFetch("/api/admin/orders");
    const order = (data.orders || []).find(o => o.id === orderId);
    if (!order) {
      showToast("Order not found", "error");
      showLoading(false);
      return;
    }
    
    const itemsHTML = (order.items || []).map(item => {
      const colorBadge = item.color ? `<span class="color-badge">${esc(item.color)}</span>` : '';
      const sizeBadge = item.size ? `<span class="size-badge">${esc(item.size)}</span>` : '';
      const quantityInfo = item.meters ? `${item.meters}m × ${item.quantity || 1}` : `×${item.quantity}`;
      const itemImage = item.image || 'https://via.placeholder.com/60?text=No+Image';
      
      return `
        <div class="order-item-row">
          <img src="${esc(itemImage)}" alt="${esc(item.product_name)}" class="order-item-thumb">
          <div class="order-item-details">
            <div class="order-item-name">${esc(item.product_name)}</div>
            <div class="order-item-attributes">
              ${colorBadge}
              ${sizeBadge}
              <span class="quantity-badge">${quantityInfo}</span>
            </div>
            <div class="order-item-price">${fmtMoney(item.unit_price)} each</div>
          </div>
          <div class="order-item-total">${fmtMoney(item.line_total)}</div>
        </div>
      `;
    }).join('');
    
    const modalHTML = `
      <div class="admin-modal-overlay open" id="order-details-modal">
        <div class="admin-modal wide">
          <button class="modal-close" onclick="closeOrderDetailsModal()">×</button>
          <h3>Order Details - ${esc(order.order_ref)}</h3>
          
          <div class="order-details-grid">
            <div class="order-details-section">
              <h4>Customer Information</h4>
              <div class="order-info-row">
                <span class="info-label">Name:</span>
                <span class="info-value">${esc(order.customer_name)}</span>
              </div>
              <div class="order-info-row">
                <span class="info-label">Phone:</span>
                <span class="info-value"><a href="tel:${esc(order.customer_phone)}">${esc(order.customer_phone)}</a></span>
              </div>
              <div class="order-info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${esc(order.customer_email || 'N/A')}</span>
              </div>
              <div class="order-info-row">
                <span class="info-label">Address:</span>
                <span class="info-value">${esc(order.customer_address)}</span>
              </div>
            </div>
            
            <div class="order-details-section">
              <h4>Order Information</h4>
              <div class="order-info-row">
                <span class="info-label">Date:</span>
                <span class="info-value">${fmtDate(order.created_at)}</span>
              </div>
              <div class="order-info-row">
                <span class="info-label">Payment Method:</span>
                <span class="info-value">${esc(order.payment_method || 'COD')}</span>
              </div>
              <div class="order-info-row">
                <span class="info-label">Payment Status:</span>
                <span class="info-value">${esc(order.payment_status || 'pending')}</span>
              </div>
              <div class="order-info-row">
                <span class="info-label">Order Status:</span>
                <span class="info-value">${esc(order.status)}</span>
              </div>
              <div class="order-info-row">
                <span class="info-label">Total:</span>
                <span class="info-value total-amount">${fmtMoney(order.total_amount)}</span>
              </div>
            </div>
          </div>
          
          <div class="order-items-section">
            <h4>Order Items</h4>
            <div class="order-items-list">
              ${itemsHTML}
            </div>
          </div>
          
          ${order.notes ? `
          <div class="order-notes-section">
            <h4>Notes</h4>
            <p>${esc(order.notes)}</p>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function closeOrderDetailsModal() {
  const modal = document.getElementById('order-details-modal');
  if (modal) {
    modal.remove();
  }
}

function exportOrders(format) {
  const params = { format, filter: orderFilter };
  if (orderFilter === "custom") {
    params.from = $("#order-from")?.value;
    params.to = $("#order-to")?.value;
  }
  window.open(apiUrl("/api/admin/export/orders", params), "_blank");
}

function exportProducts(format) {
  window.open(apiUrl("/api/admin/export/products", { format }), "_blank");
}

function exportRevenue() {
  window.open(apiUrl("/api/admin/export/revenue", { period: reportPeriod }), "_blank");
}

/* ── Customers ── */
async function loadCustomers() {
  showLoading(true);
  try {
    const data = await apiFetch("/api/admin/customers");
    renderCustomers(data.customers || []);
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function renderCustomers(customers) {
  if (!customers.length) {
    $("#customers-table").innerHTML = `<p class="empty-state">No customer records yet.</p>`;
    return;
  }
  const rows = customers.map((c) => `<tr>
    <td>${esc(c.name)}</td>
    <td><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></td>
    <td>${esc(c.email || "—")}</td>
    <td>${c.totalOrders}</td>
    <td>${fmtMoney(c.totalSpending)}</td>
    <td>${fmtDate(c.lastOrderDate)}</td>
  </tr>`).join("");
  $("#customers-table").innerHTML = `
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Orders</th><th>Spent</th><th>Last Order</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

/* ── Reports ── */
async function loadReports() {
  showLoading(true);
  try {
    const data = await apiFetch("/api/admin/reports", { params: { period: reportPeriod } });
    renderReport(data.report);
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function setReportPeriod(period) {
  reportPeriod = period;
  $$(".report-pills button").forEach((b) => b.classList.toggle("active", b.dataset.period === period));
  loadReports();
}

function renderReport(r) {
  if (!r) return;
  $("#report-summary").innerHTML = `
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><div class="label">Period</div><div class="value" style="font-size:1.1rem;text-transform:capitalize">${esc(r.period)}</div></div>
      <div class="stat-card"><div class="label">Orders</div><div class="value">${r.orderCount}</div></div>
      <div class="stat-card"><div class="label">Revenue</div><div class="value">${fmtMoney(r.revenue)}</div></div>
    </div>`;

  const best = (r.bestSelling || []).map((p, i) => `<tr>
    <td>${i + 1}</td><td>${esc(p.name)}</td><td>${p.quantity}</td><td>${fmtMoney(p.revenue)}</td>
  </tr>`).join("");
  $("#best-selling-table").innerHTML = best ? `
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>#</th><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
      <tbody>${best}</tbody>
    </table></div>` : `<p class="empty-state">No sales data for this period.</p>`;
}

/* ── Activity Log ── */
async function loadActivity() {
  showLoading(true);
  try {
    const data = await apiFetch("/api/admin/activity");
    renderActivity(data.logs || []);
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function renderActivity(logs) {
  if (!logs.length) {
    $("#activity-table").innerHTML = `<p class="empty-state">No activity recorded yet.</p>`;
    return;
  }
  const rows = logs.map((l) => `<tr>
    <td>${fmtDate(l.createdAt)}</td>
    <td>${esc(l.adminName)}</td>
    <td><strong>${esc(l.action)}</strong></td>
    <td>${esc(l.details)}</td>
  </tr>`).join("");
  $("#activity-table").innerHTML = `
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Date & Time</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

/* ── Messages (preserved from original) ── */
async function loadMessages() {
  showLoading(true);
  try {
    const res = await fetch(apiUrl("/api/messages"));
    const data = await res.json();
    renderMessages(data.messages || []);
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function renderMessages(msgs) {
  $("#msg-count").textContent = msgs.length;
  if (!msgs.length) {
    $("#messages-list").innerHTML = `<p class="empty-state">No messages yet.</p>`;
    return;
  }
  $("#messages-list").innerHTML = msgs.map((m) => `
    <div class="msg-box">
      <strong>${esc(m.first_name)} ${esc(m.last_name)}</strong>
      <div class="msg-meta">${esc(m.email)} · ${esc(m.subject)} · ${fmtDate(m.created_at)}</div>
      <p>${esc(m.message)}</p>
    </div>`).join("");
}

/* ── Modal helpers ── */
function closeModal(sel) {
  $(sel)?.classList.remove("open");
}

function initModals() {
  $$(".admin-modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });
  $$(".modal-close").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest(".admin-modal-overlay")?.classList.remove("open"));
  });
}

/* ── Init ── */
document.addEventListener("DOMContentLoaded", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const icon = document.querySelector(".admin-theme-toggle i");
  if (icon) {
    icon.className = currentTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
  }
  
  initModals();
  setupUploadZone();
  $("#product-form")?.addEventListener("submit", saveProductForm);

  CATEGORIES.forEach((c) => {
    $("#pf-category")?.insertAdjacentHTML("beforeend", `<option value="${c.value}">${c.label}</option>`);
  });

  $("#order-search")?.addEventListener("input", (e) => {
    orderSearch = e.target.value;
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(loadOrders, 300);
  });

  $("#order-status-filter")?.addEventListener("change", (e) => {
    orderStatusFilter = e.target.value;
    loadOrders();
  });

  if (adminPassword) {
    $("#login-view").style.display = "none";
    $("#app").style.display = "flex";
    document.body.classList.add("admin-app");
    loadDashboard().then((ok) => {
      if (ok) connectSSE();
      else {
        sessionStorage.removeItem("misri_admin_pw");
        location.reload();
      }
    });
  }
});
