import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "../uploads/pharmacy");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }

    cb(null, true);
  },
});

const sampleProducts = [
  ["Paracetamol 500mg", "Pain Relief", "Square Pharmaceuticals", 3.0, 2.5, 17, 1, "assets/images/paracetamol.jpg"],
  ["Omeprazole 20mg", "Gastric", "Incepta Pharmaceuticals", 10.0, 8.5, 15, 0, "assets/images/omeprazole.jpg"],
  ["Metformin 500mg", "Diabetes", "Beximco Pharmaceuticals", 5.0, 4.25, 15, 1, "assets/images/metformin.jpg"],
  ["Atorvastatin 20mg", "Cardiovascular", "Renata Limited", 15.0, 12.75, 15, 0, "assets/images/atorvastatin.jpg"],
  ["Amoxicillin 500mg", "Antibiotics", "ACI Limited", 8.0, 6.8, 15, 0, "assets/images/amoxicillin.jpg"],
  ["Losartan 50mg", "Cardiovascular", "Square Pharmaceuticals", 11.0, 9.35, 15, 1, "assets/images/losartan.jpg"],
  ["Cetirizine 10mg", "Allergy", "Incepta Pharmaceuticals", 4.0, 3.4, 15, 0, "assets/images/cetirizine.jpg"],
  ["Vitamin D3 1000 IU", "Vitamins", "Beximco Pharmaceuticals", 18.0, 15.3, 15, 1, "assets/images/vitamin-d3.jpg"],
  ["Amlodipine 5mg", "Cardiovascular", "Renata Limited", 9.0, 7.65, 15, 0, "assets/images/amlodipine.jpg"],
  ["Azithromycin 500mg", "Antibiotics", "Square Pharmaceuticals", 30.0, 25.5, 15, 1, "assets/images/azithromycin.jpg"],
  ["Montelukast 10mg", "Respiratory", "ACI Limited", 21.0, 17.85, 15, 0, "assets/images/montelukast.jpg"],
  ["Folic Acid 5mg", "Vitamins", "Incepta Pharmaceuticals", 3.0, 2.55, 15, 1, "assets/images/folic-acid.jpg"],
  ["Ranitidine 150mg", "Gastric", "Beximco Pharmaceuticals", 5.0, 4.25, 15, 0, "assets/images/ranitidine.jpg"],
  ["Diclofenac 50mg", "Pain Relief", "Renata Limited", 7.0, 5.95, 15, 1, "assets/images/diclofenac.jpg"],
  ["Calcium Carbonate 500mg", "Supplements", "Square Pharmaceuticals", 10.0, 8.5, 15, 0, "assets/images/calcium.jpg"],
  ["Fluconazole 150mg", "Antifungal", "ACI Limited", 50.0, 42.5, 15, 1, "assets/images/fluconazole.jpg"],
];

const locations = {
  Dhaka: ["Dhaka", "Gazipur", "Narayanganj", "Tangail"],
  Chattogram: ["Chattogram", "Cox's Bazar", "Cumilla", "Feni"],
  Rajshahi: ["Rajshahi", "Bogura", "Pabna"],
  Khulna: ["Khulna", "Jashore", "Kushtia"],
  Barishal: ["Barishal", "Bhola", "Patuakhali"],
  Sylhet: ["Sylhet", "Moulvibazar", "Habiganj"],
  Rangpur: ["Rangpur", "Dinajpur", "Gaibandha"],
  Mymensingh: ["Mymensingh", "Jamalpur", "Netrokona"],
};

function requirePharmacyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: " login required.",
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.PHARMACY_ADMIN_JWT_SECRET || process.env.JWT_SECRET
    );

    if (decoded.role !== "pharmacy_admin") {
      return res.status(403).json({
        success: false,
        message: "Only pharmacy admin can access this dashboard.",
      });
    }

    req.pharmacyAdmin = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired pharmacy admin login.",
    });
  }
}



function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function clean(value) {
  return String(value ?? "").trim();
}

function makeOrderId() {
  return "ORD" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch {
      req.user = null;
    }
  }

  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    next();
  });
}

