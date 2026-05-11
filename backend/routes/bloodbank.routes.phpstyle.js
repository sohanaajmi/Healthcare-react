import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const bdLocations = {
  Barishal: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  Chattogram: [
    "Bandarban",
    "Brahmanbaria",
    "Chandpur",
    "Chattogram",
    "Cumilla",
    "Cox's Bazar",
    "Feni",
    "Khagrachhari",
    "Lakshmipur",
    "Noakhali",
    "Rangamati",
  ],
  Dhaka: [
    "Dhaka",
    "Faridpur",
    "Gazipur",
    "Gopalganj",
    "Kishoreganj",
    "Madaripur",
    "Manikganj",
    "Munshiganj",
    "Narayanganj",
    "Narsingdi",
    "Rajbari",
    "Shariatpur",
    "Tangail",
  ],
  Khulna: ["Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"],
  Mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
  Rajshahi: ["Bogura", "Chapainawabganj", "Joypurhat", "Naogaon", "Natore", "Pabna", "Rajshahi", "Sirajganj"],
  Rangpur: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"],
  Sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
};

const locationAliases = {
  Barishal: ["Barishal", "Barisal"],
  Chattogram: ["Chattogram", "Chittagong"],
  Cumilla: ["Cumilla", "Comilla"],
  Jashore: ["Jashore", "Jessore"],
  Bogura: ["Bogura", "Bogra"],
  Chapainawabganj: ["Chapainawabganj", "Chapai Nawabganj"],
  Moulvibazar: ["Moulvibazar", "Maulvibazar"],
};

function normalizePhone(value = "") {
  let phone = String(value).replace(/[^0-9]/g, "");

  if (phone.length === 13 && phone.startsWith("880")) {
    phone = `0${phone.slice(3)}`;
  }

  if (phone.length === 10 && phone.startsWith("17")) {
    phone = `0${phone}`;
  }

  return phone;
}

function clean(value = "") {
  return String(value).trim();
}

function aliasesFor(value) {
  return locationAliases[value] || [value];
}

function addInFilter(where, params, column, value) {
  if (!value) return;

  const aliases = aliasesFor(value);
  where.push(`${column} IN (${aliases.map(() => "?").join(",")})`);
  params.push(...aliases);
}

function safeBloodGroup(value) {
  return bloodGroups.includes(value) ? value : "";
}

