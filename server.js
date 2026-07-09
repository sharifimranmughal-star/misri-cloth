const express = require("express");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "misri-cloth-data")
  : path.join(ROOT, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

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

app.use(express.json({ limit: "1mb" }));
app.use(express.static(ROOT));

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");
  if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, "[]");
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
  if (!USE_DB) {
    const orders = readJson(ORDERS_FILE);
    orders.unshift(order);
    writeJson(ORDERS_FILE, orders);
    return;
  }

  const orderInsert = await dbPool.query(
    `INSERT INTO orders
      (order_ref, customer_name, customer_phone, customer_email, customer_address, notes, total_amount, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      order.order_ref,
      order.customer_name,
      order.customer_phone,
      order.customer_email,
      order.customer_address,
      order.notes,
      order.total_amount,
      order.status
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
            notes, total_amount, status, created_at
     FROM orders
     ORDER BY created_at DESC`
  );

  const itemsResult = await dbPool.query(
    `SELECT order_id, product_id, product_name, size_label, color, meters, unit_price, quantity, line_total
     FROM order_items`
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

  return ordersResult.rows.map((o) => ({
    id: Number(o.id),
    order_ref: o.order_ref,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    customer_email: o.customer_email || "",
    customer_address: o.customer_address,
    notes: o.notes || "",
    total_amount: Number(o.total_amount),
    status: o.status,
    created_at: o.created_at,
    items: itemsByOrder.get(o.id) || []
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

app.post("/api/submit_order", async (req, res) => {
  try {
  const { name, phone, email, address, notes, items, total } = req.body || {};

  if (!name || !phone || !address) {
    return res.status(400).json({ success: false, message: "Name, phone and address are required" });
  }
  if (!items || !items.length) {
    return res.status(400).json({ success: false, message: "Cart is empty" });
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
    items,
    created_at: new Date().toISOString()
  };

  await saveOrder(order);

  let emailBody = `NEW ORDER — MISRI CLOTH\nOrder Ref: ${orderRef}\nDate: ${order.created_at}\n\n`;
  emailBody += `Customer: ${name}\nPhone: ${phone}\nEmail: ${email || "N/A"}\nAddress: ${address}\n`;
  if (notes) emailBody += `Notes: ${notes}\n`;
  emailBody += "\n--- ITEMS ---\n";
  items.forEach(item => {
    if (item.meters) {
      emailBody += `${item.product_name} — ${item.meters}m @ Rs.${item.unit_price}/m = Rs.${item.line_total}\n`;
    } else {
      emailBody += `${item.product_name} — ${item.size}, ${item.color} x${item.quantity} = Rs.${item.line_total}\n`;
    }
  });
  emailBody += `\nTOTAL: Rs.${total}`;

  await notifyOwner(`New Order ${orderRef} — MISRI CLOTH`, emailBody, email);

  res.json({ success: true, order_ref: orderRef, message: "Order placed successfully" });
  } catch (err) {
    console.error("submit_order failed:", err.message);
    res.status(500).json({
      success: false,
      message: USE_DB
        ? "Order could not be saved. Check DATABASE_URL on Render."
        : "Order could not be saved. Add DATABASE_URL for permanent storage."
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
  (async () => {
    if (USE_DB) {
      await initDb();
      console.log("PostgreSQL connected. Orders saved permanently.");
    } else {
      ensureDataFiles();
      if (process.env.RENDER) {
        console.log("WARNING: DATABASE_URL missing on Render. Orders will NOT persist!");
      } else {
        console.log("Using local JSON storage.");
      }
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
