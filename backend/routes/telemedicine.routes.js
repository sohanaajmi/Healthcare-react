import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();

let telemedicineTablesReadyPromise = null;

function ensureTelemedicineTablesOnce() {
  if (!telemedicineTablesReadyPromise) {
    telemedicineTablesReadyPromise = ensureTelemedicineTables().catch((error) => {
      telemedicineTablesReadyPromise = null;
      throw error;
    });
  }

  return telemedicineTablesReadyPromise;
}

const doctorSeed = [
  {
    doctor_name: "Dr. Sarah Johnson",
    username: "doctor1",
    password: "Doctor@123",
    specialty: "Cardiologist",
    degree: "MD, FACC",
    experience_years: 12,
    fee_taka: 800,
    credit_fee: 8,
    rating: 4.9,
    reviews: 234,
    avatar: "SJ",
    bio: "Heart disease, hypertension, chest pain, and cardiac follow-up consultations.",
    is_available: 1,
    status_text: "Available Now",
    wait_minutes: 15,
  },
  {
    doctor_name: "Dr. Michael Chen",
    username: "doctor2",
    password: "Doctor@123",
    specialty: "Pediatrician",
    degree: "MD, Pediatrics",
    experience_years: 8,
    fee_taka: 700,
    credit_fee: 7,
    rating: 4.8,
    reviews: 189,
    avatar: "MC",
    bio: "Child fever, cough, nutrition, vaccination advice, and newborn care.",
    is_available: 1,
    status_text: "Available Now",
    wait_minutes: 5,
  },
  {
    doctor_name: "Dr. Emily Rodriguez",
    username: "doctor3",
    password: "Doctor@123",
    specialty: "Dermatologist",
    degree: "MD, Dermatology",
    experience_years: 10,
    fee_taka: 900,
    credit_fee: 9,
    rating: 4.7,
    reviews: 156,
    avatar: "ER",
    bio: "Skin rash, acne, allergy, hair fall, and cosmetic dermatology advice.",
    is_available: 0,
    status_text: "Available at 3:00 PM",
    wait_minutes: 30,
  },
  {
    doctor_name: "Dr. James Wilson",
    username: "doctor4",
    password: "Doctor@123",
    specialty: "General Physician",
    degree: "MBBS, FCPS",
    experience_years: 11,
    fee_taka: 650,
    credit_fee: 6,
    rating: 4.9,
    reviews: 430,
    avatar: "JW",
    bio: "Fever, diabetes, pressure, common illness, prescription review, and follow-up.",
    is_available: 1,
    status_text: "Available Now",
    wait_minutes: 10,
  },
  {
    doctor_name: "Dr. Fatima Ahmed",
    username: "doctor5",
    password: "Doctor@123",
    specialty: "Gynecologist",
    degree: "MBBS, MS",
    experience_years: 14,
    fee_taka: 850,
    credit_fee: 8,
    rating: 4.8,
    reviews: 298,
    avatar: "FA",
    bio: "Women health, pregnancy advice, period issues, and gynecology follow-up.",
    is_available: 1,
    status_text: "Available Now",
    wait_minutes: 20,
  },
  {
    doctor_name: "Dr. Rajesh Kumar",
    username: "doctor6",
    password: "Doctor@123",
    specialty: "Psychiatrist",
    degree: "MD, Psychiatry",
    experience_years: 16,
    fee_taka: 950,
    credit_fee: 10,
    rating: 4.8,
    reviews: 276,
    avatar: "RK",
    bio: "Stress, anxiety, depression, sleep issues, and mental health counseling.",
    is_available: 0,
    status_text: "Busy",
    wait_minutes: 45,
  },
  {
    doctor_name: "Dr. Lisa Chang",
    username: "doctor7",
    password: "Doctor@123",
    specialty: "Neurologist",
    degree: "MD, Neurology",
    experience_years: 13,
    fee_taka: 1000,
    credit_fee: 10,
    rating: 4.7,
    reviews: 211,
    avatar: "LC",
    bio: "Headache, migraine, nerve pain, seizure follow-up, and dizziness consultation.",
    is_available: 1,
    status_text: "Available Now",
    wait_minutes: 12,
  },
  {
    doctor_name: "Dr. Ahmed Hassan",
    username: "doctor8",
    password: "Doctor@123",
    specialty: "Orthopedic",
    degree: "MS, Orthopedics",
    experience_years: 18,
    fee_taka: 850,
    credit_fee: 8,
    rating: 4.8,
    reviews: 333,
    avatar: "AH",
    bio: "Joint pain, back pain, injury follow-up, fracture care, and physiotherapy advice.",
    is_available: 0,
    status_text: "Available at 5:00 PM",
    wait_minutes: 35,
  },
];