async function setupBloodBankTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blood_bank_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      age INT NOT NULL DEFAULT 18,
      blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL DEFAULT 'O+',
      nid_number VARCHAR(100) UNIQUE NOT NULL,
      contact VARCHAR(30) UNIQUE NOT NULL,
      social_media VARCHAR(255),
      email VARCHAR(120) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      user_type ENUM('donor','receiver','both') DEFAULT 'both',
      division VARCHAR(100),
      district VARCHAR(100),
      address TEXT,
      available TINYINT(1) DEFAULT 1,
      total_donations INT DEFAULT 0,
      last_donation_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blood_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      requester_id INT NULL,
      donor_id INT NULL,
      patient_name VARCHAR(120) NOT NULL,
      blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
      contact VARCHAR(30) NOT NULL,
      hospital_location VARCHAR(255) NOT NULL,
      date_needed DATE NOT NULL,
      units_required INT DEFAULT 1,
      is_emergency TINYINT(1) DEFAULT 0,
      additional_notes TEXT,
      status ENUM('pending','accepted','declined','completed','cancelled') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blood_request_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      sender_id INT NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_request_id (request_id),
      INDEX idx_sender_id (sender_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blood_complaints (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(120) NOT NULL,
      contact VARCHAR(30) NOT NULL,
      description TEXT NOT NULL,
      attachment VARCHAR(255),
      status ENUM('new','reviewing','resolved') DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function currentBloodBankUser(req, options = {}) {
  const { createIfMissing = false, fallback = {} } = options;

  const [rows] = await pool.query("SELECT * FROM blood_bank_users WHERE email = ? LIMIT 1", [req.user.email]);

  if (rows.length > 0) return rows[0];
  if (!createIfMissing) return null;

  const contact = normalizePhone(fallback.contact) || `AUTH${req.user.id}`;
  const nid = clean(fallback.nid_number) || `AUTHNID${req.user.id}`;
  const bloodGroup = safeBloodGroup(fallback.blood_group) || "O+";
  const age = Number(fallback.age) || 18;
  const password = await bcrypt.hash("bloodbank123", 10);

  await pool.query(
    `INSERT INTO blood_bank_users
    (name, age, blood_group, nid_number, contact, social_media, email, password, user_type, division, district, address, available)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clean(fallback.name) || req.user.name || "Blood Bank User",
      age,
      bloodGroup,
      nid,
      contact,
      clean(fallback.social_media),
      req.user.email,
      password,
      fallback.user_type || "both",
      clean(fallback.division) || "Dhaka",
      clean(fallback.district) || "Dhaka",
      clean(fallback.address) || "",
      1,
    ]
  );

  const [created] = await pool.query("SELECT * FROM blood_bank_users WHERE email = ? LIMIT 1", [req.user.email]);
  return created[0] || null;
}

function donorResponse(row) {
  return {
    ...row,
    phone: row.contact,
    available: Number(row.available) === 1,
  };
}

function requestResponse(row) {
  return {
    ...row,
    requester_user_id: row.requester_id,
    donor_user_id: row.donor_id,
    is_emergency: Number(row.is_emergency) === 1,
  };
}

setupBloodBankTables().catch((error) => {
  console.error("Blood Bank table setup failed:", error.message);
});

router.get("/locations", (req, res) => {
  res.json({ success: true, data: bdLocations, bloodGroups });
});

router.get("/stats", async (req, res) => {
  try {
    const [[totalDonors]] = await pool.query("SELECT COUNT(*) AS count FROM blood_bank_users WHERE user_type IN ('donor','both')");
    const [[availableDonors]] = await pool.query("SELECT COUNT(*) AS count FROM blood_bank_users WHERE user_type IN ('donor','both') AND available = 1");
    const [[activeRequests]] = await pool.query("SELECT COUNT(*) AS count FROM blood_requests WHERE status = 'pending'");
    const [[emergencyRequests]] = await pool.query("SELECT COUNT(*) AS count FROM blood_requests WHERE status = 'pending' AND is_emergency = 1");

    const [nearbyEmergency] = await pool.query(
      `SELECT br.*, requester.name AS requester_name
       FROM blood_requests br
       LEFT JOIN blood_bank_users requester ON br.requester_id = requester.id
       WHERE br.status = 'pending' AND br.is_emergency = 1
       ORDER BY br.created_at DESC
       LIMIT 2`
    );

    res.json({
      success: true,
      data: {
        totalDonors: totalDonors.count,
        availableDonors: availableDonors.count,
        activeRequests: activeRequests.count,
        emergencyRequests: emergencyRequests.count,
        nearbyEmergency: nearbyEmergency.map(requestResponse),
      },
    });
  } catch (error) {
    console.error("Blood Bank stats error:", error);
    res.status(500).json({ success: false, message: "Could not load Blood Bank dashboard." });
  }
});

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const me = await currentBloodBankUser(req);
    res.json({ success: true, data: me ? donorResponse(me) : null });
  } catch (error) {
    console.error("Blood Bank profile error:", error);
    res.status(500).json({ success: false, message: "Could not load Blood Bank profile." });
  }
});

router.post("/profile/register", requireAuth, async (req, res) => {
  try {
    const name = clean(req.body.name) || req.user.name;
    const age = Number(req.body.age);
    const bloodGroup = safeBloodGroup(req.body.blood_group);
    const nid = clean(req.body.nid_number);
    const contact = normalizePhone(req.body.contact || req.body.phone);
    const social = clean(req.body.social_media);
    const userType = ["donor", "receiver", "both"].includes(req.body.user_type) ? req.body.user_type : "both";
    const division = clean(req.body.division);
    const district = clean(req.body.district);
    const address = clean(req.body.address);
    const available = req.body.available === false || req.body.available === 0 ? 0 : 1;
    const lastDonationDate = req.body.last_donation_date || null;

    if (!name || !age || !bloodGroup || !nid || !contact) {
      return res.status(400).json({ success: false, message: "Name, age, blood group, NID, and contact are required." });
    }

    if (age < 18 || age > 65) {
      return res.status(400).json({ success: false, message: "Age must be between 18 and 65." });
    }

    if (!/^01[0-9]{9}$/.test(contact)) {
      return res.status(400).json({ success: false, message: "Please enter a valid 11-digit Bangladeshi mobile number." });
    }

    const [existing] = await pool.query("SELECT * FROM blood_bank_users WHERE email = ? LIMIT 1", [req.user.email]);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE blood_bank_users
         SET name = ?, age = ?, blood_group = ?, nid_number = ?, contact = ?, social_media = ?, user_type = ?, division = ?, district = ?, address = ?, available = ?, last_donation_date = ?, updated_at = NOW()
         WHERE email = ?`,
        [name, age, bloodGroup, nid, contact, social, userType, division, district, address, available, lastDonationDate, req.user.email]
      );
    } else {
      const password = await bcrypt.hash("bloodbank123", 10);
      await pool.query(
        `INSERT INTO blood_bank_users
         (name, age, blood_group, nid_number, contact, social_media, email, password, user_type, division, district, address, available, last_donation_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, age, bloodGroup, nid, contact, social, req.user.email, password, userType, division, district, address, available, lastDonationDate]
      );
    }

    const me = await currentBloodBankUser(req);
    res.status(201).json({ success: true, message: "Blood Bank profile saved successfully.", data: donorResponse(me) });
  } catch (error) {
    console.error("Blood Bank register error:", error);

    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "NID, contact, or email is already registered." });
    }

    res.status(500).json({ success: false, message: "Could not save Blood Bank profile." });
  }
});

router.get("/donors", async (req, res) => {
  try {
    const group = safeBloodGroup(req.query.group || req.query.blood_group);
    const division = clean(req.query.division);
    const district = clean(req.query.district);
    const search = clean(req.query.search);

    const where = ["user_type IN ('donor','both')"];
    const params = [];

    if (group) {
      where.push("blood_group = ?");
      params.push(group);
    }

    addInFilter(where, params, "division", division);
    addInFilter(where, params, "district", district);

    if (search) {
      where.push("(name LIKE ? OR contact LIKE ? OR email LIKE ? OR address LIKE ? OR division LIKE ? OR district LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }

    const [rows] = await pool.query(
      `SELECT * FROM blood_bank_users
       WHERE ${where.join(" AND ")}
       ORDER BY available DESC, name ASC`,
      params
    );

    res.json({ success: true, data: rows.map(donorResponse) });
  } catch (error) {
    console.error("Donor fetch error:", error);
    res.status(500).json({ success: false, message: "Could not load donors." });
  }
});

router.post("/donors", requireAuth, async (req, res) => {
  try {
    const fallbackNid = `DONOR${req.user.id}${Date.now()}`;
    const payload = {
      ...req.body,
      user_type: req.body.user_type || "both",
      nid_number: clean(req.body.nid_number) || fallbackNid,
      contact: req.body.contact || req.body.phone,
    };

    const name = clean(payload.name) || req.user.name;
    const age = Number(payload.age);
    const bloodGroup = safeBloodGroup(payload.blood_group);
    const nid = clean(payload.nid_number);
    const contact = normalizePhone(payload.contact);
    const social = clean(payload.social_media);
    const userType = ["donor", "receiver", "both"].includes(payload.user_type) ? payload.user_type : "both";
    const division = clean(payload.division);
    const district = clean(payload.district);
    const address = clean(payload.address);
    const available = payload.available === false || payload.available === 0 ? 0 : 1;
    const lastDonationDate = payload.last_donation_date || null;

    if (!name || !age || !bloodGroup || !contact || !division || !district) {
      return res.status(400).json({ success: false, message: "Required donor fields are missing." });
    }

    const [existing] = await pool.query("SELECT * FROM blood_bank_users WHERE email = ? LIMIT 1", [req.user.email]);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE blood_bank_users
         SET name = ?, age = ?, blood_group = ?, nid_number = ?, contact = ?, social_media = ?, user_type = ?, division = ?, district = ?, address = ?, available = ?, last_donation_date = ?, updated_at = NOW()
         WHERE email = ?`,
        [name, age, bloodGroup, nid, contact, social, userType, division, district, address, available, lastDonationDate, req.user.email]
      );
    } else {
      const password = await bcrypt.hash("bloodbank123", 10);
      await pool.query(
        `INSERT INTO blood_bank_users
         (name, age, blood_group, nid_number, contact, social_media, email, password, user_type, division, district, address, available, last_donation_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, age, bloodGroup, nid, contact, social, req.user.email, password, userType, division, district, address, available, lastDonationDate]
      );
    }

    const me = await currentBloodBankUser(req);
    res.status(201).json({ success: true, message: "Donor registered successfully.", data: donorResponse(me) });
  } catch (error) {
    console.error("Donor create error:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "NID, contact, or email is already registered." });
    }
    res.status(500).json({ success: false, message: "Could not register donor." });
  }
});

router.post("/requests/direct", requireAuth, async (req, res) => {
  try {
    const donorId = Number(req.body.donor_id);
    if (!donorId) return res.status(400).json({ success: false, message: "Donor is required." });

    const [donors] = await pool.query("SELECT * FROM blood_bank_users WHERE id = ? LIMIT 1", [donorId]);
    if (donors.length === 0) return res.status(404).json({ success: false, message: "Donor not found." });

    const donor = donors[0];
    const me = await currentBloodBankUser(req, {
      createIfMissing: true,
      fallback: {
        contact: req.body.contact,
        blood_group: donor.blood_group,
        division: donor.division,
        district: donor.district,
        address: req.body.hospital_location,
      },
    });

    const patientName = clean(req.body.patient_name) || me.name || req.user.name;
    const contact = normalizePhone(req.body.contact) || me.contact;
    const hospitalLocation = clean(req.body.hospital_location) || me.address || "Not provided";
    const isEmergency = req.body.is_emergency === false ? 0 : 1;

    await pool.query(
      `INSERT INTO blood_requests
       (requester_id, donor_id, patient_name, blood_group, contact, hospital_location, date_needed, units_required, is_emergency, additional_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        me.id,
        donor.id,
        patientName,
        donor.blood_group,
        contact,
        hospitalLocation,
        req.body.date_needed || new Date().toISOString().split("T")[0],
        Math.max(1, Number(req.body.units_required) || 1),
        isEmergency,
        clean(req.body.additional_notes) || "Direct emergency request sent to donor.",
      ]
    );

    res.status(201).json({ success: true, message: "Blood request sent successfully." });
  } catch (error) {
    console.error("Direct request error:", error);
    res.status(500).json({ success: false, message: "Could not send request to donor." });
  }
});

