const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];
const LOW_STOCK_THRESHOLD = 10;
const sseClients = new Set();
const publicSseClients = new Set();

function createAdminApi(deps) {
  const {
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
  } = deps;

  let sharp = null;
  try {
    sharp = require("sharp");
  } catch {
    console.log("sharp not available — images saved without optimization");
  }

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
      else cb(new Error("Only image files allowed"));
    }
  });

  function isAdmin(req) {
    const pw = req.query.password || req.headers["x-admin-password"] || req.body?.password;
    return pw === ADMIN_PASSWORD;
  }

  function requireAdmin(req, res, next) {
    if (!isAdmin(req)) return res.status(401).json({ success: false, message: "Unauthorized" });
    next();
  }

  function broadcastEvent(event) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function notifyPublicClients(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    const deadClients = [];
    publicSseClients.forEach(client => {
      try {
        client.write(data);
      } catch {
        deadClients.push(client);
      }
    });
    deadClients.forEach(client => publicSseClients.delete(client));
  }

  function rowToProduct(row) {
    const parseJson = (v, fallback) => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return fallback;
        }
      }
      return fallback;
    };
    return {
      id: Number(row.id),
      name: row.name,
      description: row.description || "",
      price: Number(row.price),
      originalPrice: row.original_price === null || row.original_price === undefined ? null : Number(row.original_price),
      category: row.category,
      sku: row.sku || "",
      stockQuantity: Number(row.stock_quantity ?? 0),
      status: row.status || "active",
      isVisible: row.is_visible !== false && row.is_visible !== "false",
      featured: Boolean(row.is_featured),
      new: Boolean(row.is_new),
      badge: row.badge || null,
      rating: Number(row.rating ?? 4.5),
      reviews: Number(row.reviews ?? 0),
      image: row.image || "",
      images: parseJson(row.images, []),
      sizes: parseJson(row.sizes, ["Custom Measurement"]),
      colors: parseJson(row.colors, []),
      referenceMeters: row.reference_meters ? Number(row.reference_meters) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function productToDbFields(p) {
    return {
      name: p.name,
      description: p.description || "",
      price: p.price,
      original_price: p.originalPrice ?? null,
      category: p.category,
      sku: p.sku || null,
      stock_quantity: p.stockQuantity ?? 0,
      status: p.status || "active",
      is_visible: p.isVisible !== false,
      is_featured: Boolean(p.featured),
      is_new: Boolean(p.new),
      badge: p.badge || null,
      rating: p.rating ?? 4.5,
      reviews: p.reviews ?? 0,
      image: p.image || "",
      images: JSON.stringify(p.images || []),
      sizes: JSON.stringify(p.sizes || []),
      colors: JSON.stringify(p.colors || []),
      reference_meters: p.referenceMeters ?? null
    };
  }

  async function getAllProducts(admin = false) {
    if (!USE_DB) {
      const list = readJson(PRODUCTS_FILE);
      return admin ? list : list.filter((p) => p.isVisible !== false && p.status === "active");
    }
    const where = admin ? "" : "WHERE is_visible = true AND status = 'active'";
    const result = await dbPool.query(`SELECT * FROM products ${where} ORDER BY id ASC`);
    return result.rows.map(rowToProduct);
  }

  async function getProductById(id, admin = false) {
    if (!USE_DB) {
      const list = readJson(PRODUCTS_FILE);
      const p = list.find((x) => x.id === Number(id));
      if (!p) return null;
      if (!admin && (p.isVisible === false || p.status !== "active")) return null;
      return p;
    }
    const result = await dbPool.query("SELECT * FROM products WHERE id = $1", [id]);
    if (!result.rows.length) return null;
    const p = rowToProduct(result.rows[0]);
    if (!admin && (!p.isVisible || p.status !== "active")) return null;
    return p;
  }

  async function saveProduct(product, adminName = "Admin") {
    const fields = productToDbFields(product);
    if (!USE_DB) {
      const list = readJson(PRODUCTS_FILE);
      if (product.id) {
        const idx = list.findIndex((p) => p.id === product.id);
        if (idx === -1) throw new Error("Product not found");
        list[idx] = { ...list[idx], ...product, updatedAt: new Date().toISOString() };
        writeJson(PRODUCTS_FILE, list);
        await logActivity("Product Edited", `Updated product: ${product.name}`, adminName);
        notifyPublicClients({ type: "product_updated", product: list[idx], action: "updated" });
        return list[idx];
      }
      const newProduct = {
        ...product,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      list.push(newProduct);
      writeJson(PRODUCTS_FILE, list);
      await logActivity("Product Added", `Added product: ${product.name}`, adminName);
      notifyPublicClients({ type: "product_updated", product: newProduct, action: "created" });
      return newProduct;
    }

    if (product.id) {
      await dbPool.query(
        `UPDATE products SET name=$1, description=$2, price=$3, original_price=$4, category=$5, sku=$6,
         stock_quantity=$7, status=$8, is_visible=$9, is_featured=$10, is_new=$11, badge=$12, rating=$13,
         reviews=$14, image=$15, images=$16, sizes=$17, colors=$18, reference_meters=$19, updated_at=NOW()
         WHERE id=$20`,
        [
          fields.name, fields.description, fields.price, fields.original_price, fields.category, fields.sku,
          fields.stock_quantity, fields.status, fields.is_visible, fields.is_featured, fields.is_new,
          fields.badge, fields.rating, fields.reviews, fields.image, fields.images, fields.sizes,
          fields.colors, fields.reference_meters, product.id
        ]
      );
      await logActivity("Product Edited", `Updated product: ${product.name}`, adminName);
      const updatedProduct = await getProductById(product.id, true);
      notifyPublicClients({ type: "product_updated", product: updatedProduct, action: "updated" });
      return updatedProduct;
    }

    const result = await dbPool.query(
      `INSERT INTO products (name, description, price, original_price, category, sku, stock_quantity, status,
       is_visible, is_featured, is_new, badge, rating, reviews, image, images, sizes, colors, reference_meters)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [
        fields.name, fields.description, fields.price, fields.original_price, fields.category, fields.sku,
        fields.stock_quantity, fields.status, fields.is_visible, fields.is_featured, fields.is_new,
        fields.badge, fields.rating, fields.reviews, fields.image, fields.images, fields.sizes,
        fields.colors, fields.reference_meters
      ]
    );
    await logActivity("Product Added", `Added product: ${product.name}`, adminName);
    const newProduct = await getProductById(result.rows[0].id, true);
    notifyPublicClients({ type: "product_updated", product: newProduct, action: "created" });
    return newProduct;
  }

  async function deleteProduct(id, adminName = "Admin", soft = false) {
    const product = await getProductById(id, true);
    if (!product) throw new Error("Product not found");

    if (soft) {
      product.isVisible = false;
      product.status = "inactive";
      await saveProduct(product, adminName);
      await logActivity("Product Hidden", `Hidden product: ${product.name}`, adminName);
      return product;
    }

    if (!USE_DB) {
      const list = readJson(PRODUCTS_FILE).filter((p) => p.id !== Number(id));
      writeJson(PRODUCTS_FILE, list);
      await logActivity("Product Deleted", `Deleted product: ${product.name}`, adminName);
      notifyPublicClients({ type: "product_deleted", productId: Number(id), action: "deleted" });
      return true;
    }
    await dbPool.query("UPDATE products SET is_visible=false, status='inactive', updated_at=NOW() WHERE id=$1", [id]);
    await logActivity("Product Deleted", `Archived product: ${product.name}`, adminName);
    notifyPublicClients({ type: "product_deleted", productId: Number(id), action: "deleted" });
    return true;
  }

  async function duplicateProduct(id, adminName = "Admin") {
    const source = await getProductById(id, true);
    if (!source) throw new Error("Product not found");
    const copy = { ...source, id: undefined, name: `${source.name} (Copy)`, sku: source.sku ? `${source.sku}-COPY` : "" };
    return saveProduct(copy, adminName);
  }

  async function adjustStock(productId, delta, adminName = "System", reason = "Stock Updated") {
    const product = await getProductById(productId, true);
    if (!product) return;
    
    const currentStock = product.stockQuantity || 0;
    const newStock = Math.max(0, currentStock + delta);
    
    // Prevent negative stock
    if (newStock < 0) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${currentStock}, Requested: ${Math.abs(delta)}`);
    }
    
    product.stockQuantity = newStock;
    await saveProduct(product, adminName);
    await logActivity("Stock Updated", `${reason}: ${product.name} → ${newStock} units`, adminName);
    
    // Broadcast stock change to main site
    notifyPublicClients({
      type: "stock_updated",
      productId: product.id,
      productName: product.name,
      stock: newStock,
      delta: delta
    });
    
    // Check for low stock and create notification
    if (newStock <= LOW_STOCK_THRESHOLD && newStock > 0) {
      await createNotification({
        type: "low_stock",
        title: "Low Stock Alert",
        message: `${product.name} has only ${newStock} units left`
      });
    }
    
    // Check for out of stock and mark product accordingly
    if (newStock === 0) {
      product.status = "inactive";
      product.isVisible = false;
      await saveProduct(product, adminName);
      await logActivity("Product Out of Stock", `${product.name} marked as out of stock`, adminName);
      await createNotification({
        type: "out_of_stock",
        title: "Product Out of Stock",
        message: `${product.name} is now out of stock`
      });
      
      // Broadcast product update for main site
      notifyPublicClients({
        type: "product_updated",
        product: product,
        action: "out_of_stock"
      });
    }
    
    return newStock;
  }

  async function logActivity(action, details = "", adminName = "Admin") {
    const entry = {
      id: Date.now(),
      adminName,
      action,
      details,
      createdAt: new Date().toISOString()
    };
    if (!USE_DB) {
      const logs = readJson(ACTIVITY_FILE);
      logs.unshift(entry);
      writeJson(ACTIVITY_FILE, logs);
      return entry;
    }
    const result = await dbPool.query(
      "INSERT INTO activity_logs (admin_name, action, details) VALUES ($1,$2,$3) RETURNING id, created_at",
      [adminName, action, details]
    );
    return {
      id: Number(result.rows[0].id),
      adminName,
      action,
      details,
      createdAt: result.rows[0].created_at
    };
  }

  async function createNotification({ type, title, message, orderRef }) {
    const entry = {
      id: Date.now(),
      type,
      title,
      message,
      orderRef: orderRef || null,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    if (!USE_DB) {
      const list = readJson(NOTIFICATIONS_FILE);
      list.unshift(entry);
      writeJson(NOTIFICATIONS_FILE, list);
    } else {
      const result = await dbPool.query(
        "INSERT INTO admin_notifications (type, title, message, order_ref) VALUES ($1,$2,$3,$4) RETURNING id, created_at",
        [type, title, message, orderRef || null]
      );
      entry.id = Number(result.rows[0].id);
      entry.createdAt = result.rows[0].created_at;
    }
    broadcastEvent({ type: "notification", notification: entry });
    return entry;
  }

  async function getNotifications(unreadOnly = false) {
    if (!USE_DB) {
      let list = readJson(NOTIFICATIONS_FILE);
      if (unreadOnly) list = list.filter((n) => !n.isRead);
      return list;
    }
    const where = unreadOnly ? "WHERE is_read = false" : "";
    const result = await dbPool.query(
      `SELECT id, type, title, message, order_ref, is_read, created_at FROM admin_notifications ${where} ORDER BY created_at DESC LIMIT 200`
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      type: r.type,
      title: r.title,
      message: r.message,
      orderRef: r.order_ref,
      isRead: r.is_read,
      createdAt: r.created_at
    }));
  }

  async function markNotificationsRead(ids) {
    if (!USE_DB) {
      const list = readJson(NOTIFICATIONS_FILE);
      list.forEach((n) => {
        if (!ids || ids.includes(n.id)) n.isRead = true;
      });
      writeJson(NOTIFICATIONS_FILE, list);
      return;
    }
    if (ids && ids.length) {
      await dbPool.query("UPDATE admin_notifications SET is_read=true WHERE id = ANY($1::bigint[])", [ids]);
    } else {
      await dbPool.query("UPDATE admin_notifications SET is_read=true WHERE is_read=false");
    }
  }

  async function updateOrderStatus(orderId, status, adminName = "Admin") {
    if (!ORDER_STATUSES.includes(status)) throw new Error("Invalid status");

    if (!USE_DB) {
      const orders = readJson(ORDERS_FILE);
      const order = orders.find((o) => o.id === Number(orderId) || o.order_ref === orderId);
      if (!order) throw new Error("Order not found");
      const prev = order.status;
      order.status = status;
      if (!order.statusHistory) order.statusHistory = [];
      order.statusHistory.unshift({ status, changedAt: new Date().toISOString(), adminName });
      writeJson(ORDERS_FILE, orders);
      if (status === "cancelled" && prev !== "cancelled") {
        for (const item of order.items || []) {
          const qty = item.meters ? Math.ceil(item.meters) : (item.quantity || 1);
          await adjustStock(item.product_id, qty, adminName, "Order cancelled — stock restored");
        }
      }
      await logActivity("Order Status Changed", `${order.order_ref}: ${prev} → ${status}`, adminName);
      return order;
    }

    const orderRes = await dbPool.query("SELECT id, order_ref, status FROM orders WHERE id=$1 OR order_ref=$2", [orderId, orderId]);
    if (!orderRes.rows.length) throw new Error("Order not found");
    const order = orderRes.rows[0];
    const prev = order.status;
    await dbPool.query("UPDATE orders SET status=$1 WHERE id=$2", [status, order.id]);
    await dbPool.query(
      "INSERT INTO order_status_history (order_id, status, admin_name) VALUES ($1,$2,$3)",
      [order.id, status, adminName]
    );
    if (status === "cancelled" && prev !== "cancelled") {
      const items = await dbPool.query("SELECT product_id, quantity, meters FROM order_items WHERE order_id=$1", [order.id]);
      for (const item of items.rows) {
        const qty = item.meters ? Math.ceil(Number(item.meters)) : item.quantity;
        await adjustStock(item.product_id, qty, adminName, "Order cancelled — stock restored");
      }
    }
    await logActivity("Order Status Changed", `${order.order_ref}: ${prev} → ${status}`, adminName);
    return { id: Number(order.id), order_ref: order.order_ref, status };
  }

  async function updatePaymentStatus(orderId, paymentStatus, adminName = "Admin") {
    if (!PAYMENT_STATUSES.includes(paymentStatus)) throw new Error("Invalid payment status");

    if (!USE_DB) {
      const orders = readJson(ORDERS_FILE);
      const order = orders.find((o) => o.id === Number(orderId) || o.order_ref === orderId);
      if (!order) throw new Error("Order not found");
      const prev = order.payment_status || "pending";
      order.payment_status = paymentStatus;
      writeJson(ORDERS_FILE, orders);
      await logActivity("Payment Status Changed", `${order.order_ref}: ${prev} → ${paymentStatus}`, adminName);
      return order;
    }

    const orderRes = await dbPool.query(
      "SELECT id, order_ref, payment_status FROM orders WHERE id=$1 OR order_ref=$2",
      [orderId, orderId]
    );
    if (!orderRes.rows.length) throw new Error("Order not found");
    const order = orderRes.rows[0];
    const prev = order.payment_status || "pending";
    await dbPool.query("UPDATE orders SET payment_status=$1 WHERE id=$2", [paymentStatus, order.id]);
    await logActivity("Payment Status Changed", `${order.order_ref}: ${prev} → ${paymentStatus}`, adminName);
    return { id: Number(order.id), order_ref: order.order_ref, payment_status: paymentStatus };
  }

  async function restoreOrderStock(order, adminName) {
    if (order.status === "cancelled") return;
    for (const item of order.items || []) {
      const qty = item.meters ? Math.ceil(item.meters) : (item.quantity || 1);
      await adjustStock(item.product_id, qty, adminName, "Order deleted — stock restored");
    }
  }

  async function deleteOrder(orderId, adminName = "Admin") {
    if (!USE_DB) {
      const orders = readJson(ORDERS_FILE);
      const idx = orders.findIndex((o) => o.id === Number(orderId) || o.order_ref === orderId);
      if (idx === -1) throw new Error("Order not found");
      const order = orders[idx];
      await restoreOrderStock(order, adminName);
      await logActivity("Order Deleted", `Removed order ${order.order_ref} (${order.customer_name})`, adminName);
      orders.splice(idx, 1);
      writeJson(ORDERS_FILE, orders);
      return { order_ref: order.order_ref };
    }

    const orderRes = await dbPool.query(
      "SELECT id, order_ref, customer_name, status FROM orders WHERE id=$1 OR order_ref=$2",
      [orderId, orderId]
    );
    if (!orderRes.rows.length) throw new Error("Order not found");
    const order = orderRes.rows[0];

    const itemsRes = await dbPool.query(
      "SELECT product_id, quantity, meters FROM order_items WHERE order_id=$1",
      [order.id]
    );
    const orderWithItems = {
      status: order.status,
      items: itemsRes.rows.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        meters: i.meters
      }))
    };
    await restoreOrderStock(orderWithItems, adminName);
    await logActivity("Order Deleted", `Removed order ${order.order_ref} (${order.customer_name})`, adminName);
    await dbPool.query("DELETE FROM orders WHERE id=$1", [order.id]);
    return { order_ref: order.order_ref };
  }

  function filterOrdersByDate(orders, filter, from, to) {
    const now = new Date();
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let start, end;

    switch (filter) {
      case "today":
        start = startOfDay(now);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        break;
      case "yesterday": {
        start = startOfDay(now);
        start.setDate(start.getDate() - 1);
        end = startOfDay(now);
        break;
      }
      case "week": {
        start = startOfDay(now);
        start.setDate(start.getDate() - start.getDay());
        end = new Date(start);
        end.setDate(end.getDate() + 7);
        break;
      }
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        break;
      case "custom":
        if (from) start = new Date(from);
        if (to) {
          end = new Date(to);
          end.setDate(end.getDate() + 1);
        }
        break;
      default:
        return orders;
    }

    return orders.filter((o) => {
      const d = new Date(o.created_at);
      if (start && d < start) return false;
      if (end && d >= end) return false;
      return true;
    });
  }

  function searchOrders(orders, q) {
    if (!q) return orders;
    const term = q.toLowerCase();
    return orders.filter(
      (o) =>
        (o.order_ref && o.order_ref.toLowerCase().includes(term)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
        (o.customer_phone && o.customer_phone.includes(term))
    );
  }

  async function getDashboardStats() {
    const orders = await getOrders();
    const products = await getAllProducts(true);
    const now = new Date();
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const todayStart = startOfDay(now);
    const weekStart = startOfDay(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const inRange = (o, start) => new Date(o.created_at) >= start;
    const revenue = (list) => list.reduce((s, o) => s + Number(o.total_amount || 0), 0);

    const ordersToday = orders.filter((o) => inRange(o, todayStart));
    const ordersWeek = orders.filter((o) => inRange(o, weekStart));
    const ordersMonth = orders.filter((o) => inRange(o, monthStart));
    const ordersYear = orders.filter((o) => inRange(o, yearStart));

    const lowStock = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= LOW_STOCK_THRESHOLD);
    const outOfStock = products.filter((p) => (p.stockQuantity || 0) <= 0);

    return {
      totalOrders: orders.length,
      ordersToday: ordersToday.length,
      ordersWeek: ordersWeek.length,
      ordersMonth: ordersMonth.length,
      ordersYear: ordersYear.length,
      totalRevenue: revenue(orders),
      monthlyRevenue: revenue(ordersMonth),
      totalProducts: products.length,
      lowStockProducts: lowStock.length,
      outOfStockProducts: outOfStock.length,
      lowStockList: lowStock.slice(0, 10),
      outOfStockList: outOfStock.slice(0, 10)
    };
  }

  async function getReports(period = "month") {
    const orders = filterOrdersByDate(await getOrders(), period);
    const revenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const productSales = {};

    for (const order of orders) {
      for (const item of order.items || []) {
        const key = item.product_name;
        if (!productSales[key]) productSales[key] = { name: key, quantity: 0, revenue: 0 };
        productSales[key].quantity += item.meters ? Math.ceil(item.meters) : (item.quantity || 1);
        productSales[key].revenue += Number(item.line_total || 0);
      }
    }

    const bestSelling = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

    return {
      period,
      orderCount: orders.length,
      revenue,
      orders,
      bestSelling
    };
  }

  async function getCustomers() {
    const orders = await getOrders();
    const map = new Map();

    for (const o of orders) {
      const key = o.customer_phone || o.customer_email || o.customer_name;
      if (!map.has(key)) {
        map.set(key, {
          name: o.customer_name,
          phone: o.customer_phone,
          email: o.customer_email || "",
          totalOrders: 0,
          totalSpending: 0,
          lastOrderDate: o.created_at
        });
      }
      const c = map.get(key);
      c.totalOrders += 1;
      c.totalSpending += Number(o.total_amount || 0);
      if (new Date(o.created_at) > new Date(c.lastOrderDate)) c.lastOrderDate = o.created_at;
    }

    return Array.from(map.values()).sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));
  }

  async function getActivityLogs(limit = 200) {
    if (!USE_DB) return readJson(ACTIVITY_FILE).slice(0, limit);
    const result = await dbPool.query(
      "SELECT id, admin_name, action, details, created_at FROM activity_logs ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return result.rows.map((r) => ({
      id: Number(r.id),
      adminName: r.admin_name,
      action: r.action,
      details: r.details,
      createdAt: r.created_at
    }));
  }

  function ordersToCsv(orders) {
    const headers = ["Order ID", "Customer", "Phone", "Email", "Address", "Items", "Total", "Payment Method", "Payment Status", "Status", "Date"];
    const rows = orders.map((o) => {
      const items = (o.items || []).map(i => {
        const colorInfo = i.color ? ` (${i.color})` : '';
        const sizeInfo = i.size ? ` ${i.size}` : '';
        const qtyInfo = i.meters ? `${i.meters}m` : `×${i.quantity}`;
        return `${i.product_name}${colorInfo}${sizeInfo} ${qtyInfo}`;
      }).join('; ');
      
      return [
        o.order_ref,
        o.customer_name,
        o.customer_phone,
        o.customer_email || "",
        `"${(o.customer_address || "").replace(/"/g, '""')}"`,
        `"${items.replace(/"/g, '""')}"`,
        o.total_amount,
        o.payment_method || "COD",
        o.payment_status || "pending",
        o.status,
        o.created_at
      ];
    });
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  function productsToCsv(products) {
    const headers = ["ID", "Name", "Category", "Price", "Stock", "SKU", "Status", "Visible", "Featured"];
    const rows = products.map((p) => [
      p.id, `"${p.name.replace(/"/g, '""')}"`, p.category, p.price, p.stockQuantity, p.sku || "", p.status, p.isVisible, p.featured
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  async function seedProductsIfEmpty() {
    const seedPath = path.join(ROOT, "data", "seed-products.json");
    const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

    if (!USE_DB) {
      const existing = readJson(PRODUCTS_FILE);
      if (existing.length) return;
      const products = seed.map((p, i) => ({ ...p, id: i + 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
      writeJson(PRODUCTS_FILE, products);
      return;
    }

    const count = await dbPool.query("SELECT COUNT(*)::int AS c FROM products");
    if (count.rows[0].c > 0) return;

    for (const p of seed) {
      await saveProduct(p, "System");
    }
  }

  async function initAdminTables() {
    if (!USE_DB) {
      ensureDataFiles();
      if (!fs.existsSync(PRODUCTS_FILE)) writeJson(PRODUCTS_FILE, []);
      if (!fs.existsSync(ACTIVITY_FILE)) writeJson(ACTIVITY_FILE, []);
      if (!fs.existsSync(NOTIFICATIONS_FILE)) writeJson(NOTIFICATIONS_FILE, []);
      await seedProductsIfEmpty();
      return;
    }

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(220) NOT NULL,
        description TEXT,
        price NUMERIC(12,2) NOT NULL DEFAULT 0,
        original_price NUMERIC(12,2),
        category VARCHAR(50) NOT NULL,
        sku VARCHAR(80),
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        is_visible BOOLEAN NOT NULL DEFAULT true,
        is_featured BOOLEAN NOT NULL DEFAULT false,
        is_new BOOLEAN NOT NULL DEFAULT false,
        badge VARCHAR(30),
        rating NUMERIC(3,1) DEFAULT 4.5,
        reviews INTEGER DEFAULT 0,
        image TEXT,
        images JSONB DEFAULT '[]',
        sizes JSONB DEFAULT '[]',
        colors JSONB DEFAULT '[]',
        reference_meters NUMERIC(8,2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id BIGSERIAL PRIMARY KEY,
        admin_name VARCHAR(120) NOT NULL DEFAULT 'Admin',
        action VARCHAR(100) NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id BIGSERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT,
        order_ref VARCHAR(32),
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        admin_name VARCHAR(120) DEFAULT 'Admin',
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await dbPool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'COD';`);
    await dbPool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';`);

    await seedProductsIfEmpty();
  }

  function registerRoutes(app) {
    app.get("/api/products", async (_req, res) => {
      try {
        const products = await getAllProducts(false);
        res.json({ success: true, products });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/products/:id", async (req, res) => {
      try {
        const product = await getProductById(req.params.id, false);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        res.json({ success: true, product });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/events", (req, res) => {
      if (!isAdmin(req)) return res.status(401).end();
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    });

    app.get("/api/events", (req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.flushHeaders();
      publicSseClients.add(res);
      req.on("close", () => publicSseClients.delete(res));
      res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    });

    app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
      try {
        res.json({ success: true, stats: await getDashboardStats() });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/products", requireAdmin, async (_req, res) => {
      try {
        res.json({ success: true, products: await getAllProducts(true) });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.post("/api/admin/products", requireAdmin, async (req, res) => {
      try {
        const product = await saveProduct(req.body, req.body.adminName || "Admin");
        res.json({ success: true, product });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
      try {
        const product = await saveProduct({ ...req.body, id: Number(req.params.id) }, req.body.adminName || "Admin");
        res.json({ success: true, product });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
      try {
        await deleteProduct(Number(req.params.id), req.query.adminName || "Admin", req.query.soft === "true");
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.post("/api/admin/products/:id/duplicate", requireAdmin, async (req, res) => {
      try {
        const product = await duplicateProduct(Number(req.params.id), req.body.adminName || "Admin");
        res.json({ success: true, product });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.post("/api/admin/products/:id/stock", requireAdmin, async (req, res) => {
      try {
        const { delta, adminName, reason } = req.body;
        const newStock = await adjustStock(
          Number(req.params.id),
          Number(delta),
          adminName || "Admin",
          reason || "Manual stock adjustment"
        );
        res.json({ success: true, stock: newStock });
      } catch (err) {
        res.status(400).json({ success: false, message: err.message });
      }
    });

    app.post("/api/admin/upload", requireAdmin, upload.array("images", 10), async (req, res) => {
      try {
        const urls = [];
        for (const file of req.files || []) {
          const name = `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
          const outPath = path.join(UPLOADS_DIR, name);
          if (sharp) {
            await sharp(file.buffer).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(outPath);
          } else {
            const ext = path.extname(file.originalname) || ".jpg";
            const fallbackName = name.replace(".webp", ext);
            fs.writeFileSync(path.join(UPLOADS_DIR, fallbackName), file.buffer);
            urls.push(`/uploads/${fallbackName}`);
            continue;
          }
          urls.push(`/uploads/${name}`);
        }
        res.json({ success: true, urls });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/orders", requireAdmin, async (req, res) => {
      try {
        let orders = await getOrders();
        orders = filterOrdersByDate(orders, req.query.filter, req.query.from, req.query.to);
        orders = searchOrders(orders, req.query.search);
        if (req.query.status) orders = orders.filter((o) => o.status === req.query.status);
        res.json({ success: true, orders });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
      try {
        const order = await updateOrderStatus(req.params.id, req.body.status, req.body.adminName || "Admin");
        res.json({ success: true, order });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.patch("/api/admin/orders/:id/payment-status", requireAdmin, async (req, res) => {
      try {
        const order = await updatePaymentStatus(req.params.id, req.body.paymentStatus, req.body.adminName || "Admin");
        res.json({ success: true, order });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.delete("/api/admin/orders/:id", requireAdmin, async (req, res) => {
      try {
        const result = await deleteOrder(req.params.id, req.query.adminName || req.body?.adminName || "Admin");
        res.json({ success: true, ...result });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/notifications", requireAdmin, async (req, res) => {
      try {
        res.json({ success: true, notifications: await getNotifications(req.query.unread === "true") });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.post("/api/admin/notifications/read", requireAdmin, async (req, res) => {
      try {
        await markNotificationsRead(req.body.ids);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/activity", requireAdmin, async (_req, res) => {
      try {
        res.json({ success: true, logs: await getActivityLogs() });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/customers", requireAdmin, async (_req, res) => {
      try {
        res.json({ success: true, customers: await getCustomers() });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/reports", requireAdmin, async (req, res) => {
      try {
        res.json({ success: true, report: await getReports(req.query.period || "month") });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/export/orders", requireAdmin, async (req, res) => {
      try {
        let orders = await getOrders();
        orders = filterOrdersByDate(orders, req.query.filter, req.query.from, req.query.to);
        const format = req.query.format || "csv";

        if (format === "csv") {
          res.setHeader("Content-Type", "text/csv");
          res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
          return res.send(ordersToCsv(orders));
        }
        if (format === "xlsx") {
          const ws = XLSX.utils.json_to_sheet(orders.map((o) => {
            const items = (o.items || []).map(i => {
              const colorInfo = i.color ? ` (${i.color})` : '';
              const sizeInfo = i.size ? ` ${i.size}` : '';
              const qtyInfo = i.meters ? `${i.meters}m` : `×${i.quantity}`;
              return `${i.product_name}${colorInfo}${sizeInfo} ${qtyInfo}`;
            }).join('; ');
            
            return {
              "Order ID": o.order_ref,
              Customer: o.customer_name,
              Phone: o.customer_phone,
              Email: o.customer_email,
              Address: o.customer_address,
              Items: items,
              Total: o.total_amount,
              "Payment Method": o.payment_method || "COD",
              "Payment Status": o.payment_status || "pending",
              Status: o.status,
              Date: o.created_at
            };
          }));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Orders");
          const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          res.setHeader("Content-Disposition", "attachment; filename=orders.xlsx");
          return res.send(buf);
        }
        if (format === "pdf") {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", "attachment; filename=orders.pdf");
          const doc = new PDFDocument({ margin: 40 });
          doc.pipe(res);
          doc.fontSize(16).text("MISRI CLOTH — Orders Report", { underline: true });
          doc.moveDown();
          orders.forEach((o) => {
            doc.fontSize(12).text(`${o.order_ref} | ${o.customer_name} | Rs.${o.total_amount} | ${o.status} | ${new Date(o.created_at).toLocaleString()}`);
            doc.fontSize(10).fillColor('gray');
            (o.items || []).forEach(item => {
              const colorInfo = item.color ? ` (${item.color})` : '';
              const sizeInfo = item.size ? ` ${item.size}` : '';
              const qtyInfo = item.meters ? `${item.meters}m` : `×${item.quantity}`;
              doc.text(`  - ${item.product_name}${colorInfo}${sizeInfo} ${qtyInfo} @ Rs.${item.unit_price}`);
            });
            doc.fillColor('black');
            doc.moveDown();
          });
          doc.end();
          return;
        }
        res.status(400).json({ success: false, message: "Invalid format" });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/export/products", requireAdmin, async (req, res) => {
      try {
        const products = await getAllProducts(true);
        const format = req.query.format || "csv";
        if (format === "csv") {
          res.setHeader("Content-Type", "text/csv");
          res.setHeader("Content-Disposition", "attachment; filename=products.csv");
          return res.send(productsToCsv(products));
        }
        if (format === "xlsx") {
          const ws = XLSX.utils.json_to_sheet(products.map((p) => ({
            ID: p.id, Name: p.name, Category: p.category, Price: p.price, Stock: p.stockQuantity,
            SKU: p.sku, Status: p.status, Visible: p.isVisible, Featured: p.featured
          })));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Products");
          const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");
          return res.send(buf);
        }
        res.status(400).json({ success: false, message: "Invalid format" });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.get("/api/admin/export/revenue", requireAdmin, async (req, res) => {
      try {
        const report = await getReports(req.query.period || "month");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=revenue-report.pdf");
        const doc = new PDFDocument({ margin: 40 });
        doc.pipe(res);
        doc.fontSize(16).text("MISRI CLOTH — Revenue Report", { underline: true });
        doc.fontSize(12).text(`Period: ${report.period}`);
        doc.text(`Orders: ${report.orderCount}`);
        doc.text(`Revenue: Rs. ${report.revenue.toLocaleString()}`);
        doc.moveDown().fontSize(14).text("Best Selling Products");
        report.bestSelling.forEach((p, i) => {
          doc.fontSize(10).text(`${i + 1}. ${p.name} — ${p.quantity} sold — Rs.${p.revenue.toLocaleString()}`);
        });
        doc.end();
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    app.post("/api/admin/login-log", requireAdmin, async (req, res) => {
      try {
        await logActivity(req.body.action || "Admin Login", req.body.details || "", req.body.adminName || "Admin");
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    });

    // Periodic cleanup of SSE connections
    setInterval(() => {
      console.log(`SSE Connection Stats - Admin: ${sseClients.size}, Public: ${publicSseClients.size}`);
    }, 120000); // Log every 2 minutes
  }

  return {
    initAdminTables,
    registerRoutes,
    createNotification,
    logActivity,
    adjustStock,
    getProductById,
    getAllProducts,
    broadcastEvent
  };
}

module.exports = { createAdminApi, ORDER_STATUSES, PAYMENT_STATUSES, LOW_STOCK_THRESHOLD };
