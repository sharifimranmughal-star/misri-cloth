/* MISRI CLOTH Admin Dashboard */
const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];
const CATEGORIES = [
  { value: "fabric", label: "Collections — Fabric" },
  { value: "suits", label: "Stitching — Suits (2, 3 & 4 Piece)" },
  { value: "shalwar-kameez", label: "Stitching — Shalwar Kameez & Kurtas" },
  { value: "coats", label: "Stitching — Coats & Blazers" },
  { value: "prince-coat", label: "Stitching — Prince Coat" },
  { value: "waistcoats", label: "Stitching — Waistcoats" }
];
const LOW_STOCK_THRESHOLD = 5;
const TAILORING_LABELS = {
  "shalwar-kameez": "Shalwar Qameez",
  suits: "Suit",
  "prince-coat": "Prince Coat",
  waistcoats: "Waistcoat",
  coats: "Coat / Blazer"
};
let MEASUREMENT_SCHEMA = null;

async function loadMeasurementSchemaAdmin() {
  if (MEASUREMENT_SCHEMA) return MEASUREMENT_SCHEMA;
  try {
    const res = await fetch("/data/measurement-fields.json");
    MEASUREMENT_SCHEMA = res.ok ? await res.json() : {};
  } catch {
    MEASUREMENT_SCHEMA = {};
  }
  return MEASUREMENT_SCHEMA;
}

function renderMeasurementsHTML(typeId, measurements) {
  if (!measurements || typeof measurements !== "object") return "";
  const fields = MEASUREMENT_SCHEMA?.[typeId]?.fields || [];
  const rows = fields.map((field) => {
    const value = measurements[field.key];
    if (value === undefined || value === null || value === "") return "";
    const display = field.type === "text" ? value : `${value}${field.unit ? ` ${field.unit}` : ""}`;
    return `<div class="measurement-row"><span>${esc(field.label)}</span><strong>${esc(String(display))}</strong></div>`;
  }).filter(Boolean).join("");
  if (!rows) return "";
  return `
    <div class="order-measurements-block">
      <div class="order-measurements-title">📏 ${esc(TAILORING_LABELS[typeId] || typeId)} Measurements</div>
      <div class="order-measurements-grid">${rows}</div>
    </div>`;
}

function renderMeasurementsSummary(typeId, measurements) {
  if (!measurements || typeof measurements !== "object") return "";
  const fields = MEASUREMENT_SCHEMA?.[typeId]?.fields || [];
  const parts = fields
    .filter((field) => measurements[field.key] !== undefined && measurements[field.key] !== "")
    .slice(0, 3)
    .map((field) => {
      const value = measurements[field.key];
      const display = field.type === "text" ? value : `${value}${field.unit || ""}`;
      return `${field.label}: ${display}`;
    });
  if (!parts.length) return "";
  return `<br><small class="item-measurements">📏 ${esc(parts.join(" · "))}${Object.keys(measurements).length > 3 ? " …" : ""}</small>`;
}

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
    messages: "Messages",
    categories: "Categories",
    tailoring: "Tailoring"
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
    messages: loadMessages,
    categories: loadCategoriesSection,
    tailoring: loadTailoringSection
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
    const [data] = await Promise.all([apiFetch("/api/admin/products"), refreshAdminCategories()]);
    renderProductsTable(data.products || []);
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function renderProductStockCell(p) {
  const colors = Array.isArray(p.colors) ? p.colors.filter(Boolean) : [];
  const colorStock = p.colorStock || {};

  if (colors.length) {
    return colors.map((color) => {
      const stock = colorStock[color] != null ? Number(colorStock[color]) || 0 : 0;
      const stockClass = stock <= 0 ? "stock-out" : stock <= LOW_STOCK_THRESHOLD ? "stock-low" : "";
      const colorArg = JSON.stringify(color);
      return `<div class="stock-control color-stock-control ${stockClass}">
        <span class="color-stock-label">${esc(color)}</span>
        <button onclick='adjustStock(${p.id}, -1, ${colorArg})'>−</button>
        <span>${stock}</span>
        <button onclick='adjustStock(${p.id}, 1, ${colorArg})'>+</button>
      </div>`;
    }).join("");
  }

  const stockClass = p.stockQuantity <= 0 ? "stock-out" : p.stockQuantity <= LOW_STOCK_THRESHOLD ? "stock-low" : "";
  const stockWarning = p.stockQuantity <= LOW_STOCK_THRESHOLD && p.stockQuantity > 0 ? `⚠️` : "";
  return `<div class="stock-control ${stockClass}">
    <button onclick="adjustStock(${p.id}, -1)">−</button>
    <span>${p.stockQuantity}${stockWarning}</span>
    <button onclick="adjustStock(${p.id}, 1)">+</button>
  </div>`;
}

