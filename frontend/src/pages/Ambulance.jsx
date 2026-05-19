import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ambulance as AmbulanceIcon,
  BadgeCheck,
  CheckCircle,
  Clock,
  Edit3,
  Filter,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const initialFilters = {
  search: "",
  division: "",
  district: "",
  service_type: "",
  availability: "",
  verified_only: false,
  only247: false,
  sort: "service_name",
  order: "asc",
};

const initialUpdateForm = {
  requester_name: "",
  requester_phone: "",
  requester_email: "",
  proposed_service_name: "",
  proposed_phone_primary: "",
  proposed_phone_secondary: "",
  proposed_division: "",
  proposed_district: "",
  proposed_area: "",
  proposed_address: "",
  proposed_latitude: "",
  proposed_longitude: "",
  proposed_availability: "",
  proposed_base_charge: "",
  proposed_price_per_km: "",
  proposed_equipment: "",
  note: "",
};

const initialMessageForm = {
  sender_name: "",
  sender_phone: "",
  sender_email: "",
  message_type: "question",
  message: "",
};

const initialReviewForm = {
  reviewer_name: "",
  reviewer_phone: "",
  rating: 5,
  review_text: "",
  service_date: "",
};

function money(value) {
  return Number(value || 0).toFixed(2);
}

function telNumber(value) {
  return String(value || "").replace(/[^0-9+]/g, "");
}

function serviceLabel(type) {
  const labels = {
    basic: "Basic Ambulance",
    advanced: "Advanced Ambulance",
    icu: "ICU Ambulance",
    neonatal: "Neonatal Ambulance",
    cardiac: "Cardiac Ambulance",
  };

  return labels[type] || String(type || "Ambulance").replaceAll("_", " ");
}

function availabilityLabel(value) {
  if (value === "24/7") return "24/7 Available";
  if (value === "day_only") return "Day Only";
  if (value === "emergency_only") return "Emergency Only";
  return value || "Available";
}

function responseWindow(type) {
  const map = {
    basic: "12-18 min",
    advanced: "10-15 min",
    icu: "8-12 min",
    neonatal: "10-15 min",
    cardiac: "8-12 min",
  };

  return map[type] || "10-15 min";
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
          <strong>No live location yet</strong>
          <span>The ambulance manager has not shared live GPS yet.</span>
        </div>
      )}
    </div>
  );
}

export default function Ambulance() {
  const { user } = useAuth();

  const [meta, setMeta] = useState({
    stats: {},
    divisions: [],
    service_types: [],
    availability_types: [],
    emergency_services: [],
  });
  const [services, setServices] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [updateTarget, setUpdateTarget] = useState(null);
  const [updateForm, setUpdateForm] = useState(initialUpdateForm);
  const [messageForm, setMessageForm] = useState(initialMessageForm);
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [shareForm, setShareForm] = useState({
  sender_name: "",
  sender_phone: "",
  sender_email: "",
  latitude: "",
  longitude: "",
  message: "",
});
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ambulanceLatitude =
  selected?.current_latitude ||
  selected?.latitude ||
  selectedDetails?.service?.current_latitude ||
  selectedDetails?.service?.latitude ||
  "";

const ambulanceLongitude =
  selected?.current_longitude ||
  selected?.longitude ||
  selectedDetails?.service?.current_longitude ||
  selectedDetails?.service?.longitude ||
  "";

const ambulanceLocationNote =
  selected?.current_location_note ||
  selectedDetails?.service?.current_location_note ||
  selected?.address ||
  "";

  

  const typeOptions = useMemo(() => {
    const values = meta.service_types?.length
      ? meta.service_types
      : ["basic", "advanced", "icu", "neonatal", "cardiac"];

    return values;
  }, [meta.service_types]);

  useEffect(() => {
    loadMeta();
    loadServices();
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadServices, 250);
    return () => clearTimeout(timer);
  }, 
  );

  async function loadMeta() {
    try {
      const response = await api.get("/ambulance/meta");
      setMeta(response.data.data);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load ambulance summary.",
      });
    }
  }

  async function loadServices() {
    setLoading(true);

    try {
      const response = await api.get("/ambulance/services", {
        params: {
          ...filters,
          verified_only: filters.verified_only ? 1 : "",
          only247: filters.only247 ? 1 : "",
        },
      });

      setServices(response.data.data || []);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load ambulance services.",
      });
    } finally {
      setLoading(false);
    }
  }

  function updateShareForm(event) {
  const { name, value } = event.target;

  setShareForm((current) => ({
    ...current,
    [name]: value,
  }));
}

