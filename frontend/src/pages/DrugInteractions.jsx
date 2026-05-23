import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ClipboardList,
  FileText,
  Info,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { UploadCloud, ShoppingCart, CheckCircle, AlertTriangle } from "lucide-react";

const navigate = useNavigate();

const [prescriptionFile, setPrescriptionFile] = useState(null);
const [prescriptionText, setPrescriptionText] = useState("");
const [prescriptionScan, setPrescriptionScan] = useState(null);
const [prescriptionLoading, setPrescriptionLoading] = useState(false);
const [notice, setNotice] = useState(null);

const emptyReminder = {
  medicine_name: "",
  dosage: "",
  reminder_time: "",
  frequency: "Daily",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  notes: "",
};

const emptyPrescription = {
  prescription_title: "",
  doctor_name: "",
  prescription_date: "",
  notes: "",
  prescription_file: null,
};

const severityMeta = {
  Severe: {
    title: "Severe",
    className: "severe",
    text: "Avoid unless a doctor specifically approves and monitors it.",
  },
  Moderate: {
    title: "Moderate",
    className: "moderate",
    text: "May need dose adjustment, timing changes, or monitoring.",
  },
  Minor: {
    title: "Minor",
    className: "minor",
    text: "Usually manageable, but monitoring is still recommended.",
  },
};

function fileUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `http://localhost:5000${path}`;
}

function formatDate(value) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function mergeProductsIntoCart(products) {
  let currentCart = [];

  try {
    currentCart = JSON.parse(localStorage.getItem("healthcare_cart") || "[]");
  } catch {
    currentCart = [];
  }

  const nextCart = [...currentCart];

  products.forEach((product) => {
    const foundIndex = nextCart.findIndex((item) => Number(item.id) === Number(product.id));

    if (foundIndex >= 0) {
      nextCart[foundIndex] = {
        ...nextCart[foundIndex],
        quantity: Number(nextCart[foundIndex].quantity || 1) + Number(product.quantity || 1),
      };
    } else {
      nextCart.push({
        ...product,
        quantity: Number(product.quantity || 1),
      });
    }
  });

  localStorage.setItem("healthcare_cart", JSON.stringify(nextCart));
  localStorage.setItem(
    "healthcare_cart_notice",
    JSON.stringify({
      type: "success",
      message: `${products.length} medicine(s) were detected from your prescription and added to cart. Please review before placing order.`,
    })
  );

  return nextCart;
}