// Keep expanded categories when stock or product actions refresh the inventory.
const productCategoryOpenState = new Map();
function renderProductsTable(products) {
  const host = $("#products-table");
  host.querySelectorAll('details[data-product-group]').forEach(group => {
    productCategoryOpenState.set(group.dataset.productGroup, group.open);
  });
  if (!products.length) {
    host.innerHTML = '<p class="empty-state">No products yet. Add your first product.</p>';
    return;
  }
  host.innerHTML = ['collections', 'stitching'].map(section => {
    const sectionProducts = products.filter(product => (product.category === 'fabric') === (section === 'collections'));
    const groups = (MisriCatalog.categories[section] || []).map(category => ({ id: category.id, name: category.name, products: [] }));
    const byId = new Map(groups.map(group => [group.id, group]));
    sectionProducts.forEach(product => {
      const id = section === 'collections' ? MisriCatalog.fabricType(product) : product.category;
      if (!byId.has(id)) {
        const group = { id, name: id || 'Unassigned', products: [] };
        byId.set(id, group); groups.push(group);
      }
      byId.get(id).products.push(product);
    });
    const firstPopulated = groups.find(group => group.products.length)?.id;
    const label = section === 'collections' ? 'Collections' : 'Stitching';
    return `<section class="product-category-section" aria-label="${label} products">
      <div class="product-category-section-heading"><h3>${label}</h3><span>${sectionProducts.length} product${sectionProducts.length === 1 ? '' : 's'}</span></div>
      ${groups.map(group => {
        const key = section + ':' + group.id;
        const open = productCategoryOpenState.has(key) ? productCategoryOpenState.get(key) : group.id === firstPopulated;
        return `<details class="product-category-group" data-product-group="${esc(key)}" ${open ? 'open' : ''}>
          <summary><span>${esc(group.name)}</span><span class="product-category-count">${group.products.length} product${group.products.length === 1 ? '' : 's'}</span></summary>
          ${productCategoryTableHTML(group.products)}
        </details>`;
      }).join('')}
    </section>`;
  }).join('');
}

