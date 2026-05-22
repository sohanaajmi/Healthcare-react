import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import bcrypt from "bcryptjs";

const router = express.Router();

const serviceTypes = ["basic", "advanced", "icu", "neonatal", "cardiac"];
const availabilityTypes = ["24/7", "day_only", "emergency_only"];

const sampleAmbulances = [
  {
    service_name: "RapidCare Ambulance Service",
    service_type: "advanced",
    division: "Dhaka",
    district: "Dhaka",
    area: "Gulshan",
    address: "Gulshan-2, Dhaka",
    latitude: 23.7946,
    longitude: 90.4143,
    phone_primary: "01711111111",
    phone_secondary: "01811111111",
    email: "rapidcare@example.com",
    contact_person: "Mr. Rahman",
    website: "https://example.com",
    equipment: "Oxygen, Stretcher, Cardiac Monitor, First Aid",
    description: "Fast emergency ambulance service with trained support staff.",
    availability: "24/7",
    verified: 1,
    rating: 4.8,
    total_reviews: 24,
    base_charge: 800,
    price_per_km: 65,
  },
  {
    service_name: "LifeLine ICU Ambulance",
    service_type: "icu",
    division: "Dhaka",
    district: "Dhaka",
    area: "Dhanmondi",
    address: "Dhanmondi 27, Dhaka",
    latitude: 23.7465,
    longitude: 90.376,
    phone_primary: "01722222222",
    phone_secondary: "01822222222",
    email: "lifeline@example.com",
    contact_person: "Dr. Karim",
    website: "",
    equipment: "ICU Bed, Ventilator, Oxygen, Defibrillator, Monitor",
    description: "ICU ambulance for critical patients and inter-hospital transfer.",
    availability: "24/7",
    verified: 1,
    rating: 4.9,
    total_reviews: 31,
    base_charge: 1500,
    price_per_km: 120,
  },
  {
    service_name: "Green Path Ambulance",
    service_type: "basic",
    division: "Chattogram",
    district: "Chattogram",
    area: "Agrabad",
    address: "Agrabad Commercial Area, Chattogram",
    latitude: 22.3237,
    longitude: 91.8123,
    phone_primary: "01733333333",
    phone_secondary: "",
    email: "greenpath@example.com",
    contact_person: "Mr. Alam",
    website: "",
    equipment: "Oxygen, Stretcher, First Aid",
    description: "Affordable basic ambulance support for city and nearby areas.",
    availability: "day_only",
    verified: 1,
    rating: 4.5,
    total_reviews: 12,
    base_charge: 600,
    price_per_km: 45,
  },
  {
    service_name: "Cardiac Emergency Transport",
    service_type: "cardiac",
    division: "Dhaka",
    district: "Gazipur",
    area: "Tongi",
    address: "Tongi, Gazipur",
    latitude: 23.8917,
    longitude: 90.4023,
    phone_primary: "01744444444",
    phone_secondary: "01844444444",
    email: "cardiac@example.com",
    contact_person: "Mr. Hasan",
    website: "",
    equipment: "Defibrillator, Oxygen, Cardiac Monitor, Emergency Medicines",
    description: "Cardiac ambulance support for heart patients.",
    availability: "emergency_only",
    verified: 1,
    rating: 4.7,
    total_reviews: 19,
    base_charge: 1200,
    price_per_km: 95,
  },
  {
    service_name: "Newborn Neonatal Ambulance",
    service_type: "neonatal",
    division: "Sylhet",
    district: "Sylhet",
    area: "Zindabazar",
    address: "Zindabazar, Sylhet",
    latitude: 24.8949,
    longitude: 91.8687,
    phone_primary: "01755555555",
    phone_secondary: "",
    email: "neonatal@example.com",
    contact_person: "Ms. Nabila",
    website: "",
    equipment: "Neonatal Incubator, Oxygen, Baby Warmer, Monitor",
    description: "Special neonatal transport for newborn babies.",
    availability: "24/7",
    verified: 1,
    rating: 4.6,
    total_reviews: 16,
    base_charge: 1400,
    price_per_km: 110,
  },
];