function normalizeProduct(product) {
  return {
    ...product,
    id: Number(product.id),
    mrp: money(product.mrp),
    price: money(product.price),
    discount: Number(product.discount || 0),
    is_special_offer: Number(product.is_special_offer || 0) === 1,
    in_stock: Number(product.in_stock ?? 1) === 1,
  };
}

async function tableHasColumn(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (!(await tableHasColumn(table, column))) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function ensurePharmacyTables() {
    await pool.query(`
  CREATE TABLE IF NOT EXISTS pharmacy_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);

await pool.query(`
  INSERT INTO pharmacy_settings (setting_key, setting_value)
  VALUES
    ('delivery_charge', '60'),
    ('free_delivery_threshold', '500')
  ON DUPLICATE KEY UPDATE setting_key = setting_key
`);

await addColumnIfMissing("products", "description", "TEXT NULL AFTER manufacturer");
await addColumnIfMissing("products", "sku", "VARCHAR(100) NULL AFTER name");
await addColumnIfMissing("products", "stock_quantity", "INT DEFAULT 100 AFTER in_stock");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      image VARCHAR(255) NULL,
      mrp DECIMAL(10,2) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      discount INT NOT NULL DEFAULT 0,
      is_special_offer TINYINT(1) DEFAULT 0,
      in_stock TINYINT(1) DEFAULT 1,
      category VARCHAR(100) NOT NULL,
      manufacturer VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      order_id VARCHAR(50) NOT NULL UNIQUE,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255) NULL,
      phone_number VARCHAR(30) NOT NULL,
      division VARCHAR(100) NOT NULL,
      district VARCHAR(100) NOT NULL,
      address TEXT NOT NULL,
      landmark VARCHAR(255) NULL,
      delivery_time VARCHAR(50) NULL,
      special_instructions TEXT NULL,
      total_mrp DECIMAL(10,2) NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      total_savings DECIMAL(10,2) NOT NULL,
      delivery_charge DECIMAL(10,2) DEFAULT 0.00,
      final_total DECIMAL(10,2) NOT NULL,
      status ENUM('pending','confirmed','processing','shipped','delivered','cancelled') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(50) NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      quantity INT DEFAULT 1
    )
  `);

  await addColumnIfMissing("orders", "user_id", "INT NULL AFTER id");
  await addColumnIfMissing("orders", "customer_email", "VARCHAR(255) NULL AFTER customer_name");
  await addColumnIfMissing("products", "in_stock", "TINYINT(1) DEFAULT 1 AFTER is_special_offer");

  const [countRows] = await pool.query("SELECT COUNT(*) AS count FROM products");

  const [settingsRows] = await pool.query("SELECT setting_key, setting_value FROM pharmacy_settings");

const settings = Object.fromEntries(
  settingsRows.map((row) => [row.setting_key, row.setting_value])
);



  if (Number(countRows[0]?.count || 0) === 0) {
    await pool.query(
      `INSERT INTO products
       (name, category, manufacturer, mrp, price, discount, is_special_offer, image)
       VALUES ?`,
      [
        sampleProducts.map(([name, category, manufacturer, mrp, price, discount, special, image]) => [
          name,
          category,
          manufacturer,
          mrp,
          price,
          discount,
          special,
          image,
        ]),
      ]
    );
  }
}

async function getOrderDetails(orderId) {
  const [orders] = await pool.query("SELECT * FROM orders WHERE order_id = ? LIMIT 1", [orderId]);

  if (!orders.length) return null;

  const [items] = await pool.query(
    `SELECT oi.*, p.image, p.mrp, p.category, p.manufacturer
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [orderId]
  );

  const order = orders[0];

  return {
    ...order,
    total_mrp: money(order.total_mrp),
    total_amount: money(order.total_amount),
    total_savings: money(order.total_savings),
    delivery_charge: money(order.delivery_charge),
    final_total: money(order.final_total),
    items: items.map((item) => ({
      ...item,
      id: Number(item.id),
      product_id: Number(item.product_id),
      quantity: Number(item.quantity || 1),
      price: money(item.price),
      mrp: money(item.mrp || item.price),
      line_total: money(Number(item.price || 0) * Number(item.quantity || 1)),
    })),
  };
}

router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  const adminUsername = process.env.PHARMACY_ADMIN_USERNAME;
  const adminPassword = process.env.PHARMACY_ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return res.status(500).json({
      success: false,
      message: "Pharmacy admin credentials are not configured.",
    });
  }

  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({
      success: false,
      message: "Invalid pharmacy admin username or password.",
    });
  }

  const token = jwt.sign(
    {
      role: "pharmacy_admin",
      username: adminUsername,
    },
    process.env.PHARMACY_ADMIN_JWT_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: "8h",
    }
  );

  res.json({
    success: true,
    message: "Pharmacy admin login successful.",
    token,
    admin: {
      username: adminUsername,
      role: "pharmacy_admin",
    },
  });
});

router.get("/admin/summary", requirePharmacyAdmin, async (_req, res) => {
  const [[productStats], [orderStats], [recentOrders], [settingsRows]] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS total_products,
        SUM(in_stock = 1) AS in_stock,
        SUM(is_special_offer = 1) AS special_offers,
        SUM(stock_quantity <= 10) AS low_stock
      FROM products
    `),
    pool.query(`
      SELECT
        COUNT(*) AS total_orders,
        SUM(status = 'pending') AS pending_orders,
        SUM(status = 'delivered') AS delivered_orders,
        COALESCE(SUM(final_total), 0) AS total_sales
      FROM orders
    `),
    pool.query(`
      SELECT *
      FROM orders
      ORDER BY created_at DESC
      LIMIT 8
    `),
    pool.query("SELECT setting_key, setting_value FROM pharmacy_settings"),
  ]);

  const settings = Object.fromEntries(
    settingsRows.map((row) => [row.setting_key, row.setting_value])
  );

  res.json({
    success: true,
    data: {
      products: productStats[0],
      orders: orderStats[0],
      recentOrders,
      settings: {
        delivery_charge: Number(settings.delivery_charge || 60),
        free_delivery_threshold: Number(settings.free_delivery_threshold || 500),
      },
    },
  });
});

