import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();

function appSecret() {
  return process.env.JWT_SECRET || "healthcare_dev_secret";
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function clean(value) {
  return String(value ?? "").trim();
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Please sign in first.",
    });
  }

  try {
    req.user = jwt.verify(authHeader.split(" ")[1], appSecret());
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired login. Please sign in again.",
    });
  }
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [table]
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function safeRows(table, query, params = []) {
  try {
    if (!(await tableExists(table))) return [];
    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.warn(`Dashboard query skipped for ${table}:`, error.message);
    return [];
  }
}

async function loadReminders(userId) {
  const rows = await safeRows(
    "medicine_reminders",
    `SELECT id, medicine_name, dosage, reminder_time, frequency, start_date, end_date, notes, is_active, created_at
     FROM medicine_reminders
     WHERE user_id = ? AND is_active = 1
     ORDER BY reminder_time ASC, created_at DESC
     LIMIT 8`,
    [userId]
  );

  const countRows = await safeRows(
    "medicine_reminders",
    `SELECT COUNT(*) AS count
     FROM medicine_reminders
     WHERE user_id = ? AND is_active = 1`,
    [userId]
  );

  return {
    total_active: Number(countRows[0]?.count || rows.length || 0),
    items: rows,
  };
}

async function loadPrescriptions(userId) {
  const rows = await safeRows(
    "user_prescriptions",
    `SELECT id, prescription_title, doctor_name, prescription_date, file_path, created_at
     FROM user_prescriptions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId]
  );

  return rows;
}

async function loadAppointments(userId) {
  const rows = await safeRows(
    "appointments",
    `SELECT *
     FROM appointments
     WHERE user_id = ?
     ORDER BY
       CASE WHEN status IN ('pending','requested','accepted','confirmed','waiting','scheduled','in_call') THEN 0 ELSE 1 END,
       appointment_date ASC,
       appointment_time ASC,
       created_at DESC
     LIMIT 12`,
    [userId]
  );

  const active = rows.filter((item) =>
    ["pending", "requested", "accepted", "confirmed", "waiting", "scheduled", "in_call"].includes(String(item.status || ""))
  );

  const completed = rows.filter((item) => String(item.status || "") === "completed");

  return {
    active_count: active.length,
    completed_count: completed.length,
    items: rows.slice(0, 7),
  };
}

async function loadPharmacyOrders(user) {
  const rows = await safeRows(
    "orders",
    `SELECT o.order_id, o.customer_name, o.customer_email, o.phone_number, o.district, o.address,
            o.delivery_time, o.final_total, o.status, o.created_at,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id) AS item_count
     FROM orders o
     WHERE o.user_id = ? OR o.customer_email = ? OR o.customer_name = ?
     ORDER BY o.created_at DESC
     LIMIT 8`,
    [user.id, user.email || "", user.name || ""]
  );

  const active = rows.filter((item) => !["delivered", "cancelled"].includes(String(item.status || "")));

  return {
    active_count: active.length,
    items: rows.map((item) => ({
      ...item,
      final_total: money(item.final_total),
      item_count: Number(item.item_count || 0),
    })),
  };
}

async function loadBloodBank(user) {
  const users = await safeRows(
    "blood_bank_users",
    `SELECT * FROM blood_bank_users WHERE email = ? LIMIT 1`,
    [user.email || ""]
  );

  if (!users.length) {
    return {
      profile: null,
      incoming_count: 0,
      unread_count: 0,
      requests: [],
    };
  }

  const me = users[0];

  const requests = await safeRows(
    "blood_requests",
    `SELECT br.*, requester.name AS requester_name, donor.name AS donor_name,
            (SELECT COUNT(*)
             FROM blood_request_messages m
             WHERE m.request_id = br.id
               AND m.sender_id != ?
               AND m.is_read = 0) AS unread_count,
            (SELECT m.message
             FROM blood_request_messages m
             WHERE m.request_id = br.id
             ORDER BY m.created_at DESC
             LIMIT 1) AS last_message,
            (SELECT m.created_at
             FROM blood_request_messages m
             WHERE m.request_id = br.id
             ORDER BY m.created_at DESC
             LIMIT 1) AS last_message_time
     FROM blood_requests br
     LEFT JOIN blood_bank_users requester ON requester.id = br.requester_id
     LEFT JOIN blood_bank_users donor ON donor.id = br.donor_id
     WHERE br.requester_id = ? OR br.donor_id = ?
     ORDER BY br.updated_at DESC, br.created_at DESC
     LIMIT 8`,
    [me.id, me.id, me.id]
  );

  const incomingRows = await safeRows(
    "blood_requests",
    `SELECT COUNT(*) AS count
     FROM blood_requests
     WHERE status = 'pending'
       AND requester_id != ?
       AND (donor_id IS NULL OR donor_id = ?)`,
    [me.id, me.id]
  );

  const unreadCount = requests.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);

  return {
    profile: me,
    incoming_count: Number(incomingRows[0]?.count || 0),
    unread_count: unreadCount,
    requests,
  };
}

async function loadTelemedicine(userId) {
  const rows = await safeRows(
    "telemedicine_consultations",
    `SELECT c.*, d.doctor_name, d.specialty, d.avatar,
            (SELECT m.message
             FROM telemedicine_messages m
             WHERE m.consultation_id = c.consultation_id
             ORDER BY m.created_at DESC
             LIMIT 1) AS last_message,
            (SELECT m.created_at
             FROM telemedicine_messages m
             WHERE m.consultation_id = c.consultation_id
             ORDER BY m.created_at DESC
             LIMIT 1) AS last_message_time
     FROM telemedicine_consultations c
     LEFT JOIN telemedicine_doctors d ON d.id = c.doctor_id
     WHERE c.user_id = ?
     ORDER BY c.created_at DESC
     LIMIT 8`,
    [userId]
  );

  const active = rows.filter((item) =>
    ["requested", "accepted", "waiting", "in_call"].includes(String(item.status || ""))
  );

  return {
    active_count: active.length,
    items: rows,
  };
}

async function loadAmbulanceMessages(user) {
  const rows = await safeRows(
    "ambulance_messages",
    `SELECT am.*, s.service_name, s.phone_primary
     FROM ambulance_messages am
     LEFT JOIN ambulance_services s ON s.id = am.ambulance_id
     WHERE am.user_id = ? OR am.sender_email = ?
     ORDER BY am.created_at DESC
     LIMIT 8`,
    [user.id, user.email || ""]
  );

  return {
    open_count: rows.filter((item) => String(item.status || "") === "open").length,
    replied_count: rows.filter((item) => String(item.status || "") === "replied").length,
    items: rows,
  };
}

router.get("/overview", requireAuth, async (req, res) => {
  const user = {
    id: req.user.id,
    name: req.user.name || "User",
    email: req.user.email || "",
  };

  const [reminders, prescriptions, appointments, pharmacy, bloodbank, telemedicine, ambulance] = await Promise.all([
    loadReminders(user.id),
    loadPrescriptions(user.id),
    loadAppointments(user.id),
    loadPharmacyOrders(user),
    loadBloodBank(user),
    loadTelemedicine(user.id),
    loadAmbulanceMessages(user),
  ]);

  const notificationItems = [
    ...bloodbank.requests
      .filter((item) => Number(item.unread_count || 0) > 0 || item.last_message)
      .slice(0, 4)
      .map((item) => ({
        id: `blood-${item.id}`,
        type: "Blood Bank",
        title: `${item.blood_group} request ${item.status}`,
        message: item.last_message || `Request for ${item.patient_name}`,
        time: item.last_message_time || item.updated_at || item.created_at,
        priority: Number(item.unread_count || 0) > 0 ? "high" : "normal",
      })),
    ...telemedicine.items
      .filter((item) => item.last_message)
      .slice(0, 4)
      .map((item) => ({
        id: `tele-${item.consultation_id}`,
        type: "Telemedicine",
        title: item.doctor_name || "Doctor consultation",
        message: item.last_message,
        time: item.last_message_time || item.updated_at || item.created_at,
        priority: ["accepted", "waiting", "in_call"].includes(String(item.status || "")) ? "high" : "normal",
      })),
    ...ambulance.items
      .filter((item) => item.manager_reply)
      .slice(0, 4)
      .map((item) => ({
        id: `ambulance-${item.id}`,
        type: "Ambulance",
        title: item.service_name || "Ambulance message",
        message: item.manager_reply,
        time: item.replied_at || item.created_at,
        priority: "normal",
      })),
  ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 10);

  const stats = {
    active_reminders: reminders.total_active,
    active_appointments: appointments.active_count + telemedicine.active_count,
    active_orders: pharmacy.active_count,
    blood_unread: bloodbank.unread_count,
    notifications: notificationItems.length,
    ambulance_replies: ambulance.replied_count,
  };

  res.json({
    success: true,
    data: {
      user,
      stats,
      reminders,
      prescriptions,
      appointments,
      pharmacy,
      bloodbank,
      telemedicine,
      ambulance,
      notifications: notificationItems,
    },
  });
});

export default router;