function clean(value) {
  return String(value ?? "").trim();
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
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

async function tableHasColumn(table, column) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [table, column]
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (!(await tableHasColumn(table, column))) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

function normalizeService(row) {
  return {
    ...row,
    id: Number(row.id),
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    rating: Number(row.rating || 0),
    total_reviews: Number(row.total_reviews || 0),
    verified: Number(row.verified || 0) === 1,
    is_active: Number(row.is_active ?? 1) === 1,
    base_charge: money(row.base_charge),
    price_per_km: money(row.price_per_km),
    example_fare_10km: money(Number(row.base_charge || 0) + Number(row.price_per_km || 0) * 10),
    equipment_items: clean(row.equipment)
      ? clean(row.equipment)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : ["Oxygen", "First Aid", "Stretcher"],
  };
}

async function ensureAmbulanceTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ambulance_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      service_name VARCHAR(180) NOT NULL,
      service_type VARCHAR(40) NOT NULL DEFAULT 'advanced',
      division VARCHAR(100) NOT NULL,
      district VARCHAR(100) NOT NULL,
      area VARCHAR(120) NULL,
      address TEXT NULL,
      latitude DECIMAL(10,7) NULL,
      longitude DECIMAL(10,7) NULL,
      phone_primary VARCHAR(30) NOT NULL,
      phone_secondary VARCHAR(30) NULL,
      email VARCHAR(180) NULL,
      contact_person VARCHAR(150) NULL,
      website VARCHAR(255) NULL,
      equipment TEXT NULL,
      description TEXT NULL,
      availability VARCHAR(40) NOT NULL DEFAULT '24/7',
      verified TINYINT(1) DEFAULT 0,
      rating DECIMAL(3,2) DEFAULT 0.00,
      total_reviews INT DEFAULT 0,
      base_charge DECIMAL(10,2) DEFAULT 0.00,
      price_per_km DECIMAL(10,2) DEFAULT 0.00,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await addColumnIfMissing("ambulance_services", "latitude", "DECIMAL(10,7) NULL AFTER address");
  await addColumnIfMissing("ambulance_services", "longitude", "DECIMAL(10,7) NULL AFTER latitude");
  await addColumnIfMissing("ambulance_services", "is_active", "TINYINT(1) DEFAULT 1 AFTER price_per_km");
  await addColumnIfMissing("ambulance_services", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ambulance_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ambulance_id INT NOT NULL,
      reviewer_name VARCHAR(150) NOT NULL,
      reviewer_phone VARCHAR(30) NULL,
      rating INT NOT NULL,
      review_text TEXT NULL,
      service_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ambulance_reviews_ambulance (ambulance_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ambulance_update_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ambulance_id INT NOT NULL,
      user_id INT NULL,
      requester_name VARCHAR(150) NOT NULL,
      requester_phone VARCHAR(30) NOT NULL,
      requester_email VARCHAR(180) NULL,
      proposed_service_name VARCHAR(180) NULL,
      proposed_phone_primary VARCHAR(30) NULL,
      proposed_phone_secondary VARCHAR(30) NULL,
      proposed_division VARCHAR(100) NULL,
      proposed_district VARCHAR(100) NULL,
      proposed_area VARCHAR(120) NULL,
      proposed_address TEXT NULL,
      proposed_latitude DECIMAL(10,7) NULL,
      proposed_longitude DECIMAL(10,7) NULL,
      proposed_availability VARCHAR(40) NULL,
      proposed_base_charge DECIMAL(10,2) NULL,
      proposed_price_per_km DECIMAL(10,2) NULL,
      proposed_equipment TEXT NULL,
      note TEXT NULL,
      status ENUM('pending','reviewed','approved','rejected') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ambulance_update_service (ambulance_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ambulance_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ambulance_id INT NOT NULL,
      user_id INT NULL,
      sender_name VARCHAR(150) NOT NULL,
      sender_phone VARCHAR(30) NOT NULL,
      sender_email VARCHAR(180) NULL,
      message_type ENUM('question','location_update','pricing','availability','other') DEFAULT 'question',
      message TEXT NOT NULL,
      status ENUM('open','replied','closed') DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ambulance_messages_service (ambulance_id)
    )
  `);

  await addColumnIfMissing(
  "ambulance_services",
  "current_latitude",
  "DECIMAL(10,7) NULL AFTER longitude"
);

await addColumnIfMissing(
  "ambulance_services",
  "current_longitude",
  "DECIMAL(10,7) NULL AFTER current_latitude"
);

await addColumnIfMissing(
  "ambulance_services",
  "current_location_note",
  "TEXT NULL AFTER current_longitude"
);

await addColumnIfMissing(
  "ambulance_services",
  "current_location_updated_at",
  "TIMESTAMP NULL DEFAULT NULL AFTER current_location_note"
);

await pool.query(`
  CREATE TABLE IF NOT EXISTS ambulance_manager_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ambulance_id INT NOT NULL,
    manager_name VARCHAR(150) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NULL,
    email VARCHAR(180) NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ambulance_manager_service (ambulance_id)
  )
`);

await addColumnIfMissing(
  "ambulance_messages",
  "user_latitude",
  "DECIMAL(10,7) NULL AFTER message"
);

await addColumnIfMissing(
  "ambulance_messages",
  "user_longitude",
  "DECIMAL(10,7) NULL AFTER user_latitude"
);

await addColumnIfMissing(
  "ambulance_messages",
  "manager_reply",
  "TEXT NULL AFTER status"
);

await addColumnIfMissing(
  "ambulance_messages",
  "replied_at",
  "TIMESTAMP NULL DEFAULT NULL AFTER manager_reply"
);

  const [countRows] = await pool.query("SELECT COUNT(*) AS count FROM ambulance_services");

  if (Number(countRows[0]?.count || 0) === 0) {
    await pool.query(
      `
      INSERT INTO ambulance_services
      (service_name, service_type, division, district, area, address, latitude, longitude,
       phone_primary, phone_secondary, email, contact_person, website, equipment, description,
       availability, verified, rating, total_reviews, base_charge, price_per_km)
      VALUES ?
      `,
      [
        sampleAmbulances.map((item) => [
          item.service_name,
          item.service_type,
          item.division,
          item.district,
          item.area,
          item.address,
          item.latitude,
          item.longitude,
          item.phone_primary,
          item.phone_secondary,
          item.email,
          item.contact_person,
          item.website,
          item.equipment,
          item.description,
          item.availability,
          item.verified,
          item.rating,
          item.total_reviews,
          item.base_charge,
          item.price_per_km,
        ]),
      ]
    );
  }
}

function requireSetupSecret(req, res, next) {
  const setupSecret = process.env.AMBULANCE_MANAGER_SETUP_SECRET;
  const providedSecret = req.headers["x-setup-secret"];

  if (!setupSecret) {
    return res.status(500).json({
      success: false,
      message: "AMBULANCE_MANAGER_SETUP_SECRET is not configured.",
    });
  }

  if (providedSecret !== setupSecret) {
    return res.status(403).json({
      success: false,
      message: "Invalid ambulance manager setup secret.",
    });
  }

  next();
}

function requireAmbulanceManager(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Ambulance manager login required.",
    });
  }

  try {
    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.AMBULANCE_MANAGER_JWT_SECRET || process.env.JWT_SECRET
    );

    if (decoded.role !== "ambulance_manager") {
      return res.status(403).json({
        success: false,
        message: "Only ambulance manager can access this dashboard.",
      });
    }

    req.ambulanceManager = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired ambulance manager login.",
    });
  }
}
router.use(async (_req, _res, next) => {
  try {
    await ensureAmbulanceTables();
    next();
  } catch (error) {
    next(error);
  }
});

router.post("/manager/accounts", async (req, res) => {
  const {
    ambulance_id,
    manager_name,
    username,
    password,
    phone,
    email,
  } = req.body;

  if (!ambulance_id || !manager_name || !username || !password) {
    return res.status(400).json({
      success: false,
      message: "Ambulance ID, manager name, username, and password are required.",
    });
  }

  const [serviceRows] = await pool.query(
    "SELECT id FROM ambulance_services WHERE id = ? AND is_active = 1 LIMIT 1",
    [ambulance_id]
  );

  if (!serviceRows.length) {
    return res.status(404).json({
      success: false,
      message: "Ambulance service not found.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `
    INSERT INTO ambulance_manager_accounts
    (ambulance_id, manager_name, username, password_hash, phone, email)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      ambulance_id,
      clean(manager_name),
      clean(username),
      passwordHash,
      clean(phone),
      clean(email),
    ]
  );

  res.status(201).json({
    success: true,
    message: "Ambulance manager account created successfully.",
  });
});