async function uploadPrescriptionAndAddToCart(event) {
  event.preventDefault();

  if (!prescriptionFile) {
    setNotice({
      type: "error",
      message: "Please choose a prescription image or PDF.",
    });
    return;
  }

  setPrescriptionLoading(true);
  setNotice(null);

  try {
    const formData = new FormData();
    formData.append("prescription", prescriptionFile);
    formData.append("prescription_text", prescriptionText);

    const response = await api.post(
      "/drug-interactions/prescriptions/scan-cart",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    const matchedProducts = response.data.data?.matched_products || [];

    setPrescriptionScan(response.data.data);

    if (matchedProducts.length > 0) {
      mergeProductsIntoCart(matchedProducts);

      setNotice({
        type: "success",
        message: response.data.message,
      });

      setTimeout(() => {
        navigate("/pharmacies?view=checkout");
      }, 900);
    } else {
      setNotice({
        type: "error",
        message: response.data.message,
      });
    }
  } catch (error) {
    setNotice({
      type: "error",
      message: error.response?.data?.message || "Could not scan prescription.",
    });
  } finally {
    setPrescriptionLoading(false);
  }
}

export default function DrugInteractions() {
  const { user } = useAuth();

  const [meta, setMeta] = useState({ total_medicines: 0, known_interactions: 0, severity_counts: [] });
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(["", ""]);
  const [results, setResults] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [reminderForm, setReminderForm] = useState(emptyReminder);
  const [prescriptionForm, setPrescriptionForm] = useState(emptyPrescription);
  const [reminders, setReminders] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  const medicineNames = useMemo(
    () => medicines.map((medicine) => medicine.medicine_name),
    [medicines]
  );

  const searchedMedicines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return medicines.slice(0, 9);

    return medicines
      .filter((medicine) =>
        [medicine.medicine_name, medicine.category, medicine.common_use]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 12);
  }, [medicines, search]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserLists();
    } else {
      setReminders([]);
      setPrescriptions([]);
    }
  }, [user]);

  async function loadInitialData() {
    setLoading(true);

    try {
      const [metaResponse, medicinesResponse] = await Promise.all([
        api.get("/drug-interactions/meta"),
        api.get("/drug-interactions/medicines"),
      ]);

      setMeta(metaResponse.data.data || {});
      setMedicines(medicinesResponse.data.data || []);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load drug interaction database.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadUserLists() {
    if (!user) return;

    try {
      const [reminderResponse, prescriptionResponse] = await Promise.all([
        api.get("/drug-interactions/reminders"),
        api.get("/drug-interactions/prescriptions"),
      ]);

      setReminders(reminderResponse.data.data || []);
      setPrescriptions(prescriptionResponse.data.data || []);
    } catch {
      // User lists are optional. Keep page usable if auth expired.
    }
  }

  function updateSelected(index, value) {
    setSelected((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function addMedicineRow() {
    setSelected((current) => [...current, ""]);
  }

  function removeMedicineRow(index) {
    setSelected((current) => {
      if (current.length <= 2) {
        return current.map((item, itemIndex) => (itemIndex === index ? "" : item));
      }

      return current.filter((_item, itemIndex) => itemIndex !== index);
    });
  }

  async function checkInteractions(event) {
    event.preventDefault();

    const medicinesToCheck = selected.filter(Boolean);

    if (medicinesToCheck.length < 2) {
      setNotice({ type: "error", message: "Select at least two medicines to check." });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.post("/drug-interactions/check", {
        medicines: medicinesToCheck,
      });

      setResults(response.data.data);
      setShowResults(true);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not check interactions.",
      });
    } finally {
      setLoading(false);
    }
  }

  function quickAddMedicine(name) {
    setSelected((current) => {
      if (current.includes(name)) return current;
      const emptyIndex = current.findIndex((item) => !item);
      if (emptyIndex >= 0) {
        return current.map((item, index) => (index === emptyIndex ? name : item));
      }
      return [...current, name];
    });
  }

  function updateReminderForm(event) {
    const { name, value } = event.target;
    setReminderForm((current) => ({ ...current, [name]: value }));
  }

  async function saveReminder(event) {
    event.preventDefault();

    if (!user) {
      setNotice({ type: "error", message: "Please sign in first to save reminders." });
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/drug-interactions/reminders", reminderForm);
      setNotice({ type: "success", message: response.data.message || "Medicine reminder saved." });
      setReminderForm({ ...emptyReminder, start_date: today() });
      setShowReminder(false);
      await loadUserLists();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not save reminder." });
    } finally {
      setLoading(false);
    }
  }

  async function toggleReminder(id) {
    try {
      await api.patch(`/drug-interactions/reminders/${id}/toggle`);
      await loadUserLists();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not update reminder." });
    }
  }

  async function deleteReminder(id) {
    if (!window.confirm("Delete this reminder?")) return;

    try {
      await api.delete(`/drug-interactions/reminders/${id}`);
      await loadUserLists();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not delete reminder." });
    }
  }

  function updatePrescriptionForm(event) {
    const { name, value, files, type } = event.target;
    setPrescriptionForm((current) => ({
      ...current,
      [name]: type === "file" ? files?.[0] || null : value,
    }));
  }

  async function savePrescription(event) {
    event.preventDefault();

    if (!user) {
      setNotice({ type: "error", message: "Please sign in first to add prescriptions." });
      return;
    }

    const formData = new FormData();
    Object.entries(prescriptionForm).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    setLoading(true);

    try {
      const response = await api.post("/drug-interactions/prescriptions", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setNotice({ type: "success", message: response.data.message || "Prescription added." });
      setPrescriptionForm(emptyPrescription);
      setShowPrescription(false);
      await loadUserLists();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not add prescription." });
    } finally {
      setLoading(false);
    }
  }

  async function deletePrescription(id) {
    if (!window.confirm("Delete this prescription?")) return;

    try {
      await api.delete(`/drug-interactions/prescriptions/${id}`);
      await loadUserLists();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not delete prescription." });
    }
  }

  return (
    <section className="di-page">
      <style>{styles}</style>

      <div className="di-shell">
        <div className="di-hero">
          <div>
            <span className="di-kicker">
              <ShieldCheck size={18} />
              Drug Interactions & Safety Database
            </span>
            <h1>Check medicine safety before combining treatments.</h1>
            <p>
              Search medicines, compare warnings, check interaction severity,
              save reminders, and upload prescriptions in one modern dashboard.
            </p>
          </div>

          <div className="hero-actions">
            <button type="button" onClick={() => setShowReminder(true)}>
              <Bell size={17} />
              Set Reminder
            </button>
            <button type="button" onClick={() => setShowPrescription(true)}>
              <UploadCloud size={17} />
              Add Prescription
            </button>
          </div>
        </div>

        {notice && (
          <div className={`di-notice ${notice.type}`}>
            {notice.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {notice.message}
          </div>
        )}

        <div className="di-stats">
          <Stat icon={<Stethoscope />} label="Medicines" value={meta.total_medicines || 0} />
          <Stat icon={<ShieldAlert />} label="Known Interactions" value={meta.known_interactions || 0} />
          <Stat icon={<Bell />} label="Your Reminders" value={reminders.length} />
          <Stat icon={<FileText />} label="Prescriptions" value={prescriptions.length} />
        </div>

        <div className="di-grid">
          <main className="di-main">
            <div className="di-card search-card">
              <div className="card-head">
                <div>
                  <h2>Search Medicine Database</h2>
                  <p>Find medicines by name, category, or common use.</p>
                </div>
                <button type="button" className="ghost-btn" onClick={loadInitialData}>
                  <RefreshCcw size={16} />
                  Refresh
                </button>
              </div>

              <label className="di-search">
                <Search size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search Paracetamol, Warfarin, Antibiotic..."
                />
              </label>

              <div className="medicine-results">
                {searchedMedicines.map((medicine) => (
                  <article className="medicine-chip-card" key={medicine.medicine_name}>
                    <div>
                      <h3>{medicine.medicine_name}</h3>
                      <p>{medicine.category}</p>
                      <small>{medicine.common_use}</small>
                    </div>
                    <button type="button" onClick={() => quickAddMedicine(medicine.medicine_name)}>
                      <Plus size={16} />
                      Add
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <form className="di-card checker-card" onSubmit={checkInteractions}>
              <div className="card-head">
                <div>
                  <h2>Interaction Checker</h2>
                  <p>Select two or more medicines to check pairwise interaction risk.</p>
                </div>
              </div>

              <div className="selected-list">
                {selected.map((value, index) => (
                  <div className="selected-row" key={`${index}-${value}`}>
                    <span>{index + 1}</span>
                    <select value={value} onChange={(event) => updateSelected(index, event.target.value)}>
                      <option value="">Select medication...</option>
                      {medicineNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeMedicineRow(index)}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="checker-actions">
                <button type="button" className="ghost-btn" onClick={addMedicineRow}>
                  <Plus size={16} />
                  Add Medicine
                </button>
                <button className="primary-btn" disabled={loading}>
                  <ShieldCheck size={17} />
                  {loading ? "Checking..." : "Check Interactions"}
                </button>
              </div>
            </form>

            <div className="severity-grid">
              {Object.values(severityMeta).map((item) => (
                <article className={`severity-card ${item.className}`} key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </main>

          <aside className="di-side">
            <div className="di-card notice-card">
              <h2>
                <Info size={19} />
                Important Notice
              </h2>
              <p>
                This tool uses your local educational database. It does not replace
                medical advice, diagnosis, or treatment.
              </p>
              <ul>
                <li>Ask a doctor before combining medicines.</li>
                <li>Do not stop prescribed medicine without advice.</li>
                <li>Call 999 for emergency symptoms.</li>
              </ul>
            </div>

            <div className="di-card list-card">
              <h2>Your Reminders</h2>
              {user ? (
                reminders.length ? reminders.slice(0, 5).map((item) => (
                  <article className="mini-record" key={item.id}>
                    <div>
                      <strong>{item.medicine_name}</strong>
                      <span>{item.dosage || "No dosage"} · {item.reminder_time}</span>
                      <small>{item.frequency} · {formatDate(item.start_date)}</small>
                    </div>
                    <div className="mini-actions">
                      <button type="button" onClick={() => toggleReminder(item.id)}>
                        {item.is_active ? "Active" : "Off"}
                      </button>
                      <button type="button" className="danger" onClick={() => deleteReminder(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                )) : <p className="empty-side">No reminders yet.</p>
              ) : <p className="empty-side">Sign in to save reminders.</p>}
            </div>

            <div className="di-card list-card">
              <h2>Prescriptions</h2>
              {user ? (
                prescriptions.length ? prescriptions.slice(0, 5).map((item) => (
                  <article className="mini-record" key={item.id}>
                    <div>
                      <strong>{item.prescription_title}</strong>
                      <span>{item.doctor_name || "Doctor not added"}</span>
                      <small>{formatDate(item.prescription_date || item.created_at)}</small>
                    </div>
                    <div className="mini-actions">
                      {item.file_path && (
                        <a href={fileUrl(item.file_path)} target="_blank" rel="noreferrer">Open</a>
                      )}
                      <button type="button" className="danger" onClick={() => deletePrescription(item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                )) : <p className="empty-side">No prescriptions yet.</p>
              ) : <p className="empty-side">Sign in to upload prescriptions.</p>}
            </div>
          </aside>
        </div>
      </div>

      {showResults && (
        <ResultModal
          results={results}
          onClose={() => setShowResults(false)}
        />
      )}

      {showReminder && (
        <Modal title="Set Medicine Reminder" icon={<Bell size={18} />} onClose={() => setShowReminder(false)}>
          {!user ? (
            <div className="login-needed">Please sign in first to save reminders.</div>
          ) : (
            <form className="modal-form" onSubmit={saveReminder}>
              <input name="medicine_name" value={reminderForm.medicine_name} onChange={updateReminderForm} list="medicineList" placeholder="Medicine name *" required />
              <input name="dosage" value={reminderForm.dosage} onChange={updateReminderForm} placeholder="Dosage, e.g., 500mg after meal" />
              <div className="two">
                <input type="time" name="reminder_time" value={reminderForm.reminder_time} onChange={updateReminderForm} required />
                <select name="frequency" value={reminderForm.frequency} onChange={updateReminderForm} required>
                  <option>Daily</option>
                  <option>Twice Daily</option>
                  <option>Three Times Daily</option>
                  <option>Weekly</option>
                  <option>As Needed</option>
                </select>
              </div>
              <div className="two">
                <input type="date" name="start_date" value={reminderForm.start_date} onChange={updateReminderForm} required />
                <input type="date" name="end_date" value={reminderForm.end_date} onChange={updateReminderForm} />
              </div>
              <textarea name="notes" value={reminderForm.notes} onChange={updateReminderForm} placeholder="Notes or instruction" />
              <button className="primary-btn" disabled={loading}>Save Reminder</button>
            </form>
          )}
        </Modal>
      )}

      {showPrescription && (
        <Modal title="Add Prescription" icon={<FileText size={18} />} onClose={() => setShowPrescription(false)}>
          {!user ? (
            <div className="login-needed">Please sign in first to add prescriptions.</div>
          ) : (
            <form className="modal-form" onSubmit={savePrescription}>
              <input name="prescription_title" value={prescriptionForm.prescription_title} onChange={updatePrescriptionForm} placeholder="Prescription title *" required />
              <input name="doctor_name" value={prescriptionForm.doctor_name} onChange={updatePrescriptionForm} placeholder="Doctor name" />
              <input type="date" name="prescription_date" value={prescriptionForm.prescription_date} onChange={updatePrescriptionForm} />
              <label className="upload-box">
                <UploadCloud size={22} />
                <strong>Upload prescription file</strong>
                <span>PDF, JPG, PNG, WEBP up to 5MB</span>
                <input type="file" name="prescription_file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={updatePrescriptionForm} />
              </label>
              <textarea name="notes" value={prescriptionForm.notes} onChange={updatePrescriptionForm} placeholder="Notes" />
              <button className="primary-btn" disabled={loading}>Save Prescription</button>
            </form>
            
          )}
          <form className="prescription-auto-card" onSubmit={uploadPrescriptionAndAddToCart}>
  <div className="prescription-head">
    <span>
      <UploadCloud size={18} />
      Add Prescription
    </span>

    <h2>Upload prescription and auto-add medicines to cart</h2>
    <p>
      The system will scan your prescription, match available pharmacy products,
      add detected medicines to your cart, and ask you to review before checkout.
    </p>
  </div>

  {notice && (
    <div className={`drug-notice ${notice.type}`}>
      {notice.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
      {notice.message}
    </div>
  )}

  <label className="prescription-upload-box">
    <UploadCloud size={32} />
    <strong>{prescriptionFile ? prescriptionFile.name : "Upload prescription"}</strong>
    <small>JPG, PNG, WEBP, or PDF up to 8MB</small>

    <input
      type="file"
      accept="image/*,.pdf"
      onChange={(event) => setPrescriptionFile(event.target.files?.[0] || null)}
    />
  </label>

  <label className="manual-text-box">
    Prescription text / notes optional
    <textarea
      value={prescriptionText}
      onChange={(event) => setPrescriptionText(event.target.value)}
      placeholder="Optional: type medicine names if the image is unclear..."
    />
  </label>

  <button className="scan-cart-btn" disabled={prescriptionLoading}>
    <ShoppingCart size={18} />
    {prescriptionLoading ? "Scanning Prescription..." : "Scan & Add Medicines to Cart"}
  </button>

  {prescriptionScan && (
    <div className="scan-result-card">
      <h3>Detected Medicines</h3>

      {prescriptionScan.matched_products?.length ? (
        <div className="detected-list">
          {prescriptionScan.matched_products.map((product) => (
            <div className="detected-item" key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <span>{product.manufacturer}</span>
              </div>

              <b>৳{Number(product.price || 0).toFixed(2)}</b>
            </div>
          ))}
        </div>
      ) : (
        <p>No matching product detected. Please search manually in Pharmacy.</p>
      )}
    </div>
  )}
</form>
        </Modal>
      )}

      <datalist id="medicineList">
        {medicineNames.map((name) => <option key={name} value={name} />)}
      </datalist>
    </section>
  );
}

function Stat({ icon, label, value }) {
  return (
    <article className="di-stat">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function Modal({ title, icon, onClose, children }) {
  return (
    <div className="modal-backdrop">
      <div className="di-modal">
        <div className="modal-head">
          <h2>{icon}{title}</h2>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ResultModal({ results, onClose }) {
  const items = results?.results || [];
  const comparison = results?.comparison || [];

  return (
    <Modal title="Drug Interaction Results" icon={<ShieldCheck size={18} />} onClose={onClose}>
      <div className="results-area">
        {results?.no_known_major_interaction ? (
          <div className="safe-result">
            <CheckCircle size={26} />
            <div>
              <strong>No listed major interaction found</strong>
              <p>This does not guarantee safety. Ask a doctor or pharmacist before combining medicines.</p>
            </div>
          </div>
        ) : (
          items.map((item, index) => (
            <article className={`interaction-result ${item.severity.toLowerCase()}`} key={`${item.pair}-${index}`}>
              <span>{item.severity}</span>
              <h3>{item.pair}</h3>
              <p>{item.message}</p>
              <strong>Recommendation: {item.recommendation}</strong>
            </article>
          ))
        )}

        <div className="comparison-block">
          <h3>
            <ClipboardList size={18} />
            Medicine Info Comparison
          </h3>
          <div className="comparison-grid">
            {comparison.map((medicine) => (
              <article key={medicine.medicine_name}>
                <h4>{medicine.medicine_name}</h4>
                <p><b>Category:</b> {medicine.category}</p>
                <p><b>Use:</b> {medicine.common_use}</p>
                <p><b>Dose:</b> {medicine.usual_dose}</p>
                <p><b>Side effects:</b> {medicine.side_effects}</p>
                <p><b>Warning:</b> {medicine.warnings}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

const styles = `
.di-page {
  min-height: 100vh;
  background: #f8fafc;
  color: #0f172a;
  padding: 28px 16px 48px;
}

.di-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.di-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  border-radius: 30px;
  padding: clamp(26px, 5vw, 46px);
  color: white;
  background: linear-gradient(135deg, #2563eb, #4f46e5 55%, #10b981);
  box-shadow: 0 26px 60px rgba(37,99,235,.22);
  margin-bottom: 18px;
}

.di-kicker,
.hero-actions button,
.ghost-btn,
.primary-btn,
.mini-actions button,
.mini-actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.di-kicker {
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,.16);
  border: 1px solid rgba(255,255,255,.22);
  font-weight: 950;
  margin-bottom: 15px;
}

.di-hero h1 {
  margin: 0;
  max-width: 790px;
  font-size: clamp(2rem, 5vw, 3.7rem);
  line-height: 1;
  letter-spacing: -.065em;
}

.di-hero p {
  max-width: 720px;
  color: #dbeafe;
  font-weight: 700;
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hero-actions button,
.ghost-btn,
.primary-btn {
  border: none;
  border-radius: 15px;
  padding: 12px 16px;
  font-weight: 950;
  cursor: pointer;
}

.hero-actions button {
  background: white;
  color: #2563eb;
}

.primary-btn {
  background: #2563eb;
  color: white;
  box-shadow: 0 12px 24px rgba(37,99,235,.22);
}

.ghost-btn {
  background: white;
  color: #334155;
  border: 1px solid #dbe3ef;
}

.di-notice {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 13px 16px;
  border-radius: 16px;
  margin-bottom: 16px;
  font-weight: 900;
}

.di-notice.success { background: #dcfce7; color: #166534; }
.di-notice.error { background: #fee2e2; color: #991b1b; }

.di-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.di-stat,
.di-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  box-shadow: 0 14px 34px rgba(15,23,42,.07);
}

.di-stat {
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 13px;
}

.di-stat > span {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #dbeafe;
  color: #2563eb;
}

.di-stat strong {
  display: block;
  font-size: 1.45rem;
}

.di-stat small {
  color: #64748b;
  font-weight: 900;
}

.di-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  align-items: start;
}

.di-main,
.di-side {
  display: grid;
  gap: 18px;
}

.di-card {
  padding: 20px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 16px;
}

.card-head h2,
.di-card h2 {
  margin: 0 0 5px;
  letter-spacing: -.03em;
}

.card-head p,
.di-card p {
  margin: 0;
  color: #64748b;
  font-weight: 700;
}

.di-search {
  position: relative;
  display: block;
}

.di-search svg {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  color: #94a3b8;
}

.di-search input,
.selected-row select,
.modal-form input,
.modal-form select,
.modal-form textarea {
  width: 100%;
  border: 1px solid #dbe3ef;
  border-radius: 16px;
  padding: 13px 14px;
  font: inherit;
  font-weight: 800;
  outline: none;
  background: white;
}

.di-search input {
  padding-left: 44px;
}

.di-search input:focus,
.selected-row select:focus,
.modal-form input:focus,
.modal-form select:focus,
.modal-form textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37,99,235,.12);
}

.medicine-results {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.medicine-chip-card {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #f8fafc;
  padding: 14px;
  display: grid;
  gap: 12px;
}

.medicine-chip-card h3 {
  margin: 0;
  font-size: 1rem;
}

.medicine-chip-card p,
.medicine-chip-card small {
  color: #64748b;
}

.medicine-chip-card button {
  border: none;
  border-radius: 13px;
  padding: 10px;
  font-weight: 950;
  color: #2563eb;
  background: #dbeafe;
  cursor: pointer;
}

.selected-list {
  display: grid;
  gap: 12px;
}

.selected-row {
  display: grid;
  grid-template-columns: 38px 1fr 42px;
  gap: 10px;
  align-items: center;
}

.selected-row span {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #dbeafe;
  color: #2563eb;
  font-weight: 950;
}

.selected-row button,
.modal-head button {
  border: none;
  border-radius: 14px;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: #64748b;
  background: #f1f5f9;
}

.checker-actions {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 12px;
  margin-top: 16px;
}

.severity-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.severity-card {
  border-radius: 20px;
  padding: 18px;
  border: 1px solid #e2e8f0;
}

.severity-card h3 {
  margin: 0 0 8px;
}

.severity-card.severe { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
.severity-card.moderate { background: #fffbeb; color: #92400e; border-color: #fde68a; }
.severity-card.minor { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }

.notice-card h2 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notice-card ul {
  margin: 14px 0 0;
  color: #475569;
  font-weight: 700;
  padding-left: 20px;
}

.list-card {
  display: grid;
  gap: 12px;
}

.mini-record {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 17px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.mini-record strong,
.mini-record span,
.mini-record small {
  display: block;
}

.mini-record span,
.mini-record small,
.empty-side {
  color: #64748b;
  font-weight: 700;
}

.mini-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.mini-actions button,
.mini-actions a {
  border: none;
  border-radius: 12px;
  padding: 8px 10px;
  background: #dbeafe;
  color: #2563eb;
  font-weight: 950;
  text-decoration: none;
  cursor: pointer;
}

.mini-actions .danger {
  background: #fee2e2;
  color: #b91c1c;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(15,23,42,.62);
  backdrop-filter: blur(8px);
}

.di-modal {
  width: min(1000px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  border-radius: 26px;
  background: white;
  border: 1px solid #e2e8f0;
  box-shadow: 0 30px 80px rgba(15,23,42,.25);
  padding: 22px;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  margin-bottom: 16px;
}

.modal-head h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 9px;
}

.modal-form {
  display: grid;
  gap: 12px;
}

.modal-form textarea {
  min-height: 95px;
  resize: vertical;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.upload-box {
  border: 1px dashed #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 18px;
  padding: 20px;
  text-align: center;
  display: grid;
  gap: 6px;
  place-items: center;
  cursor: pointer;
}

.upload-box input {
  display: none;
}

.login-needed {
  border-radius: 16px;
  padding: 16px;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 900;
}

.results-area {
  display: grid;
  gap: 14px;
}

.safe-result,
.interaction-result {
  border-radius: 20px;
  padding: 18px;
  border: 1px solid #e2e8f0;
}

.safe-result {
  display: flex;
  gap: 12px;
  background: #ecfdf5;
  color: #166534;
}

.interaction-result span {
  display: inline-flex;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: .78rem;
  font-weight: 950;
  margin-bottom: 8px;
}

.interaction-result h3,
.interaction-result p {
  margin: 0 0 8px;
}

.interaction-result.severe { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
.interaction-result.moderate { background: #fffbeb; color: #92400e; border-color: #fde68a; }
.interaction-result.minor { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }

.comparison-block h3 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.comparison-grid article {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #f8fafc;
  padding: 14px;
}

.comparison-grid h4 {
  margin: 0 0 10px;
}

.comparison-grid p {
  color: #475569;
  margin: 7px 0;
}

@media (max-width: 1040px) {
  .di-grid,
  .medicine-results {
    grid-template-columns: 1fr;
  }

  .di-side {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 760px) {
  .di-hero {
    flex-direction: column;
  }

  .hero-actions,
  .hero-actions button,
  .checker-actions,
  .severity-grid,
  .di-stats,
  .di-side,
  .comparison-grid,
  .two {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .card-head,
  .mini-record {
    flex-direction: column;
  }
}

.prescription-auto-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 26px;
  padding: 22px;
  box-shadow: 0 18px 44px rgba(15, 23, 42, .08);
  display: grid;
  gap: 16px;
}

.prescription-head span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 950;
  margin-bottom: 12px;
}

.prescription-head h2 {
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  letter-spacing: -.045em;
}

.prescription-head p {
  color: #64748b;
  font-weight: 700;
}

.prescription-upload-box {
  border: 1px dashed #93c5fd;
  background: linear-gradient(135deg, #eff6ff, #ecfdf5);
  border-radius: 22px;
  padding: 26px;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 8px;
  color: #2563eb;
  cursor: pointer;
}

.prescription-upload-box input {
  display: none;
}

.prescription-upload-box strong {
  color: #0f172a;
}

.prescription-upload-box small {
  color: #64748b;
  font-weight: 800;
}

.manual-text-box {
  display: grid;
  gap: 8px;
  color: #334155;
  font-weight: 900;
}

.manual-text-box textarea {
  min-height: 90px;
  border: 1px solid #dbe3ef;
  border-radius: 16px;
  padding: 12px;
  font: inherit;
  font-weight: 700;
  resize: vertical;
}

.scan-cart-btn {
  min-height: 52px;
  border: none;
  border-radius: 16px;
  background: #2563eb;
  color: white;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 12px 24px rgba(37, 99, 235, .22);
}

.scan-cart-btn:disabled {
  opacity: .65;
  cursor: not-allowed;
}

.scan-result-card {
  border: 1px solid #dbeafe;
  background: #f8fafc;
  border-radius: 20px;
  padding: 16px;
}

.scan-result-card h3 {
  margin: 0 0 12px;
}

.detected-list {
  display: grid;
  gap: 10px;
}

.detected-item {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.detected-item strong,
.detected-item span {
  display: block;
}

.detected-item span {
  color: #64748b;
  font-size: .85rem;
  font-weight: 800;
}

.detected-item b {
  color: #047857;
}

.drug-notice {
  border-radius: 16px;
  padding: 13px 16px;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 9px;
}

.drug-notice.success {
  background: #dcfce7;
  color: #166534;
}

.drug-notice.error {
  background: #fee2e2;
  color: #991b1b;
}
`;