function clean(value) {
  return String(value ?? "").trim();
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function createConsultationId() {
  return "TMC" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function createRoomCode() {
  return "ROOM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function appSecret() {
  return process.env.JWT_SECRET || "healthcare_dev_secret";
}

function createDoctorToken(doctor) {
  return jwt.sign(
    {
      id: doctor.id,
      doctor_id: doctor.id,
      doctor_name: doctor.doctor_name,
      username: doctor.username,
      role: "telemedicine_doctor",
    },
    process.env.TELEMEDICINE_DOCTOR_JWT_SECRET || appSecret(),
    { expiresIn: "7d" }
  );
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], appSecret());
    } catch {
      req.user = null;
    }
  }

  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Please sign in first.",
      });
    }

    next();
  });
}

function requireDoctor(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Doctor login required.",
    });
  }

  try {
    const decoded = jwt.verify(
      authHeader.split(" ")[1],
      process.env.TELEMEDICINE_DOCTOR_JWT_SECRET || appSecret()
    );

    if (decoded.role !== "telemedicine_doctor") {
      return res.status(403).json({
        success: false,
        message: "Doctor account required.",
      });
    }

    req.doctor = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired doctor login.",
    });
  }
}

function normalizeDoctor(row) {
  if (!row) return null;

  return {
    ...row,
    id: Number(row.id),
    experience_years: Number(row.experience_years || 0),
    fee_taka: money(row.fee_taka),
    credit_fee: Number(row.credit_fee || 0),
    rating: Number(row.rating || 0),
    reviews: Number(row.reviews || 0),
    wait_minutes: Number(row.wait_minutes || 0),
    is_available: Number(row.is_available || 0) === 1,
    is_active: Number(row.is_active || 0) === 1,
  };
}