router.post("/manager/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required.",
    });
  }

  const [rows] = await pool.query(
    `
    SELECT *
    FROM ambulance_manager_accounts
    WHERE username = ? AND is_active = 1
    LIMIT 1
    `,
    [username]
  );

  const manager = rows[0];

  if (!manager) {
    return res.status(401).json({
      success: false,
      message: "Invalid ambulance manager login.",
    });
  }

  const passwordOk = await bcrypt.compare(password, manager.password_hash);

  if (!passwordOk) {
    return res.status(401).json({
      success: false,
      message: "Invalid ambulance manager login.",
    });
  }

  const token = jwt.sign(
    {
      role: "ambulance_manager",
      manager_id: manager.id,
      ambulance_id: manager.ambulance_id,
      username: manager.username,
      name: manager.manager_name,
    },
    process.env.AMBULANCE_MANAGER_JWT_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: "8h",
    }
  );

  res.json({
    success: true,
    message: "Ambulance manager login successful.",
    token,
    manager: {
      id: manager.id,
      ambulance_id: manager.ambulance_id,
      username: manager.username,
      name: manager.manager_name,
      phone: manager.phone,
      email: manager.email,
    },
  });
});

router.get("/manager/me", requireAmbulanceManager, async (req, res) => {
  const [managerRows] = await pool.query(
    `
    SELECT id, ambulance_id, manager_name, username, phone, email
    FROM ambulance_manager_accounts
    WHERE id = ? AND is_active = 1
    LIMIT 1
    `,
    [req.ambulanceManager.manager_id]
  );

  if (!managerRows.length) {
    return res.status(404).json({
      success: false,
      message: "Manager account not found.",
    });
  }

  const [serviceRows] = await pool.query(
    "SELECT * FROM ambulance_services WHERE id = ? LIMIT 1",
    [req.ambulanceManager.ambulance_id]
  );

  res.json({
    success: true,
    data: {
      manager: managerRows[0],
      service: serviceRows[0] ? normalizeService(serviceRows[0]) : null,
    },
  });
});

