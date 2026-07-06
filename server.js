const express = require("express");
const fs = require("fs");
const path = require("path");

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

  const orders = readJson(ORDERS_FILE);
  orders.unshift(order);
  writeJson(ORDERS_FILE, orders);

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

  const messages = readJson(MESSAGES_FILE);
  messages.unshift(entry);
  writeJson(MESSAGES_FILE, messages);

  const emailBody = `CONTACT QUERY — MISRI CLOTH\nFrom: ${fullName}\nEmail: ${email}\nSubject: ${subjectText}\n\n${message}`;
  await notifyOwner(`Contact: ${subjectText} — ${fullName}`, emailBody, email);

  res.json({ success: true, message: "Message sent! We will reply to your email soon." });
});

app.get("/api/orders", (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  res.json({ success: true, orders: readJson(ORDERS_FILE) });
});

app.get("/api/messages", (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  res.json({ success: true, messages: readJson(MESSAGES_FILE) });
});

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    ensureDataFiles();
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    console.log(`\n  MISRI CLOTH is running!\n`);
    console.log(`  Local:  http://localhost:${PORT}`);
    console.log(`  Public: ${url}`);
    console.log(`  Admin:  ${url}/admin/orders.html\n`);
  });
}

module.exports = app;
