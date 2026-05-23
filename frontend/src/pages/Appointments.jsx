import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  Clock,
  CreditCard,
  Filter,
  HeartPulse,
  MapPin,
  MonitorPlay,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Video,
  Wallet,
  XCircle,
} from "lucide-react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const paymentMethods = [
  { value: "credits", label: "Credits" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "card", label: "Card" },
];

const hospitalPaymentMethods = [
  { value: "pay_at_hospital", label: "Pay at Hospital" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "card", label: "Card" },
];

const creditPackages = [5, 10, 20, 50, 100];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1);
  return date.toTimeString().slice(0, 5);
}

function money(value) {
  return Number(value || 0).toFixed(2);
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

function formatTime(value) {
  if (!value) return "N/A";
  return String(value).slice(0, 5);
}

function statusLabel(value) {
  return String(value || "pending").replaceAll("_", " ");
}

export default function Appointments() {
  const { user } = useAuth();

  const [view, setView] = useState("telemedicine");
  const [meta, setMeta] = useState({
    doctors: [],
    hospitals: [],
    departments: [],
    wallet: { balance: 0 },
    stats: {},
  });
  const [appointments, setAppointments] = useState([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [hospitalSearch, setHospitalSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [teleForm, setTeleForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    appointment_date: today(),
    appointment_time: nowTime(),
    consultation_type: "video",
    symptoms: "",
    payment_method: "credits",
    transaction_id: "",
  });
  const [hospitalForm, setHospitalForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    district: "",
    department: "General Medicine",
    doctor: "",
    appointment_date: today(),
    appointment_time: nowTime(),
    notes: "",
    payment_method: "pay_at_hospital",
    transaction_id: "",
  });
  const [creditForm, setCreditForm] = useState({
    credits: 10,
    payment_method: "bkash",
    transaction_id: "",
  });
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  const specialties = useMemo(() => {
    return [...new Set((meta.doctors || []).map((doctor) => doctor.specialty).filter(Boolean))];
  }, [meta.doctors]);

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();

    return (meta.doctors || []).filter((doctor) => {
      const matchesSearch = !q ||
        [doctor.doctor_name, doctor.specialty, doctor.degree, doctor.bio]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesSpecialty = !specialtyFilter || doctor.specialty === specialtyFilter;

      return matchesSearch && matchesSpecialty;
    });
  }, [meta.doctors, doctorSearch, specialtyFilter]);

  const filteredHospitals = useMemo(() => {
    const q = hospitalSearch.trim().toLowerCase();

    return (meta.hospitals || []).filter((hospital) => {
      if (!q) return true;

      return [hospital.name, hospital.division, hospital.district, hospital.area, hospital.address]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [meta.hospitals, hospitalSearch]);

  useEffect(() => {
    loadMeta();
    if (user) loadAppointments();
  }, [user]);

  useEffect(() => {
    if (user) {
      setTeleForm((current) => ({
        ...current,
        full_name: current.full_name || user.name || "",
        email: current.email || user.email || "",
      }));

      setHospitalForm((current) => ({
        ...current,
        full_name: current.full_name || user.name || "",
        email: current.email || user.email || "",
      }));
    }
  }, [user]);

  async function loadMeta() {
    setLoading(true);
    try {
      const response = await api.get("/appointments/meta");
      setMeta(response.data.data || {});
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load appointment options.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadAppointments() {
    if (!user) return;

    setLoading(true);
    try {
      const response = await api.get("/appointments/my");
      setAppointments(response.data.data || []);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load your appointments.",
      });
    } finally {
      setLoading(false);
    }
  }

  function requireSignin() {
    if (!user) {
      setNotice({
        type: "error",
        message: "Please sign in first to book appointments.",
      });
      return false;
    }

    return true;
  }

  function selectDoctor(doctor) {
    setSelectedDoctor(doctor);
    setTeleForm((current) => ({
      ...current,
      payment_method: Number(meta.wallet?.balance || 0) >= Number(doctor.credit_fee || 0) ? "credits" : "bkash",
    }));
    setView("telemedicine");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectHospital(hospital) {
    setSelectedHospital(hospital);
    setHospitalForm((current) => ({
      ...current,
      district: current.district || hospital.district || "",
    }));
    setView("hospital");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateTeleForm(event) {
    const { name, value } = event.target;
    setTeleForm((current) => ({ ...current, [name]: value }));
  }

  function updateHospitalForm(event) {
    const { name, value } = event.target;
    setHospitalForm((current) => ({ ...current, [name]: value }));
  }

  function updateCreditForm(event) {
    const { name, value } = event.target;
    setCreditForm((current) => ({ ...current, [name]: value }));
  }

  async function topUpCredits(event) {
    event.preventDefault();

    if (!requireSignin()) return;

    if (!creditForm.transaction_id.trim()) {
      setNotice({ type: "error", message: "Transaction ID is required to add credits." });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.post("/appointments/credits/top-up", creditForm);
      setNotice({ type: "success", message: response.data.message || "Credits added." });
      setCreditForm((current) => ({ ...current, transaction_id: "" }));
      await loadMeta();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not add credits.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function bookTelemedicine(event) {
    event.preventDefault();

    if (!requireSignin()) return;

    if (!selectedDoctor) {
      setNotice({ type: "error", message: "Please select an online doctor first." });
      return;
    }

    if (teleForm.payment_method !== "credits" && !teleForm.transaction_id.trim()) {
      setNotice({
        type: "error",
        message: "Transaction ID is required for bKash/Nagad/Rocket/Card payment.",
      });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.post("/appointments/book", {
        ...teleForm,
        appointment_type: "telemedicine",
        doctor_id: selectedDoctor.id,
      });

      setNotice({
        type: "success",
        message: response.data.message || "Online doctor appointment requested.",
      });

      setTeleForm((current) => ({
        ...current,
        symptoms: "",
        transaction_id: "",
      }));

      await loadMeta();
      await loadAppointments();
      setView("my");
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not book online doctor appointment.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function bookHospital(event) {
    event.preventDefault();

    if (!requireSignin()) return;

    if (!selectedHospital) {
      setNotice({ type: "error", message: "Please select a hospital first." });
      return;
    }

    if (hospitalForm.payment_method !== "pay_at_hospital" && !hospitalForm.transaction_id.trim()) {
      setNotice({
        type: "error",
        message: "Transaction ID is required for online hospital booking payment.",
      });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.post("/appointments/book", {
        ...hospitalForm,
        appointment_type: "hospital",
        facility_id: selectedHospital.id,
      });

      setNotice({
        type: "success",
        message: response.data.message || "Hospital appointment booked.",
      });

      setHospitalForm((current) => ({
        ...current,
        notes: "",
        transaction_id: "",
      }));

      await loadAppointments();
      setView("my");
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not book hospital appointment.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function cancelAppointment(appointmentId) {
    if (!window.confirm("Cancel this appointment?")) return;

    setLoading(true);

    try {
      const response = await api.patch(`/appointments/${appointmentId}/cancel`);
      setNotice({ type: "success", message: response.data.message || "Appointment cancelled." });
      await loadAppointments();
      await loadMeta();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not cancel appointment.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="appt-page">
      <style>{styles}</style>

      <div className="appt-shell">
        <div className="appt-hero">
          <div>
            <span className="hero-kicker">
              <CalendarCheck size={18} />
              Smart Appointment Center
            </span>

            <h1>Schedule online doctor visits or physical hospital appointments.</h1>

            <p>
              Book telemedicine doctors with credits or mobile/card payments,
              reserve physical hospital appointments, and track all requests in one place.
            </p>
          </div>

          <div className="wallet-card">
            <span>Telemedicine Credits</span>
            <strong>{meta.wallet?.balance || 0}</strong>
            <small>Use credits for online doctor fees</small>
          </div>
        </div>

        {notice && (
          <div className={`appt-notice ${notice.type}`}>
            {notice.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {notice.message}
          </div>
        )}

        <div className="appt-stats">
          <Stat icon={<CalendarDays />} label="Total Appointments" value={meta.stats?.total || appointments.length || 0} />
          <Stat icon={<MonitorPlay />} label="Online Doctor" value={meta.stats?.telemedicine || 0} />
          <Stat icon={<Building2 />} label="Hospital Visits" value={meta.stats?.hospital || 0} />
          <Stat icon={<Clock />} label="Upcoming" value={meta.stats?.upcoming || 0} />
        </div>

        <div className="appt-tabs">
          <button className={view === "telemedicine" ? "active" : ""} onClick={() => setView("telemedicine")}>
            <Video size={16} />
            Online Doctor
          </button>
          <button className={view === "hospital" ? "active" : ""} onClick={() => setView("hospital")}>
            <Building2 size={16} />
            Hospital Appointment
          </button>
          <button className={view === "credits" ? "active" : ""} onClick={() => setView("credits")}>
            <Wallet size={16} />
            Credits & Payment
          </button>
          <button className={view === "my" ? "active" : ""} onClick={() => { setView("my"); loadAppointments(); }}>
            <CalendarCheck size={16} />
            My Appointments
          </button>
        </div>

        {view === "telemedicine" && (
          <div className="book-grid">
            <div className="appt-card">
              <div className="section-head">
                <div>
                  <h2>Choose Online Doctor</h2>
                  <p>Select a telemedicine doctor, then schedule a video/chat consultation.</p>
                </div>
                <button type="button" className="ghost-btn" onClick={loadMeta}>
                  <RefreshCcw size={16} />
                  Refresh
                </button>
              </div>

              <div className="filter-row">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    value={doctorSearch}
                    onChange={(event) => setDoctorSearch(event.target.value)}
                    placeholder="Search doctor, specialty, symptom..."
                  />
                </label>

                <select value={specialtyFilter} onChange={(event) => setSpecialtyFilter(event.target.value)}>
                  <option value="">All specialties</option>
                  {specialties.map((specialty) => (
                    <option key={specialty} value={specialty}>{specialty}</option>
                  ))}
                </select>

                <button className="ghost-btn" onClick={() => { setDoctorSearch(""); setSpecialtyFilter(""); }}>
                  <Filter size={16} />
                  Clear
                </button>
              </div>

              <div className="doctor-list">
                {filteredDoctors.map((doctor) => (
                  <article
                    className={`doctor-card ${selectedDoctor?.id === doctor.id ? "selected" : ""}`}
                    key={doctor.id}
                  >
                    <div className="doctor-avatar">{doctor.avatar || doctor.doctor_name?.slice(0, 2)}</div>
                    <div className="doctor-main">
                      <div className="doctor-top">
                        <div>
                          <h3>{doctor.doctor_name}</h3>
                          <p>{doctor.specialty} · {doctor.degree}</p>
                        </div>
                        <span className={doctor.is_available ? "online" : "offline"}>
                          {doctor.is_available ? "Online" : "Offline"}
                        </span>
                      </div>

                      <p className="doctor-bio">{doctor.bio}</p>

                      <div className="doctor-meta">
                        <span>৳{money(doctor.fee_taka)}</span>
                        <span>{doctor.credit_fee} credits</span>
                        <span>{doctor.wait_minutes} min wait</span>
                        <span>⭐ {doctor.rating}</span>
                      </div>
                    </div>

                    <button type="button" onClick={() => selectDoctor(doctor)}>
                      <Plus size={16} />
                      Select
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <form className="appt-card book-form" onSubmit={bookTelemedicine}>
              <span className="form-kicker">
                <Stethoscope size={16} />
                Online Consultation
              </span>

              <h2>{selectedDoctor ? selectedDoctor.doctor_name : "Select a doctor"}</h2>

              {selectedDoctor && (
                <div className="fee-box">
                  <div>
                    <span>Doctor Fee</span>
                    <strong>৳{money(selectedDoctor.fee_taka)}</strong>
                  </div>
                  <div>
                    <span>Credit Cost</span>
                    <strong>{selectedDoctor.credit_fee}</strong>
                  </div>
                </div>
              )}

              <input name="full_name" value={teleForm.full_name} onChange={updateTeleForm} placeholder="Patient full name *" required />
              <input name="phone" value={teleForm.phone} onChange={updateTeleForm} placeholder="Phone number *" required />
              <input name="email" value={teleForm.email} onChange={updateTeleForm} placeholder="Email" />

              <div className="two">
                <input type="date" name="appointment_date" value={teleForm.appointment_date} onChange={updateTeleForm} min={today()} required />
                <input type="time" name="appointment_time" value={teleForm.appointment_time} onChange={updateTeleForm} required />
              </div>

              <select name="consultation_type" value={teleForm.consultation_type} onChange={updateTeleForm}>
                <option value="video">Video Consultation</option>
                <option value="chat">Chat Consultation</option>
                <option value="follow_up">Follow-up</option>
              </select>

              <textarea name="symptoms" value={teleForm.symptoms} onChange={updateTeleForm} placeholder="Describe symptoms or reason for appointment *" required />

              <select name="payment_method" value={teleForm.payment_method} onChange={updateTeleForm}>
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>

              {teleForm.payment_method !== "credits" && (
                <input name="transaction_id" value={teleForm.transaction_id} onChange={updateTeleForm} placeholder="Payment transaction ID *" />
              )}

              {teleForm.payment_method === "credits" && selectedDoctor && (
                <div className="credit-warning">
                  <Wallet size={16} />
                  Wallet: {meta.wallet?.balance || 0} credits · Required: {selectedDoctor.credit_fee}
                </div>
              )}

              <button className="primary-btn" disabled={loading || !selectedDoctor}>
                <CalendarCheck size={18} />
                {loading ? "Booking..." : "Request Online Appointment"}
              </button>
            </form>
          </div>
        )}

        {view === "hospital" && (
          <div className="book-grid">
            <div className="appt-card">
              <div className="section-head">
                <div>
                  <h2>Choose Hospital</h2>
                  <p>Book a physical hospital appointment by department and time.</p>
                </div>
              </div>

              <label className="search-box single">
                <Search size={18} />
                <input
                  value={hospitalSearch}
                  onChange={(event) => setHospitalSearch(event.target.value)}
                  placeholder="Search hospital, district, area..."
                />
              </label>

              <div className="hospital-list">
                {filteredHospitals.map((hospital) => (
                  <article className={`hospital-card ${selectedHospital?.id === hospital.id ? "selected" : ""}`} key={hospital.id}>
                    <div>
                      <h3>{hospital.name}</h3>
                      <p><MapPin size={14} /> {hospital.area}, {hospital.district}, {hospital.division}</p>
                      <small>{hospital.address}</small>
                      <div className="hospital-tags">
                        {(hospital.services || []).slice(0, 4).map((service) => (
                          <span key={service}>{service}</span>
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={() => selectHospital(hospital)}>
                      Select
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <form className="appt-card book-form" onSubmit={bookHospital}>
              <span className="form-kicker">
                <Building2 size={16} />
                Physical Hospital
              </span>

              <h2>{selectedHospital ? selectedHospital.name : "Select a hospital"}</h2>

              <input name="full_name" value={hospitalForm.full_name} onChange={updateHospitalForm} placeholder="Patient full name *" required />
              <input name="phone" value={hospitalForm.phone} onChange={updateHospitalForm} placeholder="Phone number *" required />
              <input name="email" value={hospitalForm.email} onChange={updateHospitalForm} placeholder="Email" />
              <input name="district" value={hospitalForm.district} onChange={updateHospitalForm} placeholder="District" />

              <select name="department" value={hospitalForm.department} onChange={updateHospitalForm} required>
                {meta.departments?.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>

              <input name="doctor" value={hospitalForm.doctor} onChange={updateHospitalForm} placeholder="Preferred doctor name optional" />

              <div className="two">
                <input type="date" name="appointment_date" value={hospitalForm.appointment_date} onChange={updateHospitalForm} min={today()} required />
                <input type="time" name="appointment_time" value={hospitalForm.appointment_time} onChange={updateHospitalForm} required />
              </div>

              <textarea name="notes" value={hospitalForm.notes} onChange={updateHospitalForm} placeholder="Reason for visit / notes" />

              <select name="payment_method" value={hospitalForm.payment_method} onChange={updateHospitalForm}>
                {hospitalPaymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>

              {hospitalForm.payment_method !== "pay_at_hospital" && (
                <input name="transaction_id" value={hospitalForm.transaction_id} onChange={updateHospitalForm} placeholder="Payment transaction ID *" />
              )}

              <button className="primary-btn" disabled={loading || !selectedHospital}>
                <Building2 size={18} />
                {loading ? "Booking..." : "Book Hospital Appointment"}
              </button>
            </form>
          </div>
        )}

        {view === "credits" && (
          <div className="credits-grid">
            <div className="appt-card credit-panel">
              <span className="form-kicker">
                <Wallet size={16} />
                Credit Wallet
              </span>
              <h2>{meta.wallet?.balance || 0} Credits</h2>
              <p>Use credits for telemedicine doctor appointments. 1 credit = ৳100.</p>

              <div className="credit-packages">
                {creditPackages.map((credits) => (
                  <button
                    type="button"
                    className={Number(creditForm.credits) === credits ? "active" : ""}
                    onClick={() => setCreditForm((current) => ({ ...current, credits }))}
                    key={credits}
                  >
                    <strong>{credits}</strong>
                    <span>৳{credits * 100}</span>
                  </button>
                ))}
              </div>
            </div>

            <form className="appt-card book-form" onSubmit={topUpCredits}>
              <h2>Add Credits</h2>

              <select name="credits" value={creditForm.credits} onChange={updateCreditForm}>
                {creditPackages.map((credits) => (
                  <option key={credits} value={credits}>{credits} Credits - ৳{credits * 100}</option>
                ))}
              </select>

              <select name="payment_method" value={creditForm.payment_method} onChange={updateCreditForm}>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="rocket">Rocket</option>
                <option value="card">Card</option>
              </select>

              <input name="transaction_id" value={creditForm.transaction_id} onChange={updateCreditForm} placeholder="Transaction ID *" />

              <button className="primary-btn" disabled={loading}>
                <CreditCard size={18} />
                {loading ? "Adding..." : "Add Credits"}
              </button>
            </form>
          </div>
        )}

        {view === "my" && (
          <div className="appt-card">
            <div className="section-head">
              <div>
                <h2>My Appointments</h2>
                <p>Track online doctor and physical hospital appointment requests.</p>
              </div>
              <button type="button" className="ghost-btn" onClick={loadAppointments}>
                <RefreshCcw size={16} />
                Refresh
              </button>
            </div>

            {!user ? (
              <div className="empty-card">Please sign in to view your appointments.</div>
            ) : appointments.length === 0 ? (
              <div className="empty-card">No appointments yet.</div>
            ) : (
              <div className="my-list">
                {appointments.map((appointment) => (
                  <article className="my-appointment" key={appointment.appointment_id}>
                    <div className="appointment-icon">
                      {appointment.appointment_type === "telemedicine" ? <Video size={22} /> : <Building2 size={22} />}
                    </div>

                    <div>
                      <div className="appointment-head">
                        <h3>{appointment.provider || appointment.online_doctor_name || appointment.hospital_name}</h3>
                        <span className={`status ${appointment.status}`}>{statusLabel(appointment.status)}</span>
                      </div>

                      <p>
                        {appointment.department} · {formatDate(appointment.appointment_date)} at {formatTime(appointment.appointment_time)}
                      </p>

                      <small>
                        {appointment.appointment_id} · {appointment.payment_method} · {appointment.payment_status}
                      </small>

                      {appointment.telemedicine_consultation_id && (
                        <small>Consultation ID: {appointment.telemedicine_consultation_id}</small>
                      )}
                    </div>

                    {!["completed", "cancelled"].includes(appointment.status) && (
                      <button className="cancel-btn" onClick={() => cancelAppointment(appointment.appointment_id)}>
                        <XCircle size={16} />
                        Cancel
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ icon, label, value }) {
  return (
    <article className="appt-stat">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

const styles = `
.appt-page {
  min-height: 100%;
  padding: 28px 16px 56px;
  background:
    radial-gradient(circle at top left, rgba(37,99,235,.12), transparent 32%),
    radial-gradient(circle at top right, rgba(16,185,129,.11), transparent 28%),
    #f6f8ff;
  color: #0f172a;
}

.appt-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.appt-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 18px;
  align-items: stretch;
  margin-bottom: 18px;
}

.appt-hero > div:first-child,
.wallet-card,
.appt-card,
.appt-stat {
  background: white;
  border: 1px solid #dbeafe;
  border-radius: 28px;
  box-shadow: 0 18px 46px rgba(15, 23, 42, .07);
}

.appt-hero > div:first-child {
  padding: clamp(28px, 5vw, 46px);
  color: white;
  background: linear-gradient(135deg, #2563eb, #059669);
}

.hero-kicker,
.form-kicker {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 8px 13px;
  font-weight: 950;
}

.hero-kicker {
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.22);
}

.form-kicker {
  background: #eff6ff;
  color: #2563eb;
}

.appt-hero h1 {
  max-width: 900px;
  margin: 16px 0 10px;
  font-size: clamp(2rem, 5vw, 3.7rem);
  line-height: 1;
  letter-spacing: -.065em;
}

.appt-hero p {
  max-width: 780px;
  margin: 0;
  color: #dbeafe;
  font-weight: 800;
}

.wallet-card {
  padding: 24px;
  display: grid;
  align-content: center;
  gap: 8px;
}

.wallet-card span,
.wallet-card small {
  color: #64748b;
  font-weight: 900;
}

.wallet-card strong {
  font-size: 4rem;
  color: #2563eb;
  line-height: .9;
}

.appt-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 18px;
  padding: 14px 16px;
  font-weight: 950;
  margin-bottom: 16px;
}

.appt-notice.success {
  background: #dcfce7;
  color: #166534;
}

.appt-notice.error {
  background: #fee2e2;
  color: #991b1b;
}

.appt-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.appt-stat {
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.appt-stat > span {
  width: 52px;
  height: 52px;
  border-radius: 17px;
  background: #eff6ff;
  color: #2563eb;
  display: grid;
  place-items: center;
}

.appt-stat strong {
  display: block;
  font-size: 1.55rem;
}

.appt-stat small {
  color: #64748b;
  font-weight: 900;
}

.appt-tabs {
  background: white;
  border: 1px solid #dbeafe;
  border-radius: 22px;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  box-shadow: 0 14px 34px rgba(15,23,42,.06);
  margin-bottom: 18px;
}

.appt-tabs button,
.ghost-btn,
.doctor-card > button,
.hospital-card button,
.primary-btn,
.cancel-btn {
  min-height: 46px;
  border: none;
  border-radius: 16px;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.appt-tabs button {
  background: #f8fafc;
  color: #334155;
  padding: 0 16px;
}

.appt-tabs button.active {
  background: #2563eb;
  color: white;
}

.book-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  gap: 18px;
  align-items: start;
}

.credits-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  gap: 18px;
  align-items: start;
}

.appt-card {
  padding: 20px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.section-head h2,
.book-form h2,
.credit-panel h2 {
  margin: 0 0 6px;
  font-size: 1.55rem;
  letter-spacing: -.04em;
}

.section-head p,
.credit-panel p {
  margin: 0;
  color: #64748b;
  font-weight: 800;
}

.ghost-btn {
  background: #eff6ff;
  color: #2563eb;
  padding: 0 14px;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px auto;
  gap: 10px;
  margin-bottom: 16px;
}

.search-box {
  min-height: 52px;
  border: 1px solid #dbe3ef;
  border-radius: 17px;
  padding: 0 13px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: #fff;
}

.search-box.single {
  margin-bottom: 16px;
}

.search-box input,
.filter-row select,
.book-form input,
.book-form select,
.book-form textarea {
  width: 100%;
  border: none;
  outline: none;
  font: inherit;
  font-weight: 800;
  background: transparent;
}

.filter-row select,
.book-form input,
.book-form select,
.book-form textarea {
  min-height: 52px;
  border: 1px solid #dbe3ef;
  border-radius: 17px;
  padding: 12px 14px;
  background: #fff;
}

.book-form {
  display: grid;
  gap: 12px;
  position: sticky;
  top: 18px;
}

.book-form textarea {
  min-height: 110px;
  resize: vertical;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.doctor-list,
.hospital-list,
.my-list {
  display: grid;
  gap: 12px;
}

.doctor-card,
.hospital-card,
.my-appointment {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 22px;
  padding: 15px;
}

.doctor-card {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 13px;
  align-items: start;
}

.doctor-card.selected,
.hospital-card.selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.doctor-avatar {
  width: 58px;
  height: 58px;
  border-radius: 19px;
  color: white;
  background: linear-gradient(135deg, #2563eb, #10b981);
  display: grid;
  place-items: center;
  font-weight: 950;
}

.doctor-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.doctor-top h3,
.hospital-card h3,
.my-appointment h3 {
  margin: 0;
}

.doctor-top p,
.hospital-card p,
.my-appointment p {
  margin: 4px 0;
  color: #64748b;
  font-weight: 800;
}

.doctor-bio {
  color: #334155;
  line-height: 1.5;
}

.online,
.offline,
.status {
  border-radius: 999px;
  padding: 7px 10px;
  font-size: .75rem;
  font-weight: 950;
  text-transform: capitalize;
  height: fit-content;
  white-space: nowrap;
}

.online {
  background: #dcfce7;
  color: #166534;
}

.offline {
  background: #fee2e2;
  color: #991b1b;
}

.doctor-meta,
.hospital-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.doctor-meta span,
.hospital-tags span {
  border-radius: 999px;
  padding: 7px 10px;
  background: white;
  color: #475569;
  font-weight: 900;
  font-size: .82rem;
}

.doctor-card > button,
.hospital-card button {
  background: #2563eb;
  color: white;
  padding: 0 14px;
}

.hospital-card {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.hospital-card p {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hospital-card small,
.my-appointment small {
  display: block;
  color: #64748b;
  font-weight: 800;
  margin-top: 4px;
}

.fee-box {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.fee-box > div,
.credit-warning {
  border-radius: 18px;
  padding: 13px;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 900;
}

.fee-box span,
.fee-box strong {
  display: block;
}

.fee-box strong {
  font-size: 1.3rem;
}

.credit-warning {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-btn {
  min-height: 56px;
  background: #2563eb;
  color: white;
  box-shadow: 0 13px 26px rgba(37,99,235,.22);
}

.primary-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.credit-packages {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-top: 18px;
}

.credit-packages button {
  border: 1px solid #dbeafe;
  background: #f8fafc;
  border-radius: 18px;
  min-height: 96px;
  cursor: pointer;
}

.credit-packages button.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.credit-packages strong,
.credit-packages span {
  display: block;
}

.credit-packages strong {
  font-size: 1.8rem;
  color: #2563eb;
}

.my-appointment {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 13px;
  align-items: start;
}

.appointment-icon {
  width: 52px;
  height: 52px;
  border-radius: 17px;
  background: #eff6ff;
  color: #2563eb;
  display: grid;
  place-items: center;
}

.appointment-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}

.status {
  background: #eff6ff;
  color: #2563eb;
}

.status.pending,
.status.requested {
  background: #fef3c7;
  color: #92400e;
}

.status.accepted,
.status.confirmed,
.status.waiting {
  background: #dbeafe;
  color: #1d4ed8;
}

.status.completed {
  background: #dcfce7;
  color: #166534;
}

.status.cancelled,
.status.rejected {
  background: #fee2e2;
  color: #991b1b;
}

.cancel-btn {
  background: #fee2e2;
  color: #b91c1c;
  padding: 0 14px;
}

.empty-card {
  min-height: 180px;
  display: grid;
  place-items: center;
  color: #64748b;
  font-weight: 900;
  text-align: center;
  border: 1px dashed #cbd5e1;
  border-radius: 22px;
}

@media (max-width: 1120px) {
  .book-grid,
  .credits-grid,
  .appt-hero {
    grid-template-columns: 1fr;
  }

  .book-form {
    position: static;
  }
}

@media (max-width: 820px) {
  .appt-stats,
  .filter-row,
  .doctor-card,
  .my-appointment {
    grid-template-columns: 1fr;
  }

  .doctor-avatar,
  .appointment-icon {
    width: 52px;
    height: 52px;
  }

  .credit-packages {
    grid-template-columns: repeat(2, 1fr);
  }

  .section-head,
  .doctor-top,
  .hospital-card,
  .appointment-head {
    flex-direction: column;
  }

  .two,
  .fee-box {
    grid-template-columns: 1fr;
  }

  .cancel-btn {
    width: 100%;
  }
}
`;
