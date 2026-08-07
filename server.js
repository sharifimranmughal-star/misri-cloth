const express = require("express");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { createAdminApi } = require("./lib/admin-api");
const {
  validatePhoneServer,
  validateEmailServer,
  calcDeliveryCharge,
  calcOrderTotal,
  hasTrackedStock
} = require("./lib/order-utils");

const app = express();
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

const OWNER_EMAIL = "sharifimranm@gmail.com";
const ADMIN_PASSWORD = "misri2026";
const DATABASE_URL = process.env.DATABASE_URL;
const USE_DB = Boolean(DATABASE_URL);
const dbPool = USE_DB
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

let dbAvailable = USE_DB;

async function checkDbAvailable() {
  if (!dbPool) return false;
  try {
    await dbPool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

app.use(express.json({ limit: "5mb" }));
app.use(express.static(ROOT));
app.use("/uploads", express.static(UPLOADS_DIR));

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");
  if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, "[]");
  if (!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, "[]");
  if (!fs.existsSync(ACTIVITY_FILE)) fs.writeFileSync(ACTIVITY_FILE, "[]");
  if (!fs.existsSync(NOTIFICATIONS_FILE)) fs.writeFileSync(NOTIFICATIONS_FILE, "[]");
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
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
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
      line_total NUMERIC(12,2) NOT NULL
    );
  `);

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

async function saveOrder(order) {
  if (!USE_DB || !(await checkDbAvailable())) {
    const orders = readJson(ORDERS_FILE);
    orders.unshift(order);
    writeJson(ORDERS_FILE, orders);
    return;
  }

  const orderInsert = await dbPool.query(
    `INSERT INTO orders
      (order_ref, customer_name, customer_phone, customer_email, customer_address, notes, total_amount, subtotal, delivery_charge, status, payment_method, payment_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
      order.payment_status || "pending"
    ]
  );
  const orderId = orderInsert.rows[0].id;

  for (const item of order.items) {
    await dbPool.query(
      `INSERT INTO order_items
       (order_id, product_id, product_name, size_label, color, meters, unit_price, quantity, line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        orderId,
        item.product_id,
        item.product_name,
        item.size,
        item.color,
        item.meters || null,
        item.unit_price || 0,
        item.quantity || 1,
        item.line_total || 0
      ]
    );
  }

  await dbPool.query(
    "INSERT INTO order_status_history (order_id, status, admin_name) VALUES ($1,$2,$3)",
    [orderId, order.status, "System"]
  );
}

async function saveContact(entry) {
  if (!USE_DB || !(await checkDbAvailable())) {
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
  if (!USE_DB || !(await checkDbAvailable())) return readJson(ORDERS_FILE);

  const ordersResult = await dbPool.query(
    `SELECT id, order_ref, customer_name, customer_phone, customer_email, customer_address,
            notes, total_amount, subtotal, delivery_charge, status, payment_method, payment_status, created_at
     FROM orders
     ORDER BY created_at DESC`
  );

  const itemsResult = await dbPool.query(
    `SELECT order_id, product_id, product_name, size_label, color, meters, unit_price, quantity, line_total
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
      line_total: Number(row.line_total)
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
  if (!USE_DB || !(await checkDbAvailable())) return readJson(MESSAGES_FILE);

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
  USE_DB,
  dbPool,
  ADMIN_PASSWORD,
  readJson,
  writeJson,
  getOrders,
  getMessages,
  notifyOwner,
  ORDERS_FILE,
  PRODUCTS_FILE,
  ACTIVITY_FILE,
  NOTIFICATIONS_FILE,
  UPLOADS_DIR,
  ensureDataFiles
});

adminApi.registerRoutes(app);