router.patch("/manager/service", requireAmbulanceManager, async (req, res) => {
  const {
    service_name,
    service_type,
    division,
    district,
    area,
    address,
    phone_primary,
    phone_secondary,
    email,
    contact_person,
    website,
    equipment,
    description,
    availability,
    base_charge,
    price_per_km,
  } = req.body;

  await pool.query(
    `
    UPDATE ambulance_services SET
      service_name = ?,
      service_type = ?,
      division = ?,
      district = ?,
      area = ?,
      address = ?,
      phone_primary = ?,
      phone_secondary = ?,
      email = ?,
      contact_person = ?,
      website = ?,
      equipment = ?,
      description = ?,
      availability = ?,
      base_charge = ?,
      price_per_km = ?,
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      clean(service_name),
      clean(service_type || "advanced"),
      clean(division),
      clean(district),
      clean(area),
      clean(address),
      clean(phone_primary),
      clean(phone_secondary),
      clean(email),
      clean(contact_person),
      clean(website),
      clean(equipment),
      clean(description),
      clean(availability || "24/7"),
      Number(base_charge || 0),
      Number(price_per_km || 0),
      req.ambulanceManager.ambulance_id,
    ]
  );

  const [rows] = await pool.query(
    "SELECT * FROM ambulance_services WHERE id = ? LIMIT 1",
    [req.ambulanceManager.ambulance_id]
  );

  res.json({
    success: true,
    message: "Ambulance information updated successfully.",
    data: normalizeService(rows[0]),
  });
});

router.patch("/manager/location", requireAmbulanceManager, async (req, res) => {
  const { latitude, longitude, note } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: "Latitude and longitude are required.",
    });
  }

  await pool.query(
    `
    UPDATE ambulance_services
    SET current_latitude = ?,
        current_longitude = ?,
        current_location_note = ?,
        current_location_updated_at = NOW()
    WHERE id = ?
    `,
    [
      Number(latitude),
      Number(longitude),
      clean(note),
      req.ambulanceManager.ambulance_id,
    ]
  );

  res.json({
    success: true,
    message: "Current ambulance location updated successfully.",
    data: {
      latitude: Number(latitude),
      longitude: Number(longitude),
      note: clean(note),
    },
  });
});

router.get("/manager/messages", requireAmbulanceManager, async (req, res) => {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM ambulance_messages
    WHERE ambulance_id = ?
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [req.ambulanceManager.ambulance_id]
  );

  res.json({
    success: true,
    data: rows,
  });
});

router.patch("/manager/messages/:messageId", requireAmbulanceManager, async (req, res) => {
  const { status, manager_reply } = req.body;

  const allowed = ["open", "replied", "closed"];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid message status.",
    });
  }

  const [result] = await pool.query(
    `
    UPDATE ambulance_messages
    SET status = ?,
        manager_reply = ?,
        replied_at = NOW()
    WHERE id = ? AND ambulance_id = ?
    `,
    [
      status,
      clean(manager_reply),
      req.params.messageId,
      req.ambulanceManager.ambulance_id,
    ]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: "Message not found.",
    });
  }

  res.json({
    success: true,
    message: "Message updated successfully.",
  });
});

router.post("/services/:id/share-location", optionalAuth, async (req, res) => {
  const {
    sender_name,
    sender_phone,
    sender_email,
    latitude,
    longitude,
    message,
  } = req.body;

  if (!sender_name || !sender_phone || !latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: "Name, phone, latitude, and longitude are required.",
    });
  }

  const [serviceRows] = await pool.query(
    "SELECT id FROM ambulance_services WHERE id = ? AND is_active = 1 LIMIT 1",
    [req.params.id]
  );

  if (!serviceRows.length) {
    return res.status(404).json({
      success: false,
      message: "Ambulance service not found.",
    });
  }

  await pool.query(
    `
    INSERT INTO ambulance_messages
    (
      ambulance_id,
      user_id,
      sender_name,
      sender_phone,
      sender_email,
      message_type,
      message,
      user_latitude,
      user_longitude
    )
    VALUES (?, ?, ?, ?, ?, 'location_update', ?, ?, ?)
    `,
    [
      req.params.id,
      req.user?.id || null,
      clean(sender_name),
      clean(sender_phone),
      clean(sender_email || req.user?.email || ""),
      clean(message || "User shared current location with ambulance manager."),
      Number(latitude),
      Number(longitude),
    ]
  );

  res.status(201).json({
    success: true,
    message: "Your location was shared with the ambulance manager.",
  });
});



router.get("/meta", async (_req, res) => {
  const [[statsRows], [divisions], [types], [emergencyServices]] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS total_services,
        COUNT(DISTINCT division) AS total_divisions,
        SUM(availability = '24/7') AS total_247,
        SUM(verified = 1) AS total_verified
      FROM ambulance_services
      WHERE is_active = 1
    `),
    pool.query(`
      SELECT DISTINCT division
      FROM ambulance_services
      WHERE is_active = 1
      ORDER BY division ASC
    `),
    pool.query(`
      SELECT DISTINCT service_type
      FROM ambulance_services
      WHERE is_active = 1
      ORDER BY service_type ASC
    `),
    pool.query(`
      SELECT *
      FROM ambulance_services
      WHERE is_active = 1 AND verified = 1
      ORDER BY
        CASE WHEN availability = '24/7' THEN 1 ELSE 0 END DESC,
        rating DESC,
        total_reviews DESC,
        service_name ASC
      LIMIT 3
    `),
  ]);

  res.json({
    success: true,
    data: {
      stats: statsRows[0] || {
        total_services: 0,
        total_divisions: 0,
        total_247: 0,
        total_verified: 0,
      },
      divisions: divisions.map((row) => row.division),
      service_types: types.map((row) => row.service_type),
      availability_types: availabilityTypes,
      emergency_services: emergencyServices.map(normalizeService),
    },
  });
});