router.get("/requests/open", async (req, res) => {
  try {
    const group = safeBloodGroup(req.query.group || req.query.blood_group);
    const division = clean(req.query.division);
    const district = clean(req.query.district);

    const where = ["br.status = 'pending'"];
    const params = [];

    if (group) {
      where.push("br.blood_group = ?");
      params.push(group);
    }

    addInFilter(where, params, "requester.division", division);
    addInFilter(where, params, "requester.district", district);

    const [rows] = await pool.query(
      `SELECT br.*, requester.name AS requester_name, donor.name AS donor_name,
              requester.division, requester.district
       FROM blood_requests br
       LEFT JOIN blood_bank_users requester ON br.requester_id = requester.id
       LEFT JOIN blood_bank_users donor ON br.donor_id = donor.id
       WHERE ${where.join(" AND ")}
       ORDER BY br.is_emergency DESC, br.date_needed ASC, br.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows.map(requestResponse) });
  } catch (error) {
    console.error("Open request fetch error:", error);
    res.status(500).json({ success: false, message: "Could not load requests." });
  }
});

router.get("/requests/incoming", requireAuth, async (req, res) => {
  try {
    const me = await currentBloodBankUser(req, { createIfMissing: true });

    const [rows] = await pool.query(
      `SELECT br.*, requester.name AS requester_name, donor.name AS donor_name
       FROM blood_requests br
       LEFT JOIN blood_bank_users requester ON br.requester_id = requester.id
       LEFT JOIN blood_bank_users donor ON br.donor_id = donor.id
       WHERE br.status = 'pending'
         AND br.requester_id != ?
         AND (br.donor_id IS NULL OR br.donor_id = ?)
       ORDER BY br.is_emergency DESC, br.created_at DESC`,
      [me.id, me.id]
    );

    res.json({ success: true, data: rows.map(requestResponse) });
  } catch (error) {
    console.error("Incoming request fetch error:", error);
    res.status(500).json({ success: false, message: "Could not load incoming requests." });
  }
});

router.post("/requests", requireAuth, async (req, res) => {
  try {
    const bloodGroup = safeBloodGroup(req.body.blood_group);
    const patientName = clean(req.body.patient_name);
    const contact = normalizePhone(req.body.contact);
    const hospitalLocation = clean(req.body.hospital_location);
    const dateNeeded = clean(req.body.date_needed);

    if (!patientName || !bloodGroup || !contact || !hospitalLocation || !dateNeeded) {
      return res.status(400).json({ success: false, message: "Please complete all required request fields." });
    }

    const me = await currentBloodBankUser(req, {
      createIfMissing: true,
      fallback: {
        contact,
        blood_group: bloodGroup,
        address: hospitalLocation,
      },
    });

    await pool.query(
      `INSERT INTO blood_requests
       (requester_id, patient_name, blood_group, contact, hospital_location, date_needed, units_required, is_emergency, additional_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        me.id,
        patientName,
        bloodGroup,
        contact,
        hospitalLocation,
        dateNeeded,
        Math.max(1, Number(req.body.units_required) || 1),
        req.body.is_emergency ? 1 : 0,
        clean(req.body.additional_notes),
      ]
    );

    res.status(201).json({ success: true, message: "Blood request submitted successfully." });
  } catch (error) {
    console.error("Request create error:", error);
    res.status(500).json({ success: false, message: "Could not create request." });
  }
});