async function ensureWallet(userId) {
  await pool.query(
    `INSERT INTO telemedicine_credit_wallets (user_id, balance)
     VALUES (?, 0)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );

  const [rows] = await pool.query(
    "SELECT * FROM telemedicine_credit_wallets WHERE user_id = ? LIMIT 1",
    [userId]
  );

  return rows[0] || { user_id: userId, balance: 0 };
}

async function ensureTelemedicineTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemedicine_doctors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_name VARCHAR(180) NOT NULL,
      username VARCHAR(80) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      specialty VARCHAR(120) NOT NULL,
      degree VARCHAR(160) NULL,
      experience_years INT DEFAULT 0,
      fee_taka DECIMAL(10,2) DEFAULT 0,
      credit_fee INT DEFAULT 5,
      rating DECIMAL(3,2) DEFAULT 0,
      reviews INT DEFAULT 0,
      avatar VARCHAR(10) NULL,
      bio TEXT NULL,
      is_available TINYINT(1) DEFAULT 1,
      status_text VARCHAR(120) DEFAULT 'Available Now',
      wait_minutes INT DEFAULT 10,
      video_room_url VARCHAR(255) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemedicine_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT NOT NULL,
      schedule_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      slot_status VARCHAR(30) DEFAULT 'open',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tm_schedule_doctor (doctor_id, schedule_date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemedicine_consultations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      consultation_id VARCHAR(60) NOT NULL UNIQUE,
      user_id INT NULL,
      doctor_id INT NOT NULL,
      patient_name VARCHAR(180) NOT NULL,
      patient_phone VARCHAR(40) NOT NULL,
      patient_email VARCHAR(180) NULL,
      symptoms TEXT NOT NULL,
      consultation_type VARCHAR(30) DEFAULT 'video',
      appointment_date DATE NULL,
      appointment_time TIME NULL,
      fee_taka DECIMAL(10,2) DEFAULT 0,
      credit_cost INT DEFAULT 0,
      payment_method VARCHAR(30) DEFAULT 'credits',
      payment_status VARCHAR(30) DEFAULT 'pending',
      transaction_id VARCHAR(120) NULL,
      status VARCHAR(30) DEFAULT 'requested',
      queue_position INT DEFAULT 1,
      room_code VARCHAR(80) NULL,
      doctor_note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tm_consult_user (user_id),
      INDEX idx_tm_consult_doctor (doctor_id),
      INDEX idx_tm_consult_status (status)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemedicine_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      consultation_id VARCHAR(60) NOT NULL,
      sender_type VARCHAR(20) NOT NULL,
      sender_id INT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tm_message_consult (consultation_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemedicine_credit_wallets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      balance INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemedicine_credit_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      transaction_type VARCHAR(30) NOT NULL,
      credits INT NOT NULL,
      payment_method VARCHAR(30) NULL,
      transaction_id VARCHAR(120) NULL,
      note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tm_credit_user (user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS telemedicine_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      consultation_id VARCHAR(60) NULL,
      payment_type VARCHAR(30) DEFAULT 'consultation',
      amount_taka DECIMAL(10,2) DEFAULT 0,
      credits INT DEFAULT 0,
      payment_method VARCHAR(30) NOT NULL,
      transaction_id VARCHAR(120) NULL,
      payment_status VARCHAR(30) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tm_payment_user (user_id)
    )
  `);

  for (const doctor of doctorSeed) {
    const hash = await bcrypt.hash(doctor.password, 10);

    await pool.query(
      `
      INSERT INTO telemedicine_doctors
      (doctor_name, username, password_hash, specialty, degree, experience_years, fee_taka,
       credit_fee, rating, reviews, avatar, bio, is_available, status_text, wait_minutes, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        doctor_name = VALUES(doctor_name),
        password_hash = VALUES(password_hash),
        specialty = VALUES(specialty),
        degree = VALUES(degree),
        experience_years = VALUES(experience_years),
        fee_taka = VALUES(fee_taka),
        credit_fee = VALUES(credit_fee),
        rating = VALUES(rating),
        reviews = VALUES(reviews),
        avatar = VALUES(avatar),
        bio = VALUES(bio),
        is_available = VALUES(is_available),
        status_text = VALUES(status_text),
        wait_minutes = VALUES(wait_minutes),
        is_active = 1
      `,
      [
        doctor.doctor_name,
        doctor.username,
        hash,
        doctor.specialty,
        doctor.degree,
        doctor.experience_years,
        doctor.fee_taka,
        doctor.credit_fee,
        doctor.rating,
        doctor.reviews,
        doctor.avatar,
        doctor.bio,
        doctor.is_available,
        doctor.status_text,
        doctor.wait_minutes,
      ]
    );
  }

  const [doctorRows] = await pool.query("SELECT id FROM telemedicine_doctors WHERE is_active = 1 ORDER BY id ASC");
  const today = new Date();

  for (const [index, doctor] of doctorRows.entries()) {
    const day = new Date(today);
    day.setDate(today.getDate() + (index % 3));
    const scheduleDate = day.toISOString().slice(0, 10);

    const [[existingSchedule]] = await pool.query(
      `SELECT id
       FROM telemedicine_schedules
       WHERE doctor_id = ? AND schedule_date = ? AND start_time = '10:00:00'
       LIMIT 1`,
      [doctor.id, scheduleDate]
    );

    if (!existingSchedule) {
      await pool.query(
        `INSERT INTO telemedicine_schedules (doctor_id, schedule_date, start_time, end_time, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [doctor.id, scheduleDate, "10:00:00", "14:00:00", "Online consultation slot"]
      );
    }
  }
}

router.use(async (_req, _res, next) => {
  try {
    await ensureTelemedicineTablesOnce();
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/meta", async (_req, res) => {
  const [[doctorStats], [specialties], [consultStats]] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) AS total_doctors,
        SUM(is_available = 1) AS online_doctors,
        MIN(wait_minutes) AS min_wait_minutes,
        AVG(fee_taka) AS average_fee
      FROM telemedicine_doctors
      WHERE is_active = 1
    `),
    pool.query(`
      SELECT specialty, COUNT(*) AS count
      FROM telemedicine_doctors
      WHERE is_active = 1
      GROUP BY specialty
      ORDER BY specialty ASC
    `),
    pool.query(`
      SELECT
        COUNT(*) AS total_consultations,
        SUM(status IN ('requested','accepted','waiting','in_call')) AS active_consultations
      FROM telemedicine_consultations
    `),
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        ...doctorStats[0],
        ...consultStats[0],
      },
      specialties,
      payment_methods: ["credits", "bkash", "nagad", "rocket", "card"],
      credit_packages: [5, 10, 20, 50, 100],
      credit_rate_taka: 100,
    },
  });
});

