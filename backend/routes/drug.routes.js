import express from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import multer from "multer";
import { createWorker } from "tesseract.js";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { pool } from "../db.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../uploads/prescriptions");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Prescription file must be PDF, JPG, PNG, or WEBP."));
    }
    cb(null, true);
  },
});

function clean(value) {
  return String(value ?? "").trim();
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

function requireUser(req, res, next) {
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


function normalizePrescriptionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function prescriptionMedicineBaseName(name) {
  return normalizePrescriptionText(name)
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|unit|units)\b/g, "")
    .replace(/\b(tablet|tab|capsule|cap|syrup|injection|inj|drop|drops)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cartMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeCartProduct(product) {
  return {
    ...product,
    id: Number(product.id),
    mrp: cartMoney(product.mrp),
    price: cartMoney(product.price),
    discount: Number(product.discount || 0),
    is_special_offer: Number(product.is_special_offer || 0) === 1,
    in_stock: Number(product.in_stock ?? 1) === 1,
  };
}

async function extractPrescriptionText(file) {
  if (!file) return "";

  if (file.mimetype === "application/pdf") {
    const buffer = fs.readFileSync(file.path);
    const parsed = await pdfParse(buffer);
    return parsed.text || "";
  }

  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(file.path);
    return result?.data?.text || "";
  } finally {
    await worker.terminate();
  }
}

function detectPrescriptionProducts(rawText, products) {
  const text = normalizePrescriptionText(rawText);

  if (!text) return [];

  const found = [];
  const seen = new Set();

  for (const product of products) {
    const fullName = normalizePrescriptionText(product.name);
    const baseName = prescriptionMedicineBaseName(product.name);

    const fullMatch = fullName && text.includes(fullName);
    const baseMatch = baseName.length >= 4 && text.includes(baseName);

    if ((fullMatch || baseMatch) && !seen.has(Number(product.id))) {
      seen.add(Number(product.id));
      found.push({
        ...normalizeCartProduct(product),
        quantity: 1,
        detection_reason: fullMatch
          ? "Full medicine name matched"
          : "Medicine base name matched",
      });
    }
  }

  return found;
}

const seedMedicines = {
  Paracetamol: {
    category: "Pain Relief / Fever",
    common_use: "Fever, headache, mild body pain",
    usual_dose: "500mg every 6-8 hours when needed; follow doctor advice",
    side_effects: "Nausea, rash, liver risk if overdosed",
    warnings: "Avoid overdose and be careful with liver disease or heavy alcohol use",
    interacts: { Warfarin: "Moderate", Alcohol: "Severe" },
  },
  Ibuprofen: {
    category: "NSAID Pain Relief",
    common_use: "Pain, inflammation, fever",
    usual_dose: "200-400mg every 6-8 hours after food when needed",
    side_effects: "Stomach irritation, acidity, kidney stress",
    warnings: "Avoid in stomach ulcer, kidney disease, late pregnancy, or blood thinner use unless advised",
    interacts: { Aspirin: "Moderate", Warfarin: "Severe", Lisinopril: "Moderate", Prednisolone: "Moderate" },
  },
  Aspirin: {
    category: "Antiplatelet / Pain Relief",
    common_use: "Heart protection, pain, fever",
    usual_dose: "Dose depends on purpose; use as prescribed",
    side_effects: "Bleeding, stomach irritation, heartburn",
    warnings: "Do not use for children with viral fever; caution with ulcers and blood thinners",
    interacts: { Warfarin: "Severe", Ibuprofen: "Moderate", Clopidogrel: "Moderate" },
  },
  Warfarin: {
    category: "Blood Thinner",
    common_use: "Prevent blood clots",
    usual_dose: "Individual dose based on INR; never change dose without doctor advice",
    side_effects: "Bleeding, bruising, nausea",
    warnings: "Needs regular INR monitoring; many food and medicine interactions",
    interacts: { Aspirin: "Severe", Ibuprofen: "Severe", Paracetamol: "Moderate", Metronidazole: "Severe", Azithromycin: "Moderate", Amoxicillin: "Moderate", Clarithromycin: "Severe", Fluconazole: "Severe", Ciprofloxacin: "Moderate", Ranitidine: "Minor" },
  },
  Metformin: {
    category: "Diabetes Medicine",
    common_use: "Type 2 diabetes",
    usual_dose: "Usually taken with meals; dose set by doctor",
    side_effects: "Stomach upset, diarrhea, metallic taste",
    warnings: "Caution in kidney disease and before contrast imaging tests",
    interacts: { Furosemide: "Moderate", "Contrast Dye": "Severe" },
  },
  Atorvastatin: {
    category: "Cholesterol Medicine",
    common_use: "High cholesterol, heart disease prevention",
    usual_dose: "Usually once daily; dose set by doctor",
    side_effects: "Muscle pain, liver enzyme changes, stomach upset",
    warnings: "Report severe muscle pain; avoid during pregnancy",
    interacts: { Clarithromycin: "Severe", Fluconazole: "Moderate", "Grapefruit Juice": "Moderate" },
  },
  Lisinopril: {
    category: "Blood Pressure Medicine",
    common_use: "High blood pressure, heart failure",
    usual_dose: "Usually once daily; dose set by doctor",
    side_effects: "Dry cough, dizziness, high potassium",
    warnings: "Avoid during pregnancy; monitor kidney function and potassium",
    interacts: { Ibuprofen: "Moderate", "Potassium Supplement": "Severe", Spironolactone: "Severe", Diclofenac: "Moderate" },
  },
  Losartan: {
    category: "Blood Pressure Medicine",
    common_use: "High blood pressure, kidney protection in diabetes",
    usual_dose: "Usually once daily; dose set by doctor",
    side_effects: "Dizziness, high potassium, fatigue",
    warnings: "Avoid during pregnancy; monitor kidney function and potassium",
    interacts: { "Potassium Supplement": "Severe", Spironolactone: "Severe", Ibuprofen: "Moderate" },
  },
  Omeprazole: {
    category: "Gastric / Acid Reducer",
    common_use: "Acidity, reflux, stomach ulcer",
    usual_dose: "Usually once daily before food; follow prescription",
    side_effects: "Headache, stomach pain, nausea",
    warnings: "Long-term use should be reviewed by a doctor",
    interacts: { Clopidogrel: "Moderate", Warfarin: "Moderate", Levothyroxine: "Minor" },
  },
  Cetirizine: {
    category: "Antihistamine",
    common_use: "Allergy, sneezing, itching",
    usual_dose: "Usually once daily; may cause sleepiness",
    side_effects: "Drowsiness, dry mouth, tiredness",
    warnings: "Avoid driving if sleepy; caution with alcohol",
    interacts: { Alcohol: "Moderate", Diazepam: "Moderate" },
  },
  Amoxicillin: {
    category: "Antibiotic",
    common_use: "Bacterial infections",
    usual_dose: "Complete the full prescribed course",
    side_effects: "Diarrhea, rash, nausea",
    warnings: "Avoid if allergic to penicillin; use only when prescribed",
    interacts: { Warfarin: "Moderate", Methotrexate: "Severe" },
  },
  Azithromycin: {
    category: "Antibiotic",
    common_use: "Respiratory and other bacterial infections",
    usual_dose: "Dose schedule varies; complete full course",
    side_effects: "Nausea, diarrhea, stomach pain",
    warnings: "Caution in heart rhythm problems",
    interacts: { Warfarin: "Moderate", Amiodarone: "Severe", Digoxin: "Moderate" },
  },
  Amlodipine: {
    category: "Blood Pressure Medicine",
    common_use: "High blood pressure, chest pain",
    usual_dose: "Usually once daily; dose set by doctor",
    side_effects: "Ankle swelling, flushing, dizziness",
    warnings: "Do not stop suddenly without doctor advice",
    interacts: { Simvastatin: "Moderate", Clarithromycin: "Moderate" },
  },
  Montelukast: {
    category: "Respiratory / Allergy Medicine",
    common_use: "Asthma support, allergic rhinitis",
    usual_dose: "Usually once daily at night",
    side_effects: "Headache, stomach pain, mood changes rarely",
    warnings: "Report mood or sleep changes to a doctor",
    interacts: { Phenobarbital: "Moderate" },
  },
  Fluconazole: {
    category: "Antifungal",
    common_use: "Fungal infections",
    usual_dose: "Dose depends on infection type; use as prescribed",
    side_effects: "Nausea, headache, liver enzyme changes",
    warnings: "Caution with liver disease and heart rhythm problems",
    interacts: { Atorvastatin: "Moderate", Warfarin: "Severe", Clopidogrel: "Moderate" },
  },
  Ranitidine: {
    category: "Gastric / Acid Reducer",
    common_use: "Acidity and reflux",
    usual_dose: "Use only if advised and available under local guidance",
    side_effects: "Headache, constipation, diarrhea",
    warnings: "Check local safety guidance and alternatives with a doctor",
    interacts: { Warfarin: "Minor" },
  },
  Diclofenac: {
    category: "NSAID Pain Relief",
    common_use: "Pain and inflammation",
    usual_dose: "Use after food and for shortest possible duration",
    side_effects: "Stomach pain, acidity, swelling, blood pressure rise",
    warnings: "Caution in heart, kidney, ulcer, or blood thinner patients",
    interacts: { Warfarin: "Severe", Aspirin: "Moderate", Lisinopril: "Moderate" },
  },
  "Calcium Carbonate": {
    category: "Supplement / Antacid",
    common_use: "Calcium supplement, acidity",
    usual_dose: "Take as directed; separate from some medicines",
    side_effects: "Constipation, gas, high calcium if overused",
    warnings: "Separate from thyroid and some antibiotic medicines",
    interacts: { Levothyroxine: "Moderate", Ciprofloxacin: "Moderate" },
  },
  "Folic Acid": {
    category: "Vitamin",
    common_use: "Folate deficiency, pregnancy support",
    usual_dose: "Usually once daily; follow doctor advice",
    side_effects: "Usually well tolerated, nausea rarely",
    warnings: "Do not use to mask untreated B12 deficiency without evaluation",
    interacts: { Phenytoin: "Moderate" },
  },
  "Vitamin D3": {
    category: "Vitamin",
    common_use: "Vitamin D deficiency, bone health",
    usual_dose: "Daily or weekly dosing depending on prescription",
    side_effects: "High calcium symptoms if overdosed",
    warnings: "Avoid excess dosing without lab monitoring",
    interacts: { Digoxin: "Moderate", "Thiazide Diuretic": "Moderate" },
  },
  Clopidogrel: {
    category: "Antiplatelet",
    common_use: "Prevent clots after heart attack/stent/stroke",
    usual_dose: "Usually once daily as prescribed",
    side_effects: "Bleeding, bruising, stomach upset",
    warnings: "Do not stop without doctor advice after stent or stroke treatment",
    interacts: { Aspirin: "Moderate", Omeprazole: "Moderate", Fluconazole: "Moderate" },
  },
  Prednisolone: {
    category: "Steroid",
    common_use: "Inflammation, asthma flare, allergy, autoimmune conditions",
    usual_dose: "Dose and taper depend on condition; use as prescribed",
    side_effects: "High sugar, acidity, mood changes, swelling",
    warnings: "Do not stop suddenly after long use; caution with infections",
    interacts: { Ibuprofen: "Moderate", Diclofenac: "Moderate", Aspirin: "Moderate" },
  },
  Insulin: {
    category: "Diabetes Medicine",
    common_use: "Diabetes blood sugar control",
    usual_dose: "Dose individualized; follow glucose monitoring plan",
    side_effects: "Low blood sugar, weight gain, injection site reaction",
    warnings: "Carry sugar source; never change dose without professional advice",
    interacts: { Prednisolone: "Moderate", Atenolol: "Moderate" },
  },
  Salbutamol: {
    category: "Asthma Reliever",
    common_use: "Wheezing, asthma/COPD rescue relief",
    usual_dose: "Use inhaler as prescribed for symptoms",
    side_effects: "Tremor, fast heartbeat, nervousness",
    warnings: "Frequent need may mean poor asthma control; seek care",
    interacts: { Atenolol: "Moderate", Furosemide: "Minor" },
  },
  Levothyroxine: {
    category: "Thyroid Hormone",
    common_use: "Hypothyroidism",
    usual_dose: "Usually morning on empty stomach; separate from calcium/iron",
    side_effects: "Palpitations, anxiety, weight changes if dose too high",
    warnings: "Regular thyroid tests needed",
    interacts: { "Calcium Carbonate": "Moderate", "Iron Supplement": "Moderate", Omeprazole: "Minor" },
  },
  Ciprofloxacin: {
    category: "Antibiotic",
    common_use: "Certain bacterial infections",
    usual_dose: "Complete prescribed course; separate from calcium/iron",
    side_effects: "Nausea, diarrhea, tendon pain rarely",
    warnings: "Avoid unnecessary use; report tendon pain immediately",
    interacts: { "Calcium Carbonate": "Moderate", Warfarin: "Moderate", Theophylline: "Severe" },
  },
  Clarithromycin: {
    category: "Antibiotic",
    common_use: "Respiratory and other infections",
    usual_dose: "Use exactly as prescribed",
    side_effects: "Stomach upset, taste changes, diarrhea",
    warnings: "Caution in heart rhythm issues and liver disease",
    interacts: { Atorvastatin: "Severe", Amlodipine: "Moderate", Warfarin: "Severe" },
  },
  Metronidazole: {
    category: "Antibiotic / Antiprotozoal",
    common_use: "Anaerobic bacterial and protozoal infections",
    usual_dose: "Use prescribed schedule; complete course",
    side_effects: "Metallic taste, nausea, dizziness",
    warnings: "Avoid alcohol during treatment and shortly after",
    interacts: { Alcohol: "Severe", Warfarin: "Severe" },
  },
  Diazepam: {
    category: "Sedative / Anti-anxiety",
    common_use: "Anxiety, muscle spasm, seizures under supervision",
    usual_dose: "Use only as prescribed",
    side_effects: "Sleepiness, dizziness, dependence risk",
    warnings: "Avoid driving and alcohol; dependence risk with prolonged use",
    interacts: { Alcohol: "Severe", Cetirizine: "Moderate" },
  },
  Atenolol: {
    category: "Beta Blocker",
    common_use: "Blood pressure, heart rate control",
    usual_dose: "Usually once daily; do not stop suddenly",
    side_effects: "Slow pulse, tiredness, cold hands",
    warnings: "Caution in asthma/COPD and diabetes",
    interacts: { Salbutamol: "Moderate", Insulin: "Moderate" },
  },
  Furosemide: {
    category: "Diuretic",
    common_use: "Fluid overload, swelling, heart failure",
    usual_dose: "Usually morning; dose set by doctor",
    side_effects: "Frequent urination, low potassium, dehydration",
    warnings: "Monitor kidney function and electrolytes",
    interacts: { Metformin: "Moderate", Digoxin: "Moderate" },
  },
  Digoxin: {
    category: "Heart Medicine",
    common_use: "Heart failure, certain rhythm problems",
    usual_dose: "Precise dose set by doctor; monitoring may be needed",
    side_effects: "Nausea, vision changes, rhythm problems if level high",
    warnings: "Toxicity risk; caution with kidney disease",
    interacts: { Azithromycin: "Moderate", Furosemide: "Moderate", "Vitamin D3": "Moderate" },
  },
  Spironolactone: {
    category: "Diuretic / Heart Medicine",
    common_use: "Heart failure, resistant hypertension, swelling",
    usual_dose: "Usually once daily; follow prescription",
    side_effects: "High potassium, breast tenderness, dizziness",
    warnings: "Monitor potassium and kidney function",
    interacts: { Lisinopril: "Severe", Losartan: "Severe", "Potassium Supplement": "Severe" },
  },
};

const extraMedicineNames = [
  "Pantoprazole", "Esomeprazole", "Domperidone", "Ondansetron", "Doxycycline",
  "Cefixime", "Cefuroxime", "Levofloxacin", "Allopurinol", "Alprazolam",
  "Sertraline", "Fluoxetine", "Carbamazepine", "Phenytoin", "Methotrexate",
  "Iron Supplement", "Potassium Supplement", "Simvastatin", "Amiodarone",
  "Grapefruit Juice", "Alcohol", "Contrast Dye", "Theophylline", "Phenobarbital",
  "Thiazide Diuretic",
];

for (const name of extraMedicineNames) {
  if (!seedMedicines[name]) {
    seedMedicines[name] = {
      category: "Medicine / Health Item",
      common_use: "Use depends on diagnosis and prescription",
      usual_dose: "Follow prescription label or doctor advice",
      side_effects: "Side effects vary; ask a pharmacist if unsure",
      warnings: "Use only as directed; tell your doctor about other medicines",
      interacts: {},
    };
  }
}

function severityRank(severity) {
  return { Minor: 1, Moderate: 2, Severe: 3 }[severity] || 0;
}

function defaultInteractionText(severity, a, b) {
  const descriptions = {
    Severe: `${a} and ${b} may cause a serious interaction when used together. This combination can increase the chance of dangerous side effects.`,
    Moderate: `${a} and ${b} may interact and may need monitoring, timing changes, dose adjustment, or an alternative medicine.`,
    Minor: `${a} and ${b} may have a mild interaction. It is usually manageable, but monitoring is still recommended.`,
  };

  const recommendations = {
    Severe: "Avoid this combination unless a doctor specifically approves it and provides close monitoring.",
    Moderate: "Use with caution. Ask a doctor or pharmacist before combining these medicines.",
    Minor: "Usually safe with minimal precautions. Follow the prescription and monitor symptoms.",
  };

  return {
    description: descriptions[severity] || "Potential interaction found.",
    recommendation: recommendations[severity] || "Ask a healthcare professional before combining these medicines.",
  };
}

function normalizeInteractionEntry(entry, a, b) {
  if (!entry) return null;
  if (typeof entry === "object") {
    const severity = entry.severity || "Moderate";
    const defaults = defaultInteractionText(severity, a, b);
    return {
      severity,
      description: entry.description || defaults.description,
      recommendation: entry.recommendation || defaults.recommendation,
    };
  }

  const severity = String(entry);
  const defaults = defaultInteractionText(severity, a, b);
  return {
    severity,
    description: defaults.description,
    recommendation: defaults.recommendation,
  };
}

async function ensureDrugTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drug_medicines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      medicine_name VARCHAR(150) NOT NULL UNIQUE,
      category VARCHAR(150) NOT NULL,
      common_use TEXT NOT NULL,
      usual_dose TEXT NOT NULL,
      side_effects TEXT NOT NULL,
      warnings TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drug_interaction_pairs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      medicine_a VARCHAR(150) NOT NULL,
      medicine_b VARCHAR(150) NOT NULL,
      severity ENUM('Severe','Moderate','Minor') NOT NULL DEFAULT 'Moderate',
      description TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_drug_pair (medicine_a, medicine_b),
      INDEX idx_medicine_a (medicine_a),
      INDEX idx_medicine_b (medicine_b),
      INDEX idx_severity (severity)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS medicine_reminders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      medicine_name VARCHAR(150) NOT NULL,
      dosage VARCHAR(120) NULL,
      reminder_time TIME NOT NULL,
      frequency VARCHAR(80) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NULL,
      notes TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_prescriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      prescription_title VARCHAR(180) NOT NULL,
      doctor_name VARCHAR(150) NULL,
      prescription_date DATE NULL,
      file_path VARCHAR(255) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [[medicineCount]] = await pool.query("SELECT COUNT(*) AS count FROM drug_medicines");

  if (Number(medicineCount.count || 0) === 0) {
    const values = Object.entries(seedMedicines)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, info]) => [
        name,
        info.category,
        info.common_use,
        info.usual_dose,
        info.side_effects,
        info.warnings,
      ]);

    await pool.query(
      `INSERT INTO drug_medicines
       (medicine_name, category, common_use, usual_dose, side_effects, warnings)
       VALUES ?`,
      [values]
    );
  }

  const [[pairCount]] = await pool.query("SELECT COUNT(*) AS count FROM drug_interaction_pairs");

  if (Number(pairCount.count || 0) === 0) {
    const seen = new Set();
    const values = [];

    for (const [name, info] of Object.entries(seedMedicines)) {
      for (const [other, raw] of Object.entries(info.interacts || {})) {
        const pair = [name, other].sort((a, b) => a.localeCompare(b));
        const key = `${pair[0].toLowerCase()}|${pair[1].toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const entry = normalizeInteractionEntry(raw, pair[0], pair[1]);
        values.push([pair[0], pair[1], entry.severity, entry.description, entry.recommendation]);
      }
    }

    if (values.length) {
      await pool.query(
        `INSERT IGNORE INTO drug_interaction_pairs
         (medicine_a, medicine_b, severity, description, recommendation)
         VALUES ?`,
        [values]
      );
    }
  }
}

async function loadMedicines() {
  const [medicineRows] = await pool.query("SELECT * FROM drug_medicines ORDER BY medicine_name ASC");
  const medicines = {};

  for (const row of medicineRows) {
    medicines[row.medicine_name] = {
      id: row.id,
      medicine_name: row.medicine_name,
      category: row.category,
      common_use: row.common_use,
      usual_dose: row.usual_dose,
      side_effects: row.side_effects,
      warnings: row.warnings,
      interacts: {},
    };
  }

  const [pairRows] = await pool.query("SELECT * FROM drug_interaction_pairs ORDER BY FIELD(severity, 'Severe', 'Moderate', 'Minor'), medicine_a ASC, medicine_b ASC");

  for (const row of pairRows) {
    if (!medicines[row.medicine_a]) continue;
    if (!medicines[row.medicine_b]) continue;

    const entry = {
      severity: row.severity,
      description: row.description,
      recommendation: row.recommendation,
    };

    medicines[row.medicine_a].interacts[row.medicine_b] = entry;
    medicines[row.medicine_b].interacts[row.medicine_a] = entry;
  }

  return medicines;
}

function pairInteraction(a, b, medicines) {
  if (!a || !b || a === b) return null;

  let best = null;

  if (medicines[a]?.interacts?.[b]) {
    best = normalizeInteractionEntry(medicines[a].interacts[b], a, b);
  }

  if (medicines[b]?.interacts?.[a]) {
    const other = normalizeInteractionEntry(medicines[b].interacts[a], a, b);
    if (!best || severityRank(other.severity) > severityRank(best.severity)) {
      best = other;
    }
  }

  if (!best) return null;

  return {
    pair: `${a} + ${b}`,
    medicines: [a, b],
    severity: best.severity,
    message: best.description,
    recommendation: best.recommendation,
  };
}

router.use(async (_req, _res, next) => {
  try {
    await ensureDrugTables();
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/meta", async (_req, res) => {
  const [[medicineCountRows], [interactionCountRows], [severityRows]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total_medicines FROM drug_medicines"),
    pool.query("SELECT COUNT(*) AS known_interactions FROM drug_interaction_pairs"),
    pool.query("SELECT severity, COUNT(*) AS count FROM drug_interaction_pairs GROUP BY severity"),
  ]);

  res.json({
    success: true,
    data: {
      total_medicines: medicineCountRows[0]?.total_medicines || 0,
      known_interactions: interactionCountRows[0]?.known_interactions || 0,
      severity_counts: severityRows,
    },
  });
});

router.get("/medicines", async (req, res) => {
  const q = clean(req.query.q).toLowerCase();
  const medicines = await loadMedicines();

  let rows = Object.values(medicines).map(({ interacts, ...rest }) => ({
    ...rest,
    interaction_count: Object.keys(interacts || {}).length,
  }));

  if (q) {
    rows = rows.filter((item) =>
      [item.medicine_name, item.category, item.common_use, item.warnings]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  res.json({ success: true, data: rows.slice(0, 120) });
});

router.get("/medicines/:name", async (req, res) => {
  const medicines = await loadMedicines();
  const name = decodeURIComponent(req.params.name);
  const medicine = medicines[name];

  if (!medicine) {
    return res.status(404).json({ success: false, message: "Medicine not found." });
  }

  res.json({
    success: true,
    data: {
      ...medicine,
      interaction_names: Object.keys(medicine.interacts || {}),
    },
  });
});

router.post("/check", async (req, res) => {
  const medicines = await loadMedicines();
  const selected = Array.isArray(req.body.medicines)
    ? req.body.medicines.map(clean).filter(Boolean)
    : [];

  const unique = [...new Set(selected)].filter((name) => medicines[name]);

  if (unique.length < 2) {
    return res.status(400).json({
      success: false,
      message: "Select at least two valid medicines to check interactions.",
    });
  }

  const results = [];

  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const result = pairInteraction(unique[i], unique[j], medicines);
      if (result) results.push(result);
    }
  }

  const highestSeverity = results.reduce((highest, item) => {
    return severityRank(item.severity) > severityRank(highest) ? item.severity : highest;
  }, results.length ? "Minor" : "None");

  res.json({
    success: true,
    data: {
      selected: unique,
      results,
      highest_severity: highestSeverity,
      no_known_major_interaction: results.length === 0,
      comparison: unique.map((name) => {
        const { interacts, ...info } = medicines[name];
        return {
          ...info,
          interaction_count: Object.keys(interacts || {}).length,
        };
      }),
    },
  });
});

router.get("/reminders", requireUser, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM medicine_reminders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [req.user.id]
  );

  res.json({ success: true, data: rows });
});

router.post("/reminders", requireUser, async (req, res) => {
  const { medicine_name, dosage, reminder_time, frequency, start_date, end_date, notes } = req.body;

  if (!medicine_name || !reminder_time || !frequency || !start_date) {
    return res.status(400).json({
      success: false,
      message: "Medicine name, time, frequency, and start date are required.",
    });
  }

  const [result] = await pool.query(
    `INSERT INTO medicine_reminders
     (user_id, medicine_name, dosage, reminder_time, frequency, start_date, end_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      clean(medicine_name),
      clean(dosage),
      clean(reminder_time),
      clean(frequency),
      clean(start_date),
      end_date ? clean(end_date) : null,
      clean(notes),
    ]
  );

  res.status(201).json({ success: true, message: "Medicine reminder saved successfully.", data: { id: result.insertId } });
});

