import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Ambulance,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Droplet,
  HeartPulse,
  Loader2,
  MessageCircle,
  PackageCheck,
  Pill,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Video,
} from "lucide-react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function niceDate(value) {
  if (!value) return "Not set";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function niceDateTime(value) {
  if (!value) return "Just now";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function cleanTime(value) {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
}

function statusLabel(value) {
  return String(value || "pending").replaceAll("_", " ");
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  const firstName = useMemo(() => {
    const name = data?.user?.name || user?.name || "there";
    return String(name).split(" ")[0];
  }, [data?.user?.name, user?.name]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setNotice(null);

    try {
      const response = await api.get("/dashboard/overview");
      setData(response.data.data);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load dashboard.",
      });
    } finally {
      setLoading(false);
    }
  }

  const stats = data?.stats || {};
  const appointments = data?.appointments?.items || [];
  const reminders = data?.reminders?.items || [];
  const orders = data?.pharmacy?.items || [];
  const bloodRequests = data?.bloodbank?.requests || [];
  const notifications = data?.notifications || [];
  const telemedicine = data?.telemedicine?.items || [];
  const ambulanceMessages = data?.ambulance?.items || [];

  return (
    <section className="dash-page">
      <style>{styles}</style>

      <div className="dash-bg" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="pulse-line" />
      </div>

      <div className="dash-shell">
        <div className="dash-hero glass-card">
          <div>
            <span className="hero-pill">
              <Sparkles size={17} /> Personal Health Hub
            </span>
            <h1>Welcome back, {firstName}</h1>
            <p>
              Track your appointments, medicine reminders, pharmacy delivery,
              blood requests, and healthcare messages from one smart dashboard.
            </p>
          </div>

          <div className="hero-side">
            <div className="user-badge">
              <span>
                <UserRound size={24} />
              </span>
              <div>
                <strong>{data?.user?.name || user?.name || "Healthcare User"}</strong>
                <small>{data?.user?.email || user?.email || "Signed in"}</small>
              </div>
            </div>

            <button className="refresh-btn" onClick={loadDashboard} disabled={loading}>
              {loading ? <Loader2 size={17} className="spin" /> : <RefreshCcw size={17} />}
              Refresh
            </button>
          </div>
        </div>

        {notice && <div className={`dash-notice ${notice.type}`}>{notice.message}</div>}

        <div className="quick-row">
          <QuickAction to="/appointments" icon={<CalendarClock />} label="Book Appointment" />
          <QuickAction to="/pharmacies" icon={<Pill />} label="Order Medicine" />
          <QuickAction to="/blood-banks" icon={<Droplet />} label="Blood Request" />
          <QuickAction to="/telemedicine" icon={<Video />} label="Online Doctor" />
        </div>

        <div className="stats-grid">
          <StatCard icon={<Bell />} label="Active Reminders" value={stats.active_reminders || 0} note="Medicine alarms" />
          <StatCard icon={<CalendarClock />} label="Appointments" value={stats.active_appointments || 0} note="Upcoming / ongoing" />
          <StatCard icon={<Truck />} label="Deliveries" value={stats.active_orders || 0} note="Pharmacy orders" />
          <StatCard icon={<MessageCircle />} label="Notifications" value={stats.notifications || 0} note="Chats & updates" />
        </div>

        {loading && !data ? (
          <div className="loading-card glass-card">
            <Loader2 className="spin" size={28} />
            Loading your health dashboard...
          </div>
        ) : (
          <div className="dashboard-grid">
            <Panel
              title="Upcoming / Ongoing Appointments"
              icon={<CalendarClock />}
              to="/appointments"
              action="View appointments"
            >
              {appointments.length ? (
                <div className="stack-list">
                  {appointments.slice(0, 5).map((item) => (
                    <article className="mini-item appointment" key={item.appointment_id || item.id}>
                      <span className="mini-icon"><CalendarClock size={18} /></span>
                      <div>
                        <strong>{item.provider || item.doctor || item.online_doctor_name || "Healthcare appointment"}</strong>
                        <p>{item.department || item.appointment_type} · {niceDate(item.appointment_date)} at {cleanTime(item.appointment_time)}</p>
                        <small>{item.appointment_type || "appointment"} · {item.payment_status || "pending payment"}</small>
                      </div>
                      <b className={`status-chip ${item.status}`}>{statusLabel(item.status)}</b>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyCard icon={<Plus />} text="No appointment scheduled yet." to="/appointments" label="Schedule now" />
              )}
            </Panel>

            <Panel
              title="Medicine Reminders"
              icon={<Pill />}
              to="/drug-interactions"
              action="Manage reminders"
            >
              {reminders.length ? (
                <div className="reminder-grid">
                  {reminders.slice(0, 6).map((item) => (
                    <article className="reminder-card" key={item.id}>
                      <span><Clock3 size={16} /> {cleanTime(item.reminder_time)}</span>
                      <strong>{item.medicine_name}</strong>
                      <p>{item.dosage || "No dosage"}</p>
                      <small>{item.frequency} · from {niceDate(item.start_date)}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyCard icon={<Bell />} text="No active medicine reminders." to="/drug-interactions" label="Add reminder" />
              )}
            </Panel>

            <Panel
              title="Pharmacy Delivery Status"
              icon={<PackageCheck />}
              to="/pharmacies"
              action="Track orders"
            >
              {orders.length ? (
                <div className="stack-list">
                  {orders.slice(0, 5).map((order) => (
                    <article className="mini-item order" key={order.order_id}>
                      <span className="mini-icon"><Truck size={18} /></span>
                      <div>
                        <strong>#{order.order_id}</strong>
                        <p>{order.item_count || 0} item(s) · ৳{money(order.final_total)}</p>
                        <small>{order.district || "Delivery address"} · {niceDateTime(order.created_at)}</small>
                      </div>
                      <b className={`status-chip ${order.status}`}>{statusLabel(order.status)}</b>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyCard icon={<Pill />} text="No pharmacy order found." to="/pharmacies" label="Shop medicine" />
              )}
            </Panel>

            <Panel
              title="Blood Bank Requests & Responses"
              icon={<Droplet />}
              to="/blood-banks"
              action="Open blood bank"
            >
              <div className="blood-summary">
                <div>
                  <strong>{data?.bloodbank?.incoming_count || 0}</strong>
                  <span>Incoming requests</span>
                </div>
                <div>
                  <strong>{data?.bloodbank?.unread_count || 0}</strong>
                  <span>Unread replies</span>
                </div>
              </div>

              {bloodRequests.length ? (
                <div className="stack-list compact">
                  {bloodRequests.slice(0, 4).map((request) => (
                    <article className="mini-item blood" key={request.id}>
                      <span className="mini-icon"><Droplet size={18} /></span>
                      <div>
                        <strong>{request.blood_group} · {request.patient_name}</strong>
                        <p>{request.donor_name || request.requester_name || "Blood Bank user"}</p>
                        <small>{request.last_message || request.hospital_location}</small>
                      </div>
                      <b className={`status-chip ${request.status}`}>{statusLabel(request.status)}</b>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyCard icon={<Droplet />} text="No blood bank request yet." to="/blood-banks" label="Create request" />
              )}
            </Panel>

            <Panel
              title="Chat Notifications"
              icon={<MessageCircle />}
              to="/blood-banks"
              action="View chats"
              wide
            >
              {notifications.length ? (
                <div className="notify-grid">
                  {notifications.map((item) => (
                    <article className={`notify-card ${item.priority}`} key={item.id}>
                      <span>{item.type}</span>
                      <strong>{item.title}</strong>
                      <p>{item.message}</p>
                      <small>{niceDateTime(item.time)}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyCard icon={<ShieldCheck />} text="No unread chat updates." to="/dashboard" label="All clear" />
              )}
            </Panel>

            <Panel
              title="Telemedicine Queue"
              icon={<Video />}
              to="/telemedicine"
              action="Open telemedicine"
            >
              {telemedicine.length ? (
                <div className="stack-list compact">
                  {telemedicine.slice(0, 4).map((item) => (
                    <article className="mini-item tele" key={item.consultation_id}>
                      <span className="mini-icon"><Video size={18} /></span>
                      <div>
                        <strong>{item.doctor_name || "Online Doctor"}</strong>
                        <p>{item.specialty || item.consultation_type} · Queue #{item.queue_position || 1}</p>
                        <small>{item.last_message || item.symptoms}</small>
                      </div>
                      <b className={`status-chip ${item.status}`}>{statusLabel(item.status)}</b>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyCard icon={<Video />} text="No telemedicine queue active." to="/telemedicine" label="Consult doctor" />
              )}
            </Panel>

            <Panel
              title="Ambulance Messages"
              icon={<Ambulance />}
              to="/ambulance"
              action="Open ambulance"
            >
              {ambulanceMessages.length ? (
                <div className="stack-list compact">
                  {ambulanceMessages.slice(0, 4).map((item) => (
                    <article className="mini-item ambulance" key={item.id}>
                      <span className="mini-icon"><Ambulance size={18} /></span>
                      <div>
                        <strong>{item.service_name || "Ambulance service"}</strong>
                        <p>{statusLabel(item.message_type)} · {statusLabel(item.status)}</p>
                        <small>{item.manager_reply || item.message}</small>
                      </div>
                      {item.manager_reply ? <b className="status-chip replied">replied</b> : <b className="status-chip open">open</b>}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyCard icon={<Ambulance />} text="No ambulance messages." to="/ambulance" label="Find ambulance" />
              )}
            </Panel>
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({ icon, label, value, note }) {
  return (
    <article className="stat-card glass-card">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
        <em>{note}</em>
      </div>
    </article>
  );
}

function QuickAction({ to, icon, label }) {
  return (
    <Link className="quick-action glass-card" to={to}>
      <span>{icon}</span>
      <strong>{label}</strong>
      <ChevronRight size={17} />
    </Link>
  );
}

function Panel({ title, icon, children, to, action, wide }) {
  return (
    <section className={`dash-panel glass-card ${wide ? "wide" : ""}`}>
      <div className="panel-head">
        <div>
          <span>{icon}</span>
          <h2>{title}</h2>
        </div>
        {to && (
          <Link to={to}>
            {action}
            <ChevronRight size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyCard({ icon, text, to, label }) {
  return (
    <div className="empty-card">
      <span>{icon}</span>
      <p>{text}</p>
      {to && <Link to={to}>{label}</Link>}
    </div>
  );
}

const styles = `
.dash-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  color: #0f172a;
  padding: 0 0 42px;
}

.dash-bg {
  position: absolute;
  inset: -120px -80px auto -80px;
  height: 620px;
  background:
    radial-gradient(circle at 18% 22%, rgba(20,184,166,.25), transparent 26%),
    radial-gradient(circle at 74% 12%, rgba(37,99,235,.22), transparent 27%),
    linear-gradient(135deg, #ecfeff, #eff6ff 48%, #eef2ff);
  z-index: 0;
}

.dash-bg::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15,118,110,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,118,110,.06) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom, #000, transparent 88%);
}

.orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(1px);
  opacity: .8;
  animation: dashFloat 7s ease-in-out infinite;
}

.orb-1 { width: 150px; height: 150px; left: 7%; top: 110px; background: rgba(20,184,166,.25); }
.orb-2 { width: 110px; height: 110px; right: 14%; top: 80px; background: rgba(37,99,235,.2); animation-delay: 1.2s; }
.orb-3 { width: 80px; height: 80px; left: 52%; top: 205px; background: rgba(124,58,237,.17); animation-delay: 2.1s; }

.pulse-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 145px;
  height: 3px;
  background: linear-gradient(90deg, transparent, rgba(14,165,233,.6), transparent);
  animation: pulseMove 3.5s linear infinite;
}

.dash-shell {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px 18px;
}

.glass-card {
  background: rgba(255,255,255,.72);
  border: 1px solid rgba(255,255,255,.75);
  box-shadow: 0 24px 70px rgba(15,23,42,.09);
  backdrop-filter: blur(18px);
}

.dash-hero {
  border-radius: 34px;
  padding: 30px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 22px;
  overflow: hidden;
  position: relative;
}

.dash-hero::after {
  content: "";
  position: absolute;
  right: -60px;
  bottom: -95px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(20,184,166,.22), transparent 65%);
}

.hero-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #0f766e;
  background: rgba(204,251,241,.78);
  border: 1px solid rgba(20,184,166,.18);
  border-radius: 999px;
  padding: 9px 13px;
  font-weight: 950;
}

.dash-hero h1 {
  margin: 16px 0 10px;
  font-size: clamp(2.25rem, 5vw, 4.5rem);
  line-height: .95;
  letter-spacing: -.075em;
  color: #0f172a;
}

.dash-hero p {
  max-width: 760px;
  margin: 0;
  color: #64748b;
  font-weight: 800;
  line-height: 1.6;
}

.hero-side {
  position: relative;
  z-index: 2;
  min-width: 300px;
  display: grid;
  gap: 12px;
}

.user-badge {
  background: rgba(248,250,252,.78);
  border: 1px solid rgba(226,232,240,.9);
  border-radius: 22px;
  padding: 14px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.user-badge > span {
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  border-radius: 17px;
  color: white;
  background: linear-gradient(135deg, #14b8a6, #2563eb);
}

.user-badge strong,
.user-badge small {
  display: block;
}

.user-badge small {
  color: #64748b;
  font-weight: 800;
  margin-top: 3px;
}

.refresh-btn {
  min-height: 48px;
  border: none;
  border-radius: 17px;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  color: white;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.quick-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin: 16px 0;
}

.quick-action {
  min-height: 74px;
  border-radius: 22px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #0f172a;
  font-weight: 950;
  transition: transform .22s ease, box-shadow .22s ease;
}

.quick-action:hover {
  transform: translateY(-4px);
}

.quick-action span {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: #2563eb;
  background: #eff6ff;
}

.quick-action svg:last-child {
  margin-left: auto;
  color: #94a3b8;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  border-radius: 24px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  overflow: hidden;
}

.stat-card::after {
  content: "";
  position: absolute;
  inset: auto -30px -55px auto;
  width: 120px;
  height: 120px;
  border-radius: 999px;
  background: rgba(37,99,235,.08);
}

.stat-card > span {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: white;
  background: linear-gradient(135deg, #14b8a6, #2563eb);
}

.stat-card strong,
.stat-card small,
.stat-card em {
  display: block;
}

.stat-card strong {
  font-size: 2rem;
  line-height: 1;
}

.stat-card small {
  margin-top: 4px;
  color: #334155;
  font-weight: 950;
}

.stat-card em {
  margin-top: 3px;
  color: #64748b;
  font-size: .8rem;
  font-style: normal;
  font-weight: 800;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.dash-panel {
  border-radius: 28px;
  padding: 20px;
  min-height: 290px;
  animation: panelIn .45s ease both;
}

.dash-panel.wide {
  grid-column: span 2;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.panel-head > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-head span {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: #0f766e;
  background: rgba(204,251,241,.75);
}

.panel-head h2 {
  margin: 0;
  letter-spacing: -.035em;
  font-size: 1.18rem;
}

.panel-head a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  text-decoration: none;
  color: #2563eb;
  font-weight: 950;
  white-space: nowrap;
}

.stack-list {
  display: grid;
  gap: 10px;
}

.stack-list.compact {
  gap: 8px;
}

.mini-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 13px;
  border-radius: 20px;
  background: rgba(248,250,252,.8);
  border: 1px solid rgba(226,232,240,.9);
}

.mini-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: #2563eb;
  background: #eff6ff;
}

.mini-item strong,
.mini-item p,
.mini-item small {
  display: block;
}

.mini-item strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-item p,
.mini-item small {
  margin: 3px 0 0;
  color: #64748b;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-item small {
  font-size: .78rem;
}

.status-chip {
  border-radius: 999px;
  padding: 7px 10px;
  font-size: .72rem;
  text-transform: capitalize;
  color: #1d4ed8;
  background: #dbeafe;
  white-space: nowrap;
}

.status-chip.pending,
.status-chip.requested,
.status-chip.open {
  background: #fef3c7;
  color: #92400e;
}

.status-chip.accepted,
.status-chip.waiting,
.status-chip.confirmed,
.status-chip.processing,
.status-chip.shipped,
.status-chip.replied,
.status-chip.in_call {
  background: #dcfce7;
  color: #166534;
}

.status-chip.cancelled,
.status-chip.rejected,
.status-chip.declined {
  background: #fee2e2;
  color: #991b1b;
}

.reminder-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.reminder-card {
  border-radius: 20px;
  padding: 14px;
  border: 1px solid rgba(226,232,240,.9);
  background: linear-gradient(135deg, rgba(239,246,255,.88), rgba(240,253,250,.88));
}

.reminder-card span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #2563eb;
  font-weight: 950;
  margin-bottom: 9px;
}

.reminder-card strong,
.reminder-card p,
.reminder-card small {
  display: block;
}

.reminder-card p,
.reminder-card small {
  margin: 4px 0 0;
  color: #64748b;
  font-weight: 800;
}

.blood-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.blood-summary div {
  border-radius: 20px;
  padding: 16px;
  background: rgba(254,242,242,.8);
  border: 1px solid rgba(254,202,202,.75);
}

.blood-summary strong,
.blood-summary span {
  display: block;
}

.blood-summary strong {
  font-size: 1.9rem;
  color: #dc2626;
}

.blood-summary span {
  color: #64748b;
  font-weight: 900;
}

.notify-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.notify-card {
  border-radius: 20px;
  padding: 15px;
  border: 1px solid rgba(226,232,240,.9);
  background: rgba(248,250,252,.82);
}

.notify-card.high {
  border-color: rgba(20,184,166,.35);
  background: linear-gradient(135deg, rgba(204,251,241,.75), rgba(239,246,255,.85));
}

.notify-card span,
.notify-card strong,
.notify-card p,
.notify-card small {
  display: block;
}

.notify-card span {
  width: fit-content;
  border-radius: 999px;
  padding: 5px 9px;
  background: #eff6ff;
  color: #2563eb;
  font-size: .72rem;
  font-weight: 950;
}

.notify-card strong {
  margin-top: 10px;
}

.notify-card p {
  margin: 6px 0;
  color: #475569;
  font-weight: 800;
  line-height: 1.45;
}

.notify-card small {
  color: #94a3b8;
  font-weight: 800;
}

.empty-card,
.loading-card {
  min-height: 190px;
  display: grid;
  place-items: center;
  text-align: center;
  border-radius: 22px;
  border: 1px dashed rgba(148,163,184,.7);
  background: rgba(248,250,252,.6);
  padding: 20px;
  color: #64748b;
  font-weight: 900;
}

.empty-card span {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 19px;
  color: #2563eb;
  background: #eff6ff;
}

.empty-card p {
  margin: 12px 0 8px;
}

.empty-card a {
  color: #0f766e;
  text-decoration: none;
  font-weight: 950;
}

.loading-card {
  min-height: 320px;
  display: flex;
  gap: 12px;
  justify-content: center;
}

.dash-notice {
  margin: 16px 0;
  border-radius: 18px;
  padding: 14px 16px;
  font-weight: 950;
}

.dash-notice.error {
  background: #fee2e2;
  color: #991b1b;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes dashFloat {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50% { transform: translate3d(0,-18px,0) scale(1.04); }
}

@keyframes pulseMove {
  from { transform: translateX(-50%); opacity: 0; }
  35% { opacity: 1; }
  to { transform: translateX(50%); opacity: 0; }
}

@keyframes panelIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1100px) {
  .quick-row,
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .dash-panel.wide {
    grid-column: auto;
  }
}

@media (max-width: 760px) {
  .dash-shell {
    padding: 18px 12px;
  }

  .dash-hero {
    flex-direction: column;
    padding: 22px;
  }

  .hero-side {
    min-width: 0;
    width: 100%;
  }

  .quick-row,
  .stats-grid,
  .reminder-grid,
  .notify-grid,
  .blood-summary {
    grid-template-columns: 1fr;
  }

  .mini-item {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .mini-item .status-chip {
    grid-column: 2;
    width: fit-content;
  }
}
`;