router.get("/services", async (req, res) => {
  const search = clean(req.query.search);
  const division = clean(req.query.division);
  const district = clean(req.query.district);
  const serviceType = clean(req.query.service_type);
  const availability = clean(req.query.availability);
  const verifiedOnly = String(req.query.verified_only || "") === "1";
  const only247 = String(req.query.only247 || "") === "1";

  const allowedSort = [
    "service_name",
    "division",
    "district",
    "service_type",
    "rating",
    "price_per_km",
    "base_charge",
    "total_reviews",
  ];

  const sort = allowedSort.includes(clean(req.query.sort))
    ? clean(req.query.sort)
    : "service_name";

  const order = String(req.query.order || "").toLowerCase() === "desc" ? "DESC" : "ASC";

  let sql = "SELECT * FROM ambulance_services WHERE is_active = 1";
  const params = [];

  if (search) {
    sql += `
      AND (
        service_name LIKE ? OR district LIKE ? OR division LIKE ? OR area LIKE ?
        OR address LIKE ? OR contact_person LIKE ? OR phone_primary LIKE ?
        OR phone_secondary LIKE ? OR email LIKE ? OR equipment LIKE ?
        OR description LIKE ? OR website LIKE ?
      )
    `;
    for (let i = 0; i < 12; i += 1) params.push(`%${search}%`);
  }

  if (division) {
    sql += " AND division = ?";
    params.push(division);
  }

  if (district) {
    sql += " AND district LIKE ?";
    params.push(`%${district}%`);
  }

  if (serviceType) {
    sql += " AND service_type = ?";
    params.push(serviceType);
  }

  if (availability) {
    sql += " AND availability = ?";
    params.push(availability);
  }

  if (verifiedOnly) {
    sql += " AND verified = 1";
  }

  if (only247) {
    sql += " AND availability = '24/7'";
  }

  sql += ` ORDER BY ${sort} ${order}`;

  if (sort === "rating") {
    sql += ", total_reviews DESC";
  }

  sql += ", service_name ASC";

  const [rows] = await pool.query(sql, params);

  res.json({
    success: true,
    data: rows.map(normalizeService),
  });
});