router.patch("/reminders/:id/toggle", requireUser, async (req, res) => {
  const [result] = await pool.query(
    "UPDATE medicine_reminders SET is_active = IF(is_active = 1, 0, 1) WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ success: false, message: "Reminder not found." });
  }

  res.json({ success: true, message: "Reminder status updated." });
});

router.delete("/reminders/:id", requireUser, async (req, res) => {
  const [result] = await pool.query(
    "DELETE FROM medicine_reminders WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ success: false, message: "Reminder not found." });
  }

  res.json({ success: true, message: "Reminder deleted." });
});

router.get("/prescriptions", requireUser, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT * FROM user_prescriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [req.user.id]
  );

  res.json({ success: true, data: rows });
});

router.post("/prescriptions", requireUser, upload.single("prescription_file"), async (req, res) => {
  const { prescription_title, doctor_name, prescription_date, notes } = req.body;

  if (!prescription_title) {
    return res.status(400).json({ success: false, message: "Prescription title is required." });
  }

  const filePath = req.file ? `/uploads/prescriptions/${req.file.filename}` : null;

  const [result] = await pool.query(
    `INSERT INTO user_prescriptions
     (user_id, prescription_title, doctor_name, prescription_date, file_path, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      clean(prescription_title),
      clean(doctor_name),
      prescription_date ? clean(prescription_date) : null,
      filePath,
      clean(notes),
    ]
  );

  res.status(201).json({
    success: true,
    message: "Prescription added successfully.",
    data: { id: result.insertId, file_path: filePath },
  });
});

router.delete("/prescriptions/:id", requireUser, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT file_path FROM user_prescriptions WHERE id = ? AND user_id = ? LIMIT 1",
    [req.params.id, req.user.id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Prescription not found." });
  }

  await pool.query("DELETE FROM user_prescriptions WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);

  res.json({ success: true, message: "Prescription deleted." });
});


router.post("/prescriptions/scan-cart", optionalAuth, upload.single("prescription"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a prescription file.",
      });
    }

    const manualText = clean(req.body.prescription_text);
    let extractedText = "";

    try {
      extractedText = await extractPrescriptionText(req.file);
    } catch (ocrError) {
      console.error("Prescription OCR error:", ocrError);
    }

    const combinedText = `${manualText}\n${extractedText}\n${req.file.originalname}`;

    const [products] = await pool.query(`
      SELECT *
      FROM products
      WHERE in_stock = 1
      ORDER BY name ASC
    `);

    const matchedProducts = detectPrescriptionProducts(combinedText, products);

    return res.json({
      success: true,
      message:
        matchedProducts.length > 0
          ? `${matchedProducts.length} medicine(s) detected from prescription. Please review your cart before checkout.`
          : "Prescription uploaded, but no matching pharmacy product was detected. Please search manually.",
      data: {
        file_url: `/uploads/prescriptions/${req.file.filename}`,
        original_file_name: req.file.originalname,
        extracted_text: extractedText,
        matched_products: matchedProducts,
        matched_count: matchedProducts.length,
      },
    });
  } catch (error) {
    console.error("Prescription scan-cart error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not scan prescription.",
    });
  }
});

router.use((error, _req, res, _next) => {
  console.error("Drug interaction route error:", error);
  res.status(500).json({
    success: false,
    message: error.message || "Drug interaction service error.",
  });
});

export default router;