app.post("/api/submit_order", async (req, res) => {
  try {
    const { name, phone, email, address, notes, items, total, payment_method } = req.body || {};

    if (!name || !phone || !address) {
      return res.status(400).json({ success: false, message: "Name, phone and address are required" });
    }
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    for (const item of items) {
      const product = await adminApi.getProductById(item.product_id, false);
      if (!product) {
        return res.status(400).json({ success: false, message: `${item.product_name} is no longer available` });
      }
      const needed = item.meters ? Math.ceil(item.meters) : (item.quantity || 1);
      const availableStock = product.stockQuantity || 0;
      
      if (availableStock < needed) {
        return res.status(400).json({
          success: false,
          message: `${product.name} is out of stock or insufficient quantity available. Available: ${availableStock}, Requested: ${needed}`
        });
      }
    }

    const orderRef = generateOrderRef();
    const order = {
      id: Date.now(),
      order_ref: orderRef,
      customer_name: name,
      customer_phone: phone,
      customer_email: email || "",
      customer_address: address,
      notes: notes || "",
      total_amount: total,
      status: "pending",
      payment_method: payment_method || "COD",
      payment_status: "pending",
      items,
      statusHistory: [{ status: "pending", changedAt: new Date().toISOString(), adminName: "System" }],
      created_at: new Date().toISOString()
    };

    await saveOrder(order);

    // Non-critical operations - don't fail order if these fail
    try {
      for (const item of items) {
        const qty = item.meters ? Math.ceil(item.meters) : (item.quantity || 1);
        await adminApi.adjustStock(item.product_id, -qty, "System", "Order placed — stock reduced");
      }
    } catch (stockErr) {
      console.error("Stock adjustment failed:", stockErr.message);
    }

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
        if (item.meters) {
          emailBody += `${item.product_name} — ${item.meters}m @ Rs.${item.unit_price}/m = Rs.${item.line_total}\n`;
        } else {
          emailBody += `${item.product_name} — ${item.size}, ${item.color} x${item.quantity} = Rs.${item.line_total}\n`;
        }
      });
      emailBody += `\nTOTAL: Rs.${total}`;

      await notifyOwner(`New Order ${orderRef} — MISRI CLOTH`, emailBody, email);
    } catch (emailErr) {
      console.error("Email notification failed:", emailErr.message);
    }

    res.json({ success: true, order_ref: orderRef, message: "Order placed successfully" });
  } catch (err) {
    console.error("submit_order failed:", err.message);
    console.error("Full error:", err);
    res.status(500).json({
      success: false,
      message: "Order could not be saved. Please try again or contact us directly."
    });
  }
});

app.post("/api/send_contact", async (req, res) => {
  const { firstName, lastName, email, subject, message } = req.body || {};
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
});

app.get("/api/health", async (req, res) => {
  const storage = USE_DB ? "postgresql" : "json-file";
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
    persistent: USE_DB && dbOk,
    warning: !USE_DB && process.env.RENDER
      ? "Orders will disappear on restart. Add DATABASE_URL in Render Environment."
      : USE_DB && !dbOk
      ? "Database configured but connection failed. Using JSON storage fallback."
      : null
  });
});

app.get("/api/orders", async (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
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
  if (req.query.password !== ADMIN_PASSWORD) {
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

if (require.main === module) {
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
  });

  (async () => {
    try {
      if (USE_DB) {
        await initDb();
        await adminApi.initAdminTables();
        dbAvailable = await checkDbAvailable();
        if (dbAvailable) {
          console.log("PostgreSQL connected. Orders saved permanently.");
        } else {
          console.log("PostgreSQL connection failed during startup. Using JSON storage fallback.");
        }
      } else {
        ensureDataFiles();
        await adminApi.initAdminTables();
        if (process.env.RENDER) {
          console.log("WARNING: DATABASE_URL missing on Render. Orders will NOT persist!");
        } else {
          console.log("Using local JSON storage.");
        }
      }
    } catch (dbErr) {
      console.error("Database connection failed, falling back to JSON storage:", dbErr.message);
      dbAvailable = false;
      ensureDataFiles();
      await adminApi.initAdminTables();
      console.log("Using local JSON storage (fallback).");
    }

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