router.patch("/requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const me = await currentBloodBankUser(req, { createIfMissing: true });

    const [requests] = await pool.query(
      `SELECT * FROM blood_requests
       WHERE id = ? AND status = 'pending' AND requester_id != ? AND (donor_id IS NULL OR donor_id = ?)
       LIMIT 1`,
      [requestId, me.id, me.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: "This request is not available for acceptance." });
    }

    await pool.query(
      `UPDATE blood_requests
       SET status = 'accepted', donor_id = IFNULL(donor_id, ?), updated_at = NOW()
       WHERE id = ? AND status = 'pending' AND (donor_id IS NULL OR donor_id = ?)`,
      [me.id, requestId, me.id]
    );

    await pool.query("INSERT INTO blood_request_messages (request_id, sender_id, message) VALUES (?, ?, ?)", [
      requestId,
      me.id,
      "I accepted your blood request. We can coordinate donation details here.",
    ]);

    res.json({ success: true, message: "Request accepted. Chat is now open.", requestId });
  } catch (error) {
    console.error("Request accept error:", error);
    res.status(500).json({ success: false, message: "Could not accept request." });
  }
});

router.patch("/requests/:id/decline", requireAuth, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const me = await currentBloodBankUser(req, { createIfMissing: true });

    const [result] = await pool.query(
      `UPDATE blood_requests
       SET status = 'declined', donor_id = IFNULL(donor_id, ?), updated_at = NOW()
       WHERE id = ? AND status = 'pending' AND requester_id != ? AND (donor_id IS NULL OR donor_id = ?)`,
      [me.id, requestId, me.id, me.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "This request is not available." });
    }

    res.json({ success: true, message: "Request declined." });
  } catch (error) {
    console.error("Request decline error:", error);
    res.status(500).json({ success: false, message: "Could not decline request." });
  }
});

