import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();

const paymentMethods = ["credits", "bkash", "nagad", "rocket", "card"];
const hospitalPaymentMethods = ["bkash", "nagad", "rocket", "card", "pay_at_hospital"];

const departments = [
  "General Medicine",
  "Cardiology",
  "Pediatrics",
  "Gynecology",
  "Dermatology",
  "Orthopedics",
  "Neurology",
  "ENT",
  "Dental",
  "Emergency",
];

function clean(value) {
  return String(value ?? "").trim();
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function appSecret() {
  return process.env.JWT_SECRET || "healthcare_dev_secret";
}

function createAppointmentId(prefix = "APT") {
  return (
    prefix +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 7).toUpperCase()
  );
}

function createConsultationId() {
  return (
    "TMC" +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 7).toUpperCase()
  );
}

function createRoomCode() {
  return "ROOM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
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

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );

  return Number(rows[0]?.count || 0) > 0;
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
  if (await tableHasColumn(table, column)) return;

  try {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  } catch (error) {
    // Nodemon/frontend can trigger multiple requests at once while the table
    // migration is running. If another request already added the column between
    // the INFORMATION_SCHEMA check and ALTER TABLE, ignore MySQL duplicate
    // column errors and continue safely.
    if (error?.code === "ER_DUP_FIELDNAME" || Number(error?.errno) === 1060) {
      return;
    }

    throw error;
  }
}

async function ensureAppointmentTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      appointment_id VARCHAR(60) NOT NULL UNIQUE,
      appointment_type VARCHAR(30) NOT NULL DEFAULT 'hospital',
      provider VARCHAR(180) NULL,
      provider_type VARCHAR(40) NULL,
      provider_id INT NULL,
      doctor_id INT NULL,
      facility_id INT NULL,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(160) NOT NULL,
      phone VARCHAR(30) NULL,
      district VARCHAR(120) NULL,
      department VARCHAR(120) NOT NULL,
      doctor VARCHAR(180) NULL,
      appointment_date DATE NOT NULL,
      appointment_time TIME NOT NULL,
      symptoms TEXT NULL,
      notes TEXT NULL,
      consultation_type VARCHAR(30) NULL,
      fee_taka DECIMAL(10,2) DEFAULT 0,
      credit_cost INT DEFAULT 0,
      payment_method VARCHAR(30) DEFAULT 'pay_at_hospital',
      transaction_id VARCHAR(120) NULL,
      payment_status VARCHAR(30) DEFAULT 'pending',
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      telemedicine_consultation_id VARCHAR(60) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_appointments_user (user_id),
      INDEX idx_appointments_type (appointment_type),
      INDEX idx_appointments_status (status),
      INDEX idx_appointments_date (appointment_date)
    )
  `);

  const columnDefinitions = {
    appointment_id: "VARCHAR(60) NULL UNIQUE AFTER user_id",
    appointment_type: "VARCHAR(30) NOT NULL DEFAULT 'hospital' AFTER appointment_id",
    provider_type: "VARCHAR(40) NULL AFTER provider",
    provider_id: "INT NULL AFTER provider_type",
    doctor_id: "INT NULL AFTER provider_id",
    facility_id: "INT NULL AFTER doctor_id",
    symptoms: "TEXT NULL AFTER appointment_time",
    consultation_type: "VARCHAR(30) NULL AFTER notes",
    fee_taka: "DECIMAL(10,2) DEFAULT 0 AFTER consultation_type",
    credit_cost: "INT DEFAULT 0 AFTER fee_taka",
    payment_method: "VARCHAR(30) DEFAULT 'pay_at_hospital' AFTER credit_cost",
    transaction_id: "VARCHAR(120) NULL AFTER payment_method",
    payment_status: "VARCHAR(30) DEFAULT 'pending' AFTER transaction_id",
    telemedicine_consultation_id: "VARCHAR(60) NULL AFTER status",
  };

  for (const [column, definition] of Object.entries(columnDefinitions)) {
    await addColumnIfMissing("appointments", column, definition);
  }

  await pool.query(`
    UPDATE appointments
    SET appointment_id = CONCAT('APT', id, DATE_FORMAT(created_at, '%y%m%d%H%i%s'))
    WHERE appointment_id IS NULL OR appointment_id = ''
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointment_status_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      appointment_id VARCHAR(60) NOT NULL,
      status VARCHAR(40) NOT NULL,
      note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_appt_log (appointment_id)
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

