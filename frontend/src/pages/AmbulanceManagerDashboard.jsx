import { useEffect, useState } from "react";
import {
  Ambulance,
  CheckCircle,
  Clock,
  LogOut,
  MapPin,
  MessageCircle,
  RefreshCcw,
  Save,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import api from "../services/api.js";

const initialLogin = {
  username: "",
  password: "",
};

const initialService = {
  service_name: "",
  service_type: "advanced",
  division: "",
  district: "",
  area: "",
  address: "",
  phone_primary: "",
  phone_secondary: "",
  email: "",
  contact_person: "",
  website: "",
  equipment: "",
  description: "",
  availability: "24/7",
  base_charge: "",
  price_per_km: "",
};

const serviceTypes = ["basic", "advanced", "icu", "neonatal", "cardiac"];
const availabilityTypes = ["24/7", "day_only", "emergency_only"];

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

function MapBox({ latitude, longitude, title = "Location", note }) {
  const hasLocation = latitude && longitude;
  const mapSrc = hasLocation
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
    : "";

  return (
    <div className="map-box">
      {hasLocation ? (
        <>
          <iframe
            title={title}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />

          <div className="map-overlay">
            <strong>{title}</strong>
            {note && <span>{note}</span>}
          </div>
        </>
      ) : (
        <div className="map-empty">
          <MapPin size={30} />
          <strong>No location selected</strong>
          <span>Click “Use Current GPS” to locate this ambulance.</span>
        </div>
      )}
    </div>
  );
}

export default function AmbulanceManagerDashboard() {
  const [token, setToken] = useState(
    () => localStorage.getItem("ambulance_manager_token") || ""
  );
  const [login, setLogin] = useState(initialLogin);
  const [manager, setManager] = useState(null);
  const [service, setService] = useState(initialService);
  const [messages, setMessages] = useState([]);
  const [locationForm, setLocationForm] = useState({
    latitude: "",
    longitude: "",
    note: "",
  });
  const [replyDrafts, setReplyDrafts] = useState({});
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  function managerConfig() {
    return {
      headers: {
        Authorization: `Bearer ${
          localStorage.getItem("ambulance_manager_token") || token
        }`,
      },
    };
  }

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function updateLogin(event) {
    const { name, value } = event.target;

    setLogin((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitLogin(event) {
    event.preventDefault();

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.post("/ambulance/manager/login", login);

      localStorage.setItem("ambulance_manager_token", response.data.token);
      setToken(response.data.token);

      setNotice({
        type: "success",
        message: response.data.message || "Manager login successful.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message || "Invalid ambulance manager login.",
      });
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("ambulance_manager_token");
    setToken("");
    setManager(null);
    setService(initialService);
    setMessages([]);
    setReplyDrafts({});
  }

  async function loadDashboard() {
    setLoading(true);

    try {
      const [meResponse, messagesResponse] = await Promise.all([
        api.get("/ambulance/manager/me", managerConfig()),
        api.get("/ambulance/manager/messages", managerConfig()),
      ]);

      const currentService = meResponse.data.data.service;

      setManager(meResponse.data.data.manager);
      setService({
        ...initialService,
        ...currentService,
      });

      setLocationForm({
        latitude:
          currentService?.current_latitude || currentService?.latitude || "",
        longitude:
          currentService?.current_longitude || currentService?.longitude || "",
        note: currentService?.current_location_note || "",
      });

      setMessages(messagesResponse.data.data || []);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message || "Could not load manager dashboard.",
      });
    } finally {
      setLoading(false);
    }
  }

  function updateServiceField(event) {
    const { name, value } = event.target;

    setService((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function saveService(event) {
    event.preventDefault();

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.patch(
        "/ambulance/manager/service",
        service,
        managerConfig()
      );

      setService({
        ...initialService,
        ...response.data.data,
      });

      setNotice({
        type: "success",
        message: response.data.message || "Ambulance information updated.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message ||
          "Could not update ambulance information.",
      });
    } finally {
      setLoading(false);
    }
  }

  function updateLocationField(event) {
    const { name, value } = event.target;

    setLocationForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function useCurrentAmbulanceLocation() {
    if (!navigator.geolocation) {
      setNotice({
        type: "error",
        message: "Geolocation is not supported.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationForm((current) => ({
          ...current,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
      },
      () => {
        setNotice({
          type: "error",
          message: "Could not get current ambulance location.",
        });
      }
    );
  }

  async function saveCurrentLocation(event) {
    event.preventDefault();

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.patch(
        "/ambulance/manager/location",
        locationForm,
        managerConfig()
      );

      setNotice({
        type: "success",
        message: response.data.message || "Location updated.",
      });

      await loadDashboard();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message || "Could not update location.",
      });
    } finally {
      setLoading(false);
    }
  }

  function updateReply(messageId, value) {
    setReplyDrafts((current) => ({
      ...current,
      [messageId]: value,
    }));
  }

  async function updateMessageStatus(messageId, status) {
    setLoading(true);

    try {
      const response = await api.patch(
        `/ambulance/manager/messages/${messageId}`,
        {
          status,
          manager_reply: replyDrafts[messageId] || "",
        },
        managerConfig()
      );

      setNotice({
        type: "success",
        message: response.data.message || "Message updated.",
      });

      await loadDashboard();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message || "Could not update message.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <section className="manager-login-page">
        <style>{styles}</style>

        <div className="manager-login-card">
          <div className="login-icon">
            <Ambulance size={32} />
          </div>

          <h1>Ambulance Manager Login</h1>
          <p>
            Login to update your ambulance information, share current location,
            and view user shared locations.
          </p>

          {notice && (
            <div className={`manager-notice ${notice.type}`}>
              {notice.message}
            </div>
          )}

          <form onSubmit={submitLogin}>
            <label>
              Username
              <input
                name="username"
                value={login.username}
                onChange={updateLogin}
                placeholder="ambulance1"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                value={login.password}
                onChange={updateLogin}
                placeholder="Manager password"
                required
              />
            </label>

            <button disabled={loading}>
              {loading ? "Signing in..." : "Open Manager Dashboard"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="manager-page">
      <style>{styles}</style>

      <div className="manager-shell">
        <div className="manager-hero">
          <div>
            <span>
              <ShieldCheck size={18} />
              Ambulance Manager
            </span>

            <h1>Manage your ambulance and live location.</h1>

            <p>
              Update service details, share current ambulance location, and view
              user pickup locations/messages.
            </p>

            {manager && (
              <p className="manager-name">
                Signed in as {manager.manager_name || manager.username}
              </p>
            )}
          </div>

          <div className="hero-actions">
            <button type="button" onClick={loadDashboard}>
              <RefreshCcw size={16} />
              Refresh
            </button>

            <button type="button" className="logout" onClick={logout}>
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>

        {notice && (
          <div className={`manager-notice ${notice.type}`}>
            {notice.message}
          </div>
        )}

        <div className="manager-stats">
          <Stat
            icon={<Ambulance />}
            label="Service"
            value={service.service_name || "N/A"}
          />
          <Stat
            icon={<Truck />}
            label="Type"
            value={service.service_type || "N/A"}
          />
          <Stat
            icon={<Clock />}
            label="Availability"
            value={service.availability || "N/A"}
          />
          <Stat
            icon={<MessageCircle />}
            label="Messages"
            value={messages.length}
          />
        </div>

        <div className="manager-grid">
          <form className="manager-card service-form" onSubmit={saveService}>
            <h2>Ambulance Information</h2>

            <label>
              Service Name
              <input
                name="service_name"
                value={service.service_name || ""}
                onChange={updateServiceField}
                required
              />
            </label>

            <div className="two">
              <label>
                Service Type
                <select
                  name="service_type"
                  value={service.service_type || "advanced"}
                  onChange={updateServiceField}
                >
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Availability
                <select
                  name="availability"
                  value={service.availability || "24/7"}
                  onChange={updateServiceField}
                >
                  {availabilityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="two">
              <label>
                Division
                <input
                  name="division"
                  value={service.division || ""}
                  onChange={updateServiceField}
                  required
                />
              </label>

              <label>
                District
                <input
                  name="district"
                  value={service.district || ""}
                  onChange={updateServiceField}
                  required
                />
              </label>
            </div>

            <label>
              Area
              <input
                name="area"
                value={service.area || ""}
                onChange={updateServiceField}
              />
            </label>

            <label>
              Address
              <textarea
                name="address"
                value={service.address || ""}
                onChange={updateServiceField}
              />
            </label>

            <div className="two">
              <label>
                Primary Phone
                <input
                  name="phone_primary"
                  value={service.phone_primary || ""}
                  onChange={updateServiceField}
                  required
                />
              </label>

              <label>
                Secondary Phone
                <input
                  name="phone_secondary"
                  value={service.phone_secondary || ""}
                  onChange={updateServiceField}
                />
              </label>
            </div>

            <div className="two">
              <label>
                Base Charge
                <input
                  name="base_charge"
                  value={service.base_charge || ""}
                  onChange={updateServiceField}
                />
              </label>

              <label>
                Price Per KM
                <input
                  name="price_per_km"
                  value={service.price_per_km || ""}
                  onChange={updateServiceField}
                />
              </label>
            </div>

            <label>
              Equipment
              <textarea
                name="equipment"
                value={service.equipment || ""}
                onChange={updateServiceField}
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={service.description || ""}
                onChange={updateServiceField}
              />
            </label>

            <button className="save-btn" disabled={loading}>
              <Save size={17} />
              Save Ambulance Info
            </button>
          </form>

          <div>
            <form
              className="manager-card location-card"
              onSubmit={saveCurrentLocation}
            >
              <div className="location-title-row">
                <div>
                  <h2>Live Ambulance Location</h2>
                  <p>Share the ambulance’s current GPS position with users.</p>
                </div>

                <span className="live-badge">
                  <MapPin size={14} />
                  Live
                </span>
              </div>

              <MapBox
                latitude={locationForm.latitude}
                longitude={locationForm.longitude}
                title={service.service_name || "Ambulance Location"}
                note={locationForm.note}
              />

              <label>
                Location Note
                <textarea
                  name="note"
                  value={locationForm.note}
                  onChange={updateLocationField}
                  placeholder="Example: Waiting near hospital gate / on the way..."
                />
              </label>

              <div className="location-meta">
                <span>
                  <strong>Latitude:</strong>{" "}
                  {locationForm.latitude || "Not set"}
                </span>
                <span>
                  <strong>Longitude:</strong>{" "}
                  {locationForm.longitude || "Not set"}
                </span>
              </div>

              <div className="button-row">
                <button
                  type="button"
                  onClick={useCurrentAmbulanceLocation}
                >
                  <MapPin size={16} />
                  Use Current GPS
                </button>

                <button
                  className="save-btn"
                  disabled={
                    loading ||
                    !locationForm.latitude ||
                    !locationForm.longitude
                  }
                >
                  <Save size={16} />
                  Share Location
                </button>
              </div>

              {locationForm.latitude && locationForm.longitude && (
                <a
                  className="map-link"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps?q=${locationForm.latitude},${locationForm.longitude}`}
                >
                  Open Full Map
                </a>
              )}
            </form>
          </div>
        </div>

        <div className="manager-card chat-panel">
          <div className="chat-panel-head">
            <div>
              <span className="section-kicker">
                <MessageCircle size={15} />
                Ambulance Inbox
              </span>

              <h2>Pickup Requests & Messages</h2>
              <p>View pickup locations, user messages, and reply status.</p>
            </div>

            <button
              type="button"
              className="mini-refresh"
              onClick={loadDashboard}
            >
              <RefreshCcw size={15} />
              Refresh
            </button>
          </div>

          {messages.length === 0 ? (
            <div className="empty-msg modern-empty">
              <MessageCircle size={34} />
              <strong>No user location or message yet.</strong>
              <span>When a user shares location, it will appear here.</span>
            </div>
          ) : (
            <div className="chat-list">
              {messages.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  replyValue={
                    replyDrafts[message.id] || message.manager_reply || ""
                  }
                  onReplyChange={(value) => updateReply(message.id, value)}
                  onStatusChange={(status) =>
                    updateMessageStatus(message.id, status)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }) {
  return (
    <article className="manager-stat">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function MessageCard({ message, replyValue, onReplyChange, onStatusChange }) {
  const hasUserLocation = message.user_latitude && message.user_longitude;

  return (
    <article className="chat-card">
      <div className="chat-card-head">
        <div className="user-avatar">
          {String(message.sender_name || "U").charAt(0).toUpperCase()}
        </div>

        <div className="chat-user-main">
          <div className="chat-user-row">
            <h3>{message.sender_name}</h3>
            <span className={`message-status ${message.status}`}>
              {message.status}
            </span>
          </div>

          <p>{message.sender_phone}</p>
          <small>{formatDate(message.created_at)}</small>
        </div>
      </div>

      <div className="chat-bubble user-bubble">
        <span>User message</span>
        <p>
          {message.message ||
            "User shared current location with ambulance manager."}
        </p>
      </div>

      {hasUserLocation && (
        <div className="pickup-map-card">
          <MapBox
            latitude={message.user_latitude}
            longitude={message.user_longitude}
            title={`${message.sender_name}'s Pickup Location`}
            note={message.sender_phone}
          />

          <a
            className="map-open-btn"
            href={`https://www.google.com/maps?q=${message.user_latitude},${message.user_longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={15} />
            Open pickup location
          </a>
        </div>
      )}

      {message.manager_reply && (
        <div className="chat-bubble manager-bubble">
          <span>Manager reply</span>
          <p>{message.manager_reply}</p>
        </div>
      )}

      <div className="reply-composer">
        <textarea
          value={replyValue}
          onChange={(event) => onReplyChange(event.target.value)}
          placeholder="Write a short reply or internal note..."
        />

        <div className="reply-actions">
          <button type="button" onClick={() => onStatusChange("replied")}>
            <CheckCircle size={15} />
            Mark replied
          </button>

          <button
            type="button"
            className="close-btn"
            onClick={() => onStatusChange("closed")}
          >
            <XCircle size={15} />
            Close
          </button>
        </div>
      </div>
    </article>
  );
}

const styles = `
.manager-login-page,
.manager-page {
  min-height: 100vh;
  background: #fff7ef;
  color: #0f172a;
  padding: 28px 16px 48px;
}

.manager-login-page {
  display: grid;
  place-items: center;
}

.manager-login-card,
.manager-card,
.manager-stat {
  background: white;
  border: 1px solid #fee2e2;
  border-radius: 24px;
  box-shadow: 0 18px 46px rgba(127, 29, 29, .1);
}

.manager-login-card {
  width: min(480px, 100%);
  padding: 28px;
}

.login-icon {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  color: white;
  background: linear-gradient(135deg, #ef1111, #f97316);
  margin-bottom: 18px;
}

.manager-login-card h1 {
  margin: 0;
  font-size: 2.1rem;
  letter-spacing: -.05em;
}

.manager-login-card p {
  color: #64748b;
}

.manager-login-card form,
.service-form,
.location-card {
  display: grid;
  gap: 12px;
}

.manager-login-card label,
.manager-card label {
  display: grid;
  gap: 7px;
  color: #334155;
  font-weight: 900;
  font-size: .9rem;
}

.manager-login-card input,
.manager-card input,
.manager-card select,
.manager-card textarea {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px;
  font: inherit;
  font-weight: 700;
  outline: none;
}

.manager-card textarea {
  min-height: 86px;
  resize: vertical;
}

.manager-login-card button,
.manager-hero button,
.save-btn,
.button-row button {
  border: none;
  border-radius: 14px;
  padding: 12px 16px;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.manager-login-card button,
.save-btn {
  background: #ef1111;
  color: white;
  box-shadow: 0 12px 24px rgba(239, 17, 17, .24);
}

.manager-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.manager-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  color: white;
  background: linear-gradient(135deg, #ef1111, #d90429 52%, #f97316);
  border-radius: 28px;
  padding: clamp(24px, 5vw, 42px);
  box-shadow: 0 26px 60px rgba(239, 17, 17, .2);
  margin-bottom: 18px;
}

.manager-hero span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(255,255,255,.16);
  border: 1px solid rgba(255,255,255,.22);
  font-weight: 900;
  margin-bottom: 16px;
}

.manager-hero h1 {
  margin: 0;
  max-width: 780px;
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 1;
  letter-spacing: -.06em;
}

.manager-hero p {
  color: #ffe4e6;
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.hero-actions button {
  background: white;
  color: #ef1111;
}

.hero-actions .logout {
  background: #111827;
  color: white;
}

.manager-notice {
  padding: 13px 16px;
  border-radius: 16px;
  margin-bottom: 16px;
  font-weight: 900;
}

.manager-notice.success {
  background: #dcfce7;
  color: #166534;
}

.manager-notice.error {
  background: #fee2e2;
  color: #991b1b;
}
.manager-name {
  margin-top: 10px;
  color: #fff;
  font-weight: 900;
}
  

.manager-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.manager-stat {
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.manager-stat > span {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #ef1111;
  background: #fee2e2;
}

.manager-stat strong {
  display: block;
  font-size: 1.05rem;
}

.manager-stat small {
  color: #64748b;
  font-weight: 900;
}

.manager-grid {
  display: grid;
  grid-template-columns: 1fr .9fr;
  gap: 18px;
  align-items: start;
}

.manager-card {
  padding: 20px;
  margin-bottom: 18px;
}

.manager-card h2 {
  margin: 0 0 16px;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.button-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.button-row button {
  background: #f8fafc;
  color: #334155;
  border: 1px solid #e2e8f0;
}

.button-row .save-btn {
  background: #ef1111;
  color: white;
}

.button-row .close-btn {
  background: #fee2e2;
  color: #b91c1c;
}

.map-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #2563eb;
  font-weight: 900;
  margin-top: 10px;
}

.empty-msg {
  padding: 28px;
  text-align: center;
  color: #64748b;
  background: #f8fafc;
  border-radius: 18px;
}

.message-list {
  display: grid;
  gap: 12px;
}

.message-item {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 18px;
  padding: 14px;
}

.message-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.message-head h3 {
  margin: 0;
}

.message-head p,
.message-item p,
.message-item small {
  color: #64748b;
}

.message-status {
  border-radius: 999px;
  padding: 6px 9px;
  font-size: .76rem;
  font-weight: 950;
  background: #fef3c7;
  color: #92400e;
}

.message-status.replied {
  background: #dbeafe;
  color: #1d4ed8;
}

.message-status.closed {
  background: #dcfce7;
  color: #166534;
}

.message-item textarea {
  margin-top: 10px;
}

.location-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.location-title-row h2 {
  margin-bottom: 4px;
}

.location-title-row p {
  margin: 0 0 14px;
  color: #64748b;
}

.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 7px 10px;
  color: #166534;
  background: #dcfce7;
  font-size: .8rem;
  font-weight: 950;
}

.map-box {
  position: relative;
  width: 100%;
  height: 230px;
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(135deg, #fee2e2, #ffedd5);
  border: 1px solid #fecaca;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.7);
}

.map-box iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.map-overlay {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  border-radius: 16px;
  padding: 10px 12px;
  color: #0f172a;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 24px rgba(15,23,42,.12);
}

.map-overlay strong,
.map-overlay span {
  display: block;
}

.map-overlay span {
  margin-top: 3px;
  color: #64748b;
  font-size: .82rem;
}

.map-empty {
  height: 100%;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 7px;
  text-align: center;
  color: #991b1b;
  padding: 18px;
}

.map-empty span {
  color: #64748b;
  font-size: .88rem;
}

.location-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.location-meta span {
  border-radius: 14px;
  padding: 10px 12px;
  background: #fff7ef;
  color: #475569;
  font-size: .84rem;
}

.location-meta strong {
  color: #0f172a;
}

.message-map-wrap {
  margin: 10px 0;
}

.message-map-wrap .map-box {
  height: 170px;
  border-radius: 18px;
}

@media (max-width: 980px) {
  .manager-grid,
  .manager-stats {
    grid-template-columns: 1fr 1fr;
  }

  .manager-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 650px) {
  .manager-hero {
    flex-direction: column;
  }

  .manager-stats,
  .two {
    grid-template-columns: 1fr;
  }
}

/* ===== BLUE MODERN MANAGER THEME OVERRIDE ===== */

.manager-login-page,
.manager-page {
  background: #f8fafc;
  color: #0f172a;
}

.manager-hero {
  background: linear-gradient(135deg, #2563eb, #4f46e5 55%, #10b981);
  box-shadow: 0 26px 60px rgba(37, 99, 235, .22);
}

.manager-hero p {
  color: #dbeafe;
}

.manager-hero span {
  background: rgba(255,255,255,.16);
  border-color: rgba(255,255,255,.22);
}

.login-icon {
  background: linear-gradient(135deg, #2563eb, #10b981);
}

.manager-login-card,
.manager-card,
.manager-stat {
  border-color: #e2e8f0;
  box-shadow: 0 14px 34px rgba(15, 23, 42, .07);
}

.manager-stat > span {
  background: #dbeafe;
  color: #2563eb;
}

/* ===== MODERN MANAGER CHAT / LOCATION UI ===== */

.manager-grid {
  grid-template-columns: minmax(0, .95fr) minmax(420px, 1.05fr);
  align-items: start;
}

.location-card {
  gap: 14px !important;
}

.location-title-row {
  align-items: flex-start;
  margin-bottom: 2px;
}

.location-title-row h2,
.chat-panel h2 {
  font-size: 1.45rem;
  letter-spacing: -.035em;
  margin: 0;
}

.location-title-row p,
.chat-panel-head p {
  margin: 5px 0 0;
  color: #64748b;
  font-weight: 700;
}

.live-badge,
.section-kicker {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 999px;
  padding: 7px 11px;
  font-size: .78rem;
  font-weight: 950;
}

.live-badge {
  background: #dcfce7;
  color: #166534;
}

.section-kicker {
  background: #eff6ff;
  color: #2563eb;
  margin-bottom: 10px;
}

.location-card .map-box {
  height: 260px;
  border-radius: 24px;
}

.location-card textarea {
  min-height: 72px;
}

.location-meta {
  grid-template-columns: 1fr 1fr;
}

.location-meta span {
  border-radius: 16px;
  padding: 12px 14px;
  background: #eff6ff;
  color: #475569;
  font-size: .86rem;
}

.location-meta strong {
  color: #0f172a;
}

.chat-panel {
  padding: 0;
  overflow: hidden;
}

.chat-panel-head {
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  background: linear-gradient(180deg, #ffffff, #f8fafc);
}

.mini-refresh {
  border: 1px solid #dbe3ef;
  background: #fff;
  color: #2563eb;
  border-radius: 14px;
  padding: 10px 13px;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.chat-list {
  display: grid;
  gap: 14px;
  padding: 16px;
  max-height: 820px;
  overflow-y: auto;
  background: #f8fafc;
}

.chat-list::-webkit-scrollbar {
  width: 8px;
}

.chat-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
}

.chat-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  padding: 16px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, .06);
}

.chat-card-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.user-avatar {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  flex: 0 0 46px;
  background: linear-gradient(135deg, #2563eb, #10b981);
  color: white;
  font-weight: 950;
  font-size: 1.1rem;
}

.chat-user-main {
  min-width: 0;
  flex: 1;
}

.chat-user-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.chat-user-row h3 {
  margin: 0;
  font-size: 1.05rem;
  color: #0f172a;
}

.chat-user-main p {
  margin: 3px 0;
  color: #475569;
  font-weight: 800;
}

.chat-user-main small {
  color: #94a3b8;
  font-weight: 800;
}

.message-status {
  border-radius: 999px;
  padding: 7px 10px;
  font-size: .72rem;
  font-weight: 950;
  text-transform: capitalize;
  white-space: nowrap;
}

.message-status.open {
  background: #fef3c7;
  color: #92400e;
}

.message-status.replied {
  background: #dbeafe;
  color: #1d4ed8;
}

.message-status.closed {
  background: #dcfce7;
  color: #166534;
}

.chat-bubble {
  border-radius: 18px;
  padding: 12px 14px;
  margin-bottom: 12px;
}

.chat-bubble span {
  display: block;
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .08em;
  font-weight: 950;
  margin-bottom: 5px;
}

.chat-bubble p {
  margin: 0;
  line-height: 1.55;
}

.user-bubble {
  background: #eff6ff;
  color: #1e3a8a;
}

.user-bubble span {
  color: #2563eb;
}

.manager-bubble {
  background: #ecfdf5;
  color: #065f46;
}

.manager-bubble span {
  color: #059669;
}

.pickup-map-card {
  border-radius: 20px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  padding: 10px;
  margin: 12px 0;
}

.pickup-map-card .map-box {
  height: 210px;
  border-radius: 18px;
  margin-bottom: 10px;
}

.pickup-map-card .map-overlay {
  padding: 9px 11px;
}

.map-box iframe {
  pointer-events: none;
}

.map-open-btn {
  width: 100%;
  min-height: 42px;
  border-radius: 14px;
  background: #fff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
  font-weight: 950;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.reply-composer {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.reply-composer textarea {
  min-height: 76px;
  border: 1px solid #dbe3ef;
  border-radius: 16px;
  padding: 12px 14px;
  resize: vertical;
  background: #fff;
  font-weight: 700;
}

.reply-composer textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, .12);
}

.reply-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.reply-actions button {
  min-height: 46px;
  border: 1px solid #bfdbfe;
  border-radius: 15px;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.reply-actions .close-btn {
  border-color: #fecaca;
  background: #fee2e2;
  color: #b91c1c;
}

.modern-empty {
  margin: 16px;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 8px;
  min-height: 220px;
}

.modern-empty svg {
  color: #2563eb;
}

.modern-empty strong {
  color: #0f172a;
}

.modern-empty span {
  color: #64748b;
  font-weight: 700;
}

@media (max-width: 1120px) {
  .manager-grid {
    grid-template-columns: 1fr;
  }

  .chat-list {
    max-height: none;
  }
}

@media (max-width: 640px) {
  .chat-panel-head,
  .chat-user-row {
    flex-direction: column;
  }

  .reply-actions,
  .location-meta {
    grid-template-columns: 1fr;
  }

  .pickup-map-card .map-box,
  .location-card .map-box {
    height: 220px;
  }
}

.manager-login-card button,
.save-btn,
.button-row .save-btn {
  background: #2563eb;
  color: white;
  box-shadow: 0 12px 24px rgba(37, 99, 235, .22);
}

.manager-login-card button:hover,
.save-btn:hover,
.button-row .save-btn:hover {
  background: #1d4ed8;
}

.hero-actions button {
  background: white;
  color: #2563eb;
}

.hero-actions .logout {
  background: #0f172a;
  color: white;
}

.manager-notice.success {
  background: #dcfce7;
  color: #166534;
}

.manager-notice.error {
  background: #fee2e2;
  color: #991b1b;
}

.button-row button {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.button-row button:hover {
  background: #dbeafe;
}

.button-row .close-btn {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #fecaca;
}

.map-link {
  color: #2563eb;
}

.message-status {
  background: #fef3c7;
  color: #92400e;
}

.message-status.replied {
  background: #dbeafe;
  color: #1d4ed8;
}

.message-status.closed {
  background: #dcfce7;
  color: #166534;
}

.map-box {
  border-color: #bfdbfe;
  background: linear-gradient(135deg, #dbeafe, #dcfce7);
}

.map-empty {
  color: #2563eb;
}

.live-badge {
  background: #dcfce7;
  color: #166534;
}

.location-meta span {
  background: #eff6ff;
}

.manager-card input,
.manager-card select,
.manager-card textarea,
.manager-login-card input {
  border-color: #dbe3ef;
}

.manager-card input:focus,
.manager-card select:focus,
.manager-card textarea:focus,
.manager-login-card input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, .12);
}

.manager-card {
  transition: box-shadow .18s ease, transform .18s ease;
}

.manager-card:hover {
  box-shadow: 0 22px 48px rgba(15, 23, 42, .1);
}
`;