router.get("/requests/chats", requireAuth, async (req, res) => {
  try {
    const me = await currentBloodBankUser(req, { createIfMissing: true });

    const [rows] = await pool.query(
      `SELECT br.*, requester.name AS requester_name, donor.name AS donor_name,
              (SELECT m.message FROM blood_request_messages m WHERE m.request_id = br.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT m.created_at FROM blood_request_messages m WHERE m.request_id = br.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_time,
              (SELECT COUNT(*) FROM blood_request_messages m WHERE m.request_id = br.id AND m.sender_id != ? AND m.is_read = 0) AS unread_count
       FROM blood_requests br
       LEFT JOIN blood_bank_users requester ON br.requester_id = requester.id
       LEFT JOIN blood_bank_users donor ON br.donor_id = donor.id
       WHERE br.status IN ('accepted', 'completed')
         AND (br.requester_id = ? OR br.donor_id = ?)
       ORDER BY br.updated_at DESC, br.created_at DESC`,
      [me.id, me.id, me.id]
    );

    res.json({ success: true, data: rows.map(requestResponse), me });
  } catch (error) {
    console.error("Chats fetch error:", error);
    res.status(500).json({ success: false, message: "Could not load accepted chats." });
  }
});

router.get("/requests/:id/chat", requireAuth, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const me = await currentBloodBankUser(req, { createIfMissing: true });

    const [requests] = await pool.query(
      `SELECT br.*, requester.name AS requester_name, requester.contact AS requester_contact,
              donor.name AS donor_name, donor.contact AS donor_contact
       FROM blood_requests br
       LEFT JOIN blood_bank_users requester ON br.requester_id = requester.id
       LEFT JOIN blood_bank_users donor ON br.donor_id = donor.id
       WHERE br.id = ? AND (br.requester_id = ? OR br.donor_id = ?) AND br.status IN ('accepted','completed')
       LIMIT 1`,
      [requestId, me.id, me.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: "Chat is not available for this request." });
    }

    await pool.query("UPDATE blood_request_messages SET is_read = 1 WHERE request_id = ? AND sender_id != ?", [requestId, me.id]);

    const [messages] = await pool.query(
      `SELECT m.*, u.name AS sender_name
       FROM blood_request_messages m
       LEFT JOIN blood_bank_users u ON m.sender_id = u.id
       WHERE m.request_id = ?
       ORDER BY m.created_at ASC`,
      [requestId]
    );

    res.json({ success: true, data: { request: requestResponse(requests[0]), messages, me } });
  } catch (error) {
    console.error("Chat fetch error:", error);
    res.status(500).json({ success: false, message: "Could not load chat." });
  }
});