function normalizeDoctor(row) {
  if (!row) return null;

  return {
    ...row,
    id: Number(row.id),
    fee_taka: money(row.fee_taka),
    credit_fee: Number(row.credit_fee || 0),
    rating: Number(row.rating || 0),
    reviews: Number(row.reviews || 0),
    wait_minutes: Number(row.wait_minutes || 0),
    is_available: Number(row.is_available || 0) === 1,
  };
}

function normalizeFacility(row) {
  if (!row) return null;

  return {
    ...row,
    id: Number(row.id),
    rating: row.rating !== null ? Number(row.rating) : null,
    beds: row.beds !== null ? Number(row.beds) : null,
    services: row.services
      ? String(row.services)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  };
}

let appointmentTablesReadyPromise = null;

function ensureAppointmentTablesOnce() {
  if (!appointmentTablesReadyPromise) {
    appointmentTablesReadyPromise = ensureAppointmentTables().catch((error) => {
      appointmentTablesReadyPromise = null;
      throw error;
    });
  }

  return appointmentTablesReadyPromise;
}

router.use(async (_req, _res, next) => {
  try {
    await ensureAppointmentTablesOnce();
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/meta", optionalAuth, async (req, res) => {
  const doctorsTableReady = await tableExists("telemedicine_doctors");
  const healthcareTableReady = await tableExists("healthcare_locations");

  const [doctorRows] = doctorsTableReady
    ? await pool.query(
        `SELECT *
         FROM telemedicine_doctors
         WHERE is_active = 1
         ORDER BY is_available DESC, rating DESC, reviews DESC, doctor_name ASC
         LIMIT 80`
      )
    : [[]];

  const [hospitalRows] = healthcareTableReady
    ? await pool.query(
        `SELECT id, facility_type, name, division, district, area, address, phone, services, beds, rating
         FROM healthcare_locations
         WHERE is_active = 1 AND facility_type = 'hospital'
         ORDER BY rating DESC, name ASC
         LIMIT 80`
      )
    : [[]];

  let wallet = { balance: 0 };
  let myStats = { total: 0, upcoming: 0, telemedicine: 0, hospital: 0 };

  if (req.user?.id) {
    wallet = await ensureWallet(req.user.id);

    const [[statsRow]] = await pool.query(
      `SELECT
        COUNT(*) AS total,
        SUM(status IN ('pending','requested','accepted','confirmed','waiting','scheduled')) AS upcoming,
        SUM(appointment_type = 'telemedicine') AS telemedicine,
        SUM(appointment_type = 'hospital') AS hospital
       FROM appointments
       WHERE user_id = ?`,
      [req.user.id]
    );

    myStats = statsRow || myStats;
  }

  res.json({
    success: true,
    data: {
      doctors: doctorRows.map(normalizeDoctor),
      hospitals: hospitalRows.map(normalizeFacility),
      departments,
      payment_methods: paymentMethods,
      hospital_payment_methods: hospitalPaymentMethods,
      credit_packages: [5, 10, 20, 50, 100],
      credit_rate_taka: 100,
      wallet: {
        balance: Number(wallet.balance || 0),
      },
      stats: myStats,
    },
  });
});

router.get("/my", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.*,
      td.doctor_name AS online_doctor_name,
      td.specialty AS online_specialty,
      hl.name AS hospital_name,
      hl.address AS hospital_address,
      hl.phone AS hospital_phone
     FROM appointments a
     LEFT JOIN telemedicine_doctors td ON td.id = a.doctor_id
     LEFT JOIN healthcare_locations hl ON hl.id = a.facility_id
     WHERE a.user_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.created_at DESC
     LIMIT 100`,
    [req.user.id]
  );

  res.json({ success: true, data: rows });
});

router.get("/doctors/:id/schedule", async (req, res) => {
  const [doctorRows] = await pool.query(
    "SELECT id, doctor_name, specialty, fee_taka, credit_fee, is_available FROM telemedicine_doctors WHERE id = ? AND is_active = 1 LIMIT 1",
    [req.params.id]
  );

  if (!doctorRows.length) {
    return res.status(404).json({ success: false, message: "Doctor not found." });
  }

  const [scheduleRows] = await pool.query(
    `SELECT *
     FROM telemedicine_schedules
     WHERE doctor_id = ? AND schedule_date >= CURDATE()
     ORDER BY schedule_date ASC, start_time ASC
     LIMIT 20`,
    [req.params.id]
  );

  res.json({
    success: true,
    data: {
      doctor: normalizeDoctor(doctorRows[0]),
      schedule: scheduleRows,
    },
  });
});

router.post("/credits/top-up", requireAuth, async (req, res) => {
  const credits = Number(req.body.credits || 0);
  const paymentMethod = clean(req.body.payment_method).toLowerCase();
  const transactionId = clean(req.body.transaction_id);
  const allowedPackages = [5, 10, 20, 50, 100];

  if (!allowedPackages.includes(credits)) {
    return res.status(400).json({ success: false, message: "Select a valid credit package." });
  }

  if (!["bkash", "nagad", "rocket", "card"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: "Select bKash, Nagad, Rocket, or Card." });
  }

  if (!transactionId) {
    return res.status(400).json({ success: false, message: "Transaction ID is required." });
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
    [req.user.id, credits, paymentMethod, transactionId, `${credits} appointment credits purchased.`]
  );

  await pool.query(
    `INSERT INTO telemedicine_payments
     (user_id, payment_type, amount_taka, credits, payment_method, transaction_id, payment_status)
     VALUES (?, 'appointment_credit_topup', ?, ?, ?, ?, 'paid')`,
    [req.user.id, credits * 100, credits, paymentMethod, transactionId]
  );

  const wallet = await ensureWallet(req.user.id);

  res.status(201).json({
    success: true,
    message: `${credits} credits added successfully.`,
    data: {
      balance: Number(wallet.balance || 0),
    },
  });
});

router.post("/book", requireAuth, async (req, res) => {
  const appointmentType = clean(req.body.appointment_type).toLowerCase();

  if (appointmentType === "telemedicine") {
    return createTelemedicineAppointment(req, res);
  }

  if (appointmentType === "hospital") {
    return createHospitalAppointment(req, res);
  }

  return res.status(400).json({
    success: false,
    message: "Choose telemedicine or hospital appointment.",
  });
});

async function createTelemedicineAppointment(req, res) {
  const {
    doctor_id,
    full_name,
    phone,
    email,
    appointment_date,
    appointment_time,
    symptoms,
    consultation_type = "video",
    payment_method = "credits",
    transaction_id,
  } = req.body;

  if (!doctor_id || !full_name || !phone || !appointment_date || !appointment_time || !symptoms) {
    return res.status(400).json({
      success: false,
      message: "Doctor, patient name, phone, date, time, and symptoms are required.",
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

  if (!paymentMethods.includes(method)) {
    return res.status(400).json({ success: false, message: "Invalid payment method." });
  }

  let paymentStatus = "pending";

  if (method === "credits") {
    const wallet = await ensureWallet(req.user.id);

    if (Number(wallet.balance || 0) < doctor.credit_fee) {
      return res.status(400).json({
        success: false,
        message: `Not enough credits. ${doctor.credit_fee} credits required for ${doctor.doctor_name}.`,
      });
    }

    await pool.query(
      "UPDATE telemedicine_credit_wallets SET balance = balance - ? WHERE user_id = ?",
      [doctor.credit_fee, req.user.id]
    );

    paymentStatus = "paid";
  } else {
    if (!clean(transaction_id)) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required for bKash/Nagad/Rocket/Card payment.",
      });
    }

    paymentStatus = "paid";
  }

  const appointmentId = createAppointmentId("APT");
  const consultationId = createConsultationId();
  const roomCode = createRoomCode();

  const [[queueRow]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM telemedicine_consultations
     WHERE doctor_id = ? AND status IN ('requested','accepted','waiting','in_call')`,
    [doctor.id]
  );

  const queuePosition = Number(queueRow?.count || 0) + 1;

  await pool.query(
    `INSERT INTO appointments
     (user_id, appointment_id, appointment_type, provider, provider_type, provider_id, doctor_id,
      full_name, email, phone, department, doctor, appointment_date, appointment_time, symptoms,
      notes, consultation_type, fee_taka, credit_cost, payment_method, transaction_id, payment_status,
      status, telemedicine_consultation_id)
     VALUES (?, ?, 'telemedicine', ?, 'online_doctor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?)`,
    [
      req.user.id,
      appointmentId,
      doctor.doctor_name,
      doctor.id,
      doctor.id,
      clean(full_name),
      clean(email || req.user.email || ""),
      clean(phone),
      doctor.specialty,
      doctor.doctor_name,
      appointment_date,
      appointment_time,
      clean(symptoms),
      clean(req.body.notes || ""),
      clean(consultation_type) || "video",
      doctor.fee_taka,
      doctor.credit_fee,
      method,
      clean(transaction_id),
      paymentStatus,
      consultationId,
    ]
  );

  await pool.query(
    `INSERT INTO telemedicine_consultations
     (consultation_id, user_id, doctor_id, patient_name, patient_phone, patient_email,
      symptoms, consultation_type, appointment_date, appointment_time, fee_taka, credit_cost,
      payment_method, payment_status, transaction_id, status, queue_position, room_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)`,
    [
      consultationId,
      req.user.id,
      doctor.id,
      clean(full_name),
      clean(phone),
      clean(email || req.user.email || ""),
      clean(symptoms),
      clean(consultation_type) || "video",
      appointment_date,
      appointment_time,
      doctor.fee_taka,
      doctor.credit_fee,
      method,
      paymentStatus,
      clean(transaction_id),
      queuePosition,
      roomCode,
    ]
  );

  if (method === "credits") {
    await pool.query(
      `INSERT INTO telemedicine_credit_transactions
       (user_id, transaction_type, credits, payment_method, transaction_id, note)
       VALUES (?, 'deduct', ?, 'credits', ?, ?)`,
      [
        req.user.id,
        -doctor.credit_fee,
        appointmentId,
        `Scheduled appointment with ${doctor.doctor_name}.`,
      ]
    );
  }

  await pool.query(
    `INSERT INTO telemedicine_payments
     (user_id, consultation_id, payment_type, amount_taka, credits, payment_method, transaction_id, payment_status)
     VALUES (?, ?, 'appointment', ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      consultationId,
      doctor.fee_taka,
      doctor.credit_fee,
      method,
      method === "credits" ? appointmentId : clean(transaction_id),
      paymentStatus,
    ]
  );

  await pool.query(
    `INSERT INTO telemedicine_messages (consultation_id, sender_type, sender_id, message)
     VALUES (?, 'system', NULL, ?), (?, 'user', ?, ?)`,
    [
      consultationId,
      `Appointment scheduled for ${appointment_date} at ${appointment_time}. Queue position: ${queuePosition}.`,
      consultationId,
      req.user.id,
      clean(symptoms),
    ]
  );

  await pool.query(
    `INSERT INTO appointment_status_logs (appointment_id, status, note)
     VALUES (?, 'requested', ?)`,
    [appointmentId, `Online consultation request created for ${doctor.doctor_name}.`]
  );

  res.status(201).json({
    success: true,
    message: "Online doctor appointment requested. The doctor can accept it from the doctor dashboard.",
    data: {
      appointment_id: appointmentId,
      telemedicine_consultation_id: consultationId,
      status: "requested",
      payment_status: paymentStatus,
      queue_position: queuePosition,
    },
  });
}

async function createHospitalAppointment(req, res) {
  const {
    facility_id,
    full_name,
    phone,
    email,
    district,
    department,
    doctor,
    appointment_date,
    appointment_time,
    notes,
    payment_method = "pay_at_hospital",
    transaction_id,
  } = req.body;

  if (!facility_id || !full_name || !phone || !department || !appointment_date || !appointment_time) {
    return res.status(400).json({
      success: false,
      message: "Hospital, patient name, phone, department, date, and time are required.",
    });
  }

  const [facilityRows] = await pool.query(
    `SELECT id, name, district, address, phone
     FROM healthcare_locations
     WHERE id = ? AND facility_type = 'hospital' AND is_active = 1
     LIMIT 1`,
    [facility_id]
  );

  if (!facilityRows.length) {
    return res.status(404).json({ success: false, message: "Hospital not found." });
  }

  const hospital = facilityRows[0];
  const method = clean(payment_method).toLowerCase();

  if (!hospitalPaymentMethods.includes(method)) {
    return res.status(400).json({ success: false, message: "Invalid hospital payment method." });
  }

  const paymentStatus = method === "pay_at_hospital" ? "pending" : "paid";

  if (method !== "pay_at_hospital" && !clean(transaction_id)) {
    return res.status(400).json({
      success: false,
      message: "Transaction ID is required for online hospital booking payment.",
    });
  }

  const appointmentId = createAppointmentId("HAP");
  const bookingFee = method === "pay_at_hospital" ? 0 : 200;

  await pool.query(
    `INSERT INTO appointments
     (user_id, appointment_id, appointment_type, provider, provider_type, provider_id, facility_id,
      full_name, email, phone, district, department, doctor, appointment_date, appointment_time,
      notes, fee_taka, credit_cost, payment_method, transaction_id, payment_status, status)
     VALUES (?, ?, 'hospital', ?, 'physical_hospital', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'pending')`,
    [
      req.user.id,
      appointmentId,
      hospital.name,
      hospital.id,
      hospital.id,
      clean(full_name),
      clean(email || req.user.email || ""),
      clean(phone),
      clean(district || hospital.district || ""),
      clean(department),
      clean(doctor),
      appointment_date,
      appointment_time,
      clean(notes),
      bookingFee,
      method,
      clean(transaction_id),
      paymentStatus,
    ]
  );

  if (method !== "pay_at_hospital") {
    await pool.query(
      `INSERT INTO telemedicine_payments
       (user_id, consultation_id, payment_type, amount_taka, credits, payment_method, transaction_id, payment_status)
       VALUES (?, ?, 'hospital_appointment', ?, 0, ?, ?, ?)`,
      [req.user.id, appointmentId, bookingFee, method, clean(transaction_id), paymentStatus]
    );
  }

  await pool.query(
    `INSERT INTO appointment_status_logs (appointment_id, status, note)
     VALUES (?, 'pending', ?)`,
    [appointmentId, `Hospital appointment requested at ${hospital.name}.`]
  );

  res.status(201).json({
    success: true,
    message: "Hospital appointment booked. Please arrive 15 minutes early.",
    data: {
      appointment_id: appointmentId,
      status: "pending",
      payment_status: paymentStatus,
      provider: hospital.name,
    },
  });
}

router.patch("/:appointmentId/cancel", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM appointments WHERE appointment_id = ? AND user_id = ? LIMIT 1",
    [req.params.appointmentId, req.user.id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Appointment not found." });
  }

  const appointment = rows[0];

  if (["completed", "cancelled"].includes(appointment.status)) {
    return res.status(400).json({ success: false, message: "This appointment cannot be cancelled." });
  }

  await pool.query(
    "UPDATE appointments SET status = 'cancelled' WHERE appointment_id = ? AND user_id = ?",
    [req.params.appointmentId, req.user.id]
  );

  if (appointment.telemedicine_consultation_id) {
    await pool.query(
      "UPDATE telemedicine_consultations SET status = 'cancelled' WHERE consultation_id = ? AND user_id = ?",
      [appointment.telemedicine_consultation_id, req.user.id]
    );
  }

  await pool.query(
    `INSERT INTO appointment_status_logs (appointment_id, status, note)
     VALUES (?, 'cancelled', 'Cancelled by patient.')`,
    [req.params.appointmentId]
  );

  res.json({ success: true, message: "Appointment cancelled." });
});

export default router;
