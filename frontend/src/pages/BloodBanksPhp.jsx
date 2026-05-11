import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Check,
  ClipboardPlus,
  Droplet,
  FileText,
  Inbox,
  MessageCircle,
  Phone,
  Search,
  Send,
  Siren,
  Users,
  X,
} from "lucide-react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const emptyStats = {
  totalDonors: 0,
  availableDonors: 0,
  activeRequests: 0,
  emergencyRequests: 0,
  nearbyEmergency: [],
};

const emptyProfile = {
  name: "",
  age: "",
  blood_group: "",
  nid_number: "",
  contact: "",
  social_media: "",
  user_type: "both",
  division: "",
  district: "",
  address: "",
  available: true,
  last_donation_date: "",
};

const emptyRequest = {
  patient_name: "",
  blood_group: "",
  contact: "",
  hospital_location: "",
  date_needed: "",
  units_required: 1,
  is_emergency: false,
  additional_notes: "",
};

const emptyComplaint = {
  name: "",
  email: "",
  contact: "",
  description: "",
};

const emptyDirectRequest = {
  patient_name: "",
  contact: "",
  hospital_location: "",
  date_needed: "",
  units_required: 1,
  is_emergency: true,
  additional_notes: "Direct emergency request sent to donor.",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "Not selected";
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

function showDateForInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function ErrorBox({ notice }) {
  if (!notice) return null;
  return <div className={`bb-alert ${notice.type}`}>{notice.message}</div>;
}

export default function BloodBanksPhp() {
  const { user } = useAuth();
  const [view, setView] = useState("dashboard");
  const [locations, setLocations] = useState({});
  const [stats, setStats] = useState(emptyStats);
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [filters, setFilters] = useState({ group: "", division: "", district: "", search: "" });
  const [donors, setDonors] = useState([]);
  const [requestForm, setRequestForm] = useState({ ...emptyRequest, date_needed: today() });
  const [incoming, setIncoming] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [complaintForm, setComplaintForm] = useState(emptyComplaint);
  const [directDonor, setDirectDonor] = useState(null);
  const [directForm, setDirectForm] = useState({ ...emptyDirectRequest, date_needed: today() });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const divisions = Object.keys(locations);
  const selectedDistricts = filters.division ? locations[filters.division] || [] : Object.values(locations).flat().sort();
  const profileDistricts = profileForm.division ? locations[profileForm.division] || [] : [];

  const filteredDonors = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();
    if (!keyword) return donors;
    return donors.filter((donor) =>
      [donor.name, donor.blood_group, donor.contact, donor.phone, donor.email, donor.division, donor.district, donor.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [donors, filters.search]);

  async function safeLoad(task, fallbackMessage) {
    setLoading(true);
    setNotice(null);
    try {
      await task();
    } catch (error) {
      setNotice({ type: "error", message: error.response?.data?.message || fallbackMessage });
    } finally {
      setLoading(false);
    }
  }

  async function loadBase() {
    const [locationResponse, statsResponse] = await Promise.all([
      api.get("/bloodbank/locations"),
      api.get("/bloodbank/stats"),
    ]);
    setLocations(locationResponse.data.data || {});
    setStats(statsResponse.data.data || emptyStats);
  }

  async function loadProfile() {
    if (!user) return;
    const response = await api.get("/bloodbank/profile");
    const data = response.data.data;
    setProfile(data);
    if (data) {
      setProfileForm({
        name: data.name || user.name || "",
        age: data.age || "",
        blood_group: data.blood_group || "",
        nid_number: data.nid_number || "",
        contact: data.contact || data.phone || "",
        social_media: data.social_media || "",
        user_type: data.user_type || "both",
        division: data.division || "",
        district: data.district || "",
        address: data.address || "",
        available: Number(data.available) === 1 || data.available === true,
        last_donation_date: showDateForInput(data.last_donation_date),
      });
      setRequestForm((current) => ({
        ...current,
        patient_name: current.patient_name || data.name || user.name || "",
        contact: current.contact || data.contact || "",
        hospital_location: current.hospital_location || data.address || "",
      }));
      setComplaintForm((current) => ({
        ...current,
        name: current.name || data.name || user.name || "",
        email: current.email || data.email || user.email || "",
        contact: current.contact || data.contact || "",
      }));
    } else {
      setProfileForm((current) => ({ ...current, name: user.name || "" }));
      setComplaintForm((current) => ({ ...current, name: user.name || "", email: user.email || "" }));
    }
  }

  async function loadDonors() {
    const response = await api.get("/bloodbank/donors", { params: filters });
    setDonors(response.data.data || []);
  }

  async function loadIncoming() {
    const [incomingResponse, chatsResponse] = await Promise.all([
      api.get("/bloodbank/requests/incoming"),
      api.get("/bloodbank/requests/chats"),
    ]);
    setIncoming(incomingResponse.data.data || []);
    setChats(chatsResponse.data.data || []);
  }

  async function openChat(requestId) {
    await safeLoad(async () => {
      const response = await api.get(`/bloodbank/requests/${requestId}/chat`);
      setActiveChat(response.data.data);
      setView("chat");
      await loadIncoming();
    }, "Could not open chat.");
  }

  async function refreshCurrentView(nextView = view) {
    await safeLoad(async () => {
      await loadBase();
      if (user) await loadProfile();
      if (nextView === "donors") await loadDonors();
      if (nextView === "incoming") await loadIncoming();
      if (nextView === "chat" && activeChat?.request?.id) await openChat(activeChat.request.id);
    }, "Could not refresh Blood Bank data.");
  }

  useEffect(() => {
    refreshCurrentView("dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (view === "donors") {
      safeLoad(loadDonors, "Could not load donors.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.group, filters.division, filters.district]);

  function go(nextView) {
    setView(nextView);
    if (nextView === "dashboard") refreshCurrentView("dashboard");
    if (nextView === "donors") safeLoad(loadDonors, "Could not load donors.");
    if (nextView === "incoming") safeLoad(loadIncoming, "Could not load requests.");
  }

  function requireSignedIn() {
    if (user) return true;
    setNotice({ type: "error", message: "Please sign in first." });
    return false;
  }

  function updateProfileField(event) {
    const { name, value, type, checked } = event.target;
    setProfileForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "division" ? { district: "" } : {}),
    }));
  }

  function updateRequestField(event) {
    const { name, value, type, checked } = event.target;
    setRequestForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function updateComplaintField(event) {
    const { name, value } = event.target;
    setComplaintForm((current) => ({ ...current, [name]: value }));
  }

  function updateDirectField(event) {
    const { name, value, type, checked } = event.target;
    setDirectForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function submitProfile(event) {
    event.preventDefault();
    if (!requireSignedIn()) return;
    await safeLoad(async () => {
      const response = await api.post("/bloodbank/profile/register", profileForm);
      setNotice({ type: "success", message: response.data.message || "Profile saved." });
      await loadProfile();
      await loadBase();
      setView("dashboard");
    }, "Could not save Blood Bank profile.");
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!requireSignedIn()) return;
    await safeLoad(async () => {
      const response = await api.post("/bloodbank/requests", requestForm);
      setNotice({ type: "success", message: response.data.message || "Blood request submitted." });
      setRequestForm({ ...emptyRequest, date_needed: today() });
      await loadBase();
      await loadIncoming();
      setView("incoming");
    }, "Could not submit request.");
  }

  function startDirectRequest(donor) {
    if (!requireSignedIn()) return;
    setDirectDonor(donor);
    setDirectForm({
      ...emptyDirectRequest,
      patient_name: profile?.name || user?.name || "",
      contact: profile?.contact || "",
      hospital_location: profile?.address || "",
      date_needed: today(),
    });
  }

  async function submitDirectRequest(event) {
    event.preventDefault();
    if (!directDonor) return;
    await safeLoad(async () => {
      const response = await api.post("/bloodbank/requests/direct", {
        ...directForm,
        donor_id: directDonor.id,
      });
      setNotice({ type: "success", message: response.data.message || "Request sent." });
      setDirectDonor(null);
      await loadBase();
    }, "Could not send request to donor.");
  }

  async function requestAction(requestId, action) {
    if (!requireSignedIn()) return;
    await safeLoad(async () => {
      const response = await api.patch(`/bloodbank/requests/${requestId}/${action}`);
      setNotice({ type: "success", message: response.data.message || `Request ${action}ed.` });
      await loadIncoming();
      await loadBase();
      if (action === "accept") await openChat(requestId);
    }, `Could not ${action} request.`);
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    if (!chatMessage.trim() || !activeChat?.request?.id) return;
    await safeLoad(async () => {
      await api.post(`/bloodbank/requests/${activeChat.request.id}/chat`, { message: chatMessage });
      setChatMessage("");
      await openChat(activeChat.request.id);
    }, "Could not send message.");
  }

  async function submitComplaint(event) {
    event.preventDefault();
    if (!requireSignedIn()) return;
    await safeLoad(async () => {
      const response = await api.post("/bloodbank/complaints", complaintForm);
      setNotice({ type: "success", message: response.data.message || "Complaint submitted." });
      setComplaintForm((current) => ({ ...current, description: "" }));
      setView("dashboard");
    }, "Could not submit complaint.");
  }

  return (
    <section className="bb-react-page">
      <style>{styles}</style>
      <div className="bb-wrap">
        <ErrorBox notice={notice} />

        {!user && (
          <div className="bb-card bb-login-note">
            <h2>Blood Bank access requires sign in</h2>
            <p className="bb-small">Sign in to create requests, register as a donor, accept requests, and chat.</p>
            <Link className="bb-btn" to="/signin">Sign In</Link>
          </div>
        )}

        {view === "dashboard" && (
          <>
            <div className="bb-modern-head">
              <div className="bb-modern-head-left">
                <h1>Blood<span>Bank</span> Dashboard</h1>
                <p>Emergency blood donation system</p>
              </div>
              <button className="bb-complaint-btn" type="button" onClick={() => go("complaint")}>Complaint Form</button>
            </div>

            <div className="bb-modern-stats">
              <StatCard color="red" icon={<Droplet />} value={stats.totalDonors} label="Total Donors" />
              <StatCard color="green" icon={<Award />} value={stats.availableDonors} label="Available Donors" />
              <StatCard color="blue" icon={<FileText />} value={stats.activeRequests} label="Active Requests" />
              <StatCard color="purple" icon={<Inbox />} value={stats.emergencyRequests} label="Emergency Requests" />
            </div>

            <div className="bb-modern-actions">
              <ActionCard color="red" icon={<Search />} title="Search Donors" text="Find blood donors in your area" onClick={() => go("donors")} />
              <ActionCard color="blue" icon={<Users />} title="View Donors" text="Browse all available donors" onClick={() => go("donors")} />
              <ActionCard color="green" icon={<ClipboardPlus />} title="Create Request" text="Request blood from donors" onClick={() => go("create")} />
              <ActionCard color="purple" icon={<Inbox />} title="Incoming Requests" text="View requests sent to you" badge={stats.activeRequests ? `${stats.activeRequests} New` : ""} onClick={() => go("incoming")} />
            </div>

            <div className="bb-card bb-profile-strip">
              <div>
                <h3>{profile ? "My Donor Profile" : "Become a Blood Bank Donor"}</h3>
                <p className="bb-small">
                  {profile ? `${profile.name} · ${profile.blood_group} · ${profile.contact}` : "Create your donor profile to receive and accept blood requests."}
                </p>
              </div>
              <button className="bb-btn bb-gray" type="button" onClick={() => go("profile")}>{profile ? "Edit Profile" : "Register Donor"}</button>
            </div>

            <div className="bb-emergency-panel">
              <h2>Emergency Requests Nearby</h2>
              <div className="bb-emergency-list">
                {stats.nearbyEmergency?.length ? (
                  stats.nearbyEmergency.map((request, index) => (
                    <div className={`bb-emergency-item ${index === 0 ? "redish" : "orangeish"}`} key={request.id}>
                      <div className="bb-emergency-info">
                        <h4>{request.patient_name} <span className="bb-group-pill">{request.blood_group}</span> <span className="bb-urgent-pill">URGENT</span></h4>
                        <div className="bb-emergency-meta">
                          <span>{request.hospital_location}</span>
                          <span>{request.contact}</span>
                        </div>
                      </div>
                      <button className="bb-respond-btn" type="button" onClick={() => go("incoming")}>Respond</button>
                    </div>
                  ))
                ) : (
                  <div className="bb-card no-shadow">No emergency requests found right now.</div>
                )}
              </div>
            </div>
          </>
        )}

        {view === "profile" && (
          <div className="bb-card bb-centered-card">
            <BackButton go={go} />
            <h2>Create / Update Donor Profile</h2>
            <p className="bb-small">This replaces the PHP Blood Bank register panel inside your React app.</p>
            <form className="bb-form-grid" onSubmit={submitProfile}>
              <Field label="Full Name *"><input className="bb-input" name="name" value={profileForm.name} onChange={updateProfileField} required /></Field>
              <Field label="Age *"><input className="bb-input" type="number" min="18" max="65" name="age" value={profileForm.age} onChange={updateProfileField} required /></Field>
              <Field label="Blood Group *"><SelectBlood name="blood_group" value={profileForm.blood_group} onChange={updateProfileField} required /></Field>
              <Field label="NID Number *"><input className="bb-input" name="nid_number" value={profileForm.nid_number} onChange={updateProfileField} required /></Field>
              <Field label="Contact *"><input className="bb-input" name="contact" value={profileForm.contact} onChange={updateProfileField} placeholder="017XXXXXXXX" required /></Field>
              <Field label="Social Media"><input className="bb-input" name="social_media" value={profileForm.social_media} onChange={updateProfileField} /></Field>
              <Field label="User Type *"><select className="bb-select" name="user_type" value={profileForm.user_type} onChange={updateProfileField}><option value="both">Donor & Receiver</option><option value="donor">Donor</option><option value="receiver">Receiver</option></select></Field>
              <Field label="Available"><label className="bb-check"><input type="checkbox" name="available" checked={profileForm.available} onChange={updateProfileField} /> Available for donation</label></Field>
              <Field label="Division"><select className="bb-select" name="division" value={profileForm.division} onChange={updateProfileField}><option value="">Select Division</option>{divisions.map((division) => <option key={division} value={division}>{division}</option>)}</select></Field>
              <Field label="District"><select className="bb-select" name="district" value={profileForm.district} onChange={updateProfileField} disabled={!profileForm.division}><option value="">Select District</option>{profileDistricts.map((district) => <option key={district} value={district}>{district}</option>)}</select></Field>
              <Field label="Last Donation Date"><input className="bb-input" type="date" name="last_donation_date" value={profileForm.last_donation_date} onChange={updateProfileField} /></Field>
              <Field label="Address" full><textarea className="bb-textarea" name="address" value={profileForm.address} onChange={updateProfileField} /></Field>
              <div className="bb-field full center"><button className="bb-btn" disabled={loading}>Save Profile</button></div>
            </form>
          </div>
        )}

        {view === "donors" && (
          <>
            <div className="bb-card">
              <BackButton go={go} />
              <h2>Find Blood Donors</h2>
              <p className="bb-small">Filter donors by blood group, division, and district.</p>
              <div className="bb-search-groups">
                <button className={filters.group === "" ? "active" : ""} onClick={() => setFilters((f) => ({ ...f, group: "" }))}>All</button>
                {bloodGroups.map((group) => <button key={group} className={filters.group === group ? "active" : ""} onClick={() => setFilters((f) => ({ ...f, group }))}>{group}</button>)}
              </div>
              <div className="bb-filter-grid">
                <Field label="Division"><select className="bb-select" value={filters.division} onChange={(e) => setFilters((f) => ({ ...f, division: e.target.value, district: "" }))}><option value="">All Divisions</option>{divisions.map((division) => <option key={division} value={division}>{division}</option>)}</select></Field>
                <Field label="District"><select className="bb-select" value={filters.district} onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))}><option value="">All Districts</option>{selectedDistricts.map((district) => <option key={district} value={district}>{district}</option>)}</select></Field>
                <Field label="Search"><input className="bb-input" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Name, contact, area" /></Field>
                <div className="bb-filter-actions"><button className="bb-btn" type="button" onClick={() => safeLoad(loadDonors, "Could not load donors.")}>Filter</button><button className="bb-btn bb-outline-btn" type="button" onClick={() => setFilters({ group: "", division: "", district: "", search: "" })}>Reset</button></div>
              </div>
            </div>

            <div className="bb-filter-summary">Showing {filteredDonors.length} donor{filteredDonors.length === 1 ? "" : "s"}.</div>
            {!filteredDonors.length && <div className="bb-card">No donors found.</div>}
            {filteredDonors.map((donor) => (
              <div className="bb-donor" key={donor.id}>
                <div><h3>{donor.name}</h3><p className="bb-small">{donor.district || "Unknown District"}, {donor.division || "Unknown Division"}</p><p className="bb-small">Contact: {donor.contact || donor.phone}</p></div>
                <div><span className="bb-badge">{donor.blood_group}</span> {donor.available ? <span className="bb-status bb-accepted">Available</span> : <span className="bb-status bb-declined">Unavailable</span>}<p className="bb-small">Donations: {donor.total_donations || 0}</p></div>
                <div><button className="bb-btn" type="button" onClick={() => startDirectRequest(donor)}>Send Request</button></div>
              </div>
            ))}
          </>
        )}

        {view === "create" && (
          <div className="bb-card bb-centered-card">
            <BackButton go={go} />
            <h2 className="bb-red-title">Create Blood Request</h2>
            <p className="bb-small center-text">Fill patient details and submit a request.</p>
            <form className="bb-form-grid" onSubmit={submitRequest}>
              <Field label="Patient Name *"><input className="bb-input" name="patient_name" value={requestForm.patient_name} onChange={updateRequestField} required /></Field>
              <Field label="Blood Group *"><SelectBlood name="blood_group" value={requestForm.blood_group} onChange={updateRequestField} required /></Field>
              <Field label="Contact Number *"><input className="bb-input" name="contact" value={requestForm.contact} onChange={updateRequestField} required /></Field>
              <Field label="Date Needed *"><input className="bb-input" type="date" min={today()} name="date_needed" value={requestForm.date_needed} onChange={updateRequestField} required /></Field>
              <Field label="Units Required *"><input className="bb-input" type="number" min="1" name="units_required" value={requestForm.units_required} onChange={updateRequestField} required /></Field>
              <Field label="Emergency?"><label className="bb-check"><input type="checkbox" name="is_emergency" checked={requestForm.is_emergency} onChange={updateRequestField} /> Mark as emergency request</label></Field>
              <Field label="Hospital Location *" full><textarea className="bb-textarea" name="hospital_location" value={requestForm.hospital_location} onChange={updateRequestField} required /></Field>
              <Field label="Additional Notes" full><textarea className="bb-textarea" name="additional_notes" value={requestForm.additional_notes} onChange={updateRequestField} /></Field>
              <div className="bb-field full center"><button className="bb-btn" disabled={loading}>Submit Blood Request</button></div>
            </form>
          </div>
        )}

        {view === "incoming" && (
          <>
            <div className="bb-card"><BackButton go={go} /><h2>Incoming / Open Blood Requests</h2><p className="bb-small">Accept requests first. After acceptance, built-in chat opens for donor and requester communication.</p></div>
            <div className="bb-card">
              <h2>Pending Requests</h2>
              {!incoming.length && <p className="bb-small">No pending blood requests.</p>}
              {incoming.map((request) => <RequestRow key={request.id} request={request} onAccept={() => requestAction(request.id, "accept")} onDecline={() => requestAction(request.id, "decline")} />)}
            </div>
            <div className="bb-card">
              <h2>Accepted Requests / Chats</h2>
              <p className="bb-small">Open a chat to coordinate donor arrival time, hospital location, patient details, and contact information.</p>
              {!chats.length && <p className="bb-small">No accepted request chats yet.</p>}
              {chats.map((chat) => <ChatRow key={chat.id} chat={chat} profile={profile} onOpen={() => openChat(chat.id)} />)}
            </div>
          </>
        )}

        {view === "chat" && activeChat && (
          <div className="bb-chat-layout">
            <div className="bb-chat-box">
              <div className="bb-chat-head"><div><h2><MessageCircle size={18} /> Chat</h2><p>Request #{activeChat.request.id} · {activeChat.request.blood_group} blood · {activeChat.request.status}</p></div><button className="bb-btn bb-gray" type="button" onClick={() => go("incoming")}>Back</button></div>
              <div className="bb-chat-messages">
                {!activeChat.messages.length && <div className="bb-chat-message"><div className="bb-chat-text">No messages yet. Start the conversation.</div></div>}
                {activeChat.messages.map((message) => {
                  const isMe = Number(message.sender_id) === Number(activeChat.me.id);
                  return <div className={`bb-chat-message ${isMe ? "me" : ""}`} key={message.id}><div className="bb-chat-sender">{isMe ? "You" : message.sender_name || "User"}</div><div className="bb-chat-text">{message.message}</div><div className="bb-chat-time">{formatDate(message.created_at)}</div></div>;
                })}
              </div>
              <form className="bb-chat-form" onSubmit={sendChatMessage}><textarea className="bb-textarea" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="Type your message..." required /><button className="bb-btn"><Send size={16} /> Send</button></form>
            </div>
            <aside className="bb-chat-side-card"><h3>Request Details</h3><InfoRow label="Patient" value={activeChat.request.patient_name} /><InfoRow label="Blood Group" value={activeChat.request.blood_group} /><InfoRow label="Units Required" value={activeChat.request.units_required} /><InfoRow label="Date Needed" value={formatDate(activeChat.request.date_needed)} /><InfoRow label="Hospital Location" value={activeChat.request.hospital_location} /><InfoRow label="Contact" value={activeChat.request.contact} />{activeChat.request.contact && <a className="bb-btn bb-call-btn" href={`tel:${activeChat.request.contact}`}><Phone size={16} /> Call</a>}</aside>
          </div>
        )}

        {view === "complaint" && (
          <div className="bb-card bb-complaint-card">
            <BackButton go={go} />
            <h2 className="bb-red-title">Complaint Form</h2>
            <p className="bb-small center-text">Submit your complaint or feedback.</p>
            <form className="bb-form-grid" onSubmit={submitComplaint}>
              <Field label="Name *" full><input className="bb-input" name="name" value={complaintForm.name} onChange={updateComplaintField} required /></Field>
              <Field label="Email *" full><input className="bb-input" type="email" name="email" value={complaintForm.email} onChange={updateComplaintField} required /></Field>
              <Field label="Contact *" full><input className="bb-input" name="contact" value={complaintForm.contact} onChange={updateComplaintField} required /></Field>
              <Field label="Description *" full><textarea className="bb-textarea" name="description" value={complaintForm.description} onChange={updateComplaintField} required /></Field>
              <div className="bb-field full center"><button className="bb-btn" disabled={loading}>Submit Complaint</button></div>
            </form>
          </div>
        )}

        {directDonor && (
          <div className="bb-modal"><div className="bb-modal-card"><button className="bb-modal-close" onClick={() => setDirectDonor(null)}><X size={18} /></button><h2>Send Request to {directDonor.name}</h2><p className="bb-small">This creates a direct request for {directDonor.blood_group} blood.</p><form className="bb-form-grid" onSubmit={submitDirectRequest}><Field label="Patient Name *"><input className="bb-input" name="patient_name" value={directForm.patient_name} onChange={updateDirectField} required /></Field><Field label="Contact *"><input className="bb-input" name="contact" value={directForm.contact} onChange={updateDirectField} required /></Field><Field label="Date Needed *"><input className="bb-input" type="date" min={today()} name="date_needed" value={directForm.date_needed} onChange={updateDirectField} required /></Field><Field label="Units *"><input className="bb-input" type="number" min="1" name="units_required" value={directForm.units_required} onChange={updateDirectField} required /></Field><Field label="Hospital Location *" full><textarea className="bb-textarea" name="hospital_location" value={directForm.hospital_location} onChange={updateDirectField} required /></Field><Field label="Notes" full><textarea className="bb-textarea" name="additional_notes" value={directForm.additional_notes} onChange={updateDirectField} /></Field><label className="bb-check full"><input type="checkbox" name="is_emergency" checked={directForm.is_emergency} onChange={updateDirectField} /> Mark as emergency</label><div className="bb-field full center"><button className="bb-btn" disabled={loading}>Send Request</button></div></form></div></div>
        )}
      </div>
    </section>
  );
}