router.get("/doctors", async (req, res) => {
  const search = clean(req.query.search).toLowerCase();
  const specialty = clean(req.query.specialty);
  const availableOnly = String(req.query.available_only || "") === "1";

  let sql = "SELECT * FROM telemedicine_doctors WHERE is_active = 1";
  const params = [];

  if (search) {
    sql += ` AND LOWER(CONCAT_WS(' ', doctor_name, specialty, degree, bio)) LIKE ?`;
    params.push(`%${search}%`);
  }

  if (specialty) {
    sql += " AND specialty = ?";
    params.push(specialty);
  }

  if (availableOnly) {
    sql += " AND is_available = 1";
  }

  sql += " ORDER BY is_available DESC, rating DESC, reviews DESC, doctor_name ASC";

  const [rows] = await pool.query(sql, params);

  res.json({
    success: true,
    data: rows.map(normalizeDoctor),
  });
});

router.get("/doctors/:id", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM telemedicine_doctors WHERE id = ? AND is_active = 1 LIMIT 1",
    [req.params.id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Doctor not found." });
  }

  const [schedule] = await pool.query(
    `SELECT * FROM telemedicine_schedules
     WHERE doctor_id = ? AND schedule_date >= CURDATE()
     ORDER BY schedule_date ASC, start_time ASC
     LIMIT 20`,
    [req.params.id]
  );

  res.json({
    success: true,
    data: {
      doctor: normalizeDoctor(rows[0]),
      schedule,
    },
  });
});

router.get("/credits", requireAuth, async (req, res) => {
  const wallet = await ensureWallet(req.user.id);
  const [transactions] = await pool.query(
    `SELECT * FROM telemedicine_credit_transactions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 30`,
    [req.user.id]
  );

  res.json({
    success: true,
    data: {
      balance: Number(wallet.balance || 0),
      transactions,
    },
  });
});

router.post("/credits/top-up", requireAuth, async (req, res) => {
  const credits = Number(req.body.credits || 0);
  const paymentMethod = clean(req.body.payment_method).toLowerCase();
  const transactionId = clean(req.body.transaction_id);
  const allowedPackages = [5, 10, 20, 50, 100];
  const allowedMethods = ["bkash", "nagad", "rocket", "card"];

  if (!allowedPackages.includes(credits)) {
    return res.status(400).json({ success: false, message: "Select a valid credit package." });
  }

  if (!allowedMethods.includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "Select bKash, Nagad, Rocket, or Card." });
  }

  if (!transactionId) {
    return res.status(400).json({ success: false, message: "Transaction ID is required for credit top-up." });
  }

  await ensureWallet(req.user.id);

  await pool.query(
    "UPDATE telemedicine_credit_wallets SET balance = balance + ? WHERE user_id = ?",
    [credits, req.user.id]
  );

  await pool.query(
    `INSERT INTO telemedicine_credit_transactions
     (user_id, transaction_type, credits, payment_method, transaction_id, note)
     VALUES (?, 'topup', ?, ?, ?, ?)`,
    [req.user.id, credits, paymentMethod, transactionId, `${credits} telemedicine credits purchased.`]
  );

  await pool.query(
    `INSERT INTO telemedicine_payments
     (user_id, payment_type, amount_taka, credits, payment_method, transaction_id, payment_status)
     VALUES (?, 'credit_topup', ?, ?, ?, ?, 'paid')`,
    [req.user.id, credits * 100, credits, paymentMethod, transactionId]
  );

  const wallet = await ensureWallet(req.user.id);

  res.status(201).json({
    success: true,
    message: `${credits} credits added successfully.`,
    data: { balance: Number(wallet.balance || 0) },
  });
});

