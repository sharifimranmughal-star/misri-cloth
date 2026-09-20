const { validateAddonOrderItem } = require("./lib/stitching-addons");
require('dotenv').config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { createAdminApi } = require("./lib/admin-api");
const { getColorStock, normalizeProductStock } = require("./lib/stock-utils");
const {
  validatePhoneServer,
  validateEmailServer,
  calcDeliveryCharge,
  calcOrderTotal,
  hasTrackedStock,
  getItemStockQty
} = require("./lib/order-utils");
const { validateGarmentOrderItem } = require("./lib/garment-orders");
const { formatMeasurementsBlock } = require("./lib/measurement-fields");

const { createSecurity, securityHeaders } = require("./lib/security");
const { createCheckout } = require("./lib/secure-checkout");
const app = express();
app.disable("x-powered-by");
const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.RENDER ? 1 : 0));
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) throw new Error("Invalid TRUST_PROXY_HOPS");
app.set("trust proxy", proxyHops);
app.use(securityHeaders);
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "misri-cloth-data")
  : path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ACTIVITY_FILE = path.join(DATA_DIR, "activity_logs.json");
const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");
const TAILORING_SETTINGS_FILE = path.join(DATA_DIR, "tailoring_charges.json");

const OWNER_EMAIL = "sharifimranm@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;
const USE_DB = Boolean(DATABASE_URL);
const dbPool = USE_DB
  ? new Pool({
      connectionString: (() => { const u = new URL(DATABASE_URL); for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) u.searchParams.delete(key); return u.toString(); })(),
      ssl: { rejectUnauthorized: true, ...(process.env.PG_CA_CERT ? { ca: process.env.PG_CA_CERT.replace(/\\n/g, "\n") } : {}) }
    })
  : null;

let dbAvailable = false;

function useDb() {
  return USE_DB && dbAvailable;
}

