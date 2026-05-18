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

export default function AmbulanceManagerDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem("ambulance_manager_token") || "");
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
        Authorization: `Bearer ${localStorage.getItem("ambulance_manager_token") || token}`,
      },
    };
  }

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
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
        message: error.response?.data?.message || "Invalid ambulance manager login.",
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
  }

  async function loadDashboard() {
    setLoading(true);

    try {
      const [meResponse, messagesResponse] = await Promise.all([
        api.get("/ambulance/manager/me", managerConfig()),
        api.get("/ambulance/manager/messages", managerConfig()),
      ]);

      setManager(meResponse.data.data.manager);
      setService({
        ...initialService,
        ...meResponse.data.data.service,
      });

      setLocationForm({
        latitude:
          meResponse.data.data.service?.current_latitude ||
          meResponse.data.data.service?.latitude ||
          "",
        longitude:
          meResponse.data.data.service?.current_longitude ||
          meResponse.data.data.service?.longitude ||
          "",
        note: meResponse.data.data.service?.current_location_note || "",
      });

      setMessages(messagesResponse.data.data || []);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load manager dashboard.",
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
        message: error.response?.data?.message || "Could not update ambulance information.",
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
        message: error.response?.data?.message || "Could not update location.",
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
        message: error.response?.data?.message || "Could not update message.",
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

          {notice && <div className={`manager-notice ${notice.type}`}>{notice.message}</div>}

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
            <button onClick={loadDashboard}>
              <RefreshCcw size={16} />
              Refresh
            </button>

            <button className="logout" onClick={logout}>
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>

        {notice && <div className={`manager-notice ${notice.type}`}>{notice.message}</div>}

        <div className="manager-stats">
          <Stat icon={<Ambulance />} label="Service" value={service.service_name || "N/A"} />
          <Stat icon={<Truck />} label="Type" value={service.service_type || "N/A"} />
          <Stat icon={<Clock />} label="Availability" value={service.availability || "N/A"} />
          <Stat icon={<MessageCircle />} label="Messages" value={messages.length} />
        </div>

        <div className="manager-grid">
          <form className="manager-card service-form" onSubmit={saveService}>
            <h2>Ambulance Information</h2>

            <label>
              Service Name
              <input name="service_name" value={service.service_name || ""} onChange={updateServiceField} required />
            </label>

            <div className="two">
              <label>
                Service Type
                <select name="service_type" value={service.service_type || "advanced"} onChange={updateServiceField}>
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label>
                Availability
                <select name="availability" value={service.availability || "24/7"} onChange={updateServiceField}>
                  {availabilityTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="two">
              <label>
                Division
                <input name="division" value={service.division || ""} onChange={updateServiceField} required />
              </label>

              <label>
                District
                <input name="district" value={service.district || ""} onChange={updateServiceField} required />
              </label>
            </div>

            <label>
              Area
              <input name="area" value={service.area || ""} onChange={updateServiceField} />
            </label>

            <label>
              Address
              <textarea name="address" value={service.address || ""} onChange={updateServiceField} />
            </label>

            <div className="two">
              <label>
                Primary Phone
                <input name="phone_primary" value={service.phone_primary || ""} onChange={updateServiceField} required />
              </label>

              <label>
                Secondary Phone
                <input name="phone_secondary" value={service.phone_secondary || ""} onChange={updateServiceField} />
              </label>
            </div>

            <div className="two">
              <label>
                Base Charge
                <input name="base_charge" value={service.base_charge || ""} onChange={updateServiceField} />
              </label>

              <label>
                Price Per KM
                <input name="price_per_km" value={service.price_per_km || ""} onChange={updateServiceField} />
              </label>
            </div>

            <label>
              Equipment
              <textarea name="equipment" value={service.equipment || ""} onChange={updateServiceField} />
            </label>

            <label>
              Description
              <textarea name="description" value={service.description || ""} onChange={updateServiceField} />
            </label>

            <button className="save-btn" disabled={loading}>
              <Save size={17} />
              Save Ambulance Info
            </button>
          </form>

          <div>
            <form className="manager-card location-card" onSubmit={saveCurrentLocation}>
              <h2>Current Ambulance Location</h2>

              <div className="two">
                <label>
                  Latitude
                  <input name="latitude" value={locationForm.latitude} onChange={updateLocationField} required />
                </label>

                <label>
                  Longitude
                  <input name="longitude" value={locationForm.longitude} onChange={updateLocationField} required />
                </label>
              </div>

              <label>
                Location Note
                <textarea
                  name="note"
                  value={locationForm.note}
                  onChange={updateLocationField}
                  placeholder="Example: Waiting near hospital gate / on the way..."
                />
              </label>

              <div className="button-row">
                <button type="button" onClick={useCurrentAmbulanceLocation}>
                  <MapPin size={16} />
                  Use Current GPS
                </button>

                <button className="save-btn" disabled={loading}>
                  <Save size={16} />
                  Share Location
                </button>
              </div>

              {service.current_latitude && service.current_longitude && (
                <a
                  className="map-link"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps?q=${service.current_latitude},${service.current_longitude}`}
                >
                  Open Current Ambulance Location
                </a>
              )}
            </form>

            <div className="manager-card">
              <h2>User Locations / Messages</h2>

              {messages.length === 0 ? (
                <div className="empty-msg">No user location or message yet.</div>
              ) : (
                <div className="message-list">
                  {messages.map((message) => (
                    <article className="message-item" key={message.id}>
                      <div className="message-head">
                        <div>
                          <h3>{message.sender_name}</h3>
                          <p>{message.sender_phone}</p>
                        </div>

                        <span className={`message-status ${message.status}`}>
                          {message.status}
                        </span>
                      </div>

                      <p>{message.message}</p>

                      {message.user_latitude && message.user_longitude && (
                        <a
                          className="map-link"
                          href={`https://www.google.com/maps?q=${message.user_latitude},${message.user_longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin size={15} />
                          Open User Shared Location
                        </a>
                      )}

                      <small>{formatDate(message.created_at)}</small>

                      <textarea
                        value={replyDrafts[message.id] || message.manager_reply || ""}
                        onChange={(event) => updateReply(message.id, event.target.value)}
                        placeholder="Reply / internal note..."
                      />

                      <div className="button-row">
                        <button onClick={() => updateMessageStatus(message.id, "replied")}>
                          <CheckCircle size={15} />
                          Mark Replied
                        </button>

                        <button className="close-btn" onClick={() => updateMessageStatus(message.id, "closed")}>
                          <XCircle size={15} />
                          Close
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
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
`;