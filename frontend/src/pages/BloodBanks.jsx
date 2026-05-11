import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  ClipboardPlus,
  Droplet,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  UserPlus,
} from "lucide-react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const initialFilters = {
  search: "",
  blood_group: "",
  division: "",
  district: "",
};

const initialDonorForm = {
  name: "",
  age: "",
  blood_group: "",
  phone: "",
  email: "",
  division: "",
  district: "",
  address: "",
  last_donation_date: "",
};

const initialRequestForm = {
  patient_name: "",
  blood_group: "",
  contact: "",
  hospital_location: "",
  division: "",
  district: "",
  date_needed: "",
  units_required: 1,
  is_emergency: false,
  additional_notes: "",
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(value) {
  if (!value) return "Not provided";

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

function makeParams(filters) {
  const params = {};

  if (filters.blood_group) params.blood_group = filters.blood_group;
  if (filters.division) params.division = filters.division;
  if (filters.district) params.district = filters.district;

  return params;
}

export default function BloodBanks() {
  const { user } = useAuth();

  const [locations, setLocations] = useState({});
  const [filters, setFilters] = useState(initialFilters);
  const [donors, setDonors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [donorForm, setDonorForm] = useState(initialDonorForm);
  const [requestForm, setRequestForm] = useState({
    ...initialRequestForm,
    date_needed: today(),
  });

  const [loading, setLoading] = useState(true);
  const [donorSubmitting, setDonorSubmitting] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const divisions = Object.keys(locations);
  const filterDistricts = filters.division ? locations[filters.division] || [] : [];
  const donorDistricts = donorForm.division ? locations[donorForm.division] || [] : [];
  const requestDistricts = requestForm.division ? locations[requestForm.division] || [] : [];

  const filteredDonors = useMemo(() => {
    const keyword = filters.search.trim().toLowerCase();

    if (!keyword) return donors;

    return donors.filter((donor) => {
      const searchable = [
        donor.name,
        donor.blood_group,
        donor.phone,
        donor.email,
        donor.division,
        donor.district,
        donor.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [donors, filters.search]);

  const emergencyCount = requests.filter((request) => request.is_emergency).length;

  async function loadBloodBankData(nextFilters = filters) {
    setLoading(true);
    setNotice(null);

    try {
      const params = makeParams(nextFilters);

      const [locationsResponse, donorsResponse, requestsResponse] = await Promise.all([
        api.get("/bloodbank/locations"),
        api.get("/bloodbank/donors", { params }),
        api.get("/bloodbank/requests/open", { params }),
      ]);

      setLocations(locationsResponse.data.data || {});
      setDonors(donorsResponse.data.data || []);
      setRequests(requestsResponse.data.data || []);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error.response?.data?.message ||
          "Could not load Blood Bank data. Please check backend and database tables.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBloodBankData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBloodBankData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.blood_group, filters.division, filters.district]);

  function updateFilters(event) {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === "division" ? { district: "" } : {}),
    }));
  }

  function updateDonorForm(event) {
    const { name, value } = event.target;

    setDonorForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "division" ? { district: "" } : {}),
    }));
  }

  function updateRequestForm(event) {
    const { name, value, type, checked } = event.target;

    setRequestForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "division" ? { district: "" } : {}),
    }));
  }

  function resetFilters() {
    setFilters(initialFilters);
  }

  async function handleDonorSubmit(event) {
    event.preventDefault();

    if (!user) {
      setNotice({
        type: "error",
        message: "Please sign in before registering as a donor.",
      });
      return;
    }

    setDonorSubmitting(true);
    setNotice(null);

    try {
      const payload = {
        ...donorForm,
        age: Number(donorForm.age),
        last_donation_date: donorForm.last_donation_date || null,
      };

      const response = await api.post("/bloodbank/donors", payload);

      setNotice({
        type: "success",
        message: response.data.message || "Donor registered successfully.",
      });

      setDonorForm(initialDonorForm);
      loadBloodBankData(filters);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not register donor.",
      });
    } finally {
      setDonorSubmitting(false);
    }
  }

  async function handleRequestSubmit(event) {
    event.preventDefault();

    if (!user) {
      setNotice({
        type: "error",
        message: "Please sign in before creating a blood request.",
      });
      return;
    }

    setRequestSubmitting(true);
    setNotice(null);

    try {
      const payload = {
        ...requestForm,
        units_required: Math.max(1, Number(requestForm.units_required) || 1),
      };

      const response = await api.post("/bloodbank/requests", payload);

      setNotice({
        type: "success",
        message: response.data.message || "Blood request created successfully.",
      });

      setRequestForm({ ...initialRequestForm, date_needed: today() });
      loadBloodBankData(filters);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not create blood request.",
      });
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function acceptRequest(requestId) {
    if (!user) {
      setNotice({
        type: "error",
        message: "Please sign in before accepting a request.",
      });
      return;
    }

    setAcceptingId(requestId);
    setNotice(null);

    try {
      const response = await api.patch(`/bloodbank/requests/${requestId}/accept`);

      setNotice({
        type: "success",
        message: response.data.message || "Blood request accepted successfully.",
      });

      loadBloodBankData(filters);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not accept request.",
      });
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <section className="blood-page">
      <style>{`
        .blood-page {
          min-height: 100%;
          background: #fff7f7;
          padding: 28px 16px 46px;
        }

        .blood-shell {
          width: 100%;
          max-width: 1220px;
          margin: 0 auto;
        }

        .blood-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(260px, .6fr);
          gap: 18px;
          margin-bottom: 18px;
        }

        .blood-hero-main,
        .blood-hero-side,
        .blood-panel,
        .blood-card,
        .request-card {
          background: #ffffff;
          border: 1px solid #fee2e2;
          border-radius: 24px;
          box-shadow: 0 18px 42px rgba(127, 29, 29, .08);
        }

        .blood-hero-main {
          position: relative;
          overflow: hidden;
          padding: clamp(24px, 4vw, 38px);
          color: #ffffff;
          background: linear-gradient(135deg, #b91c1c 0%, #ef4444 58%, #fb7185 100%);
        }

        .blood-hero-main::after {
          content: "";
          position: absolute;
          right: -80px;
          bottom: -110px;
          width: 280px;
          height: 280px;
          border-radius: 999px;
          background: rgba(255, 255, 255, .14);
        }

        .blood-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(255,255,255,.16);
          border: 1px solid rgba(255,255,255,.22);
          font-weight: 800;
          font-size: .86rem;
          margin-bottom: 16px;
        }

        .blood-hero h2 {
          position: relative;
          z-index: 1;
          margin: 0;
          font-size: clamp(2rem, 5vw, 3.5rem);
          line-height: 1.02;
          letter-spacing: -.05em;
        }

        .blood-hero p {
          position: relative;
          z-index: 1;
          max-width: 680px;
          margin: 14px 0 0;
          color: #ffe4e6;
          font-size: 1rem;
        }

        .blood-hero-side {
          padding: 22px;
          display: grid;
          gap: 12px;
        }

        .blood-stat {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          background: #fff1f2;
          color: #7f1d1d;
        }

        .blood-stat-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: #ffffff;
          color: #dc2626;
          box-shadow: 0 8px 18px rgba(220,38,38,.14);
          flex: 0 0 auto;
        }

        .blood-stat strong {
          display: block;
          font-size: 1.35rem;
          line-height: 1;
        }

        .blood-stat span {
          display: block;
          color: #991b1b;
          font-size: .82rem;
          margin-top: 4px;
        }

        .blood-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(330px, .48fr);
          gap: 18px;
          align-items: start;
        }

        .blood-panel {
          padding: 20px;
          margin-bottom: 18px;
        }

        .blood-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }

        .blood-panel-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .blood-panel-title h3 {
          margin: 0;
          color: #111827;
          font-size: 1.25rem;
        }

        .blood-panel-title p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: .9rem;
        }

        .blood-title-icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: #dc2626;
          background: #fee2e2;
          flex: 0 0 auto;
        }

        .blood-notice {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border-radius: 16px;
          padding: 13px 15px;
          margin-bottom: 18px;
          font-weight: 700;
        }

        .blood-notice.success {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .blood-notice.error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .blood-filters {
          display: grid;
          grid-template-columns: minmax(220px, 1.2fr) repeat(3, minmax(140px, 1fr)) auto;
          gap: 12px;
          align-items: end;
        }

        .blood-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #334155;
          font-weight: 800;
          font-size: .86rem;
        }

        .blood-input-wrap {
          position: relative;
        }

        .blood-input-wrap svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .blood-field input,
        .blood-field select,
        .blood-field textarea {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 11px 12px;
          background: #ffffff;
          color: #0f172a;
          outline: none;
          font: inherit;
          font-weight: 600;
        }

        .blood-input-wrap input {
          padding-left: 40px;
        }

        .blood-field textarea {
          min-height: 88px;
          resize: vertical;
        }

        .blood-field input:focus,
        .blood-field select:focus,
        .blood-field textarea:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, .12);
        }

        .blood-button {
          border: none;
          border-radius: 14px;
          padding: 11px 15px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .blood-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .blood-button:disabled {
          cursor: not-allowed;
          opacity: .65;
        }

        .blood-button.primary {
          background: #dc2626;
          color: #ffffff;
          box-shadow: 0 12px 24px rgba(220, 38, 38, .22);
        }

        .blood-button.primary:hover:not(:disabled) {
          background: #b91c1c;
        }

        .blood-button.secondary {
          color: #b91c1c;
          background: #fee2e2;
        }

        .blood-button.ghost {
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .blood-cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .blood-card,
        .request-card {
          padding: 18px;
        }

        .blood-card-top,
        .request-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }

        .blood-card h4,
        .request-card h4 {
          margin: 0 0 5px;
          color: #111827;
          font-size: 1.05rem;
        }

        .blood-muted {
          color: #64748b;
          font-size: .88rem;
        }

        .blood-group-pill {
          min-width: 50px;
          text-align: center;
          border-radius: 16px;
          padding: 9px 10px;
          color: #ffffff;
          background: linear-gradient(135deg, #dc2626, #fb7185);
          font-weight: 950;
          box-shadow: 0 10px 20px rgba(220, 38, 38, .22);
        }

        .blood-card-info,
        .request-info {
          display: grid;
          gap: 9px;
        }

        .blood-info-row {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-size: .9rem;
        }

        .blood-info-row svg {
          color: #ef4444;
          flex: 0 0 auto;
        }

        .blood-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .blood-form-grid .full {
          grid-column: 1 / -1;
        }

        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 12px;
          border-radius: 14px;
          background: #fff1f2;
          color: #991b1b;
          font-weight: 900;
        }

        .checkbox-row input {
          width: auto;
          box-shadow: none;
        }

        .request-list {
          display: grid;
          gap: 14px;
        }

        .request-card.emergency {
          border-color: #fecaca;
          background: linear-gradient(180deg, #fff 0%, #fff7f7 100%);
        }

        .request-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .request-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 9px;
          font-size: .76rem;
          font-weight: 900;
        }

        .request-badge.emergency {
          background: #fee2e2;
          color: #b91c1c;
        }

        .request-badge.normal {
          background: #e0f2fe;
          color: #0369a1;
        }

        .request-actions {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
        }

        .blood-empty {
          border: 1px dashed #fecaca;
          border-radius: 20px;
          padding: 30px 18px;
          text-align: center;
          color: #64748b;
          background: #fffafa;
        }

        .blood-empty svg {
          color: #ef4444;
          margin-bottom: 10px;
        }

        .blood-empty strong {
          display: block;
          color: #111827;
          margin-bottom: 4px;
          font-size: 1.05rem;
        }

        .auth-hint {
          margin-bottom: 14px;
          border-radius: 16px;
          padding: 12px 14px;
          background: #fffbeb;
          color: #92400e;
          border: 1px solid #fde68a;
          font-weight: 800;
          font-size: .88rem;
        }

        @media (max-width: 980px) {
          .blood-hero,
          .blood-grid {
            grid-template-columns: 1fr;
          }

          .blood-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .blood-page {
            padding: 18px 12px 34px;
          }

          .blood-cards,
          .blood-form-grid,
          .blood-filters {
            grid-template-columns: 1fr;
          }

          .blood-panel-header,
          .blood-card-top,
          .request-card-top {
            flex-direction: column;
          }

          .request-badges,
          .request-actions {
            justify-content: flex-start;
          }
        }
      `}</style>

      <div className="blood-shell">
        <div className="blood-hero">
          <div className="blood-hero-main">
            <div className="blood-kicker">
              <Droplet size={17} />
              Blood Bank Network
            </div>
            <h2>Find donors and handle urgent blood requests faster.</h2>
            <p>
              Search available donors by blood group, division, and district.
              Create a request when a patient needs blood and let registered
              donors accept it.
            </p>
          </div>

          <aside className="blood-hero-side">
            <div className="blood-stat">
              <span className="blood-stat-icon">
                <Droplet size={20} />
              </span>
              <div>
                <strong>{donors.length}</strong>
                <span>available donors loaded</span>
              </div>
            </div>

            <div className="blood-stat">
              <span className="blood-stat-icon">
                <ClipboardPlus size={20} />
              </span>
              <div>
                <strong>{requests.length}</strong>
                <span>open blood requests</span>
              </div>
            </div>

            <div className="blood-stat">
              <span className="blood-stat-icon">
                <AlertTriangle size={20} />
              </span>
              <div>
                <strong>{emergencyCount}</strong>
                <span>emergency requests</span>
              </div>
            </div>
          </aside>
        </div>

        {notice && (
          <div className={`blood-notice ${notice.type}`}>
            {notice.type === "success" ? (
              <CheckCircle size={18} />
            ) : (
              <AlertTriangle size={18} />
            )}
            <span>{notice.message}</span>
          </div>
        )}

        <div className="blood-panel">
          <div className="blood-panel-header">
            <div className="blood-panel-title">
              <span className="blood-title-icon">
                <Search size={20} />
              </span>
              <div>
                <h3>Search Blood Donors</h3>
                <p>Use filters to narrow down donor and request results.</p>
              </div>
            </div>

            <button
              className="blood-button ghost"
              type="button"
              onClick={() => loadBloodBankData(filters)}
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>

          <div className="blood-filters">
            <label className="blood-field">
              Search donor
              <span className="blood-input-wrap">
                <Search size={17} />
                <input
                  type="search"
                  name="search"
                  value={filters.search}
                  onChange={updateFilters}
                  placeholder="Name, phone, area..."
                />
              </span>
            </label>

            <label className="blood-field">
              Blood Group
              <select
                name="blood_group"
                value={filters.blood_group}
                onChange={updateFilters}
              >
                <option value="">All groups</option>
                {bloodGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>

            <label className="blood-field">
              Division
              <select
                name="division"
                value={filters.division}
                onChange={updateFilters}
              >
                <option value="">All divisions</option>
                {divisions.map((division) => (
                  <option key={division} value={division}>
                    {division}
                  </option>
                ))}
              </select>
            </label>

            <label className="blood-field">
              District
              <select
                name="district"
                value={filters.district}
                onChange={updateFilters}
                disabled={!filters.division}
              >
                <option value="">All districts</option>
                {filterDistricts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="blood-button secondary"
              type="button"
              onClick={resetFilters}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="blood-grid">
          <div>
            <div className="blood-panel">
              <div className="blood-panel-header">
                <div className="blood-panel-title">
                  <span className="blood-title-icon">
                    <Droplet size={20} />
                  </span>
                  <div>
                    <h3>Available Donors</h3>
                    <p>{filteredDonors.length} donor(s) match your search.</p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="blood-empty">
                  <RefreshCcw size={26} />
                  <strong>Loading donors...</strong>
                  <span>Please wait while donor data is fetched.</span>
                </div>
              ) : filteredDonors.length === 0 ? (
                <div className="blood-empty">
                  <Droplet size={26} />
                  <strong>No donors found</strong>
                  <span>
                    Try changing the blood group, division, district, or search keyword.
                  </span>
                </div>
              ) : (
                <div className="blood-cards">
                  {filteredDonors.map((donor) => (
                    <article className="blood-card" key={donor.id}>
                      <div className="blood-card-top">
                        <div>
                          <h4>{donor.name}</h4>
                          <div className="blood-muted">
                            Age {donor.age} • {donor.total_donations || 0} donations
                          </div>
                        </div>

                        <div className="blood-group-pill">{donor.blood_group}</div>
                      </div>

                      <div className="blood-card-info">
                        <div className="blood-info-row">
                          <MapPin size={16} />
                          <span>
                            {donor.district}, {donor.division}
                          </span>
                        </div>

                        {donor.address && (
                          <div className="blood-info-row">
                            <HeartPulse size={16} />
                            <span>{donor.address}</span>
                          </div>
                        )}

                        <div className="blood-info-row">
                          <Phone size={16} />
                          <a href={`tel:${donor.phone}`}>{donor.phone}</a>
                        </div>

                        {donor.email && (
                          <div className="blood-info-row">
                            <Mail size={16} />
                            <a href={`mailto:${donor.email}`}>{donor.email}</a>
                          </div>
                        )}

                        <div className="blood-info-row">
                          <CalendarDays size={16} />
                          <span>
                            Last donation: {formatDate(donor.last_donation_date)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="blood-panel">
              <div className="blood-panel-header">
                <div className="blood-panel-title">
                  <span className="blood-title-icon">
                    <ClipboardPlus size={20} />
                  </span>
                  <div>
                    <h3>Open Blood Requests</h3>
                    <p>Accept a pending request when you can donate.</p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="blood-empty">
                  <RefreshCcw size={26} />
                  <strong>Loading requests...</strong>
                  <span>Open requests will appear here.</span>
                </div>
              ) : requests.length === 0 ? (
                <div className="blood-empty">
                  <ClipboardPlus size={26} />
                  <strong>No open requests</strong>
                  <span>
                    There are no pending blood requests for the current filters.
                  </span>
                </div>
              ) : (
                <div className="request-list">
                  {requests.map((request) => {
                    const isOwnRequest =
                      user && Number(request.requester_user_id) === Number(user.id);

                    return (
                      <article
                        className={`request-card ${
                          request.is_emergency ? "emergency" : ""
                        }`}
                        key={request.id}
                      >
                        <div className="request-card-top">
                          <div>
                            <h4>{request.patient_name}</h4>
                            <div className="blood-muted">
                              Needed on {formatDate(request.date_needed)} •{" "}
                              {request.units_required} unit(s)
                            </div>
                          </div>

                          <div className="request-badges">
                            <span className="blood-group-pill">
                              {request.blood_group}
                            </span>

                            <span
                              className={`request-badge ${
                                request.is_emergency ? "emergency" : "normal"
                              }`}
                            >
                              {request.is_emergency ? (
                                <AlertTriangle size={14} />
                              ) : (
                                <HeartPulse size={14} />
                              )}
                              {request.is_emergency ? "Emergency" : "Regular"}
                            </span>
                          </div>
                        </div>

                        <div className="request-info">
                          <div className="blood-info-row">
                            <Phone size={16} />
                            <a href={`tel:${request.contact}`}>
                              {request.contact}
                            </a>
                          </div>

                          <div className="blood-info-row">
                            <MapPin size={16} />
                            <span>
                              {request.hospital_location} — {request.district},{" "}
                              {request.division}
                            </span>
                          </div>

                          {request.additional_notes && (
                            <div className="blood-info-row">
                              <HeartPulse size={16} />
                              <span>{request.additional_notes}</span>
                            </div>
                          )}
                        </div>

                        <div className="request-actions">
                          <button
                            className="blood-button primary"
                            type="button"
                            onClick={() => acceptRequest(request.id)}
                            disabled={acceptingId === request.id || isOwnRequest}
                          >
                            <CheckCircle size={16} />
                            {isOwnRequest
                              ? "Your Request"
                              : acceptingId === request.id
                                ? "Accepting..."
                                : "Accept Request"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside>
            <div className="blood-panel">
              <div className="blood-panel-header">
                <div className="blood-panel-title">
                  <span className="blood-title-icon">
                    <UserPlus size={20} />
                  </span>
                  <div>
                    <h3>Register Donor</h3>
                    <p>Add yourself to the donor list.</p>
                  </div>
                </div>
              </div>

              {!user && (
                <div className="auth-hint">Sign in to register as a donor.</div>
              )}

              <form className="blood-form-grid" onSubmit={handleDonorSubmit}>
                <label className="blood-field full">
                  Full Name
                  <input
                    name="name"
                    value={donorForm.name}
                    onChange={updateDonorForm}
                    placeholder="Donor name"
                    required
                  />
                </label>

                <label className="blood-field">
                  Age
                  <input
                    type="number"
                    min="18"
                    max="65"
                    name="age"
                    value={donorForm.age}
                    onChange={updateDonorForm}
                    placeholder="18"
                    required
                  />
                </label>

                <label className="blood-field">
                  Blood Group
                  <select
                    name="blood_group"
                    value={donorForm.blood_group}
                    onChange={updateDonorForm}
                    required
                  >
                    <option value="">Select</option>
                    {bloodGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="blood-field full">
                  Phone
                  <input
                    name="phone"
                    value={donorForm.phone}
                    onChange={updateDonorForm}
                    placeholder="017XXXXXXXX"
                    required
                  />
                </label>

                <label className="blood-field full">
                  Email
                  <input
                    type="email"
                    name="email"
                    value={donorForm.email}
                    onChange={updateDonorForm}
                    placeholder="optional@example.com"
                  />
                </label>

                <label className="blood-field">
                  Division
                  <select
                    name="division"
                    value={donorForm.division}
                    onChange={updateDonorForm}
                    required
                  >
                    <option value="">Select</option>
                    {divisions.map((division) => (
                      <option key={division} value={division}>
                        {division}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="blood-field">
                  District
                  <select
                    name="district"
                    value={donorForm.district}
                    onChange={updateDonorForm}
                    disabled={!donorForm.division}
                    required
                  >
                    <option value="">Select</option>
                    {donorDistricts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="blood-field full">
                  Address
                  <textarea
                    name="address"
                    value={donorForm.address}
                    onChange={updateDonorForm}
                    placeholder="Area, road, nearby landmark"
                  />
                </label>

                <label className="blood-field full">
                  Last Donation Date
                  <input
                    type="date"
                    name="last_donation_date"
                    value={donorForm.last_donation_date}
                    onChange={updateDonorForm}
                  />
                </label>

                <button className="blood-button primary full" disabled={donorSubmitting}>
                  <UserPlus size={16} />
                  {donorSubmitting ? "Registering..." : "Register Donor"}
                </button>
              </form>
            </div>

            <div className="blood-panel">
              <div className="blood-panel-header">
                <div className="blood-panel-title">
                  <span className="blood-title-icon">
                    <ClipboardPlus size={20} />
                  </span>
                  <div>
                    <h3>Create Blood Request</h3>
                    <p>Post a request for donors to accept.</p>
                  </div>
                </div>
              </div>

              {!user && (
                <div className="auth-hint">Sign in to create a request.</div>
              )}

              <form className="blood-form-grid" onSubmit={handleRequestSubmit}>
                <label className="blood-field full">
                  Patient Name
                  <input
                    name="patient_name"
                    value={requestForm.patient_name}
                    onChange={updateRequestForm}
                    placeholder="Patient name"
                    required
                  />
                </label>

                <label className="blood-field">
                  Blood Group
                  <select
                    name="blood_group"
                    value={requestForm.blood_group}
                    onChange={updateRequestForm}
                    required
                  >
                    <option value="">Select</option>
                    {bloodGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="blood-field">
                  Units
                  <input
                    type="number"
                    min="1"
                    name="units_required"
                    value={requestForm.units_required}
                    onChange={updateRequestForm}
                    required
                  />
                </label>

                <label className="blood-field full">
                  Contact Number
                  <input
                    name="contact"
                    value={requestForm.contact}
                    onChange={updateRequestForm}
                    placeholder="017XXXXXXXX"
                    required
                  />
                </label>

                <label className="blood-field full">
                  Hospital Location
                  <textarea
                    name="hospital_location"
                    value={requestForm.hospital_location}
                    onChange={updateRequestForm}
                    placeholder="Hospital name, ward, address"
                    required
                  />
                </label>

                <label className="blood-field">
                  Division
                  <select
                    name="division"
                    value={requestForm.division}
                    onChange={updateRequestForm}
                    required
                  >
                    <option value="">Select</option>
                    {divisions.map((division) => (
                      <option key={division} value={division}>
                        {division}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="blood-field">
                  District
                  <select
                    name="district"
                    value={requestForm.district}
                    onChange={updateRequestForm}
                    disabled={!requestForm.division}
                    required
                  >
                    <option value="">Select</option>
                    {requestDistricts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="blood-field full">
                  Date Needed
                  <input
                    type="date"
                    min={today()}
                    name="date_needed"
                    value={requestForm.date_needed}
                    onChange={updateRequestForm}
                    required
                  />
                </label>

                <label className="checkbox-row full">
                  <input
                    type="checkbox"
                    name="is_emergency"
                    checked={requestForm.is_emergency}
                    onChange={updateRequestForm}
                  />
                  Mark as emergency request
                </label>

                <label className="blood-field full">
                  Additional Notes
                  <textarea
                    name="additional_notes"
                    value={requestForm.additional_notes}
                    onChange={updateRequestForm}
                    placeholder="Patient condition, preferred time, contact person..."
                  />
                </label>

                <button
                  className="blood-button primary full"
                  disabled={requestSubmitting}
                >
                  <ClipboardPlus size={16} />
                  {requestSubmitting ? "Submitting..." : "Create Request"}
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}