async function checkDbAvailable() {
  if (!dbPool) return false;
  try {
    await dbPool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

const security = createSecurity({ password: ADMIN_PASSWORD, dbPool, production: Boolean(process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === "production") });
app.use("/api", security.originGuard);
app.use(express.json({ limit: "256kb", strict: true }));
// Only public storefront assets may be served; data and server source stay private.
app.use((req, res, next) => {
  let pathname;
  try { pathname = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
  const publicRoot = /^\/(?:[a-z0-9-]+\.html|favicon\.(?:ico|svg)|manifest\.json)?$/i;
  const publicAsset = /^\/(?:css|js|pics|icons|uploads|admin)\/[a-z0-9_./ -]+\.(?:css|js|html|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf)$/i;
  if ((publicRoot.test(pathname) || publicAsset.test(pathname) || pathname === "/data/measurement-fields.json") && !pathname.split('/').some(p => p.startsWith('.'))) {
    return express.static(ROOT)(req, res, next);
  }
  next();
});


function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");
  if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, "[]");
  if (!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, "[]");
  if (!fs.existsSync(ACTIVITY_FILE)) fs.writeFileSync(ACTIVITY_FILE, "[]");
  if (!fs.existsSync(NOTIFICATIONS_FILE)) fs.writeFileSync(NOTIFICATIONS_FILE, "[]");
  if (!fs.existsSync(TAILORING_SETTINGS_FILE)) {
    fs.writeFileSync(
      TAILORING_SETTINGS_FILE,
      JSON.stringify({ charges: require("./lib/tailoring-settings").DEFAULT_TAILORING_CHARGES }, null, 2)
    );
  }
}

function readJson(file) {
  ensureDataFiles();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeJson(file, data) {
  ensureDataFiles();
  const temporary = file + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, file);
}

async function initDb() {
  if (!USE_DB) return;

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      order_ref VARCHAR(32) UNIQUE NOT NULL,
      customer_name VARCHAR(120) NOT NULL,
      customer_phone VARCHAR(30) NOT NULL,
      customer_email VARCHAR(120),
      customer_address TEXT NOT NULL,
      notes TEXT,
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      payment_method VARCHAR(50) DEFAULT 'COD',
      payment_status VARCHAR(20) DEFAULT 'pending',
      subtotal NUMERIC(12,2) DEFAULT 0,
      delivery_charge NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      product_name VARCHAR(220) NOT NULL,
      size_label VARCHAR(80),
      color VARCHAR(80),
      meters NUMERIC(8,2),
      unit_price NUMERIC(12,2) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      line_total NUMERIC(12,2) NOT NULL,
      tailoring_enabled BOOLEAN NOT NULL DEFAULT false,
      tailoring_type VARCHAR(50),
      tailoring_charge NUMERIC(12,2) DEFAULT 0
    );
  `);

  await dbPool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS request_key VARCHAR(80)');
  await dbPool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS request_hash TEXT');
  await dbPool.query('CREATE UNIQUE INDEX IF NOT EXISTS orders_request_key_unique ON orders(request_key)');
  await dbPool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tailoring_enabled BOOLEAN NOT NULL DEFAULT false;`);
  await dbPool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tailoring_type VARCHAR(50);`);
  await dbPool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tailoring_charge NUMERIC(12,2) DEFAULT 0;`);
  await dbPool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tailoring_measurements JSONB;`);
  await dbPool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS stitching_addons JSONB;`);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id BIGSERIAL PRIMARY KEY,
      first_name VARCHAR(60) NOT NULL,
      last_name VARCHAR(60) NOT NULL,
      email VARCHAR(120) NOT NULL,
      subject VARCHAR(120) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function saveOrder(order, transaction) {
  if (!USE_DB) {
    const orders = readJson(ORDERS_FILE);
    orders.unshift(order);
    writeJson(ORDERS_FILE, orders);
    return;
  }

  if (!transaction) throw new Error("Order writes require a database transaction");
  const orderInsert = await transaction.query(
    `INSERT INTO orders
      (order_ref, customer_name, customer_phone, customer_email, customer_address, notes, total_amount, subtotal, delivery_charge, status, payment_method, payment_status, request_key, request_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      order.order_ref,
      order.customer_name,
      order.customer_phone,
      order.customer_email,
      order.customer_address,
      order.notes,
      order.total_amount,
      order.subtotal ?? order.total_amount,
      order.delivery_charge ?? 0,
      order.status,
      order.payment_method || "COD",
      order.payment_status || "pending",
      order.request_key || null,
      order.request_hash || null
    ]
  );
  const orderId = orderInsert.rows[0].id;

  for (const item of order.items) {
    await transaction.query(
      `INSERT INTO order_items
       (order_id, product_id, product_name, size_label, color, meters, unit_price, quantity, line_total,
        tailoring_enabled, tailoring_type, tailoring_charge, tailoring_measurements, stitching_addons)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        orderId,
        item.product_id,
        item.product_name,
        item.size,
        item.color,
        item.meters || null,
        item.unit_price || 0,
        item.quantity || 1,
        item.line_total || 0,
        Boolean(item.tailoring_enabled || item.tailoringEnabled),
        item.tailoring_type || item.tailoringType || null,
        Number(item.tailoring_charge ?? item.tailoringCharge ?? 0),
        item.tailoring_measurements || item.tailoringMeasurements || null,
        JSON.stringify(item.stitching_addons || [])
      ]
    );
  }

  await transaction.query(
    "INSERT INTO order_status_history (order_id, status, admin_name) VALUES ($1,$2,$3)",
    [orderId, order.status, "System"]
  );
}

async function saveContact(entry) {
  if (!USE_DB) {
    const messages = readJson(MESSAGES_FILE);
    messages.unshift(entry);
    writeJson(MESSAGES_FILE, messages);
    return;
  }

  await dbPool.query(
    `INSERT INTO contact_messages (first_name, last_name, email, subject, message)
     VALUES ($1,$2,$3,$4,$5)`,
    [entry.first_name, entry.last_name, entry.email, entry.subject, entry.message]
  );
}

