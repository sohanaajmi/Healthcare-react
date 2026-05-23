import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  LogOut,
  MessageCircle,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Video,
  VideoOff,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import api from "../services/api.js";

const initialLogin = { username: "", password: "" };
const initialSchedule = {
  schedule_date: new Date().toISOString().slice(0, 10),
  start_time: "10:00",
  end_time: "14:00",
  slot_status: "open",
  notes: "Online consultation slot",
};

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

function money(value) {
  return Number(value || 0).toFixed(2);
}

function doctorConfig(token) {
  return {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("telemedicine_doctor_token") || token}`,
    },
  };
}

export default function DoctorTelemedicineDashboard() {
  const localVideoRef = useRef(null);
  const [token, setToken] = useState(() => localStorage.getItem("telemedicine_doctor_token") || "");
  const [login, setLogin] = useState(initialLogin);
  const [doctor, setDoctor] = useState(null);
  const [profile, setProfile] = useState({});
  const [dashboard, setDashboard] = useState({ stats: {}, consultations: [], schedule: [] });
  const [scheduleForm, setScheduleForm] = useState(initialSchedule);
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [activeVideo, setActiveVideo] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    return () => stopLocalMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (localVideoRef.current && mediaStream) {
      localVideoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, activeVideo]);

  async function submitLogin(event) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post("/telemedicine/doctor/login", login);
      localStorage.setItem("telemedicine_doctor_token", response.data.token);
      setToken(response.data.token);
      setNotice({ type: "success", message: response.data.message || "Doctor login successful." });
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Invalid doctor login." });
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("telemedicine_doctor_token");
    setToken("");
    setDoctor(null);
    setDashboard({ stats: {}, consultations: [], schedule: [] });
  }

  async function loadDashboard() {
    setLoading(true);
    try {
      const [meResponse, dashboardResponse] = await Promise.all([
        api.get("/telemedicine/doctor/me", doctorConfig(token)),
        api.get("/telemedicine/doctor/dashboard", doctorConfig(token)),
      ]);
      setDoctor(meResponse.data.data);
      setProfile(meResponse.data.data || {});
      setDashboard(dashboardResponse.data.data || { stats: {}, consultations: [], schedule: [] });
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not load doctor dashboard." });
    } finally {
      setLoading(false);
    }
  }

  function updateProfile(event) {
    const { name, value, type, checked } = event.target;
    setProfile((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await api.patch("/telemedicine/doctor/profile", profile, doctorConfig(token));
      setNotice({ type: "success", message: "Profile updated." });
      await loadDashboard();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not update profile." });
    } finally {
      setLoading(false);
    }
  }

  function updateSchedule(event) {
    const { name, value } = event.target;
    setScheduleForm((current) => ({ ...current, [name]: value }));
  }

  async function saveSchedule(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post("/telemedicine/doctor/schedule", scheduleForm, doctorConfig(token));
      setNotice({ type: "success", message: "Schedule slot added." });
      setScheduleForm(initialSchedule);
      await loadDashboard();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not add schedule." });
    } finally {
      setLoading(false);
    }
  }

  async function updateConsultationStatus(item, status) {
    setLoading(true);
    try {
      await api.patch(
        `/telemedicine/doctor/consultations/${item.consultation_id}/status`,
        { status },
        doctorConfig(token)
      );
      setNotice({ type: "success", message: `Consultation ${status}.` });
      await loadDashboard();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not update consultation." });
    } finally {
      setLoading(false);
    }
  }

  async function openChat(item) {
    setActiveChat(item);
    setChatDraft("");
    try {
      const response = await api.get(
        `/telemedicine/doctor/consultations/${item.consultation_id}/messages`,
        doctorConfig(token)
      );
      setChatMessages(response.data.data?.messages || []);
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not load chat." });
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    if (!activeChat || !chatDraft.trim()) return;

    try {
      await api.post(
        `/telemedicine/doctor/consultations/${activeChat.consultation_id}/messages`,
        { message: chatDraft.trim() },
        doctorConfig(token)
      );
      setChatDraft("");
      await openChat(activeChat);
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || "Could not send message." });
    }
  }

  async function startVideo(item) {
    setActiveVideo(item);
    await updateConsultationStatus(item, "in_call");
    await startLocalMedia();
  }

  async function startLocalMedia() {
    stopLocalMedia();
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice({ type: "error", message: "Camera preview is not supported." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      setCameraOn(true);
      setMicOn(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch {
      setNotice({ type: "error", message: "Camera or microphone permission blocked." });
    }
  }

  function stopLocalMedia() {
    if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setMediaStream(null);
  }

  function closeVideo() {
    stopLocalMedia();
    setActiveVideo(null);
  }

  function toggleCamera() {
    const next = !cameraOn;
    mediaStream?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCameraOn(next);
  }

  function toggleMic() {
    const next = !micOn;
    mediaStream?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicOn(next);
  }

  if (!token) {
    return (
      <section className="td-page login">
        <style>{styles}</style>
        <div className="td-login-card">
          <div className="td-login-icon"><Stethoscope size={34} /></div>
          <h1>Telemedicine Doctor Portal</h1>
          <p>Login to manage your schedule, accept consultation requests, chat, and start video queue.</p>
          {notice && <div className={`td-notice ${notice.type}`}>{notice.message}</div>}
          <form onSubmit={submitLogin}>
            <input name="username" value={login.username} onChange={(e) => setLogin((c) => ({ ...c, username: e.target.value }))} placeholder="doctor1" required />
            <input type="password" name="password" value={login.password} onChange={(e) => setLogin((c) => ({ ...c, password: e.target.value }))} placeholder="Doctor@123" required />
            <button disabled={loading}>{loading ? "Signing in..." : "Open Doctor Dashboard"}</button>
          </form>
          <small>Demo doctors: doctor1 to doctor8 · password: Doctor@123</small>
        </div>
      </section>
    );
  }

  return (
    <section className="td-page">
      <style>{styles}</style>
      <div className="td-shell">
        <div className="td-hero">
          <div>
            <span><ShieldCheck size={18} /> Doctor Dashboard</span>
            <h1>{doctor?.doctor_name || "Doctor"}</h1>
            <p>{doctor?.specialty} · Manage consultation requests, schedule slots, queue, video calls, and patient chat.</p>
          </div>
          <div className="hero-actions">
            <button onClick={loadDashboard}><RefreshCcw size={16} /> Refresh</button>
            <button className="logout" onClick={logout}><LogOut size={16} /> Logout</button>
          </div>
        </div>

        {notice && <div className={`td-notice ${notice.type}`}>{notice.message}</div>}

        <div className="td-stats">
          <Stat icon={<Bell />} label="Pending" value={dashboard.stats?.pending_requests || 0} />
          <Stat icon={<Clock />} label="Active Queue" value={dashboard.stats?.active_queue || 0} />
          <Stat icon={<CheckCircle />} label="Completed" value={dashboard.stats?.completed_total || 0} />
          <Stat icon={<Wallet />} label="Fee" value={`৳${money(profile.fee_taka)}`} />
        </div>

        <div className="td-grid">
          <div className="td-card">
            <h2>Consultation Queue</h2>
            {dashboard.consultations.length === 0 ? <p className="muted">No consultation requests yet.</p> : (
              <div className="consult-list">
                {dashboard.consultations.map((item) => (
                  <article className="consult-item" key={item.consultation_id}>
                    <div className="consult-head">
                      <div>
                        <h3>{item.patient_name}</h3>
                        <p>{item.patient_phone} · {item.consultation_type} · {item.payment_method}</p>
                        <small>{formatDate(item.created_at)} · Queue #{item.queue_position || 1}</small>
                      </div>
                      <span className={`status ${item.status}`}>{item.status}</span>
                    </div>
                    <p className="symptoms">{item.symptoms}</p>
                    <div className="consult-actions">
                      <button onClick={() => updateConsultationStatus(item, "accepted")}><UserCheck size={15} /> Accept</button>
                      <button onClick={() => updateConsultationStatus(item, "waiting")}><Clock size={15} /> Queue</button>
                      <button onClick={() => openChat(item)}><MessageCircle size={15} /> Chat</button>
                      <button onClick={() => startVideo(item)}><Video size={15} /> Video</button>
                      <button onClick={() => updateConsultationStatus(item, "completed")}><CheckCircle size={15} /> Done</button>
                      <button className="danger" onClick={() => updateConsultationStatus(item, "rejected")}><XCircle size={15} /> Reject</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside>
            <form className="td-card form-card" onSubmit={saveProfile}>
              <h2>Availability & Fee</h2>
              <label className="toggle-row">
                <input type="checkbox" name="is_available" checked={Boolean(profile.is_available)} onChange={updateProfile} /> Available Now
              </label>
              <input name="status_text" value={profile.status_text || ""} onChange={updateProfile} placeholder="Status text" />
              <div className="two">
                <input name="wait_minutes" value={profile.wait_minutes || ""} onChange={updateProfile} placeholder="Wait min" />
                <input name="credit_fee" value={profile.credit_fee || ""} onChange={updateProfile} placeholder="Credits" />
              </div>
              <input name="fee_taka" value={profile.fee_taka || ""} onChange={updateProfile} placeholder="Fee ৳" />
              <input name="video_room_url" value={profile.video_room_url || ""} onChange={updateProfile} placeholder="Optional video room URL" />
              <textarea name="bio" value={profile.bio || ""} onChange={updateProfile} placeholder="Doctor bio" />
              <button className="primary"><Save size={16} /> Save Profile</button>
            </form>

            <form className="td-card form-card" onSubmit={saveSchedule}>
              <h2>Add Schedule Slot</h2>
              <input type="date" name="schedule_date" value={scheduleForm.schedule_date} onChange={updateSchedule} required />
              <div className="two">
                <input type="time" name="start_time" value={scheduleForm.start_time} onChange={updateSchedule} required />
                <input type="time" name="end_time" value={scheduleForm.end_time} onChange={updateSchedule} required />
              </div>
              <select name="slot_status" value={scheduleForm.slot_status} onChange={updateSchedule}>
                <option value="open">Open</option>
                <option value="booked">Booked</option>
                <option value="closed">Closed</option>
              </select>
              <textarea name="notes" value={scheduleForm.notes} onChange={updateSchedule} placeholder="Slot notes" />
              <button className="primary"><CalendarDays size={16} /> Add Slot</button>
            </form>

            <div className="td-card schedule-card">
              <h2>Upcoming Schedule</h2>
              {dashboard.schedule.length === 0 ? <p className="muted">No schedule slots.</p> : dashboard.schedule.map((slot) => (
                <article key={slot.id}>
                  <strong>{formatDate(slot.schedule_date).split(',')[0]}</strong>
                  <span>{slot.start_time} - {slot.end_time} · {slot.slot_status}</span>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {activeChat && (
        <Modal title={`Chat · ${activeChat.patient_name}`} icon={<MessageCircle size={18} />} onClose={() => setActiveChat(null)}>
          <div className="chat-window">
            {chatMessages.map((message) => (
              <div className={`chat-bubble ${message.sender_type}`} key={message.id}>
                <span>{message.sender_type}</span>
                <p>{message.message}</p>
                <small>{formatDate(message.created_at)}</small>
              </div>
            ))}
          </div>
          <form className="chat-send" onSubmit={sendChat}>
            <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder="Reply to patient..." />
            <button><Send size={16} /></button>
          </form>
        </Modal>
      )}

      {activeVideo && (
        <Modal title={`Video Queue · ${activeVideo.patient_name}`} icon={<Video size={18} />} onClose={closeVideo} wide>
          <div className="video-room">
            <div className="video-stage">
              <h3>{activeVideo.patient_name}</h3>
              <p>Room Code: {activeVideo.room_code}</p>
              <video ref={localVideoRef} autoPlay playsInline muted />
            </div>
            <aside>
              <div><b>Symptoms</b><span>{activeVideo.symptoms}</span></div>
              <button onClick={() => openChat(activeVideo)}><MessageCircle size={16} /> Open Chat</button>
            </aside>
          </div>
          <div className="video-controls">
            <button onClick={toggleMic}>{micOn ? "Mute" : "Unmute"}</button>
            <button onClick={toggleCamera}>{cameraOn ? <VideoOff size={16} /> : <Video size={16} />} {cameraOn ? "Camera Off" : "Camera On"}</button>
            <button className="danger" onClick={closeVideo}>End Call</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Stat({ icon, label, value }) {
  return <article className="td-stat"><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>;
}

function Modal({ title, icon, onClose, children, wide }) {
  return (
    <div className="td-modal-backdrop">
      <div className={`td-modal ${wide ? "wide" : ""}`}>
        <div className="td-modal-head"><h2>{icon}{title}</h2><button onClick={onClose}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

const styles = `
.td-page { min-height: 100vh; padding: 28px 16px 52px; background: #f6f8ff; color: #0f172a; }
.td-page.login { display: grid; place-items: center; }
.td-shell { max-width: 1240px; margin: 0 auto; }
.td-login-card, .td-card, .td-stat, .td-hero { background: white; border: 1px solid #dbeafe; border-radius: 28px; box-shadow: 0 18px 44px rgba(15,23,42,.07); }
.td-login-card { width: min(480px, 100%); padding: 28px; display: grid; gap: 14px; }
.td-login-icon { width: 66px; height: 66px; border-radius: 22px; display: grid; place-items: center; color: white; background: linear-gradient(135deg,#2563eb,#7c3aed); }
.td-login-card h1 { margin: 0; font-size: 2rem; letter-spacing: -.04em; }
.td-login-card p, .muted { color: #64748b; font-weight: 800; }
.td-login-card form, .form-card { display: grid; gap: 12px; }
.td-login-card input, .form-card input, .form-card select, .form-card textarea, .chat-send input { width: 100%; min-height: 50px; border: 1px solid #dbe3ef; border-radius: 16px; padding: 12px 14px; font: inherit; font-weight: 800; outline: none; }
.form-card textarea { min-height: 90px; resize: vertical; }
.td-login-card button, .primary, .consult-actions button, .hero-actions button, .chat-send button, .video-controls button, .video-room aside button { min-height: 46px; border: none; border-radius: 15px; background: #2563eb; color: white; font-weight: 950; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.td-hero { padding: 28px; margin-bottom: 18px; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; background: linear-gradient(135deg,#2563eb,#7c3aed); color: white; }
.td-hero span { display: inline-flex; gap: 8px; align-items: center; border-radius: 999px; padding: 8px 12px; background: rgba(255,255,255,.15); font-weight: 950; }
.td-hero h1 { margin: 16px 0 8px; font-size: clamp(2rem,4vw,3.5rem); letter-spacing: -.06em; }
.td-hero p { color: #e0e7ff; font-weight: 800; margin: 0; }
.hero-actions { display: flex; gap: 10px; }
.hero-actions .logout { background: #111827; }
.td-notice { border-radius: 16px; padding: 13px 16px; font-weight: 950; margin-bottom: 16px; }
.td-notice.success { background: #dcfce7; color: #166534; }
.td-notice.error { background: #fee2e2; color: #991b1b; }
.td-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 18px; }
.td-stat { padding: 18px; display: flex; align-items: center; gap: 12px; }
.td-stat > span { width: 50px; height: 50px; border-radius: 16px; background: #eff6ff; color: #2563eb; display: grid; place-items: center; }
.td-stat strong { display: block; font-size: 1.55rem; }
.td-stat small { color: #64748b; font-weight: 900; }
.td-grid { display: grid; grid-template-columns: minmax(0,1fr) 380px; gap: 18px; align-items: start; }
.td-card { padding: 18px; margin-bottom: 16px; }
.td-card h2 { margin: 0 0 14px; font-size: 1.25rem; letter-spacing: -.03em; }
.consult-list { display: grid; gap: 12px; }
.consult-item { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 22px; padding: 16px; }
.consult-head { display: flex; justify-content: space-between; gap: 12px; }
.consult-head h3 { margin: 0 0 4px; }
.consult-head p, .consult-head small { margin: 0; color: #64748b; font-weight: 800; }
.status { border-radius: 999px; padding: 7px 10px; background: #eff6ff; color: #2563eb; font-weight: 950; text-transform: capitalize; height: fit-content; }
.status.requested { background: #fef3c7; color: #92400e; }
.status.completed { background: #dcfce7; color: #166534; }
.status.rejected { background: #fee2e2; color: #991b1b; }
.symptoms { color: #334155; font-weight: 700; line-height: 1.55; }
.consult-actions { display: grid; grid-template-columns: repeat(6,1fr); gap: 8px; }
.consult-actions button { min-height: 42px; font-size: .8rem; }
.consult-actions .danger, .video-controls .danger { background: #ef4444; }
.two { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
.toggle-row { min-height: 48px; border-radius: 16px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; gap: 10px; padding: 0 14px; font-weight: 950; }
.schedule-card article { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; margin-bottom: 8px; background: #f8fafc; }
.schedule-card strong, .schedule-card span { display: block; }
.schedule-card span { color: #64748b; font-weight: 800; }
.td-modal-backdrop { position: fixed; inset: 0; z-index: 4000; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(15,23,42,.58); }
.td-modal { width: min(720px,100%); max-height: 92vh; overflow-y: auto; background: white; border-radius: 26px; box-shadow: 0 30px 80px rgba(15,23,42,.25); }
.td-modal.wide { width: min(980px,100%); }
.td-modal-head { padding: 18px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
.td-modal-head h2 { margin: 0; display: flex; gap: 8px; align-items: center; }
.td-modal-head button { width: 38px; height: 38px; border: none; border-radius: 13px; background: #f1f5f9; cursor: pointer; }
.chat-window { padding: 18px; display: grid; gap: 10px; max-height: 460px; overflow-y: auto; background: #f8fafc; }
.chat-bubble { max-width: 78%; border-radius: 18px; padding: 12px 14px; }
.chat-bubble.user { background: #eff6ff; color: #1e3a8a; }
.chat-bubble.doctor { margin-left: auto; background: #2563eb; color: white; }
.chat-bubble.system { margin-inline: auto; background: #f1f5f9; color: #475569; text-align: center; }
.chat-bubble span { display: block; text-transform: uppercase; font-size: .7rem; font-weight: 950; margin-bottom: 4px; }
.chat-bubble p { margin: 0; }
.chat-bubble small { display: block; margin-top: 6px; opacity: .75; }
.chat-send { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 16px; border-top: 1px solid #e2e8f0; }
.chat-send button { width: 52px; }
.video-room { padding: 18px; display: grid; grid-template-columns: minmax(0,1fr) 270px; gap: 16px; }
.video-stage { min-height: 420px; border-radius: 24px; background: radial-gradient(circle at center,#4338ca,#111827 72%); color: white; display: grid; place-items: center; text-align: center; position: relative; overflow: hidden; }
.video-stage video { position: absolute; right: 16px; bottom: 16px; width: 180px; height: 125px; border-radius: 18px; object-fit: cover; background: #0f172a; border: 2px solid rgba(255,255,255,.75); transform: scaleX(-1); }
.video-room aside { display: grid; gap: 12px; align-content: start; }
.video-room aside div { border-radius: 18px; padding: 15px; border: 1px solid #dbeafe; background: #eff6ff; }
.video-room aside b, .video-room aside span { display: block; }
.video-controls { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 0 18px 18px; }
.video-controls button { background: #f1f5f9; color: #0f172a; }
@media (max-width: 1100px) { .td-grid, .video-room { grid-template-columns: 1fr; } .consult-actions { grid-template-columns: repeat(3,1fr); } }
@media (max-width: 760px) { .td-hero { flex-direction: column; } .td-stats, .two, .video-controls { grid-template-columns: 1fr; } .consult-actions { grid-template-columns: 1fr 1fr; } .hero-actions { width: 100%; flex-direction: column; } .hero-actions button { width: 100%; } }
`;