router.post("/consultations", requireAuth, async (req, res) => {
  const {
    doctor_id,
    patient_name,
    patient_phone,
    patient_email,
    symptoms,
    consultation_type = "video",
    appointment_date,
    appointment_time,
    payment_method = "credits",
    transaction_id,
  } = req.body;

  if (!doctor_id || !patient_name || !patient_phone || !symptoms) {
    return res.status(400).json({
      success: false,
      message: "Doctor, patient name, phone, and symptoms are required.",
    });
  }

  const [doctorRows] = await pool.query(
    "SELECT * FROM telemedicine_doctors WHERE id = ? AND is_active = 1 LIMIT 1",
    [doctor_id]
  );

  if (!doctorRows.length) {
    return res.status(404).json({ success: false, message: "Doctor not found." });
  }

  const doctor = normalizeDoctor(doctorRows[0]);
  const method = clean(payment_method).toLowerCase();
  const allowedMethods = ["credits", "bkash", "nagad", "rocket", "card"];

  if (!allowedMethods.includes(method)) {
    return res.status(400).json({ success: false, message: "Invalid payment method." });
  }

  const consultationId = createConsultationId();
  const roomCode = createRoomCode();
  let paymentStatus = "pending";

  if (method === "credits") {
    const wallet = await ensureWallet(req.user.id);
    if (Number(wallet.balance || 0) < doctor.credit_fee) {
      return res.status(400).json({
        success: false,
        message: `Not enough credits. ${doctor.credit_fee} credits required for this doctor.`,
      });
    }

    await pool.query(
      "UPDATE telemedicine_credit_wallets SET balance = balance - ? WHERE user_id = ?",
      [doctor.credit_fee, req.user.id]
    );

    await pool.query(
      `INSERT INTO telemedicine_credit_transactions
       (user_id, transaction_type, credits, payment_method, transaction_id, note)
       VALUES (?, 'deduct', ?, 'credits', ?, ?)`,
      [req.user.id, -doctor.credit_fee, consultationId, `Consultation fee for ${doctor.doctor_name}.`]
    );

    paymentStatus = "paid";
  } else if (transaction_id) {
    paymentStatus = "paid";
  }

  const [[queueRow]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM telemedicine_consultations
     WHERE doctor_id = ? AND status IN ('requested','accepted','waiting','in_call')`,
    [doctor.id]
  );

  const queuePosition = Number(queueRow?.count || 0) + 1;

  await pool.query(
    `
    INSERT INTO telemedicine_consultations
    (consultation_id, user_id, doctor_id, patient_name, patient_phone, patient_email,
     symptoms, consultation_type, appointment_date, appointment_time, fee_taka, credit_cost,
     payment_method, payment_status, transaction_id, status, queue_position, room_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)
    `,
    [
      consultationId,
      req.user.id,
      doctor.id,
      clean(patient_name),
      clean(patient_phone),
      clean(patient_email || req.user.email || ""),
      clean(symptoms),
      clean(consultation_type) || "video",
      appointment_date || null,
      appointment_time || null,
      doctor.fee_taka,
      doctor.credit_fee,
      method,
      paymentStatus,
      clean(transaction_id),
      queuePosition,
      roomCode,
    ]
  );

  if (method !== "credits") {
    await pool.query(
      `INSERT INTO telemedicine_payments
       (user_id, consultation_id, payment_type, amount_taka, credits, payment_method, transaction_id, payment_status)
       VALUES (?, ?, 'consultation', ?, ?, ?, ?, ?)`,
      [req.user.id, consultationId, doctor.fee_taka, doctor.credit_fee, method, clean(transaction_id), paymentStatus]
    );
  }

  await pool.query(
    `INSERT INTO telemedicine_messages (consultation_id, sender_type, sender_id, message)
     VALUES (?, 'system', NULL, ?), (?, 'user', ?, ?)`,
    [
      consultationId,
      `Consultation request created. Queue position: ${queuePosition}.`,
      consultationId,
      req.user.id,
      clean(symptoms),
    ]
  );

  res.status(201).json({
    success: true,
    message:
      paymentStatus === "paid"
        ? "Consultation request submitted successfully. Please wait for doctor approval."
        : "Consultation request submitted. Payment is pending verification.",
    data: {
      consultation_id: consultationId,
      status: "requested",
      payment_status: paymentStatus,
      queue_position: queuePosition,
      room_code: roomCode,
    },
  });
});

router.get("/my-consultations", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `
    SELECT c.*, d.doctor_name, d.specialty, d.degree, d.avatar
    FROM telemedicine_consultations c
    JOIN telemedicine_doctors d ON d.id = c.doctor_id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
    LIMIT 80
    `,
    [req.user.id]
  );

  res.json({ success: true, data: rows });
});

router.get("/consultations/:consultationId/messages", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM telemedicine_consultations WHERE consultation_id = ? AND user_id = ? LIMIT 1",
    [req.params.consultationId, req.user.id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Consultation not found." });
  }

  const [messages] = await pool.query(
    `SELECT * FROM telemedicine_messages
     WHERE consultation_id = ?
     ORDER BY created_at ASC`,
    [req.params.consultationId]
  );

  res.json({ success: true, data: { consultation: rows[0], messages } });
});

router.post("/consultations/:consultationId/messages", requireAuth, async (req, res) => {
  const message = clean(req.body.message);

  if (!message) {
    return res.status(400).json({ success: false, message: "Message is required." });
  }

  const [rows] = await pool.query(
    "SELECT * FROM telemedicine_consultations WHERE consultation_id = ? AND user_id = ? LIMIT 1",
    [req.params.consultationId, req.user.id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Consultation not found." });
  }

  await pool.query(
    `INSERT INTO telemedicine_messages (consultation_id, sender_type, sender_id, message)
     VALUES (?, 'user', ?, ?)`,
    [req.params.consultationId, req.user.id, message]
  );

  res.status(201).json({ success: true, message: "Message sent." });
});

router.post("/doctor/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required." });
  }

  const [rows] = await pool.query(
    "SELECT * FROM telemedicine_doctors WHERE username = ? AND is_active = 1 LIMIT 1",
    [clean(username)]
  );

  if (!rows.length) {
    return res.status(401).json({ success: false, message: "Invalid doctor login." });
  }

  const doctor = rows[0];
  const ok = await bcrypt.compare(password, String(doctor.password_hash).replace(/^\$2y\$/, "$2a$"));

  if (!ok) {
    return res.status(401).json({ success: false, message: "Invalid doctor login." });
  }

  const token = createDoctorToken(doctor);

  res.json({
    success: true,
    message: "Doctor login successful.",
    token,
    data: normalizeDoctor(doctor),
  });
});

router.get("/doctor/me", requireDoctor, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM telemedicine_doctors WHERE id = ? AND is_active = 1 LIMIT 1",
    [req.doctor.doctor_id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Doctor not found." });
  }

  res.json({ success: true, data: normalizeDoctor(rows[0]) });
});

router.get("/doctor/dashboard", requireDoctor, async (req, res) => {
  const doctorId = req.doctor.doctor_id;

  const [[statsRows], [consultations], [schedule]] = await Promise.all([
    pool.query(
      `SELECT
        COUNT(*) AS total_requests,
        SUM(status = 'requested') AS pending_requests,
        SUM(status IN ('accepted','waiting','in_call')) AS active_queue,
        SUM(status = 'completed') AS completed_total
       FROM telemedicine_consultations
       WHERE doctor_id = ?`,
      [doctorId]
    ),
    pool.query(
      `SELECT * FROM telemedicine_consultations
       WHERE doctor_id = ?
       ORDER BY FIELD(status, 'requested', 'accepted', 'waiting', 'in_call', 'completed', 'rejected', 'cancelled'), created_at DESC
       LIMIT 100`,
      [doctorId]
    ),
    pool.query(
      `SELECT * FROM telemedicine_schedules
       WHERE doctor_id = ? AND schedule_date >= CURDATE()
       ORDER BY schedule_date ASC, start_time ASC
       LIMIT 30`,
      [doctorId]
    ),
  ]);

  res.json({
    success: true,
    data: {
      stats: statsRows[0] || {},
      consultations,
      schedule,
    },
  });
});

router.patch("/doctor/profile", requireDoctor, async (req, res) => {
  const { is_available, status_text, wait_minutes, video_room_url, fee_taka, credit_fee, bio } = req.body;

  await pool.query(
    `UPDATE telemedicine_doctors
     SET is_available = ?, status_text = ?, wait_minutes = ?, video_room_url = ?, fee_taka = ?, credit_fee = ?, bio = ?
     WHERE id = ?`,
    [
      is_available ? 1 : 0,
      clean(status_text) || "Available Now",
      Number(wait_minutes || 10),
      clean(video_room_url),
      money(fee_taka),
      Number(credit_fee || 5),
      clean(bio),
      req.doctor.doctor_id,
    ]
  );

  res.json({ success: true, message: "Doctor profile updated." });
});

router.post("/doctor/schedule", requireDoctor, async (req, res) => {
  const { schedule_date, start_time, end_time, slot_status = "open", notes } = req.body;

  if (!schedule_date || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: "Date, start time, and end time are required." });
  }

  await pool.query(
    `INSERT INTO telemedicine_schedules (doctor_id, schedule_date, start_time, end_time, slot_status, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.doctor.doctor_id, schedule_date, start_time, end_time, clean(slot_status), clean(notes)]
  );

  res.status(201).json({ success: true, message: "Schedule slot added." });
});