async function getOrders() {
  if (!USE_DB) return readJson(ORDERS_FILE);

  const ordersResult = await dbPool.query(
    `SELECT id, order_ref, customer_name, customer_phone, customer_email, customer_address,
            notes, total_amount, subtotal, delivery_charge, status, payment_method, payment_status, created_at
     FROM orders
     ORDER BY created_at DESC`
  );

  const itemsResult = await dbPool.query(
    `SELECT order_id, product_id, product_name, size_label, color, meters, unit_price, quantity, line_total,
            tailoring_enabled, tailoring_type, tailoring_charge, tailoring_measurements, stitching_addons
     FROM order_items`
  );

  const historyResult = await dbPool.query(
    `SELECT order_id, status, admin_name, changed_at FROM order_status_history ORDER BY changed_at DESC`
  );

  const itemsByOrder = new Map();
  for (const row of itemsResult.rows) {
    const normalizedItem = {
      product_id: row.product_id,
      product_name: row.product_name,
      size: row.size_label,
      color: row.color,
      meters: row.meters === null ? null : Number(row.meters),
      unit_price: Number(row.unit_price),
      quantity: row.quantity,
      line_total: Number(row.line_total),
      tailoring_enabled: Boolean(row.tailoring_enabled),
      tailoring_type: row.tailoring_type || null,
      tailoring_charge: Number(row.tailoring_charge || 0),
      tailoring_measurements: row.tailoring_measurements || null,
      stitching_addons: row.stitching_addons || []
    };
    if (!itemsByOrder.has(row.order_id)) itemsByOrder.set(row.order_id, []);
    itemsByOrder.get(row.order_id).push(normalizedItem);
  }

  const historyByOrder = new Map();
  for (const row of historyResult.rows) {
    if (!historyByOrder.has(row.order_id)) historyByOrder.set(row.order_id, []);
    historyByOrder.get(row.order_id).push({
      status: row.status,
      adminName: row.admin_name,
      changedAt: row.changed_at
    });
  }

  return ordersResult.rows.map((o) => ({
    id: Number(o.id),
    order_ref: o.order_ref,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    customer_email: o.customer_email || "",
    customer_address: o.customer_address,
    notes: o.notes || "",
    total_amount: Number(o.total_amount),
    subtotal: Number(o.subtotal ?? o.total_amount),
    delivery_charge: Number(o.delivery_charge ?? 0),
    status: o.status,
    payment_method: o.payment_method || "COD",
    payment_status: o.payment_status || "pending",
    created_at: o.created_at,
    items: itemsByOrder.get(o.id) || [],
    statusHistory: historyByOrder.get(o.id) || []
  }));
}

async function getMessages() {
  if (!USE_DB) return readJson(MESSAGES_FILE);

  const result = await dbPool.query(
    `SELECT id, first_name, last_name, email, subject, message, created_at
     FROM contact_messages
     ORDER BY created_at DESC`
  );

  return result.rows.map((m) => ({
    id: Number(m.id),
    first_name: m.first_name,
    last_name: m.last_name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    created_at: m.created_at
  }));
}

function generateOrderRef() {
  return "MC" + Date.now().toString(36).toUpperCase().slice(-6);
}

async function notifyOwner(subject, body, customerEmail) {
  try {
    const res = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(OWNER_EMAIL), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: subject,
        _template: "table",
        message: body,
        email: customerEmail || "customer@misricloth.com",
        _captcha: "false"
      })
    });
    if (!res.ok) console.log("Email notify status:", res.status);
  } catch (err) {
    console.log("Email notification skipped:", err.message);
  }
}

const adminApi = createAdminApi({
  ROOT,
  DATA_DIR,
  useDb,
  dbPool,
  security,
  readJson,
  writeJson,
  getOrders,
  getMessages,
  notifyOwner,
  ORDERS_FILE,
  PRODUCTS_FILE,
  ACTIVITY_FILE,
  NOTIFICATIONS_FILE,
  TAILORING_SETTINGS_FILE,
  UPLOADS_DIR,
  ensureDataFiles
});