router.get("/admin/products", requirePharmacyAdmin, async (req, res) => {
  const search = clean(req.query.search);

  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (search) {
    sql += " AND (name LIKE ? OR category LIKE ? OR manufacturer LIKE ? OR sku LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY id DESC";

  const [rows] = await pool.query(sql, params);

  res.json({
    success: true,
    data: rows.map(normalizeProduct),
  });
});

router.post(
  "/admin/products",
  requirePharmacyAdmin,
  upload.single("image"),
  async (req, res) => {
    const {
      name,
      sku,
      category,
      manufacturer,
      description,
      mrp,
      price,
      discount,
      is_special_offer,
      in_stock,
      stock_quantity,
    } = req.body;

    if (!name || !category || !manufacturer || !mrp || !price) {
      return res.status(400).json({
        success: false,
        message: "Name, category, manufacturer, MRP, and price are required.",
      });
    }

    const image = req.file ? `/uploads/pharmacy/${req.file.filename}` : "";

    const [result] = await pool.query(
      `INSERT INTO products
       (name, sku, category, manufacturer, description, mrp, price, discount, is_special_offer, in_stock, stock_quantity, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clean(name),
        clean(sku),
        clean(category),
        clean(manufacturer),
        clean(description),
        Number(mrp),
        Number(price),
        Number(discount || 0),
        Number(is_special_offer || 0),
        Number(in_stock ?? 1),
        Number(stock_quantity || 0),
        image,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Product added successfully.",
      data: {
        id: result.insertId,
        image,
      },
    });
  }
);

router.patch(
  "/admin/products/:id",
  requirePharmacyAdmin,
  upload.single("image"),
  async (req, res) => {
    const productId = Number(req.params.id);

    const [existingRows] = await pool.query("SELECT * FROM products WHERE id = ? LIMIT 1", [
      productId,
    ]);

    if (!existingRows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const current = existingRows[0];

    const image = req.file
      ? `/uploads/pharmacy/${req.file.filename}`
      : current.image;

    await pool.query(
      `UPDATE products SET
        name = ?,
        sku = ?,
        category = ?,
        manufacturer = ?,
        description = ?,
        mrp = ?,
        price = ?,
        discount = ?,
        is_special_offer = ?,
        in_stock = ?,
        stock_quantity = ?,
        image = ?
       WHERE id = ?`,
      [
        clean(req.body.name || current.name),
        clean(req.body.sku || current.sku || ""),
        clean(req.body.category || current.category),
        clean(req.body.manufacturer || current.manufacturer),
        clean(req.body.description || current.description || ""),
        Number(req.body.mrp ?? current.mrp),
        Number(req.body.price ?? current.price),
        Number(req.body.discount ?? current.discount ?? 0),
        Number(req.body.is_special_offer ?? current.is_special_offer ?? 0),
        Number(req.body.in_stock ?? current.in_stock ?? 1),
        Number(req.body.stock_quantity ?? current.stock_quantity ?? 0),
        image,
        productId,
      ]
    );

    res.json({
      success: true,
      message: "Product updated successfully.",
      data: {
        id: productId,
        image,
      },
    });
  }
);

router.delete("/admin/products/:id", requirePharmacyAdmin, async (req, res) => {
  const productId = Number(req.params.id);

  const [result] = await pool.query("DELETE FROM products WHERE id = ?", [productId]);

  if (result.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: "Product not found.",
    });
  }

  res.json({
    success: true,
    message: "Product deleted successfully.",
  });
});

router.get("/admin/orders", requirePharmacyAdmin, async (req, res) => {
  const status = clean(req.query.status);

  let sql = "SELECT order_id FROM orders WHERE 1=1";
  const params = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY created_at DESC LIMIT 100";

  const [rows] = await pool.query(sql, params);

  const orders = [];

  for (const row of rows) {
    const order = await getOrderDetails(row.order_id);
    if (order) orders.push(order);
  }

  res.json({
    success: true,
    data: orders,
  });
});

router.patch("/admin/orders/:orderId/status", requirePharmacyAdmin, async (req, res) => {
  const { status } = req.body;

  const allowed = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order status.",
    });
  }

  const [result] = await pool.query(
    "UPDATE orders SET status = ? WHERE order_id = ?",
    [status, req.params.orderId]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: "Order not found.",
    });
  }

  const order = await getOrderDetails(req.params.orderId);

  res.json({
    success: true,
    message: "Delivery status updated successfully.",
    data: order,
  });
});

router.patch("/admin/settings/delivery", requirePharmacyAdmin, async (req, res) => {
  const deliveryCharge = Math.max(0, Number(req.body.delivery_charge || 0));
  const freeThreshold = Math.max(0, Number(req.body.free_delivery_threshold || 0));

  await pool.query(
    `INSERT INTO pharmacy_settings (setting_key, setting_value)
     VALUES ('delivery_charge', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [String(deliveryCharge)]
  );

  await pool.query(
    `INSERT INTO pharmacy_settings (setting_key, setting_value)
     VALUES ('free_delivery_threshold', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [String(freeThreshold)]
  );

  res.json({
    success: true,
    message: "Delivery settings updated successfully.",
    data: {
      delivery_charge: deliveryCharge,
      free_delivery_threshold: freeThreshold,
    },
  });
});

router.use(async (_req, _res, next) => {
  try {
    await ensurePharmacyTables();
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/meta", async (_req, res) => {
  const [[statsRows], [categories], [manufacturers]] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS total_products,
        SUM(is_special_offer = 1) AS special_offers,
        SUM(in_stock = 1) AS in_stock
      FROM products
    `),
    pool.query(`
      SELECT category, COUNT(*) AS count
      FROM products
      GROUP BY category
      ORDER BY category ASC
    `),
    pool.query(`
      SELECT manufacturer, COUNT(*) AS count
      FROM products
      GROUP BY manufacturer
      ORDER BY manufacturer ASC
    `),
  ]);

  res.json({
    success: true,
    data: {
      stats: statsRows[0] || {
        total_products: 0,
        special_offers: 0,
        in_stock: 0,
      },
      categories,
      manufacturers,
      locations,
      delivery: {
        free_threshold: 500,
        charge: 60,
      },
    },
  });
});