router.patch("/doctor/schedule/:id", requireDoctor, async (req, res) => {
  const { schedule_date, start_time, end_time, slot_status, notes } = req.body;

  await pool.query(
    `UPDATE telemedicine_schedules
     SET schedule_date = ?, start_time = ?, end_time = ?, slot_status = ?, notes = ?
     WHERE id = ? AND doctor_id = ?`,
    [schedule_date, start_time, end_time, clean(slot_status || "open"), clean(notes), req.params.id, req.doctor.doctor_id]
  );

  res.json({ success: true, message: "Schedule updated." });
});

router.patch("/doctor/consultations/:consultationId/status", requireDoctor, async (req, res) => {
  const status = clean(req.body.status);
  const doctorNote = clean(req.body.doctor_note);
  const allowed = ["accepted", "waiting", "in_call", "completed", "rejected", "cancelled"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid consultation status." });
  }

  const [result] = await pool.query(
    `UPDATE telemedicine_consultations
     SET status = ?, doctor_note = COALESCE(NULLIF(?, ''), doctor_note), updated_at = NOW()
     WHERE consultation_id = ? AND doctor_id = ?`,
    [status, doctorNote, req.params.consultationId, req.doctor.doctor_id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ success: false, message: "Consultation not found." });
  }

  const statusMessages = {
    accepted: "Doctor accepted your consultation request.",
    waiting: "You are now in the video/chat queue. Please stay online.",
    in_call: "Doctor started the consultation room.",
    completed: "Consultation completed. Please follow doctor advice.",
    rejected: "Doctor rejected this request. Please request another doctor or time.",
    cancelled: "Consultation cancelled.",
  };

  await pool.query(
    `INSERT INTO telemedicine_messages (consultation_id, sender_type, sender_id, message)
     VALUES (?, 'system', ?, ?)`,
    [req.params.consultationId, req.doctor.doctor_id, statusMessages[status] || `Status changed to ${status}.`]
  );

  res.json({ success: true, message: "Consultation status updated." });
});