let initialization;
function initialize() {
  if (!initialization) initialization = (async () => {
    ensureDataFiles();
    if (USE_DB) {
      await dbPool.query("SELECT 1");
      await initDb();
      dbAvailable = true;
    }
    await adminApi.initAdminTables();
    await security.init();
  })().catch(err => { dbAvailable = false; initialization = null; throw err; });
  return initialization;
}
app.use('/api', async (req, res, next) => {
  try { await initialize(); next(); }
  catch { res.status(503).json({ success: false, message: 'The store database is temporarily unavailable. Please try again shortly.' }); }
});
security.register(app);
app.use("/api/submit_order", security.rateLimit("checkout", 20));
app.use("/api/send_contact", security.rateLimit("contact", 10));
app.use(["/api/track_order", "/api/request_return"], security.rateLimit("support", 30));
app.use("/api/admin/upload", security.rateLimit("upload", 20));
adminApi.registerRoutes(app);
const checkout = createCheckout({dbPool, api: adminApi, saveOrder, readJson, writeJson, PRODUCTS_FILE, ORDERS_FILE});
require('./lib/customer-support').registerCustomerSupport(app, {dbPool, useDb, readJson, ORDERS_FILE, saveContact});

app.post("/api/submit_order", async (req, res) => {
  try {
    const order = await checkout(req.body);
    if (order.duplicate) return res.json({success:true,order_ref:order.order_ref,message:"Order already placed successfully"});
    const { customer_name: name, customer_phone: phone, customer_email: email, customer_address: address, notes, items, total_amount: total, order_ref: orderRef } = order;

    try {
      await adminApi.logActivity("Order Received", `New order ${orderRef} from ${name}`, "System");
    } catch (activityErr) {
      console.error("Activity logging failed:", activityErr.message);
    }

    try {
      await adminApi.createNotification({
        type: "new_order",
        title: "New Order Received",
        message: `Order ${orderRef} from ${name}`,
        orderRef
      });
    } catch (notificationErr) {
      console.error("Notification creation failed:", notificationErr.message);
    }

    try {
      let emailBody = `NEW ORDER — MISRI CLOTH\nOrder Ref: ${orderRef}\nDate: ${order.created_at}\n\n`;
      emailBody += `Customer: ${name}\nPhone: ${phone}\nEmail: ${email || "N/A"}\nAddress: ${address}\n`;
      emailBody += `Payment: ${order.payment_method}\n`;
      if (notes) emailBody += `Notes: ${notes}\n`;
      emailBody += "\n--- ITEMS ---\n";
      items.forEach((item) => {
        const tailoringType = item.tailoring_type || item.tailoringType;
        const tailoringCharge = item.tailoring_charge ?? item.tailoringCharge ?? 0;
        const tailoringEnabled = item.tailoring_enabled ?? item.tailoringEnabled;
        const tailoringNote = tailoringEnabled && tailoringType
          ? ` + Custom ${tailoringType} stitching (Rs.${tailoringCharge})`
          : "";
        if (item.meters) {
          emailBody += `${item.product_name} — ${item.meters}m × ${item.quantity || 1} @ Rs.${item.unit_price}${tailoringNote} = Rs.${item.line_total}\n`;
        } else {
          emailBody += `${item.product_name} — ${item.size}, ${item.color} x${item.quantity}${tailoringNote} = Rs.${item.line_total}\n`;
        }
        if (item.stitching_addons?.length) {
          emailBody += `  Extras: ${item.stitching_addons.map(a => `${a.name} (+Rs.${a.price} per garment)`).join(', ')}\n`;
        }
        const measurements = item.tailoring_measurements || item.tailoringMeasurements;
        if (tailoringEnabled && measurements) {
          const block = formatMeasurementsBlock(tailoringType, measurements);
          if (block) emailBody += `${block}\n`;
        }
      });
      emailBody += `\nTOTAL: Rs.${total}`;

      await notifyOwner(`New Order ${orderRef} — MISRI CLOTH`, emailBody, email);
    } catch (emailErr) {
      console.error("Email notification failed:", emailErr.message);
    }

    res.json({ success: true, order_ref: orderRef, message: "Order placed successfully" });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ success: false, message: err.message });
    console.error("submit_order failed:", err.code || "request failed");

    res.status(500).json({
      success: false,
      message: "Order could not be saved. Please try again or contact us directly."
    });
  }
});