function productCategoryTableHTML(products) {
  if (!products.length) {
    return `<p class="empty-state">No products in this category yet.</p>`;
  }
  const rows = products.map((p) => {
    const stockClass = p.stockQuantity <= 0 ? "stock-out" : p.stockQuantity <= LOW_STOCK_THRESHOLD ? "stock-low" : "";
    return `<tr>
      <td><img src="${esc(p.image)}" class="product-thumb" alt=""></td>
      <td><strong>${esc(p.name)}</strong><br><small>${esc(p.sku || "—")}</small></td>
      <td>${esc(p.category === "fabric" ? "Collections / " + MisriCatalog.fabricTypes[MisriCatalog.fabricType(p)] : "Stitching / " + (CATEGORIES.find(c => c.value === p.category)?.label.replace("Stitching — ", "") || p.category))}</td>
      <td>${p.category === "fabric" && p.stitchingEnabled ? `<span class="tailoring-badge">✂️ ${(p.stitchingTypes || []).map((id) => TAILORING_LABELS[id] || id).join(", ") || "On"}</span>` : (p.category === "fabric" ? "—" : esc([...MisriCatalog.garmentOptions(p).readyMadeSizes, ...(MisriCatalog.garmentOptions(p).customEnabled ? ["Custom Stitching"] : [])].join(", ")))}</td>
      <td>${fmtMoney(p.price)}</td>
      <td class="${stockClass}">${renderProductStockCell(p)}</td>
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
  return `
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Image</th><th>Product</th><th>Category</th><th>Stitching</th><th>Price</th><th>Stock</th><th>Status</th><th>Featured</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

async function adjustStock(productId, delta, color = null) {
  try {
    const payload = { delta, adminName, reason: "Manual stock adjustment from admin panel" };
    if (color) payload.color = color;

    const data = await apiFetch(`/api/admin/products/${productId}/stock`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (data.success) {
      const label = color ? `${color}: ` : "";
      showToast(`Stock updated: ${label}${delta > 0 ? "+" : ""}${delta}`);
      loadProducts();
    } else {
      showToast(data.message, "error");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

function getColorStockRowsData() {
  return Array.from($("#color-stock-rows")?.querySelectorAll(".color-stock-row") || []).map((row) => ({
    color: row.querySelector(".color-name")?.value.trim() || "",
    stock: Math.max(0, Number(row.querySelector(".color-stock")?.value) || 0)
  })).filter((row) => row.color);
}

function updateTotalStockField() {
  const colorRows = getColorStockRowsData();
  const stockInput = $("#pf-stock");
  if (!stockInput) return;

  if (colorRows.length) {
    stockInput.readOnly = true;
    stockInput.title = "Calculated from color stocks";
    stockInput.value = colorRows.reduce((sum, row) => sum + row.stock, 0);
  } else {
    stockInput.readOnly = false;
    stockInput.title = "";
  }
}

function renderColorStockRows(product = null) {
  const container = $("#color-stock-rows");
  if (!container) return;

  const colors = product?.colors || [];
  const colorStock = product?.colorStock || {};
  let rows = colors.map((color) => ({
    color,
    stock: colorStock[color] != null ? Number(colorStock[color]) || 0 : 0
  }));

  if (!rows.length) {
    container.innerHTML = '<p class="field-hint">Add colors to track stock per color. Products without colors use total stock only.</p>';
    const stockInput = $("#pf-stock");
    if (stockInput) {
      stockInput.readOnly = false;
      stockInput.value = product?.stockQuantity ?? 0;
    }
    return;
  }

  container.innerHTML = rows.map((row, index) => `
    <div class="color-stock-row" data-index="${index}">
      <input type="text" class="color-name" placeholder="Color name" value="${esc(row.color)}">
      <input type="number" class="color-stock" min="0" placeholder="Stock" value="${row.stock}">
      <button type="button" class="remove-color-row" aria-label="Remove color">×</button>
    </div>
  `).join("");

  container.querySelectorAll(".color-name, .color-stock").forEach((input) => {
    input.addEventListener("input", updateTotalStockField);
  });
  container.querySelectorAll(".remove-color-row").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest(".color-stock-row")?.remove();
      if (!container.querySelector(".color-stock-row")) {
        container.innerHTML = '<p class="field-hint">Add colors to track stock per color. Products without colors use total stock only.</p>';
      }
      updateTotalStockField();
    });
  });

  updateTotalStockField();
}

function addColorStockRow(color = "", stock = 0) {
  const container = $("#color-stock-rows");
  if (!container) return;

  if (container.querySelector(".field-hint")) {
    container.innerHTML = "";
  }

  const row = document.createElement("div");
  row.className = "color-stock-row";
  row.innerHTML = `
    <input type="text" class="color-name" placeholder="Color name" value="${esc(color)}">
    <input type="number" class="color-stock" min="0" placeholder="Stock" value="${stock}">
    <button type="button" class="remove-color-row" aria-label="Remove color">×</button>
  `;

  row.querySelectorAll(".color-name, .color-stock").forEach((input) => {
    input.addEventListener("input", updateTotalStockField);
  });
  row.querySelector(".remove-color-row")?.addEventListener("click", () => {
    row.remove();
    if (!container.querySelector(".color-stock-row")) {
      container.innerHTML = '<p class="field-hint">Add colors to track stock per color. Products without colors use total stock only.</p>';
    }
    updateTotalStockField();
  });

  container.appendChild(row);
  updateTotalStockField();
}

function setupColorStockRows() {
  $("#add-color-row")?.addEventListener("click", () => addColorStockRow());
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
  $("#pf-fabric-type").value = product ? MisriCatalog.fabricType(product) : (MisriCatalog.fabricTypes.other ? "other" : MisriCatalog.categories.collections[0]?.id || "");
  $("#pf-fabric-type-group").hidden = $("#pf-category").value !== "fabric";
  $("#pf-sku").value = product?.sku || "";
  $("#pf-stock").value = product?.stockQuantity ?? 0;
  $("#pf-status").value = product?.status || "active";
  $("#pf-badge").value = product?.badge || "";
  $("#pf-rating").value = product?.rating ?? 4.5;
  $("#pf-reviews").value = product?.reviews ?? 0;
  $("#pf-sizes").value = (product?.sizes || ["Custom Measurement"]).join(", ");
  renderColorStockRows(product);
  const refMeters = $("#pf-ref-meters");
  if (refMeters) refMeters.value = product?.referenceMeters || "";
  $("#pf-featured").checked = Boolean(product?.featured);
  $("#pf-new").checked = Boolean(product?.new);
  $("#pf-visible").checked = product ? product.isVisible !== false : true;
  renderProductStitchingFields(product);
  renderGarmentOptions(product);
  renderImagePreviews();
  $("#product-modal").classList.add("open");
}

function getTailoringTypeOptions() {
  if (tailoringTypes.length) return tailoringTypes;
  return Object.entries(TAILORING_LABELS).filter(([id]) => id !== "coats").map(([id, label]) => ({ id, label }));
}

function selectedStitchingTypesFrom(container) {
  return Array.from(container?.querySelectorAll("input[data-stitch-type]:checked") || []).map((el) => el.value);
}

function renderStitchingTypeChecks(container, selectedIds, enabled) {
  if (!container) return;
  const selected = new Set(selectedIds || []);
  const types = getTailoringTypeOptions();
  container.innerHTML = types.map((type) => `
    <label class="form-check stitching-type-check">
      <input type="checkbox" data-stitch-type value="${esc(type.id)}" ${selected.has(type.id) ? "checked" : ""} ${enabled ? "" : "disabled"}>
      ${esc(type.label)}
    </label>
  `).join("");
}

function renderProductStitchingFields(product = null) {
  const wrap = $("#pf-stitching-wrap");
  const checkbox = $("#pf-stitching");
  const typesBox = $("#pf-stitching-types");
  const category = $("#pf-category")?.value || product?.category || "fabric";
  const isFabric = category === "fabric";

  if (wrap) wrap.hidden = !isFabric;
  if (!isFabric) return;

  const enabled = product
    ? Boolean(product.stitchingEnabled)
    : true;
  const types = product?.stitchingTypes?.length
    ? product.stitchingTypes
    : getTailoringTypeOptions().map((type) => type.id);

  if (checkbox) checkbox.checked = enabled;
  renderStitchingTypeChecks(typesBox, types, enabled);
}

function toggleProductStitchingTypes() {
  const enabled = Boolean($("#pf-stitching")?.checked);
  $$("#pf-stitching-types input[data-stitch-type]").forEach((input) => {
    input.disabled = !enabled;
  });
}

function getProductFormStitching() {
  const isFabric = $("#pf-category")?.value === "fabric";
  if (!isFabric) {
    return { stitchingEnabled: false, stitchingTypes: [] };
  }
  const stitchingEnabled = Boolean($("#pf-stitching")?.checked);
  const stitchingTypes = selectedStitchingTypesFrom($("#pf-stitching-types"));
  return { stitchingEnabled, stitchingTypes };
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
  const colorRows = getColorStockRowsData();
  let colors = [];
  let colorStock = {};
  let stockQuantity = 0;

  if (colorRows.length) {
    colors = colorRows.map((row) => row.color);
    colorRows.forEach((row) => {
      colorStock[row.color] = row.stock;
    });
    stockQuantity = colorRows.reduce((sum, row) => sum + row.stock, 0);
  } else {
    stockQuantity = Math.max(0, Number($("#pf-stock").value) || 0);
  }

  const payload = {
    name: $("#pf-name").value.trim(),
    description: $("#pf-desc").value.trim(),
    price: Number($("#pf-price").value),
    originalPrice: $("#pf-original").value ? Number($("#pf-original").value) : null,
    category: $("#pf-category").value,
    fabricType: $("#pf-category").value === "fabric" ? $("#pf-fabric-type").value : null,
    sku: $("#pf-sku").value.trim(),
    stockQuantity,
    colorStock,
    status: $("#pf-status").value,
    badge: $("#pf-badge").value || null,
    rating: Number($("#pf-rating").value),
    reviews: Number($("#pf-reviews").value),
    sizes: $("#pf-sizes").value.split(",").map((s) => s.trim()).filter(Boolean),
    colors,
    referenceMeters: $("#pf-ref-meters")?.value ? Number($("#pf-ref-meters").value) : null,
    featured: $("#pf-featured").checked,
    new: $("#pf-new").checked,
    isVisible: $("#pf-visible").checked,
    image: productImages[0] || "",
    images: productImages,
    ...getProductFormStitching(),
    garmentOptions: $("#pf-category").value === "fabric" ? null : collectGarmentOptions()
  };

  if (payload.category !== "fabric") {
    const options = payload.garmentOptions;
    if (!options.customEnabled && !options.readyMadeSizes.length) {
      showToast("Select a ready-made size or enable custom stitching", "error");
      return;
    }
    payload.sizes = [...options.readyMadeSizes, ...(options.customEnabled ? ["Custom Stitching"] : [])];
  }
  if (!payload.name || !payload.price) {
    showToast("Name and price are required", "error");
    return;
  }

  if (payload.category === "fabric" && payload.stitchingEnabled && !payload.stitchingTypes.length) {
    showToast("Select at least one stitching type (Shalwar Qameez, Suit, Prince Coat, or Waistcoat)", "error");
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
    await loadMeasurementSchemaAdmin();
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
      const tailoringInfo = i.tailoring_enabled && i.tailoring_type
        ? `<br><small class="item-tailoring">✂️ ${esc(TAILORING_LABELS[i.tailoring_type] || i.tailoring_type)}</small>`
        : "";
      const measureInfo = i.tailoring_enabled && i.tailoring_measurements
        ? renderMeasurementsSummary(i.tailoring_type, i.tailoring_measurements)
        : "";
      return `${esc(i.product_name)} ${itemDetails ? `(${itemDetails})` : ''} ${quantityInfo}${tailoringInfo}${measureInfo}${renderOrderAddons(i)}`;
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
    await loadMeasurementSchemaAdmin();
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
      const tailoringBadge = item.tailoring_enabled && item.tailoring_type
        ? `<span class="tailoring-badge">✂️ ${esc(TAILORING_LABELS[item.tailoring_type] || item.tailoring_type)} ${item.meters ? `(+${fmtMoney(item.tailoring_charge || 0)})` : "(included)"}</span>`
        : '';
      const measurementsHTML = item.tailoring_enabled && item.tailoring_measurements
        ? renderMeasurementsHTML(item.tailoring_type, item.tailoring_measurements)
        : '';
      
      return `
        <div class="order-item-row">
          <img src="${esc(itemImage)}" alt="${esc(item.product_name)}" class="order-item-thumb">
          <div class="order-item-details">
            <div class="order-item-name">${esc(item.product_name)}</div>
            <div class="order-item-attributes">
              ${colorBadge}
              ${sizeBadge}
              <span class="quantity-badge">${quantityInfo}</span>
              ${tailoringBadge}
            </div>
            ${measurementsHTML}
            ${renderOrderAddons(item)}
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

/* ── Tailoring Charges ── */
let tailoringTypes = [];

async function loadTailoringSection() {
  showLoading(true);
  try {
    const [chargeData, productData] = await Promise.all([
      apiFetch("/api/admin/tailoring-charges"),
      apiFetch("/api/admin/products")
    ]);
    tailoringTypes = chargeData.types || [];
    renderStitchingAddonsEditor(chargeData.addons || []);
    const charges = chargeData.charges || {};
    const form = $("#tailoring-charges-form");
    if (form) {
      form.innerHTML = tailoringTypes.map((type) => `
        <div class="form-row tailoring-charge-row">
          <label for="charge-${esc(type.id)}">${esc(type.label)}</label>
          <div class="input-with-prefix">
            <span>Rs.</span>
            <input type="number" id="charge-${esc(type.id)}" min="0" step="100" value="${Number(charges[type.id] || 0)}">
          </div>
        </div>
      `).join("");
    }
    renderProductStitchingTable(productData.products || []);
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

function renderProductStitchingTable(products) {
  const host = $("#product-stitching-table");
  if (!host) return;

  const fabrics = products.filter((p) => p.category === "fabric");
  if (!fabrics.length) {
    host.innerHTML = `<p class="empty-state">No fabric products yet. Add a Men's Fabric product first.</p>`;
    return;
  }

  const types = getTailoringTypeOptions();
  const rows = fabrics.map((p) => {
    const enabled = Boolean(p.stitchingEnabled);
    const selected = new Set(p.stitchingTypes || []);
    const typeCells = types.map((type) => `
      <td>
        <label class="form-check stitching-type-check">
          <input type="checkbox" data-stitch-type="${esc(type.id)}" ${selected.has(type.id) ? "checked" : ""} ${enabled ? "" : "disabled"}>
          ${esc(type.label)}
        </label>
      </td>
    `).join("");
    return `<tr data-product-id="${p.id}">
      <td>
        <strong>${esc(p.name)}</strong><br>
        <small>${esc(p.sku || "—")}</small>
      </td>
      <td>
        <label class="form-check">
          <input type="checkbox" class="stitching-enabled" ${enabled ? "checked" : ""}>
          Offer stitching
        </label>
      </td>
      ${typeCells}
    </tr>`;
  }).join("");

  host.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table product-stitching-table">
        <thead>
          <tr>
            <th>Fabric</th>
            <th>Custom Stitching</th>
            ${types.map((type) => `<th>${esc(type.label)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  host.querySelectorAll(".stitching-enabled").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = checkbox.closest("tr");
      row.querySelectorAll("input[data-stitch-type]").forEach((input) => {
        input.disabled = !checkbox.checked;
        if (checkbox.checked && !row.querySelector("input[data-stitch-type]:checked")) {
          input.checked = true;
        }
      });
    });
  });
}

async function saveProductStitching() {
  const rows = Array.from($$("#product-stitching-table tbody tr"));
  const items = rows.map((row) => {
    const stitchingEnabled = Boolean(row.querySelector(".stitching-enabled")?.checked);
    const stitchingTypes = selectedStitchingTypesFrom(row);
    return {
      id: Number(row.dataset.productId),
      stitchingEnabled,
      stitchingTypes
    };
  });

  const missingTypes = items.find((item) => item.stitchingEnabled && !item.stitchingTypes.length);
  if (missingTypes) {
    showToast("Turn stitching on only if you pick at least one type for that fabric", "error");
    return;
  }

  showLoading(true);
  try {
    await apiFetch("/api/admin/product-stitching", {
      method: "PUT",
      body: JSON.stringify({ items, adminName })
    });
    showToast("Stitching options saved", "success");
    await loadTailoringSection();
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

async function saveTailoringCharges() {
  const charges = {};
  tailoringTypes.forEach((type) => {
    const input = document.getElementById(`charge-${type.id}`);
    charges[type.id] = Number(input?.value || 0);
  });

  showLoading(true);
  try {
    await apiFetch("/api/admin/tailoring-charges", {
      method: "PUT",
      body: JSON.stringify({ charges, adminName })
    });
    showToast("Tailoring charges saved", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
  showLoading(false);
}

/* ── Init ── */
document.addEventListener("DOMContentLoaded", async () => {
  await refreshAdminCategories();
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const icon = document.querySelector(".admin-theme-toggle i");
  if (icon) {
    icon.className = currentTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
  }
  
  initModals();
  setupUploadZone();
  setupColorStockRows();
  $("#product-form")?.addEventListener("submit", saveProductForm);
  $("#pf-category")?.addEventListener("change", () => {
    $("#pf-fabric-type-group").hidden = $("#pf-category").value !== "fabric";
    renderGarmentOptions(null);
    renderProductStitchingFields({
      category: $("#pf-category").value,
      stitchingEnabled: Boolean($("#pf-stitching")?.checked),
      stitchingTypes: selectedStitchingTypesFrom($("#pf-stitching-types"))
    });
  });
  $("#pf-stitching")?.addEventListener("change", toggleProductStitchingTypes);
  $("#pf-custom-enabled").addEventListener("change", () => { $("#pf-measurement-type").disabled = !$("#pf-custom-enabled").checked; });



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


function renderGarmentOptions(product) {
  const category = $("#pf-category").value;
  $("#pf-garment-options").hidden = category === 'fabric';
  $("#pf-sizes-group").hidden = category !== 'fabric';
  const options = product && product.category !== 'fabric' ? MisriCatalog.garmentOptions(product) : {
    readyMadeSizes: ['Small', 'Medium', 'Large'], customEnabled: true, measurementType: category
  };
  const known = MisriCatalog.readyMadeSizes;
  $("#pf-ready-sizes").innerHTML = known.map(size => `<label class="form-check"><input type="checkbox" value="${size}" ${options.readyMadeSizes.includes(size) ? 'checked' : ''}> ${size}</label>`).join('');
  $("#pf-extra-sizes").value = options.readyMadeSizes.filter(size => !known.includes(size)).join(', ');
  $("#pf-custom-enabled").checked = options.customEnabled;
  $("#pf-measurement-type").innerHTML = Object.entries(MisriCatalog.measurementTypes).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  $("#pf-measurement-type").value = MisriCatalog.measurementTypes[options.measurementType] ? options.measurementType : 'suits';
  $("#pf-measurement-type").disabled = !options.customEnabled;
}
function collectGarmentOptions() {
  const selected = [...document.querySelectorAll('#pf-ready-sizes input:checked')].map(input => input.value);
  const extra = $("#pf-extra-sizes").value.split(',').map(s => s.trim()).filter(s => s && !MisriCatalog.isCustomSize(s));
  return { readyMadeSizes: [...new Set([...selected, ...extra])], customEnabled: $("#pf-custom-enabled").checked, measurementType: $("#pf-measurement-type").value };
}

function addStitchingAddonRow(addon = {}) {
  const id = addon.id || 'extra-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const row = document.createElement('div');
  row.className = 'stitching-addon-row'; row.dataset.addonId = id;
  row.innerHTML = `<label>Name<input data-addon-name value="${esc(addon.name || '')}" maxlength="100" placeholder="e.g. Karhai / Embroidery"></label><label>Price (Rs.)<input data-addon-price type="number" min="0" step="0.01" value="${Number(addon.price || 0)}"></label><label class="form-check"><input data-addon-enabled type="checkbox" ${addon.enabled ? 'checked' : ''}> Enabled</label><button type="button" class="btn-sm btn-outline-sm" data-remove-addon>Remove</button>`;
  row.querySelector('[data-remove-addon]').addEventListener('click', () => row.remove());
  document.querySelector('#stitching-addons-editor').appendChild(row);
}
function renderStitchingAddonsEditor(addons) {
  document.querySelector('#stitching-addons-editor').innerHTML = '';
  addons.forEach(addStitchingAddonRow);
}
async function saveStitchingAddons() {
  const addons = [...document.querySelectorAll('.stitching-addon-row')].map(row => ({
    id: row.dataset.addonId, name: row.querySelector('[data-addon-name]').value.trim(),
    price: row.querySelector('[data-addon-price]').value, enabled: row.querySelector('[data-addon-enabled]').checked
  }));
  if (addons.some(a => !a.name || a.price === '' || !Number.isFinite(Number(a.price)) || Number(a.price) < 0)) {
    showToast('Enter a name and a zero or positive price for every extra', 'error'); return;
  }
  showLoading(true);
  try {
    const data = await apiFetch('/api/admin/stitching-addons', { method: 'PUT', body: JSON.stringify({ addons, adminName }) });
    renderStitchingAddonsEditor(data.addons); showToast('Stitching extras saved', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  showLoading(false);
}
function renderOrderAddons(item) {
  const addons = item.stitching_addons || [];
  if (!addons.length) return '';
  const count = Math.max(1, Number(item.quantity || 1));
  const total = addons.reduce((sum, a) => sum + Number(a.price || 0), 0) * count;
  return `<div class="order-extras"><strong>Stitching extras</strong><br>${addons.map(a => `${esc(a.name)} — +${fmtMoney(a.price)} per garment`).join('<br>')}<br><strong>Extras total${count > 1 ? ` (${count} garments)` : ''}: ${fmtMoney(total)}</strong></div>`;
}

function applyAdminCategories(categories) {
  MisriCatalog.applyCategories(categories);
  CATEGORIES.splice(0, CATEGORIES.length, { value: 'fabric', label: 'Collections — Fabric' }, ...categories.stitching.map(c => ({value:c.id,label:'Stitching — '+c.name})));
  const garmentSelect = $('#pf-category'), fabricSelect = $('#pf-fabric-type');
  const previousGarment = garmentSelect.value, previousFabric = fabricSelect.value;
  garmentSelect.replaceChildren(...CATEGORIES.map(c => new Option(c.label, c.value)));
  fabricSelect.replaceChildren(...categories.collections.map(c => new Option(c.name, c.id)));
  garmentSelect.value = CATEGORIES.some(c => c.value === previousGarment) ? previousGarment : 'fabric';
  fabricSelect.value = categories.collections.some(c => c.id === previousFabric) ? previousFabric : categories.collections[0]?.id || '';
}
async function refreshAdminCategories() {
  try {
    const response = await fetch('/api/catalog-categories');
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error('Category settings could not be loaded');
    applyAdminCategories(data.categories);
  } catch (err) { applyAdminCategories(MisriCatalog.categories); showToast(err.message, 'error'); }
}
async function loadCategoriesSection() {
  $('#save-categories-btn').disabled = true;
  showLoading(true);
  try {
    const data = await apiFetch('/api/admin/catalog-categories');
    applyAdminCategories(data.categories);
    for (const section of ['collections', 'stitching']) {
      document.getElementById(section+'-categories-editor').replaceChildren();
      data.categories[section].forEach(category => addCatalogCategoryRow(section, category, data.counts[section]?.[category.id] || 0));
    }
    $('#save-categories-btn').disabled = false;
  } catch (err) { showToast(err.message, 'error'); }
  showLoading(false);
}
function addCatalogCategoryRow(section, category = {}, count = 0) {
  const row = document.createElement('div'); row.className = 'catalog-category-row';
  row.dataset.categoryId = category.id || 'category-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
  row.innerHTML = `<label>Category name<input data-category-name maxlength="80" value="${esc(category.name || '')}" placeholder="e.g. Silk or Sherwani"></label><label>Banner image<input data-category-image value="${esc(category.image || '')}" placeholder="pics/image.jpg or https://..."></label><label>Image position<input data-category-position value="${esc(category.position || 'center')}" placeholder="center"></label><div><small>${count} product${count === 1 ? '' : 's'}</small><button type="button" class="btn-sm btn-outline-sm" data-remove-category ${count ? 'disabled title="Move these products before removing this category"' : ''}>Remove</button></div>`;
  row.querySelector('[data-remove-category]').addEventListener('click', () => row.remove());
  document.getElementById(section+'-categories-editor').appendChild(row);
}
async function saveCatalogCategories() {
  const categories = {};
  for (const section of ['collections','stitching']) {
    categories[section] = [...document.querySelectorAll('#'+section+'-categories-editor .catalog-category-row')].map(row => ({
      id: row.dataset.categoryId, name: row.querySelector('[data-category-name]').value.trim(), image: row.querySelector('[data-category-image]').value.trim(), position: row.querySelector('[data-category-position]').value.trim() || 'center'
    }));
  }
  if (Object.values(categories).some(list => !list.length || list.some(c => !c.name))) { showToast('Keep at least one named category in each section', 'error'); return; }
  $('#save-categories-btn').disabled = true; showLoading(true);
  try {
    const data = await apiFetch('/api/admin/catalog-categories', {method:'PUT',body:JSON.stringify({categories,adminName})});
    applyAdminCategories(data.categories); showToast('Categories saved', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  $('#save-categories-btn').disabled = false; showLoading(false);
}