router.get("/services/:id", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM ambulance_services WHERE id = ? AND is_active = 1 LIMIT 1",
    [req.params.id]
  );

  if (!rows.length) {
    return res.status(404).json({
      success: false,
      message: "Ambulance service not found.",
    });
  }

  const [reviews] = await pool.query(
    `
    SELECT *
    FROM ambulance_reviews
    WHERE ambulance_id = ?
    ORDER BY created_at DESC
    LIMIT 10
    `,
    [req.params.id]
  );

  const [messages] = await pool.query(
    `
    SELECT
    id,
    sender_name,
    sender_phone,
    sender_email,
    message_type,
    message,
    user_latitude,
    user_longitude,
    status,
    manager_reply,
    replied_at,
    created_at
  FROM ambulance_messages
  WHERE ambulance_id = ?
  ORDER BY created_at DESC
  LIMIT 20
    `,
    [req.params.id]
  );

  res.json({
    success: true,
    data: {
      service: normalizeService(rows[0]),
      reviews,
      messages,
    },
  });
});



router.post("/services/:id/reviews", async (req, res) => {
  const { reviewer_name, reviewer_phone, rating, review_text, service_date } = req.body;

  const finalRating = Number(rating);

  if (!reviewer_name || finalRating < 1 || finalRating > 5) {
    return res.status(400).json({
      success: false,
      message: "Reviewer name and valid rating are required.",
    });
  }

  const [serviceRows] = await pool.query(
    "SELECT id FROM ambulance_services WHERE id = ? AND is_active = 1 LIMIT 1",
    [req.params.id]
  );

  if (!serviceRows.length) {
    return res.status(404).json({
      success: false,
      message: "Ambulance service not found.",
    });
  }

  await pool.query(
    `
    INSERT INTO ambulance_reviews
    (ambulance_id, reviewer_name, reviewer_phone, rating, review_text, service_date)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      req.params.id,
      clean(reviewer_name),
      clean(reviewer_phone),
      finalRating,
      clean(review_text),
      service_date || null,
    ]
  );

  await pool.query(
    `
    UPDATE ambulance_services
    SET rating = (
      SELECT AVG(rating)
      FROM ambulance_reviews
      WHERE ambulance_id = ?
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM ambulance_reviews
      WHERE ambulance_id = ?
    )
    WHERE id = ?
    `,
    [req.params.id, req.params.id, req.params.id]
  );

  res.status(201).json({
    success: true,
    message: "Review submitted successfully.",
  });
});

router.post("/services/:id/messages", optionalAuth, async (req, res) => {
  const {
    sender_name,
    sender_phone,
    sender_email,
    message_type,
    message,
  } = req.body;

  if (!sender_name || !sender_phone || !message) {
    return res.status(400).json({
      success: false,
      message: "Name, phone, and message are required.",
    });
  }

  const finalType = availabilityTypes.includes(message_type)
    ? "question"
    : ["question", "location_update", "pricing", "availability", "other"].includes(message_type)
      ? message_type
      : "question";

  const [serviceRows] = await pool.query(
    "SELECT id FROM ambulance_services WHERE id = ? AND is_active = 1 LIMIT 1",
    [req.params.id]
  );

  if (!serviceRows.length) {
    return res.status(404).json({
      success: false,
      message: "Ambulance service not found.",
    });
  }

  await pool.query(
    `
    INSERT INTO ambulance_messages
    (ambulance_id, user_id, sender_name, sender_phone, sender_email, message_type, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      req.params.id,
      req.user?.id || null,
      clean(sender_name),
      clean(sender_phone),
      clean(sender_email || req.user?.email || ""),
      finalType,
      clean(message),
    ]
  );

  res.status(201).json({
    success: true,
    message: "Message sent successfully.",
  });
});