app.post("/api/send_contact", async (req, res, next) => {
  try {
  const { firstName, lastName, email, subject, message } = req.body || {};
  const limits = {firstName:60,lastName:60,email:120,subject:120,message:4000};
  for (const [key, max] of Object.entries(limits)) {
    const value = req.body?.[key];
    if ((key !== 'subject' || value != null) && (typeof value !== 'string' || !value.trim() || value.length > max)) return res.status(400).json({success:false,message:'Please enter valid contact details.'});
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({success:false,message:'Invalid email.'});
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();

  if (!firstName || !lastName || !email || !message) {
    return res.status(400).json({ success: false, message: "Please fill all required fields" });
  }

  const subjectLabels = {
    general: "General Inquiry",
    order: "Order Status",
    returns: "Returns & Exchanges",
    sizing: "Measurements Help",
    wholesale: "Wholesale",
    fabric: "Fabric Inquiry"
  };
  const subjectText = subjectLabels[subject] || subject || "General Inquiry";

  const entry = {
    id: Date.now(),
    first_name: firstName,
    last_name: lastName,
    email,
    subject: subjectText,
    message,
    created_at: new Date().toISOString()
  };

  await saveContact(entry);

  const emailBody = `CONTACT QUERY — MISRI CLOTH\nFrom: ${fullName}\nEmail: ${email}\nSubject: ${subjectText}\n\n${message}`;
  await notifyOwner(`Contact: ${subjectText} — ${fullName}`, emailBody, email);

  res.json({ success: true, message: "Message sent! We will reply to your email soon." });
  } catch (err) { next(err); }
});

app.get("/api/health", async (req, res) => {
  const storage = useDb() ? "postgresql" : "json-file";
  let dbOk = false;
  if (USE_DB) {
    try {
      await dbPool.query("SELECT 1");
      dbOk = true;
    } catch {
      dbOk = false;
    }
  }
  res.json({
    ok: true,
    storage,
    persistent: useDb() && dbOk,
    warning: !USE_DB && process.env.RENDER
      ? "Orders will disappear on restart. Add DATABASE_URL in Render Environment."
      : USE_DB && !dbOk
      ? "Database configured but connection failed. Using JSON storage fallback."
      : null
  });
});

app.get("/api/orders", async (req, res) => {
  if (!req.adminAuthenticated) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const orders = await getOrders();
    res.json({ success: true, orders });
  } catch (err) {
    console.error("orders read failed:", err.message);
    res.status(500).json({ success: false, message: "Could not load orders" });
  }
});

app.get("/api/messages", async (req, res) => {
  if (!req.adminAuthenticated) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const messages = await getMessages();
    res.json({ success: true, messages });
  } catch (err) {
    console.error("messages read failed:", err.message);
    res.status(500).json({ success: false, message: "Could not load messages" });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status === 400 || err instanceof SyntaxError || String(err.code || '').startsWith('LIMIT_') ? 400 : 500);
  res.status(status).json({success:false,message:status === 413 ? 'Request is too large.' : status === 400 ? 'Invalid request.' : 'The request could not be completed. Please try again.'});
});

if (require.main === module) {
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
  });

  (async () => {
    await initialize();

    app.listen(PORT, "0.0.0.0", () => {
      const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
      console.log(`\n  MISRI CLOTH is running!\n`);
      console.log(`  Local:  http://localhost:${PORT}`);
      console.log(`  Public: ${url}`);
      console.log(`  Admin:  ${url}/admin/orders.html\n`);
    });
  })().catch((err) => {
    console.error("Startup failed:", err.message);
    process.exit(1);
  });
}

module.exports = app;