function StatCard({ color, icon, value, label }) {
  return <div className={`bb-modern-stat ${color}`}><div className="bb-modern-stat-icon">{icon}</div><div className="bb-modern-stat-text"><div className="bb-modern-stat-value">{value}</div><div className="bb-modern-stat-label">{label}</div></div></div>;
}

function ActionCard({ color, icon, title, text, badge, onClick }) {
  return <button className={`bb-modern-action ${color}`} type="button" onClick={onClick}><div className="bb-modern-action-left"><div className="bb-modern-action-icon">{icon}</div><div><h3>{title}</h3><p>{text}</p></div></div>{badge && <span className="bb-modern-badge">{badge}</span>}</button>;
}

function Field({ label, children, full }) {
  return <div className={`bb-field ${full ? "full" : ""}`}><label>{label}</label>{children}</div>;
}

function SelectBlood(props) {
  return <select className="bb-select" {...props}><option value="">Select Blood Group</option>{bloodGroups.map((group) => <option key={group} value={group}>{group}</option>)}</select>;
}

function BackButton({ go }) {
  return <button className="bb-back" type="button" onClick={() => go("dashboard")}>← Back to Dashboard</button>;
}

function InfoRow({ label, value }) {
  return <div className="bb-chat-info-row"><strong>{label}</strong>{value || "Not provided"}</div>;
}