router.post("/services/:id/update-request", optionalAuth, async (req, res) => {
  const {
    requester_name,
    requester_phone,
    requester_email,
    proposed_service_name,
    proposed_phone_primary,
    proposed_phone_secondary,
    proposed_division,
    proposed_district,
    proposed_area,
    proposed_address,
    proposed_latitude,
    proposed_longitude,
    proposed_availability,
    proposed_base_charge,
    proposed_price_per_km,
    proposed_equipment,
    note,
  } = req.body;

  if (!requester_name || !requester_phone) {
    return res.status(400).json({
      success: false,
      message: "Your name and phone number are required.",
    });
  }

  const [serviceRows] = await pool.query(
    "SELECT id FROM ambulance_services WHERE id = ? AND is_active = 1 LIMIT 1",
    [req.params.id]
  );

  if (!serviceRows.length) {
    return res.status(404).json({
      success: false,
      message: "Ambulance service not found.",
    });
  }

  await pool.query(
    `
    INSERT INTO ambulance_update_requests
    (
      ambulance_id, user_id, requester_name, requester_phone, requester_email,
      proposed_service_name, proposed_phone_primary, proposed_phone_secondary,
      proposed_division, proposed_district, proposed_area, proposed_address,
      proposed_latitude, proposed_longitude, proposed_availability,
      proposed_base_charge, proposed_price_per_km, proposed_equipment, note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      req.params.id,
      req.user?.id || null,
      clean(requester_name),
      clean(requester_phone),
      clean(requester_email || req.user?.email || ""),
      clean(proposed_service_name),
      clean(proposed_phone_primary),
      clean(proposed_phone_secondary),
      clean(proposed_division),
      clean(proposed_district),
      clean(proposed_area),
      clean(proposed_address),
      proposed_latitude || null,
      proposed_longitude || null,
      clean(proposed_availability),
      proposed_base_charge || null,
      proposed_price_per_km || null,
      clean(proposed_equipment),
      clean(note),
    ]
  );

  if (note) {
    await pool.query(
      `
      INSERT INTO ambulance_messages
      (ambulance_id, user_id, sender_name, sender_phone, sender_email, message_type, message)
      VALUES (?, ?, ?, ?, ?, 'location_update', ?)
      `,
      [
        req.params.id,
        req.user?.id || null,
        clean(requester_name),
        clean(requester_phone),
        clean(requester_email || req.user?.email || ""),
        clean(note),
      ]
    );
  }

  res.status(201).json({
    success: true,
    message: "Ambulance update request submitted successfully.",
  });
});

router.use((error, _req, res, _next) => {
  console.error("Ambulance route error:", error);

  res.status(500).json({
    success: false,
    message: "Ambulance service error: " + error.message,
  });
});

export default router;