router.get("/doctor/consultations/:consultationId/messages", requireDoctor, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM telemedicine_consultations WHERE consultation_id = ? AND doctor_id = ? LIMIT 1",
    [req.params.consultationId, req.doctor.doctor_id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Consultation not found." });
  }

  const [messages] = await pool.query(
    `SELECT * FROM telemedicine_messages
     WHERE consultation_id = ?
     ORDER BY created_at ASC`,
    [req.params.consultationId]
  );

  res.json({ success: true, data: { consultation: rows[0], messages } });
});

router.post("/doctor/consultations/:consultationId/messages", requireDoctor, async (req, res) => {
  const message = clean(req.body.message);

  if (!message) {
    return res.status(400).json({ success: false, message: "Message is required." });
  }

  const [rows] = await pool.query(
    "SELECT * FROM telemedicine_consultations WHERE consultation_id = ? AND doctor_id = ? LIMIT 1",
    [req.params.consultationId, req.doctor.doctor_id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Consultation not found." });
  }

  await pool.query(
    `INSERT INTO telemedicine_messages (consultation_id, sender_type, sender_id, message)
     VALUES (?, 'doctor', ?, ?)`,
    [req.params.consultationId, req.doctor.doctor_id, message]
  );

  res.status(201).json({ success: true, message: "Message sent." });
});

export default router;