router.post("/requests/:id/chat", requireAuth, async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const message = clean(req.body.message || req.body.chat_message);
    const me = await currentBloodBankUser(req, { createIfMissing: true });

    if (!message) {
      return res.status(400).json({ success: false, message: "Message cannot be empty." });
    }

    if (message.length > 1000) {
      return res.status(400).json({ success: false, message: "Message is too long. Keep it under 1000 characters." });
    }

    const [requests] = await pool.query(
      `SELECT id FROM blood_requests
       WHERE id = ? AND (requester_id = ? OR donor_id = ?) AND status IN ('accepted','completed')
       LIMIT 1`,
      [requestId, me.id, me.id]
    );

    if (requests.length === 0) {
      return res.status(403).json({ success: false, message: "You are not allowed to send messages in this chat." });
    }

    await pool.query("INSERT INTO blood_request_messages (request_id, sender_id, message) VALUES (?, ?, ?)", [requestId, me.id, message]);
    await pool.query("UPDATE blood_requests SET updated_at = NOW() WHERE id = ?", [requestId]);

    res.status(201).json({ success: true, message: "Message sent." });
  } catch (error) {
    console.error("Chat send error:", error);
    res.status(500).json({ success: false, message: "Could not send message." });
  }
});

router.post("/complaints", requireAuth, async (req, res) => {
  try {
    const me = await currentBloodBankUser(req, {
      createIfMissing: true,
      fallback: { contact: req.body.contact },
    });

    const name = clean(req.body.name || req.body.complaint_name) || me.name;
    const email = clean(req.body.email || req.body.complaint_email) || me.email;
    const contact = normalizePhone(req.body.contact || req.body.complaint_contact) || me.contact;
    const description = clean(req.body.description || req.body.complaint_description);

    if (!name || !email || !contact || !description) {
      return res.status(400).json({ success: false, message: "Please complete the complaint form." });
    }

    await pool.query(
      "INSERT INTO blood_complaints (user_id, name, email, contact, description, attachment) VALUES (?, ?, ?, ?, ?, ?)",
      [me.id, name, email, contact, description, null]
    );

    res.status(201).json({ success: true, message: "Complaint submitted successfully." });
  } catch (error) {
    console.error("Complaint submit error:", error);
    res.status(500).json({ success: false, message: "Could not submit complaint." });
  }
});

export default router;
