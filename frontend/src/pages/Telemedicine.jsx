import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  CreditCard,
  MessageCircle,
  PhoneCall,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
  Video,
  VideoOff,
  Wallet,
  X,
} from "lucide-react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const initialFilters = {
  search: "",
  specialty: "",
  available_only: false,
};

const initialConsultForm = {
  patient_name: "",
  patient_phone: "",
  patient_email: "",
  symptoms: "",
  consultation_type: "video",
  appointment_date: "",
  appointment_time: "",
  payment_method: "credits",
  transaction_id: "",
};

const paymentLabels = {
  credits: "Telemedicine Credits",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  card: "Card",
};

function money(value) {
  return Number(value || 0).toFixed(2);
}

function formatDate(value) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function initials(name) {
  return String(name || "DR")
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function Telemedicine() {
  const { user } = useAuth();
  const localVideoRef = useRef(null);

  const [meta, setMeta] = useState({
    stats: {},
    specialties: [],
    credit_packages: [5, 10, 20, 50, 100],
    payment_methods: ["credits", "bkash", "nagad", "rocket", "card"],
    credit_rate_taka: 100,
  });
  const [doctors, setDoctors] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [consultations, setConsultations] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [consultForm, setConsultForm] = useState(initialConsultForm);
  const [showConsult, setShowConsult] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [topup, setTopup] = useState({ credits: 10, payment_method: "bkash", transaction_id: "" });
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [activeVideo, setActiveVideo] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  const specialties = useMemo(() => meta.specialties || [], [meta.specialties]);

  useEffect(() => {
    loadMeta();
    loadDoctors();
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadDoctors, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.specialty, filters.available_only]);

  useEffect(() => {
    if (user) {
      setConsultForm((current) => ({
        ...current,
        patient_name: current.patient_name || user.name || "",
        patient_email: current.patient_email || user.email || "",
      }));
      loadWallet();
      loadMyConsultations();
    } else {
      setWallet({ balance: 0, transactions: [] });
      setConsultations([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    return () => stopLocalMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (localVideoRef.current && mediaStream) {
      localVideoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, activeVideo]);

  async function loadMeta() {
    try {
      const response = await api.get("/telemedicine/meta");
      setMeta(response.data.data || {});
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not load telemedicine overview." });
    }
  }

  async function loadDoctors() {
    setLoading(true);
    try {
      const response = await api.get("/telemedicine/doctors", {
        params: {
          search: filters.search,
          specialty: filters.specialty,
          available_only: filters.available_only ? 1 : "",
        },
      });
      setDoctors(response.data.data || []);
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not load doctors." });
    } finally {
      setLoading(false);
    }
  }

  async function loadWallet() {
    if (!user) return;
    try {
      const response = await api.get("/telemedicine/credits");
      setWallet(response.data.data || { balance: 0, transactions: [] });
    } catch {
      setWallet({ balance: 0, transactions: [] });
    }
  }

  async function loadMyConsultations() {
    if (!user) return;
    try {
      const response = await api.get("/telemedicine/my-consultations");
      setConsultations(response.data.data || []);
    } catch {
      setConsultations([]);
    }
  }

  function updateFilter(event) {
    const { name, value, type, checked } = event.target;
    setFilters((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function updateConsultForm(event) {
    const { name, value } = event.target;
    setConsultForm((current) => ({ ...current, [name]: value }));
  }

  function openConsult(doctor, type = "video") {
    if (!user) {
      setNotice({ type: "error", message: "Please sign in before requesting a consultation." });
      return;
    }

    setSelectedDoctor(doctor);
    setConsultForm((current) => ({
      ...current,
      patient_name: current.patient_name || user?.name || "",
      patient_email: current.patient_email || user?.email || "",
      consultation_type: type,
      payment_method: wallet.balance >= Number(doctor.credit_fee || 0) ? "credits" : "bkash",
      transaction_id: "",
    }));
    setShowConsult(true);
  }

  async function submitConsultation(event) {
    event.preventDefault();
    if (!selectedDoctor) return;

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.post("/telemedicine/consultations", {
        ...consultForm,
        doctor_id: selectedDoctor.id,
      });

      setNotice({ type: "success", message: response.data.message || "Consultation request submitted." });
      setShowConsult(false);
      setConsultForm(initialConsultForm);
      await Promise.all([loadWallet(), loadMyConsultations(), loadMeta()]);
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not request consultation." });
    } finally {
      setLoading(false);
    }
  }

  async function submitTopup(event) {
    event.preventDefault();

    if (!user) {
      setNotice({ type: "error", message: "Please sign in before buying credits." });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.post("/telemedicine/credits/top-up", topup);
      setNotice({ type: "success", message: response.data.message || "Credits added." });
      setTopup({ credits: 10, payment_method: "bkash", transaction_id: "" });
      await loadWallet();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not add credits." });
    } finally {
      setLoading(false);
    }
  }

  async function openChat(consultation) {
    setActiveChat(consultation);
    setChatDraft("");
    try {
      const response = await api.get(`/telemedicine/consultations/${consultation.consultation_id}/messages`);
      setChatMessages(response.data.data?.messages || []);
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not load chat." });
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    if (!activeChat || !chatDraft.trim()) return;

    try {
      await api.post(`/telemedicine/consultations/${activeChat.consultation_id}/messages`, {
        message: chatDraft.trim(),
      });
      setChatDraft("");
      await openChat(activeChat);
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not send message." });
    }
  }

  async function startVideo(consultation) {
    setActiveVideo(consultation);
    await startLocalMedia();
  }

  async function startLocalMedia() {
    stopLocalMedia();

    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice({ type: "error", message: "Camera preview is not supported in this browser." });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      setCameraOn(true);
      setMicOn(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch {
      setNotice({ type: "error", message: "Camera or microphone permission was blocked." });
    }
  }

  function stopLocalMedia() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setMediaStream(null);
  }

  function toggleCamera() {
    const next = !cameraOn;
    mediaStream?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCameraOn(next);
  }

  function toggleMic() {
    const next = !micOn;
    mediaStream?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicOn(next);
  }

  function closeVideo() {
    stopLocalMedia();
    setActiveVideo(null);
  }

  const firstAvailableDoctor = doctors.find((doctor) => doctor.is_available);

  return (
    <section className="tm-page-react">
      <style>{styles}</style>
      <div className="tm-shell">
        <div className="tm-hero">
          <div>
            <span className="tm-kicker"><Video size={18} /> Telemedicine Services</span>
            <h1>Connect with doctors through video, chat, queue, and secure payments.</h1>
            <p>Choose a doctor, pay with credits or mobile banking, request consultation, and continue with chat or video queue after doctor approval.</p>
            <div className="tm-hero-actions">
              <button type="button" onClick={() => firstAvailableDoctor && openConsult(firstAvailableDoctor, "video")} disabled={!firstAvailableDoctor}>
                <Sparkles size={17} /> Quick Consult
              </button>
              <button type="button" className="light" onClick={() => setShowWallet(true)}>
                <Wallet size={17} /> Credits: {wallet.balance || 0}
              </button>
              <a className="doctor-link" href="/telemedicine-doctor">Doctor Portal</a>
            </div>
          </div>
          <div className="tm-credit-card">
            <Wallet size={34} />
            <strong>{wallet.balance || 0}</strong>
            <span>Available Credits</span>
            <button type="button" onClick={() => setShowWallet(true)}>Buy Credits</button>
          </div>
        </div>

        {notice && (
          <div className={`tm-notice ${notice.type}`}>
            {notice.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {notice.message}
          </div>
        )}

        <div className="tm-stats-grid">
          <Stat icon={<UserRound />} label="Doctors" value={meta.stats?.total_doctors || 0} />
          <Stat icon={<ShieldCheck />} label="Online" value={meta.stats?.online_doctors || 0} />
          <Stat icon={<Clock />} label="Min Wait" value={`${meta.stats?.min_wait_minutes || 0} min`} />
          <Stat icon={<MessageCircle />} label="My Consults" value={consultations.length} />
        </div>

        <div className="tm-layout">
          <main>
            <div className="tm-filter-card">
              <label className="tm-search">
                <Search size={18} />
                <input name="search" value={filters.search} onChange={updateFilter} placeholder="Search doctor, specialty, symptoms..." />
              </label>
              <select name="specialty" value={filters.specialty} onChange={updateFilter}>
                <option value="">All specialties</option>
                {specialties.map((item) => (
                  <option key={item.specialty} value={item.specialty}>{item.specialty} ({item.count})</option>
                ))}
              </select>
              <label className="tm-check">
                <input type="checkbox" name="available_only" checked={filters.available_only} onChange={updateFilter} />
                Available only
              </label>
              <button type="button" onClick={() => setFilters(initialFilters)}><RefreshCcw size={16} /> Reset</button>
            </div>

            {loading ? (
              <div className="tm-empty">Loading doctors...</div>
            ) : doctors.length === 0 ? (
              <div className="tm-empty">No doctors found.</div>
            ) : (
              <div className="doctor-grid-react">
                {doctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} onConsult={openConsult} />
                ))}
              </div>
            )}
          </main>

          <aside>
            <div className="tm-side-card">
              <h2><Bell size={18} /> My Consultation Queue</h2>
              {!user && <p className="muted">Sign in to view your requests.</p>}
              {user && consultations.length === 0 && <p className="muted">No consultation requested yet.</p>}
              {consultations.slice(0, 8).map((item) => (
                <article className="queue-item" key={item.consultation_id}>
                  <div>
                    <strong>{item.doctor_name}</strong>
                    <span>{item.specialty} · {item.status}</span>
                    <small>{formatDate(item.created_at)} · Queue #{item.queue_position || 1}</small>
                  </div>
                  <div className="queue-actions">
                    <button type="button" onClick={() => openChat(item)}><MessageCircle size={14} /> Chat</button>
                    <button type="button" onClick={() => startVideo(item)} disabled={!['accepted', 'waiting', 'in_call'].includes(item.status)}><Video size={14} /> Video</button>
                  </div>
                </article>
              ))}
            </div>

            <div className="tm-side-card steps-card">
              <h2>How it works</h2>
              <p><b>1.</b> Choose doctor and consultation type.</p>
              <p><b>2.</b> Pay with credits, bKash, Nagad, Rocket, or Card.</p>
              <p><b>3.</b> Doctor accepts and places you in queue.</p>
              <p><b>4.</b> Continue video call and chat in the same request.</p>
            </div>
          </aside>
        </div>
      </div>

      {showConsult && selectedDoctor && (
        <Modal title="Request Consultation" icon={<Stethoscope size={18} />} onClose={() => setShowConsult(false)}>
          <form className="consult-form" onSubmit={submitConsultation}>
            <div className="selected-doctor-box">
              <div className="doctor-avatar-big">{selectedDoctor.avatar || initials(selectedDoctor.doctor_name)}</div>
              <div>
                <h3>{selectedDoctor.doctor_name}</h3>
                <p>{selectedDoctor.specialty} · ৳{money(selectedDoctor.fee_taka)} · {selectedDoctor.credit_fee} credits</p>
              </div>
            </div>

            <div className="two">
              <input name="patient_name" value={consultForm.patient_name} onChange={updateConsultForm} placeholder="Patient name *" required />
              <input name="patient_phone" value={consultForm.patient_phone} onChange={updateConsultForm} placeholder="Phone number *" required />
            </div>
            <input name="patient_email" value={consultForm.patient_email} onChange={updateConsultForm} placeholder="Email" />
            <textarea name="symptoms" value={consultForm.symptoms} onChange={updateConsultForm} placeholder="Describe symptoms, age, current medicines, allergies... *" required />

            <div className="two">
              <select name="consultation_type" value={consultForm.consultation_type} onChange={updateConsultForm}>
                <option value="video">Video Consultation</option>
                <option value="chat">Chat Consultation</option>
                <option value="follow_up">Follow-up</option>
              </select>
              <select name="payment_method" value={consultForm.payment_method} onChange={updateConsultForm}>
                {meta.payment_methods?.map((method) => (
                  <option key={method} value={method}>{paymentLabels[method] || method}</option>
                ))}
              </select>
            </div>

            <div className="two">
              <input type="date" name="appointment_date" value={consultForm.appointment_date} onChange={updateConsultForm} />
              <input type="time" name="appointment_time" value={consultForm.appointment_time} onChange={updateConsultForm} />
            </div>

            {consultForm.payment_method !== "credits" && (
              <input name="transaction_id" value={consultForm.transaction_id} onChange={updateConsultForm} placeholder={`${paymentLabels[consultForm.payment_method]} transaction ID *`} required />
            )}

            <div className="payment-summary">
              <span>Fee: <b>৳{money(selectedDoctor.fee_taka)}</b></span>
              <span>Credits needed: <b>{selectedDoctor.credit_fee}</b></span>
              <span>Your credits: <b>{wallet.balance || 0}</b></span>
            </div>

            <button className="primary-btn" disabled={loading}>
              <CreditCard size={17} /> {loading ? "Submitting..." : "Request Consultation"}
            </button>
          </form>
        </Modal>
      )}

      {showWallet && (
        <Modal title="Telemedicine Credits" icon={<Wallet size={18} />} onClose={() => setShowWallet(false)}>
          <form className="consult-form" onSubmit={submitTopup}>
            <div className="wallet-balance">
              <Wallet size={32} />
              <strong>{wallet.balance || 0}</strong>
              <span>Credits available</span>
            </div>
            <div className="credit-packages">
              {meta.credit_packages?.map((value) => (
                <button type="button" key={value} className={Number(topup.credits) === Number(value) ? "active" : ""} onClick={() => setTopup((current) => ({ ...current, credits: value }))}>
                  {value} Credits <small>৳{value * Number(meta.credit_rate_taka || 100)}</small>
                </button>
              ))}
            </div>
            <select value={topup.payment_method} onChange={(event) => setTopup((current) => ({ ...current, payment_method: event.target.value }))}>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="rocket">Rocket</option>
              <option value="card">Card</option>
            </select>
            <input value={topup.transaction_id} onChange={(event) => setTopup((current) => ({ ...current, transaction_id: event.target.value }))} placeholder="Payment transaction ID *" required />
            <button className="primary-btn" disabled={loading}>Buy Credits</button>
          </form>
        </Modal>
      )}

      {activeChat && (
        <Modal title={`Chat · ${activeChat.doctor_name}`} icon={<MessageCircle size={18} />} onClose={() => setActiveChat(null)}>
          <div className="chat-window-react">
            {chatMessages.map((message) => (
              <div className={`chat-bubble ${message.sender_type}`} key={message.id}>
                <span>{message.sender_type === "doctor" ? "Doctor" : message.sender_type === "user" ? "You" : "System"}</span>
                <p>{message.message}</p>
                <small>{formatDate(message.created_at)}</small>
              </div>
            ))}
          </div>
          <form className="chat-send" onSubmit={sendChat}>
            <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Type your message..." />
            <button><Send size={16} /></button>
          </form>
        </Modal>
      )}

      {activeVideo && (
        <Modal title={`Video Room · ${activeVideo.doctor_name}`} icon={<Video size={18} />} onClose={closeVideo} wide>
          <div className="video-room">
            <div className="doctor-stage">
              <div className="doctor-avatar-huge">{activeVideo.avatar || initials(activeVideo.doctor_name)}</div>
              <h3>{activeVideo.doctor_name}</h3>
              <p>{activeVideo.status === "in_call" ? "Doctor is in the room." : "Waiting for doctor to start the call."}</p>
              <small>Room Code: {activeVideo.room_code}</small>
              <video ref={localVideoRef} autoPlay playsInline muted />
            </div>
            <aside>
              <div className="video-note"><b>Consultation tips</b><span>Keep your symptoms, medicine list, allergies, and reports ready.</span></div>
              <button type="button" onClick={() => openChat(activeVideo)}><MessageCircle size={16} /> Open Chat</button>
            </aside>
          </div>
          <div className="video-controls-react">
            <button type="button" onClick={toggleMic}>{micOn ? <PhoneCall size={16} /> : <X size={16} />} {micOn ? "Mute" : "Unmute"}</button>
            <button type="button" onClick={toggleCamera}>{cameraOn ? <VideoOff size={16} /> : <Video size={16} />} {cameraOn ? "Camera Off" : "Camera On"}</button>
            <button type="button" className="danger" onClick={closeVideo}>End Call</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function DoctorCard({ doctor, onConsult }) {
  return (
    <article className="doctor-card-react">
      <div className="doctor-head">
        <div className="doctor-avatar-big">{doctor.avatar || initials(doctor.doctor_name)}</div>
        <div>
          <h3>{doctor.doctor_name}</h3>
          <p>{doctor.specialty}</p>
          <span className={`availability ${doctor.is_available ? "online" : "busy"}`}>
            {doctor.is_available ? "Available Now" : doctor.status_text || "Busy"}
          </span>
        </div>
      </div>
      <p className="doctor-bio">{doctor.bio}</p>
      <div className="doctor-meta-grid">
        <span><b>{doctor.wait_minutes} min</b><small>Wait</small></span>
        <span><b>{doctor.experience_years} yrs</b><small>Experience</small></span>
        <span><b>৳{money(doctor.fee_taka)}</b><small>Fee</small></span>
        <span><b>{doctor.credit_fee}</b><small>Credits</small></span>
      </div>
      <div className="rating-row"><Star size={16} fill="currentColor" /> <b>{doctor.rating}</b> <span>({doctor.reviews} reviews)</span></div>
      <div className="doctor-actions-react">
        <button type="button" onClick={() => onConsult(doctor, "video")}><Video size={16} /> Video</button>
        <button type="button" className="outline" onClick={() => onConsult(doctor, "chat")}><MessageCircle size={16} /> Chat</button>
      </div>
    </article>
  );
}

function Stat({ icon, label, value }) {
  return (
    <article className="tm-stat-react">
      <span>{icon}</span>
      <div><strong>{value}</strong><small>{label}</small></div>
    </article>
  );
}

function Modal({ title, icon, onClose, children, wide }) {
  return (
    <div className="tm-modal-backdrop">
      <div className={`tm-modal-react ${wide ? "wide" : ""}`}>
        <div className="tm-modal-head">
          <h2>{icon}{title}</h2>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const styles = `
.tm-page-react {
  min-height: 100%;
  padding: 28px 16px 52px;
  background: #f6f8ff;
  color: #0f172a;
}

.tm-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.tm-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 18px;
  margin-bottom: 18px;
}

.tm-hero > div:first-child,
.tm-credit-card,
.tm-filter-card,
.tm-side-card,
.doctor-card-react,
.tm-stat-react {
  background: white;
  border: 1px solid #dbeafe;
  border-radius: 28px;
  box-shadow: 0 18px 44px rgba(15, 23, 42, .07);
}

.tm-hero > div:first-child {
  padding: clamp(28px, 5vw, 48px);
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  color: white;
}

.tm-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(255,255,255,.15);
  border: 1px solid rgba(255,255,255,.22);
  font-weight: 950;
  margin-bottom: 16px;
}

.tm-hero h1 {
  max-width: 850px;
  margin: 0;
  font-size: clamp(2.1rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -.065em;
}

.tm-hero p {
  max-width: 760px;
  color: #e0e7ff;
  font-weight: 700;
  margin: 18px 0 0;
}

.tm-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.tm-hero-actions button,
.doctor-link,
.primary-btn,
.scan-btn {
  border: none;
  min-height: 46px;
  border-radius: 15px;
  padding: 0 18px;
  background: #fff;
  color: #2563eb;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
}

.tm-hero-actions .light {
  background: rgba(255,255,255,.14);
  border: 1px solid rgba(255,255,255,.22);
  color: white;
}

.doctor-link {
  background: #111827;
  color: white;
}

.tm-credit-card {
  padding: 24px;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 9px;
}

.tm-credit-card svg { color: #2563eb; }
.tm-credit-card strong { font-size: 3rem; line-height: 1; }
.tm-credit-card span { color: #64748b; font-weight: 900; }
.tm-credit-card button {
  width: 100%;
  min-height: 44px;
  border: none;
  border-radius: 14px;
  background: #2563eb;
  color: white;
  font-weight: 950;
  cursor: pointer;
}

.tm-notice {
  margin-bottom: 16px;
  border-radius: 16px;
  padding: 13px 16px;
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 950;
}
.tm-notice.success { background: #dcfce7; color: #166534; }
.tm-notice.error { background: #fee2e2; color: #991b1b; }

.tm-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.tm-stat-react {
  padding: 18px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.tm-stat-react > span {
  width: 50px;
  height: 50px;
  border-radius: 16px;
  background: #eff6ff;
  color: #2563eb;
  display: grid;
  place-items: center;
}
.tm-stat-react strong { display: block; font-size: 1.6rem; }
.tm-stat-react small { color: #64748b; font-weight: 900; }

.tm-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  align-items: start;
}

.tm-filter-card {
  padding: 14px;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 220px auto auto;
  gap: 12px;
  margin-bottom: 18px;
}

.tm-search { position: relative; }
.tm-search svg {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
}
.tm-search input { padding-left: 44px !important; }
.tm-filter-card input,
.tm-filter-card select,
.tm-filter-card button,
.consult-form input,
.consult-form select,
.consult-form textarea,
.chat-send input {
  width: 100%;
  min-height: 50px;
  border-radius: 16px;
  border: 1px solid #dbe3ef;
  padding: 12px 14px;
  font: inherit;
  font-weight: 800;
  outline: none;
}
.tm-filter-card button {
  background: #eff6ff;
  color: #2563eb;
  cursor: pointer;
}
.tm-check {
  min-height: 50px;
  border-radius: 16px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  color: #2563eb;
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  white-space: nowrap;
}

.doctor-grid-react {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.doctor-card-react { padding: 18px; }
.doctor-head { display: flex; gap: 13px; align-items: flex-start; }
.doctor-avatar-big,
.doctor-avatar-huge {
  border-radius: 22px;
  display: grid;
  place-items: center;
  color: white;
  font-weight: 950;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  box-shadow: 0 16px 30px rgba(37, 99, 235, .18);
}
.doctor-avatar-big { width: 62px; height: 62px; flex: 0 0 62px; }
.doctor-head h3 { margin: 0 0 4px; }
.doctor-head p { margin: 0 0 8px; color: #64748b; font-weight: 800; }
.availability {
  border-radius: 999px;
  padding: 6px 10px;
  font-size: .76rem;
  font-weight: 950;
}
.availability.online { background: #dcfce7; color: #166534; }
.availability.busy { background: #ffedd5; color: #c2410c; }
.doctor-bio { color: #64748b; font-weight: 700; line-height: 1.55; }
.doctor-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 14px 0;
}
.doctor-meta-grid span {
  border-radius: 15px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 10px;
}
.doctor-meta-grid b,
.doctor-meta-grid small { display: block; }
.doctor-meta-grid small { color: #64748b; font-weight: 800; font-size: .72rem; }
.rating-row { display: flex; align-items: center; gap: 6px; color: #f59e0b; font-weight: 900; margin-bottom: 14px; }
.rating-row span { color: #64748b; }
.doctor-actions-react { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.doctor-actions-react button,
.queue-actions button,
.video-room aside button,
.video-controls-react button,
.chat-send button {
  min-height: 46px;
  border: none;
  border-radius: 15px;
  background: #2563eb;
  color: white;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.doctor-actions-react .outline,
.queue-actions button:first-child,
.video-room aside button {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #dbeafe;
}

.tm-side-card { padding: 18px; margin-bottom: 16px; }
.tm-side-card h2 { display: flex; gap: 8px; align-items: center; margin: 0 0 14px; font-size: 1.1rem; }
.muted { color: #64748b; font-weight: 800; }
.queue-item {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 13px;
  margin-bottom: 10px;
  background: #f8fafc;
}
.queue-item strong,
.queue-item span,
.queue-item small { display: block; }
.queue-item span { color: #475569; font-weight: 800; }
.queue-item small { color: #94a3b8; font-weight: 800; }
.queue-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.queue-actions button:disabled { opacity: .55; cursor: not-allowed; }
.steps-card p { color: #64748b; font-weight: 800; }

.tm-empty {
  background: white;
  border: 1px solid #dbeafe;
  border-radius: 24px;
  padding: 28px;
  text-align: center;
  color: #64748b;
  font-weight: 900;
}

.tm-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: rgba(15, 23, 42, .58);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}
.tm-modal-react {
  width: min(720px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  background: white;
  border-radius: 26px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 30px 80px rgba(15,23,42,.25);
}
.tm-modal-react.wide { width: min(980px, 100%); }
.tm-modal-head {
  padding: 18px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tm-modal-head h2 { margin: 0; display: flex; align-items: center; gap: 9px; }
.tm-modal-head button {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 13px;
  background: #f1f5f9;
  cursor: pointer;
}
.consult-form { padding: 20px; display: grid; gap: 12px; }
.consult-form textarea { min-height: 110px; resize: vertical; }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.selected-doctor-box,
.payment-summary,
.wallet-balance {
  border: 1px solid #dbeafe;
  background: #eff6ff;
  border-radius: 20px;
  padding: 14px;
}
.selected-doctor-box { display: flex; gap: 12px; align-items: center; }
.selected-doctor-box h3 { margin: 0; }
.selected-doctor-box p { margin: 4px 0 0; color: #475569; font-weight: 800; }
.payment-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.payment-summary span { color: #475569; font-weight: 800; }
.primary-btn {
  width: 100%;
  background: #2563eb;
  color: white;
}
.wallet-balance { display: grid; place-items: center; text-align: center; gap: 6px; }
.wallet-balance strong { font-size: 2.6rem; }
.credit-packages { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.credit-packages button {
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 16px;
  padding: 13px;
  font-weight: 950;
  cursor: pointer;
}
.credit-packages button.active { background: #2563eb; color: white; }
.credit-packages small { display: block; margin-top: 4px; }

.chat-window-react { padding: 18px; display: grid; gap: 10px; max-height: 460px; overflow-y: auto; background: #f8fafc; }
.chat-bubble { max-width: 78%; border-radius: 18px; padding: 12px 14px; }
.chat-bubble.user { margin-left: auto; background: #2563eb; color: white; }
.chat-bubble.doctor { background: #ecfdf5; color: #065f46; }
.chat-bubble.system { margin-inline: auto; background: #f1f5f9; color: #475569; text-align: center; }
.chat-bubble span { display: block; text-transform: uppercase; font-size: .7rem; font-weight: 950; margin-bottom: 4px; }
.chat-bubble p { margin: 0; }
.chat-bubble small { display: block; margin-top: 6px; opacity: .75; }
.chat-send { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 16px; border-top: 1px solid #e2e8f0; }
.chat-send button { width: 52px; }

.video-room { padding: 18px; display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; }
.doctor-stage {
  min-height: 410px;
  border-radius: 24px;
  background: radial-gradient(circle at center, #4338ca 0%, #111827 72%);
  color: white;
  display: grid;
  place-items: center;
  text-align: center;
  position: relative;
  overflow: hidden;
  padding: 24px;
}
.doctor-avatar-huge { width: 96px; height: 96px; font-size: 1.6rem; }
.doctor-stage video {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 170px;
  height: 120px;
  border-radius: 18px;
  object-fit: cover;
  background: #0f172a;
  border: 2px solid rgba(255,255,255,.75);
  transform: scaleX(-1);
}
.video-room aside { display: grid; gap: 12px; align-content: start; }
.video-note { border-radius: 18px; padding: 15px; border: 1px solid #dbeafe; background: #eff6ff; color: #475569; }
.video-note b,
.video-note span { display: block; }
.video-controls-react { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 18px 18px; }
.video-controls-react button { background: #f1f5f9; color: #0f172a; }
.video-controls-react .danger { background: #ef4444; color: white; }

@media (max-width: 1100px) {
  .tm-hero,
  .tm-layout,
  .video-room { grid-template-columns: 1fr; }
  .doctor-grid-react { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .tm-stats-grid,
  .tm-filter-card,
  .two,
  .payment-summary,
  .credit-packages,
  .video-controls-react { grid-template-columns: 1fr; }
  .tm-hero-actions { flex-direction: column; }
  .tm-hero-actions button,
  .doctor-link { width: 100%; }
  .doctor-meta-grid { grid-template-columns: repeat(2, 1fr); }
}
`;