function useCurrentUserLocation() {
  if (!navigator.geolocation) {
    setNotice({
      type: "error",
      message: "Geolocation is not supported in this browser.",
    });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setShareForm((current) => ({
        ...current,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }));
    },
    () => {
      setNotice({
        type: "error",
        message: "Could not get your current location.",
      });
    }
  );
}

async function submitUserLocation(event) {
  event.preventDefault();

  if (!selected) return;

  setSubmitting(true);
  setNotice(null);

  try {
    const response = await api.post(
      `/ambulance/services/${selected.id}/share-location`,
      shareForm
    );

    setNotice({
      type: "success",
      message: response.data.message || "Location shared successfully.",
    });

    setShareForm({
      sender_name: user?.name || "",
      sender_phone: "",
      sender_email: user?.email || "",
      latitude: "",
      longitude: "",
      message: "",
    });
  } catch (error) {
    setNotice({
      type: "error",
      message: error.response?.data?.message || "Could not share location.",
    });
  } finally {
    setSubmitting(false);
  }
}

  function updateFilter(event) {
    const { name, value, type, checked } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function resetFilters() {
    setFilters(initialFilters);
  }

  async function openDetails(service) {
  setSelected(service);
  setSelectedDetails(null);
  setNotice(null);

  setShareForm({
    sender_name: user?.name || "",
    sender_phone: "",
    sender_email: user?.email || "",
    latitude: "",
    longitude: "",
    message: "",
  });

  setReviewForm({
    reviewer_name: user?.name || "",
    reviewer_phone: "",
    rating: 5,
    review_text: "",
    service_date: "",
  });

    try {
      const response = await api.get(`/ambulance/services/${service.id}`);
      setSelectedDetails(response.data.data);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load ambulance details.",
      });
    }
  }

  function updateUpdateForm(event) {
    const { name, value } = event.target;

    setUpdateForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateMessageForm(event) {
    const { name, value } = event.target;

    setMessageForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateReviewForm(event) {
    const { name, value } = event.target;

    setReviewForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitUpdateRequest(event) {
    event.preventDefault();

    if (!updateTarget) return;

    setSubmitting(true);
    setNotice(null);

    try {
      const response = await api.post(
        `/ambulance/services/${updateTarget.id}/update-request`,
        updateForm
      );

      setNotice({
        type: "success",
        message: response.data.message || "Update request submitted successfully.",
      });

      setUpdateTarget(null);
      setUpdateForm(initialUpdateForm);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not submit update request.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMessage(event) {
    event.preventDefault();

    if (!updateTarget) return;

    setSubmitting(true);
    setNotice(null);

    try {
      const response = await api.post(
        `/ambulance/services/${updateTarget.id}/messages`,
        messageForm
      );

      setNotice({
        type: "success",
        message: response.data.message || "Message sent successfully.",
      });

      setMessageForm(initialMessageForm);
      setUpdateTarget(null);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not send message.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReview(event) {
    event.preventDefault();

    if (!selected) return;

    setSubmitting(true);

    try {
      const response = await api.post(
        `/ambulance/services/${selected.id}/reviews`,
        reviewForm
      );

      setNotice({
        type: "success",
        message: response.data.message || "Review submitted successfully.",
      });

      setReviewForm(initialReviewForm);
      await openDetails(selected);
      await loadServices();
      await loadMeta();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not submit review.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  

  return (
    <section className="ambulance-page">
      <style>{styles}</style>

      <div className="ambulance-shell">
        <div className="ambulance-hero">
          <div className="hero-left">
            <span className="hero-kicker">
              <AmbulanceIcon size={18} />
              Emergency Ambulance Network
            </span>
            <h1>Find verified ambulances and contact emergency transport fast.</h1>
            <p>
              Search by division, district, service type, availability, rating,
              and emergency response level. Users can also submit location and
              contact corrections for each ambulance.
            </p>
          </div>

          <a className="hotline-card" href="tel:999">
            <AlertTriangle size={28} />
            <div>
              <strong>999</strong>
              <span>Emergency Hotline</span>
            </div>
          </a>
        </div>

        {notice && (
          <div className={`ambulance-notice ${notice.type}`}>
            {notice.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {notice.message}
          </div>
        )}

        <div className="stats-grid">
          <Stat icon={<AmbulanceIcon />} label="Total Services" value={meta.stats?.total_services || 0} />
          <Stat icon={<Navigation />} label="Divisions" value={meta.stats?.total_divisions || 0} />
          <Stat icon={<Clock />} label="24/7 Available" value={meta.stats?.total_247 || 0} />
          <Stat icon={<ShieldCheck />} label="Verified" value={meta.stats?.total_verified || 0} />
        </div>

        <div className="emergency-strip">
          <div>
            <h2>Emergency Services Nearby</h2>
            <p>Top verified and high-rated services for urgent response.</p>
          </div>
          <button className="refresh-btn" onClick={() => { loadMeta(); loadServices(); }}>
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>

        <div className="emergency-grid">
          {meta.emergency_services?.map((service) => (
            <article className="emergency-card" key={service.id}>
              <div>
                <span className="mini-badge">{availabilityLabel(service.availability)}</span>
                <h3>{service.service_name}</h3>
                <p>{service.area}, {service.district}</p>
              </div>
              <a href={`tel:${telNumber(service.phone_primary)}`} className="call-now">
                <Phone size={16} />
                Call
              </a>
            </article>
          ))}
        </div>

        <div className="filter-panel">
          <div className="search-field">
            <Search size={18} />
            <input
              name="search"
              value={filters.search}
              onChange={updateFilter}
              placeholder="Search service, area, phone, equipment..."
            />
          </div>

          <select name="division" value={filters.division} onChange={updateFilter}>
            <option value="">All divisions</option>
            {meta.divisions?.map((division) => (
              <option key={division} value={division}>{division}</option>
            ))}
          </select>

          <input
            name="district"
            value={filters.district}
            onChange={updateFilter}
            placeholder="District"
          />

          <select name="service_type" value={filters.service_type} onChange={updateFilter}>
            <option value="">All service types</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>{serviceLabel(type)}</option>
            ))}
          </select>

          <select name="availability" value={filters.availability} onChange={updateFilter}>
            <option value="">Any availability</option>
            <option value="24/7">24/7 Available</option>
            <option value="day_only">Day Only</option>
            <option value="emergency_only">Emergency Only</option>
          </select>

          <select name="sort" value={filters.sort} onChange={updateFilter}>
            <option value="service_name">Sort by name</option>
            <option value="rating">Sort by rating</option>
            <option value="base_charge">Sort by base charge</option>
            <option value="price_per_km">Sort by per km price</option>
            <option value="total_reviews">Sort by reviews</option>
          </select>

          <select name="order" value={filters.order} onChange={updateFilter}>
            <option value="asc">ASC</option>
            <option value="desc">DESC</option>
          </select>

          <label className="check-pill">
            <input
              type="checkbox"
              name="verified_only"
              checked={filters.verified_only}
              onChange={updateFilter}
            />
            Verified only
          </label>

          <label className="check-pill">
            <input
              type="checkbox"
              name="only247"
              checked={filters.only247}
              onChange={updateFilter}
            />
            24/7 only
          </label>

          <button className="clear-btn" onClick={resetFilters}>
            <Filter size={16} />
            Reset
          </button>
        </div>

        {loading ? (
          <div className="empty-card">Loading ambulance services...</div>
        ) : services.length === 0 ? (
          <div className="empty-card">No ambulance services found.</div>
        ) : (
          <div className="ambulance-grid">
            {services.map((service) => (
              <AmbulanceCard
  key={service.id}
  service={service}
  onDetails={() => openDetails(service)}
/>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="details-modal">


            <button className="modal-close" onClick={() => setSelected(null)}>
              <X size={20} />
            </button>
            <form className="review-form" onSubmit={submitUserLocation}>
  <h3>Share Your Location With Ambulance Manager</h3>

  <MapBox
  latitude={shareForm.latitude}
  longitude={shareForm.longitude}
  title="Your Pickup Location"
  note={shareForm.message || "This location will be shared with the ambulance manager."}
/>

<div className="location-meta">
  <span>
    <strong>Latitude:</strong> {shareForm.latitude || "Not set"}
  </span>
  <span>
    <strong>Longitude:</strong> {shareForm.longitude || "Not set"}
  </span>
</div>

<button type="button" className="details-btn" onClick={useCurrentUserLocation}>
  <MapPin size={16} />
  Use My Current Location
</button>

  <textarea
    name="message"
    value={shareForm.message}
    onChange={updateShareForm}
    placeholder="Add pickup note, landmark, emergency details..."
  />

  <button className="submit-btn green" disabled={submitting}>
    <MapPin size={16} />
    Share Location
  </button>
</form>

            <div className="details-head">
              <div>
                <span className={`type-badge ${selected.service_type}`}>
                  {serviceLabel(selected.service_type)}
                </span>
                <h2>{selected.service_name}</h2>
                <p>
                  {selected.area}, {selected.district}, {selected.division}
                </p>
              </div>

              <a className="call-main" href={`tel:${telNumber(selected.phone_primary)}`}>
                <Phone size={18} />
                Call Now
              </a>
            </div>

            <div className="details-grid">
              <div className="details-card">
                <h3>Service Details</h3>
                <Info label="Availability" value={availabilityLabel(selected.availability)} />
                <Info label="Response Window" value={responseWindow(selected.service_type)} />
                <Info label="Base Charge" value={`৳${money(selected.base_charge)}`} />
                <Info label="Price / KM" value={`৳${money(selected.price_per_km)}`} />
                <Info label="Example 10 KM Fare" value={`৳${money(selected.example_fare_10km)}`} />
                <Info label="Primary Phone" value={selected.phone_primary} />
                <Info label="Secondary Phone" value={selected.phone_secondary || "Not provided"} />
                <Info label="Contact Person" value={selected.contact_person || "Not provided"} />
              </div>

              <div className="details-card">
  <h3>Ambulance Live Location</h3>

  <MapBox
    latitude={ambulanceLatitude}
    longitude={ambulanceLongitude}
    title={selected.service_name}
    note={ambulanceLocationNote}
  />

  <p className="address-text">{selected.address || "Address not provided."}</p>

  {ambulanceLatitude && ambulanceLongitude && (
    <a
      className="map-link"
      href={`https://www.google.com/maps?q=${ambulanceLatitude},${ambulanceLongitude}`}
      target="_blank"
      rel="noreferrer"
    >
      <MapPin size={16} />
      Open Full Map
    </a>
  )}

  <h3>Equipment</h3>
  <div className="equipment-list">
    {selected.equipment_items?.map((item) => (
      <span key={item}>{item}</span>
    ))}
  </div>
</div>
            </div>

            <div className="details-card">
              <h3>Description</h3>
              <p>{selected.description || "No description added."}</p>
            </div>

            <div className="details-grid">
              <div className="details-card">
                <h3>Recent Messages</h3>
                {selectedDetails?.messages?.length ? (
                  <div className="mini-list">
                    {selectedDetails.messages.map((message) => (
                      <div key={message.id}>
                        <strong>{message.sender_name}</strong>
                        <p>{message.message}</p>
                        <small>{formatDate(message.created_at)} · {message.message_type}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No public messages yet.</p>
                )}
              </div>

              <div className="details-card">
                <h3>Reviews</h3>
                {selectedDetails?.reviews?.length ? (
                  <div className="mini-list">
                    {selectedDetails.reviews.map((review) => (
                      <div key={review.id}>
                        <strong>{review.reviewer_name}</strong>
                        <p>{"★".repeat(Number(review.rating || 0))} {review.review_text}</p>
                        <small>{formatDate(review.service_date || review.created_at)}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No reviews yet.</p>
                )}
              </div>
            </div>

            <form className="review-form" onSubmit={submitReview}>
              <h3>Add Review</h3>

              <div className="form-row">
                <input
                  name="reviewer_name"
                  value={reviewForm.reviewer_name}
                  onChange={updateReviewForm}
                  placeholder="Your name"
                  required
                />
                <input
                  name="reviewer_phone"
                  value={reviewForm.reviewer_phone}
                  onChange={updateReviewForm}
                  placeholder="Phone"
                />
                <select name="rating" value={reviewForm.rating} onChange={updateReviewForm}>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>
              </div>

              <textarea
                name="review_text"
                value={reviewForm.review_text}
                onChange={updateReviewForm}
                placeholder="Write your experience..."
              />

              <button className="submit-btn" disabled={submitting}>
                Submit Review
              </button>
            </form>
          </div>
        </div>
      )}

      {updateTarget && (
        <div className="modal-overlay">
          <div className="update-modal">
            <button className="modal-close" onClick={() => setUpdateTarget(null)}>
              <X size={20} />
            </button>

            <div className="update-head">
              <span className="hero-kicker">
                <Edit3 size={16} />
                Update / Communicate
              </span>
              <h2>{updateTarget.service_name}</h2>
              <p>
                Send corrected ambulance information, updated location, pricing,
                availability, or a message to the service/admin team.
              </p>
            </div>

            <div className="update-grid">
              <form className="update-form" onSubmit={submitUpdateRequest}>
                <h3>Update ambulance information</h3>

                <div className="form-row">
                  <input
                    name="requester_name"
                    value={updateForm.requester_name}
                    onChange={updateUpdateForm}
                    placeholder="Your name *"
                    required
                  />
                  <input
                    name="requester_phone"
                    value={updateForm.requester_phone}
                    onChange={updateUpdateForm}
                    placeholder="Your phone *"
                    required
                  />
                </div>

                <input
                  name="requester_email"
                  value={updateForm.requester_email}
                  onChange={updateUpdateForm}
                  placeholder="Your email"
                />

                <input
                  name="proposed_service_name"
                  value={updateForm.proposed_service_name}
                  onChange={updateUpdateForm}
                  placeholder="Service name"
                />

                <div className="form-row">
                  <input
                    name="proposed_phone_primary"
                    value={updateForm.proposed_phone_primary}
                    onChange={updateUpdateForm}
                    placeholder="Primary phone"
                  />
                  <input
                    name="proposed_phone_secondary"
                    value={updateForm.proposed_phone_secondary}
                    onChange={updateUpdateForm}
                    placeholder="Secondary phone"
                  />
                </div>

                <div className="form-row">
                  <input
                    name="proposed_division"
                    value={updateForm.proposed_division}
                    onChange={updateUpdateForm}
                    placeholder="Division"
                  />
                  <input
                    name="proposed_district"
                    value={updateForm.proposed_district}
                    onChange={updateUpdateForm}
                    placeholder="District"
                  />
                </div>

                <input
                  name="proposed_area"
                  value={updateForm.proposed_area}
                  onChange={updateUpdateForm}
                  placeholder="Area"
                />

                <textarea
                  name="proposed_address"
                  value={updateForm.proposed_address}
                  onChange={updateUpdateForm}
                  placeholder="Full address / landmark"
                />

                <div className="form-row">
                  <input
                    name="proposed_latitude"
                    value={updateForm.proposed_latitude}
                    onChange={updateUpdateForm}
                    placeholder="Latitude"
                  />
                  <input
                    name="proposed_longitude"
                    value={updateForm.proposed_longitude}
                    onChange={updateUpdateForm}
                    placeholder="Longitude"
                  />
                </div>

                <div className="form-row">
                  <select
                    name="proposed_availability"
                    value={updateForm.proposed_availability}
                    onChange={updateUpdateForm}
                  >
                    <option value="">Availability</option>
                    <option value="24/7">24/7</option>
                    <option value="day_only">Day only</option>
                    <option value="emergency_only">Emergency only</option>
                  </select>

                  <input
                    name="proposed_base_charge"
                    value={updateForm.proposed_base_charge}
                    onChange={updateUpdateForm}
                    placeholder="Base charge"
                  />
                </div>

                <input
                  name="proposed_price_per_km"
                  value={updateForm.proposed_price_per_km}
                  onChange={updateUpdateForm}
                  placeholder="Price per KM"
                />

                <textarea
                  name="proposed_equipment"
                  value={updateForm.proposed_equipment}
                  onChange={updateUpdateForm}
                  placeholder="Equipment list: Oxygen, Stretcher, ICU..."
                />

                <textarea
                  name="note"
                  value={updateForm.note}
                  onChange={updateUpdateForm}
                  placeholder="Explain what should be changed..."
                />

                <button className="submit-btn" disabled={submitting}>
                  <Edit3 size={16} />
                  Submit Update Request
                </button>
              </form>

              <form className="message-form" onSubmit={submitMessage}>
                <h3>Communicate / Ask Question</h3>

                <input
                  name="sender_name"
                  value={messageForm.sender_name}
                  onChange={updateMessageForm}
                  placeholder="Your name *"
                  required
                />

                <input
                  name="sender_phone"
                  value={messageForm.sender_phone}
                  onChange={updateMessageForm}
                  placeholder="Your phone *"
                  required
                />

                <input
                  name="sender_email"
                  value={messageForm.sender_email}
                  onChange={updateMessageForm}
                  placeholder="Your email"
                />

                <select
                  name="message_type"
                  value={messageForm.message_type}
                  onChange={updateMessageForm}
                >
                  <option value="question">Question</option>
                  <option value="location_update">Location update</option>
                  <option value="pricing">Pricing</option>
                  <option value="availability">Availability</option>
                  <option value="other">Other</option>
                </select>

                <textarea
                  name="message"
                  value={messageForm.message}
                  onChange={updateMessageForm}
                  placeholder="Write your message..."
                  required
                />

                <button className="submit-btn green" disabled={submitting}>
                  <MessageCircle size={16} />
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ icon, label, value }) {
  return (
    <article className="stat-card">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AmbulanceCard({ service, onDetails }) {
  return (
    <article className="service-card">
      <div className="service-top">
        <div className="service-icon">
          <AmbulanceIcon size={30} />
        </div>

        <div className="badges">
          {service.verified && (
            <span className="verified">
              <BadgeCheck size={14} />
              Verified
            </span>
          )}
          <span className={`type-badge ${service.service_type}`}>
            {serviceLabel(service.service_type)}
          </span>
        </div>
      </div>

      <h3>{service.service_name}</h3>

      <div className="rating-line">
        <Star size={16} fill="currentColor" />
        <strong>{service.rating || "0.0"}</strong>
        <span>({service.total_reviews || 0} reviews)</span>
      </div>

      <p className="desc">{service.description || "Emergency ambulance service."}</p>

      <div className="service-info">
        <span>
          <MapPin size={15} />
          {service.area}, {service.district}, {service.division}
        </span>
        <span>
          <Clock size={15} />
          {availabilityLabel(service.availability)} · {responseWindow(service.service_type)}
        </span>
        <span>
          <Phone size={15} />
          {service.phone_primary}
        </span>
      </div>

      <div className="equipment-list compact">
        {service.equipment_items?.slice(0, 4).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <div className="fare-box">
        <div>
          <small>Base</small>
          <strong>৳{money(service.base_charge)}</strong>
        </div>
        <div>
          <small>Per KM</small>
          <strong>৳{money(service.price_per_km)}</strong>
        </div>
        <div>
          <small>10 KM Est.</small>
          <strong>৳{money(service.example_fare_10km)}</strong>
        </div>
      </div>

      <div className="card-actions">
        <a href={`tel:${telNumber(service.phone_primary)}`} className="call-btn">
          <Phone size={16} />
          Call
        </a>

        <button onClick={onDetails} className="details-btn">
          Details
        </button>
      </div>
    </article>
  );
}

const styles = `
.ambulance-page {
  background: #fff7ef;
  min-height: 100%;
  padding: 28px 16px 48px;
  color: #0f172a;
}

.ambulance-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.ambulance-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 18px;
  margin-bottom: 18px;
}

.hero-left {
  border-radius: 28px;
  padding: clamp(26px, 5vw, 44px);
  color: white;
  background: linear-gradient(135deg, #ef1111 0%, #d90429 50%, #f97316 100%);
  box-shadow: 0 26px 60px rgba(239, 17, 17, .2);
}

.hero-kicker {
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

.hero-left h1 {
  margin: 0;
  max-width: 850px;
  font-size: clamp(2rem, 5vw, 3.6rem);
  line-height: 1;
  letter-spacing: -.06em;
}

.hero-left p {
  max-width: 720px;
  color: #ffe4e6;
  margin: 16px 0 0;
}

.hotline-card {
  border-radius: 28px;
  background: #111827;
  color: white;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  text-decoration: none;
  box-shadow: 0 22px 44px rgba(15,23,42,.2);
}

.hotline-card strong {
  display: block;
  font-size: 3rem;
  line-height: 1;
}

.hotline-card span {
  color: #fecaca;
  font-weight: 900;
}

.ambulance-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 16px;
  padding: 13px 16px;
  margin-bottom: 16px;
  font-weight: 900;
}

.ambulance-notice.success {
  background: #dcfce7;
  color: #166534;
}

.ambulance-notice.error {
  background: #fee2e2;
  color: #991b1b;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card,
.filter-panel,
.service-card,
.emergency-card,
.empty-card,
.details-modal,
.update-modal,
.details-card {
  background: white;
  border: 1px solid #fee2e2;
  border-radius: 22px;
  box-shadow: 0 14px 34px rgba(127, 29, 29, .08);
}

.stat-card {
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-card > span {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: #fee2e2;
  color: #ef1111;
}

.stat-card strong {
  display: block;
  font-size: 1.6rem;
}

.stat-card small {
  color: #64748b;
  font-weight: 900;
}

.emergency-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin: 22px 0 14px;
}

.emergency-strip h2 {
  margin: 0 0 5px;
}

.emergency-strip p {
  margin: 0;
  color: #64748b;
}

.refresh-btn,
.clear-btn,
.submit-btn,
.call-btn,
.details-btn,
.update-link,
.call-main {
  border: none;
  border-radius: 14px;
  padding: 11px 15px;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
}

.refresh-btn,
.clear-btn,
.details-btn {
  background: #fff;
  color: #334155;
  border: 1px solid #e2e8f0;
}

.emergency-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.emergency-card {
  padding: 18px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.emergency-card h3 {
  margin: 8px 0 4px;
}

.emergency-card p {
  margin: 0;
  color: #64748b;
}

.mini-badge {
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  padding: 5px 9px;
  font-size: .76rem;
  font-weight: 950;
}

.call-now,
.call-btn,
.call-main {
  background: #ef1111;
  color: white;
  box-shadow: 0 12px 22px rgba(239, 17, 17, .22);
}

.filter-panel {
  padding: 16px;
  display: grid;
  grid-template-columns: minmax(240px, 1.3fr) repeat(6, minmax(130px, 1fr)) auto auto auto;
  gap: 10px;
  margin-bottom: 18px;
  align-items: center;
}

.search-field {
  position: relative;
}

.search-field svg {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}

.filter-panel input,
.filter-panel select,
.update-form input,
.update-form select,
.update-form textarea,
.message-form input,
.message-form select,
.message-form textarea,
.review-form input,
.review-form select,
.review-form textarea {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 12px;
  font: inherit;
  font-weight: 700;
  outline: none;
}

.search-field input {
  padding-left: 42px;
}

.check-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff7ef;
  color: #9f1239;
  border-radius: 14px;
  padding: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.ambulance-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.service-card {
  padding: 18px;
}

.service-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 15px;
}

.service-icon {
  width: 64px;
  height: 64px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #fee2e2, #ffedd5);
  color: #ef1111;
}

.badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
}

.verified,
.type-badge {
  border-radius: 999px;
  padding: 6px 9px;
  font-size: .76rem;
  font-weight: 950;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.verified {
  background: #dcfce7;
  color: #166534;
}

.type-badge {
  color: #1d4ed8;
  background: #dbeafe;
}

.type-badge.icu,
.type-badge.cardiac {
  color: #b91c1c;
  background: #fee2e2;
}

.type-badge.neonatal {
  color: #7c2d12;
  background: #ffedd5;
}

.service-card h3 {
  margin: 0 0 10px;
  font-size: 1.15rem;
}

.rating-line {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #f59e0b;
  margin-bottom: 10px;
}

.rating-line span {
  color: #64748b;
  font-size: .85rem;
}

.desc {
  color: #64748b;
  min-height: 42px;
}

.service-info {
  display: grid;
  gap: 8px;
  margin: 14px 0;
}

.service-info span {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-size: .9rem;
}

.equipment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.equipment-list span {
  border-radius: 999px;
  padding: 6px 9px;
  background: #f8fafc;
  color: #475569;
  font-weight: 800;
  font-size: .78rem;
}

.equipment-list.compact {
  margin-bottom: 14px;
}

.fare-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: #fff7ef;
  border-radius: 16px;
  padding: 10px;
  margin-bottom: 14px;
}

.fare-box div {
  text-align: center;
}

.fare-box small {
  display: block;
  color: #64748b;
  font-size: .72rem;
}

.fare-box strong {
  color: #111827;
}

.card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.update-link {
  width: 100%;
  margin-top: 10px;
  background: #111827;
  color: white;
}

.empty-card {
  padding: 34px;
  text-align: center;
  color: #64748b;
  font-weight: 900;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(15, 23, 42, .6);
  backdrop-filter: blur(8px);
}

.details-modal,
.update-modal {
  position: relative;
  width: min(1080px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  padding: 24px;
}

.update-modal {
  width: min(1180px, 100%);
}

.modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.details-head,
.update-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 18px;
  padding-right: 50px;
}

.update-head {
  display: block;
}

.details-head h2,
.update-head h2 {
  margin: 10px 0 6px;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  letter-spacing: -.04em;
}

.details-head p,
.update-head p {
  color: #64748b;
  margin: 0;
}

.details-grid,
.update-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.details-card,
.update-form,
.message-form,
.review-form {
  padding: 18px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.details-card h3,
.update-form h3,
.message-form h3,
.review-form h3 {
  margin: 0 0 14px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 9px 0;
  border-bottom: 1px dashed #e2e8f0;
}

.info-row span {
  color: #64748b;
}

.address-text,
.muted {
  color: #64748b;
}

.map-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #2563eb;
  font-weight: 900;
  margin: 10px 0 18px;
}

.mini-list {
  display: grid;
  gap: 12px;
}

.mini-list div {
  background: #f8fafc;
  border-radius: 14px;
  padding: 12px;
}

.mini-list p {
  margin: 5px 0;
  color: #475569;
}

.mini-list small {
  color: #64748b;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.update-form,
.message-form,
.review-form {
  display: grid;
  gap: 10px;
}

.update-form textarea,
.message-form textarea,
.review-form textarea {
  min-height: 90px;
  resize: vertical;
}

.submit-btn {
  background: #ef1111;
  color: white;
  box-shadow: 0 12px 22px rgba(239, 17, 17, .22);
}

.submit-btn.green {
  background: #10b981;
  box-shadow: 0 12px 22px rgba(16, 185, 129, .22);
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
  margin-bottom: 12px;
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

@media (max-width: 1120px) {
  .filter-panel {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ambulance-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .emergency-grid,
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 760px) {
  .ambulance-hero,
  .ambulance-grid,
  .emergency-grid,
  .stats-grid,
  .details-grid,
  .update-grid,
  .form-row,
  .filter-panel {
    grid-template-columns: 1fr;
  }

  .details-head {
    flex-direction: column;
  }

  .hotline-card strong {
    font-size: 2rem;
  }
}
`;