function RequestRow({ request, onAccept, onDecline }) {
  return <div className="bb-donor"><div><h3>{request.patient_name}</h3><p className="bb-small">Requester: {request.requester_name || "Unknown"}</p><p className="bb-small">Hospital: {request.hospital_location}</p><p className="bb-small">Contact: {request.contact}</p><p className="bb-small">Needed: {formatDate(request.date_needed)}</p></div><div><span className="bb-badge">{request.blood_group}</span> {request.is_emergency ? <span className="bb-status bb-declined">Emergency</span> : <span className="bb-status bb-pending">Normal</span>}<p className="bb-small">Units: {request.units_required}</p></div><div className="bb-inline-actions"><button className="bb-btn bb-green" onClick={onAccept}><Check size={15} /> Accept & Chat</button><button className="bb-btn bb-gray" onClick={onDecline}>Decline</button></div></div>;
}

function ChatRow({ chat, profile, onOpen }) {
  const isRequester = profile && Number(chat.requester_id) === Number(profile.id);
  const otherPerson = isRequester ? chat.donor_name || "Donor" : chat.requester_name || "Requester";
  return <div className="bb-donor"><div><h3>{chat.patient_name}</h3><p className="bb-small">Chat with: <strong>{otherPerson}</strong></p><p className="bb-small">Hospital: {chat.hospital_location}</p><p className="bb-small">Needed: {formatDate(chat.date_needed)}</p>{chat.last_message && <p className="bb-small">Last message: {String(chat.last_message).slice(0, 80)}</p>}</div><div><span className="bb-badge">{chat.blood_group}</span> <span className="bb-status bb-accepted">Accepted</span>{Number(chat.unread_count) > 0 && <p className="bb-small bb-unread">{chat.unread_count} new message{Number(chat.unread_count) === 1 ? "" : "s"}</p>}</div><div><button className="bb-btn" onClick={onOpen}><MessageCircle size={16} /> Open Chat</button></div></div>;
}