router.get("/products", async (req, res) => {
  const search = clean(req.query.search);
  const category = clean(req.query.category);
  const manufacturer = clean(req.query.manufacturer);
  const specialOnly = String(req.query.special || "") === "1";

  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (search) {
    sql += " AND (name LIKE ? OR category LIKE ? OR manufacturer LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }

  if (manufacturer) {
    sql += " AND manufacturer = ?";
    params.push(manufacturer);
  }

  if (specialOnly) {
    sql += " AND is_special_offer = 1";
  }

  sql += " ORDER BY is_special_offer DESC, in_stock DESC, name ASC";

  const [rows] = await pool.query(sql, params);

  res.json({
    success: true,
    data: rows.map(normalizeProduct),
  });
});

router.post("/orders", optionalAuth, async (req, res) => {
  const {
    customer_name,
    phone_number,
    division,
    district,
    address,
    landmark,
    delivery_time,
    special_instructions,
    items,
  } = req.body;

  if (!customer_name || !phone_number || !division || !district || !address) {
    return res.status(400).json({
      success: false,
      message: "Customer name, phone number, division, district, and address are required.",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Cart is empty.",
    });
  }

  const productIds = [...new Set(items.map((item) => Number(item.id)).filter(Boolean))];

  if (!productIds.length) {
    return res.status(400).json({
      success: false,
      message: "Cart products are invalid.",
    });
  }

  const [products] = await pool.query("SELECT * FROM products WHERE id IN (?) AND in_stock = 1", [productIds]);
  const productMap = new Map(products.map((product) => [Number(product.id), normalizeProduct(product)]));

  const orderItems = [];

  for (const item of items) {
    const product = productMap.get(Number(item.id));

    if (!product) continue;

    orderItems.push({
      ...product,
      quantity: Math.max(1, Number(item.quantity || 1)),
    });
  }

  if (!orderItems.length) {
    return res.status(400).json({
      success: false,
      message: "No in-stock products found in cart.",
    });
  }

  const totalMrp = money(orderItems.reduce((sum, item) => sum + item.mrp * item.quantity, 0));
  const totalAmount = money(orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const totalSavings = money(totalMrp - totalAmount);
  const [settingsRows] = await pool.query("SELECT setting_key, setting_value FROM pharmacy_settings");

const settings = Object.fromEntries(
  settingsRows.map((row) => [row.setting_key, row.setting_value])
);

const freeThreshold = Number(settings.free_delivery_threshold || 500);
const deliveryFee = Number(settings.delivery_charge || 60);
const deliveryCharge = totalAmount >= freeThreshold ? 0 : deliveryFee;
  const finalTotal = money(totalAmount + deliveryCharge);
  const orderId = makeOrderId();

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO orders
       (user_id, order_id, customer_name, customer_email, phone_number, division, district, address, landmark,
        delivery_time, special_instructions, total_mrp, total_amount, total_savings, delivery_charge, final_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id || null,
        orderId,
        clean(customer_name),
        req.user?.email || null,
        clean(phone_number),
        clean(division),
        clean(district),
        clean(address),
        clean(landmark),
        clean(delivery_time),
        clean(special_instructions),
        totalMrp,
        totalAmount,
        totalSavings,
        deliveryCharge,
        finalTotal,
      ]
    );

    for (const item of orderItems) {
      await connection.query(
        `INSERT INTO order_items
         (order_id, product_id, product_name, price, quantity)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.id, item.name, item.price, item.quantity]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const order = await getOrderDetails(orderId);

  res.status(201).json({
    success: true,
    message: "Order placed successfully.",
    data: order,
  });
});

router.get("/orders/:orderId", async (req, res) => {
  const order = await getOrderDetails(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found.",
    });
  }

  res.json({
    success: true,
    data: order,
  });
});

router.get("/my-orders", requireAuth, async (req, res) => {
  const phone = clean(req.query.phone);

  let sql = `
    SELECT order_id
    FROM orders
    WHERE user_id = ? OR customer_email = ? OR customer_name = ?
  `;

  const params = [req.user.id, req.user.email || "", req.user.name || ""];

  if (phone) {
    sql += " OR phone_number = ?";
    params.push(phone);
  }

  sql += " ORDER BY created_at DESC LIMIT 50";

  const [rows] = await pool.query(sql, params);
  const orders = [];

  for (const row of rows) {
    const order = await getOrderDetails(row.order_id);
    if (order) orders.push(order);
  }

  res.json({
    success: true,
    data: orders,
  });
});

router.use((error, _req, res, _next) => {
  console.error("Pharmacy route error:", error);

  res.status(500).json({
    success: false,
    message: "Pharmacy service error: " + error.message,
  });
});

export default router;