const styles = `
.bb-react-page{min-height:100%;background:#f4f6f8;color:#0f172a}.bb-wrap{max-width:1200px;margin:0 auto;padding:28px 16px 70px}.bb-card{background:#fff;border-radius:16px;box-shadow:0 15px 35px rgba(15,23,42,.08);padding:26px;margin-bottom:22px}.bb-login-note{display:flex;justify-content:space-between;align-items:center;gap:16px}.bb-small{font-size:13px;color:#475569}.bb-btn{border:none;border-radius:10px;padding:13px 18px;font-weight:800;cursor:pointer;background:#e91b2f;color:#fff;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}.bb-btn:disabled{opacity:.6;cursor:not-allowed}.bb-yellow{background:#f5b400}.bb-gray{background:#64748b}.bb-green{background:#16a34a}.bb-outline-btn{background:#fff;color:#e91b2f;border:1px solid #e91b2f}.bb-alert{border-radius:12px;padding:13px 16px;margin-bottom:18px;font-weight:800}.bb-alert.success{background:#dcfce7;color:#166534}.bb-alert.error{background:#fee2e2;color:#991b1b}.bb-modern-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:26px}.bb-modern-head-left h1{margin:0;font-size:2rem;font-weight:800;color:#0f172a;line-height:1.1}.bb-modern-head-left h1 span{color:#e91b2f}.bb-modern-head-left p{margin:6px 0 0;color:#475569;font-size:14px}.bb-complaint-btn{background:#e91b2f;color:#fff;border:none;border-radius:8px;padding:13px 18px;font-weight:900;box-shadow:0 14px 24px rgba(233,27,47,.22);cursor:pointer}.bb-modern-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:22px}.bb-modern-stat{background:#fff;border-radius:16px;padding:20px 18px;box-shadow:0 8px 24px rgba(15,23,42,.08);display:flex;justify-content:space-between;align-items:flex-start;min-height:96px;position:relative;overflow:hidden}.bb-modern-stat:before{content:"";position:absolute;left:0;top:0;width:4px;height:100%;border-radius:10px}.bb-modern-stat.red:before{background:#ef4444}.bb-modern-stat.green:before{background:#22c55e}.bb-modern-stat.blue:before{background:#3b82f6}.bb-modern-stat.purple:before{background:#a855f7}.bb-modern-stat-icon{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center}.bb-modern-stat.red .bb-modern-stat-icon{background:#fee2e2;color:#ef4444}.bb-modern-stat.green .bb-modern-stat-icon{background:#dcfce7;color:#22c55e}.bb-modern-stat.blue .bb-modern-stat-icon{background:#dbeafe;color:#3b82f6}.bb-modern-stat.purple .bb-modern-stat-icon{background:#f3e8ff;color:#a855f7}.bb-modern-stat-text{flex:1;margin-left:14px}.bb-modern-stat-value{font-size:2rem;font-weight:800;color:#0f172a;line-height:1;text-align:right}.bb-modern-stat-label{margin-top:8px;font-size:13px;color:#475569}.bb-modern-actions{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:22px}.bb-modern-action{border:none;text-align:left;background:#fff;border-radius:16px;padding:20px;text-decoration:none;color:#0f172a;box-shadow:0 8px 24px rgba(15,23,42,.08);display:flex;align-items:center;justify-content:space-between;gap:16px;transition:.2s ease;cursor:pointer}.bb-modern-action:hover{transform:translateY(-2px)}.bb-modern-action-left{display:flex;align-items:center;gap:14px}.bb-modern-action-icon{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center}.bb-modern-action.red .bb-modern-action-icon{background:#fee2e2;color:#ef4444}.bb-modern-action.blue .bb-modern-action-icon{background:#dbeafe;color:#3b82f6}.bb-modern-action.green .bb-modern-action-icon{background:#dcfce7;color:#22c55e}.bb-modern-action.purple .bb-modern-action-icon{background:#f3e8ff;color:#a855f7}.bb-modern-action h3{margin:0 0 5px;font-size:1.2rem;font-weight:800;color:#0f172a}.bb-modern-action p{margin:0;font-size:13px;color:#475569}.bb-modern-badge{background:#ef233c;color:#fff;font-size:11px;font-weight:800;padding:5px 9px;border-radius:999px}.bb-profile-strip{display:flex;align-items:center;justify-content:space-between;gap:16px}.bb-emergency-panel{background:#fff;border-radius:16px;box-shadow:0 15px 35px rgba(15,23,42,.08);padding:26px}.bb-emergency-panel h2{margin:0 0 18px}.bb-emergency-list{display:grid;gap:12px}.bb-emergency-item{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px;border-radius:14px;border:1px solid #fee2e2;background:#fff7f7}.bb-emergency-item.orangeish{background:#fff7ed;border-color:#fed7aa}.bb-emergency-info h4{margin:0 0 8px}.bb-emergency-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#475569}.bb-group-pill,.bb-badge{display:inline-flex;align-items:center;justify-content:center;background:#e91b2f;color:#fff;border-radius:999px;padding:5px 9px;font-weight:900;font-size:12px}.bb-urgent-pill{background:#991b1b;color:#fff;border-radius:999px;padding:5px 9px;font-weight:900;font-size:11px}.bb-respond-btn{background:#e91b2f;color:#fff;border:none;border-radius:10px;padding:10px 14px;font-weight:900;cursor:pointer}.bb-field{display:flex;flex-direction:column;gap:7px}.bb-field label{font-size:13px;font-weight:800;color:#334155}.bb-field.full{grid-column:1/-1}.bb-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.bb-input,.bb-select,.bb-textarea{width:100%;border:1px solid #d9e1ea;border-radius:10px;padding:12px 13px;font:inherit;background:#fff;color:#0f172a}.bb-textarea{min-height:92px;resize:vertical}.bb-check{display:flex!important;align-items:center;gap:8px;margin-top:12px}.bb-centered-card{max-width:900px;margin-left:auto;margin-right:auto}.bb-complaint-card{max-width:760px;margin-left:auto;margin-right:auto}.bb-red-title{text-align:center;color:#e91b2f}.center-text{text-align:center}.center{align-items:center}.bb-back{border:none;background:transparent;color:#e91b2f;font-weight:900;margin-bottom:14px;cursor:pointer}.bb-search-groups{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.bb-search-groups button{border:1px solid #fecaca;background:#fff;color:#e91b2f;border-radius:999px;padding:8px 13px;font-weight:900;cursor:pointer}.bb-search-groups button.active{background:#e91b2f;color:#fff}.bb-filter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:12px;align-items:end}.bb-filter-actions{display:flex;gap:8px}.bb-filter-summary{margin:12px 0;color:#64748b;font-size:13px;font-weight:700}.bb-donor{display:grid;grid-template-columns:1.3fr 1fr auto;gap:18px;align-items:center;background:#fff;border-radius:13px;padding:20px;box-shadow:0 5px 14px rgba(2,6,23,.10);margin-bottom:18px}.bb-donor h3{margin:0 0 6px}.bb-status{display:inline-flex;margin-left:6px;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:900}.bb-accepted{background:#dcfce7;color:#166534}.bb-declined{background:#fee2e2;color:#991b1b}.bb-pending{background:#fef3c7;color:#92400e}.bb-inline-actions{display:flex;gap:8px;flex-wrap:wrap}.bb-unread{color:#e91b2f!important;font-weight:900!important}.bb-chat-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start}.bb-chat-box,.bb-chat-side-card{background:#fff;border-radius:16px;box-shadow:0 15px 35px rgba(15,23,42,.08);overflow:hidden;border:1px solid #e5e7eb}.bb-chat-head{padding:18px 20px;background:linear-gradient(135deg,#e91b2f,#b91c1c);color:#fff;display:flex;justify-content:space-between;gap:14px;align-items:center}.bb-chat-head h2{display:flex;align-items:center;gap:8px;margin:0;font-size:1.15rem}.bb-chat-head p{margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px}.bb-chat-messages{height:470px;overflow-y:auto;padding:18px;background:#f8fafc;display:flex;flex-direction:column;gap:10px}.bb-chat-message{max-width:76%;padding:11px 13px;border-radius:14px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 4px 12px rgba(15,23,42,.05)}.bb-chat-message.me{align-self:flex-end;background:#e91b2f;color:#fff;border-color:#e91b2f}.bb-chat-sender{font-size:12px;font-weight:900;margin-bottom:5px;opacity:.86}.bb-chat-text{white-space:pre-wrap;line-height:1.45;font-size:14px}.bb-chat-time{margin-top:6px;font-size:11px;opacity:.72;text-align:right}.bb-chat-form{padding:14px;display:grid;grid-template-columns:1fr auto;gap:10px;background:#fff;border-top:1px solid #e5e7eb}.bb-chat-side-card{padding:20px}.bb-chat-info-row{margin-bottom:10px;font-size:13px;color:#475569}.bb-chat-info-row strong{display:block;color:#0f172a;margin-bottom:2px}.bb-call-btn{width:100%;margin-top:10px;background:#16a34a}.bb-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:4000;display:flex;align-items:center;justify-content:center;padding:18px}.bb-modal-card{position:relative;max-width:760px;width:100%;background:#fff;border-radius:18px;padding:24px;max-height:92vh;overflow-y:auto}.bb-modal-close{position:absolute;top:12px;right:12px;border:none;background:#fee2e2;color:#991b1b;border-radius:999px;width:34px;height:34px;display:grid;place-items:center;cursor:pointer}.no-shadow{box-shadow:none;padding:16px;margin:0}@media(max-width:900px){.bb-modern-stats{grid-template-columns:repeat(2,1fr)}.bb-modern-actions,.bb-form-grid,.bb-donor,.bb-filter-grid,.bb-chat-layout{grid-template-columns:1fr}.bb-modern-head,.bb-profile-strip,.bb-login-note{flex-direction:column;align-items:flex-start}.bb-emergency-item{flex-direction:column;align-items:flex-start}.bb-chat-form{grid-template-columns:1fr}}@media(max-width:600px){.bb-modern-stats{grid-template-columns:1fr}.bb-modern-stat{flex-direction:column;gap:10px}.bb-modern-stat-text{margin-left:0;width:100%}.bb-modern-stat-value{text-align:left}.bb-modern-action{align-items:flex-start}.bb-chat-message{max-width:90%}}
`;
