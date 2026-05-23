import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  CheckCircle,
  Clock,
  Minus,
  PackageCheck,
  PackageSearch,
  Pill,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import PharmacyAdminDashboard from "./PharmacyAdminDashboard.jsx";
import { useLocation } from "react-router-dom";


const initialFilters = {
  search: "",
  category: "",
  manufacturer: "",
  special: false,
};

const initialCheckout = {
  customer_name: "",
  phone_number: "",
  division: "",
  district: "",
  address: "",
  landmark: "",
  delivery_time: "anytime",
  special_instructions: "",
};

const isPharmacyAdmin = Boolean(localStorage.getItem("pharmacy_admin_token"));

function money(value) {
  return Number(value || 0).toFixed(2);
}

function imageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/uploads")) return `http://localhost:5000${path}`;
  return path;
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

function statusIcon(status) {
  if (status === "confirmed") return <CheckCircle size={16} />;
  if (status === "processing") return <Clock size={16} />;
  if (status === "shipped") return <Truck size={16} />;
  if (status === "delivered") return <PackageCheck size={16} />;
  if (status === "cancelled") return <X size={16} />;
  return <Clock size={16} />;
}

export default function Pharmacies() {
  const { user } = useAuth();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({
    stats: {},
    categories: [],
    manufacturers: [],
    locations: {},
    delivery: { charge: 60, free_threshold: 500 },
  });

  const [filters, setFilters] = useState(initialFilters);
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("healthcare_cart") || "[]");
    } catch {
      return [];
    }
  });

  const [checkout, setCheckout] = useState(initialCheckout);
  const [view, setView] = useState("shop");
  const [trackId, setTrackId] = useState("");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  const divisions = Object.keys(meta.locations || {});
  const districts = checkout.division ? meta.locations[checkout.division] || [] : [];

  const totals = useMemo(() => {
    const totalMrp = cart.reduce((sum, item) => sum + Number(item.mrp || 0) * item.quantity, 0);
    const totalAmount = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
    const totalSavings = totalMrp - totalAmount;
    const deliveryCharge = totalAmount >= Number(meta.delivery?.free_threshold || 500) || totalAmount === 0 ? 0 : Number(meta.delivery?.charge || 60);
    const finalTotal = totalAmount + deliveryCharge;

    return {
      totalMrp,
      totalAmount,
      totalSavings,
      deliveryCharge,
      finalTotal,
      count: cart.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [cart, meta.delivery]);

  useEffect(() => {
    localStorage.setItem("healthcare_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    loadMeta();
    loadProducts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadProducts, 250);
    return () => clearTimeout(timer);
  }, [filters.search, filters.category, filters.manufacturer, filters.special]);

  useEffect(() => {
  const query = new URLSearchParams(location.search);
  const shouldOpenCheckout = query.get("view") === "checkout";

  const cartNotice = localStorage.getItem("healthcare_cart_notice");

  if (cartNotice) {
    try {
      const parsed = JSON.parse(cartNotice);
      setNotice(parsed);
    } catch {
      setNotice({
        type: "success",
        message: "Prescription medicines were added to cart. Please review before checkout.",
      });
    }

    localStorage.removeItem("healthcare_cart_notice");
  }

  if (shouldOpenCheckout) {
    try {
      setCart(JSON.parse(localStorage.getItem("healthcare_cart") || "[]"));
    } catch {
      setCart([]);
    }

    setView("checkout");
  }
}, [location.search]);

  useEffect(() => {
    if (user) {
      setCheckout((current) => ({
        ...current,
        customer_name: current.customer_name || user.name || "",
      }));
    }
  }, [user]);

  async function loadMeta() {
    try {
      const response = await api.get("/pharmacy/meta");
      setMeta(response.data.data);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load pharmacy details.",
      });
    }
  }

  async function loadProducts() {
    setLoading(true);

    try {
      const response = await api.get("/pharmacy/products", {
        params: {
          search: filters.search,
          category: filters.category,
          manufacturer: filters.manufacturer,
          special: filters.special ? 1 : "",
        },
      });

      setProducts(response.data.data || []);
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load products.",
      });
    } finally {
      setLoading(false);
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

  function addToCart(product) {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);

      if (found) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });

    setNotice({
      type: "success",
      message: `${product.name} added to cart.`,
    });
  }

  function changeQuantity(productId, delta) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId) {
    setCart((current) => current.filter((item) => item.id !== productId));
  }

  function updateCheckout(event) {
    const { name, value } = event.target;

    setCheckout((current) => ({
      ...current,
      [name]: value,
      ...(name === "division" ? { district: "" } : {}),
    }));
  }

  async function placeOrder(event) {
    event.preventDefault();

    if (cart.length === 0) {
      setNotice({ type: "error", message: "Cart is empty." });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.post("/pharmacy/orders", {
        ...checkout,
        items: cart.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      });

      setOrderSuccess(response.data.data);
      setTrackedOrder(response.data.data);
      setCart([]);
      setCheckout(initialCheckout);
      setView("shop");

      setNotice({
        type: "success",
        message: response.data.message || "Order placed successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not place order.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function trackOrder(event) {
    event.preventDefault();

    if (!trackId.trim()) return;

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.get(`/pharmacy/orders/${trackId.trim()}`);
      setTrackedOrder(response.data.data);
      setView("track");
    } catch (error) {
      setTrackedOrder(null);
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Order not found.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadMyOrders() {
    if (!user) {
      setNotice({
        type: "error",
        message: "Please sign in to view your orders.",
      });
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const response = await api.get("/pharmacy/my-orders");
      setMyOrders(response.data.data || []);
      setView("orders");
    } catch (error) {
      setNotice({
        type: "error",
        message: error.response?.data?.message || "Could not load your orders.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="pharm-page">
      <style>{styles}</style>

      <div className="pharm-shell">
        <div className="pharm-hero">
          <div>
            <span className="hero-kicker">
              <Pill size={18} />
              Online Pharmacy
            </span>
            <h1>Order medicines with a modern checkout and order tracking.</h1>
            <p>
              Search medicines, add to cart, choose delivery information, place
              order, and track your pharmacy orders.
            </p>
          </div>

          <div className="hero-card">
            <div>
              <strong>{meta.stats?.total_products || 0}</strong>
              <span>Products</span>
            </div>
            <div>
              <strong>{meta.stats?.special_offers || 0}</strong>
              <span>Special Offers</span>
            </div>
            <div>
              <strong>{cart.length}</strong>
              <span>Cart Items</span>
            </div>
          </div>
        </div>

        {notice && (
          <div className={`pharm-notice ${notice.type}`}>
            {notice.message}
          </div>
        )}

        <div className="pharm-tabs">

          <button className={view === "shop" ? "active" : ""} onClick={() => setView("shop")}>
            <Pill size={16} />
            Pharmacy
          </button>

          <button className={view === "checkout" ? "active" : ""} onClick={() => setView("checkout")}>
            <ShoppingCart size={16} />
            Cart / Checkout
            {totals.count > 0 && <span>{totals.count}</span>}
          </button>

          <button className={view === "track" ? "active" : ""} onClick={() => setView("track")}>
            <PackageSearch size={16} />
            Track Order
          </button>

          <button className={view === "orders" ? "active" : ""} onClick={loadMyOrders}>
            <ReceiptText size={16} />
            My Orders
          </button>
          

        </div>

        {view === "shop" && (
          <>
            <div className="filter-card">
              <label className="search-box">
                <Search size={18} />
                <input
                  name="search"
                  value={filters.search}
                  onChange={updateFilter}
                  placeholder="Search medicine, category, manufacturer..."
                />
              </label>

              <select name="category" value={filters.category} onChange={updateFilter}>
                <option value="">All Categories</option>
                {meta.categories?.map((item) => (
                  <option key={item.category} value={item.category}>
                    {item.category} ({item.count})
                  </option>
                ))}
              </select>

              <select name="manufacturer" value={filters.manufacturer} onChange={updateFilter}>
                <option value="">All Manufacturers</option>
                {meta.manufacturers?.map((item) => (
                  <option key={item.manufacturer} value={item.manufacturer}>
                    {item.manufacturer}
                  </option>
                ))}
              </select>

              <label className="special-check">
                <input
                  type="checkbox"
                  name="special"
                  checked={filters.special}
                  onChange={updateFilter}
                />
                Special offers only
              </label>

              <button className="ghost-btn" onClick={resetFilters}>
                Reset
              </button>
            </div>

            {loading ? (
              <div className="empty-card">Loading pharmacy products...</div>
            ) : products.length === 0 ? (
              <div className="empty-card">No products found.</div>
            ) : (
              <div className="products-grid">
                {products.map((product) => (
                  <article className="product-card" key={product.id}>
                    {product.is_special_offer && (
                      <span className="offer-badge">
                        <BadgePercent size={14} />
                        {product.discount}% OFF
                      </span>
                    )}

                    <div className="product-image">
  {product.image ? (
    <img src={imageUrl(product.image)} alt={product.name} />
  ) : (
    <Pill size={34} />
  )}
</div>

                    <h3>{product.name}</h3>
                    <p>{product.manufacturer}</p>

                    <div className="product-meta">
                      <span>{product.category}</span>
                      <span className={product.in_stock ? "stock" : "stock out"}>
                        {product.in_stock ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    <div className="price-row">
                      <div>
                        <strong>৳{money(product.price)}</strong>
                        <del>৳{money(product.mrp)}</del>
                      </div>

                      <button
                        className="add-btn"
                        disabled={!product.in_stock}
                        onClick={() => addToCart(product)}
                      >
                        <Plus size={16} />
                        Add
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {view === "checkout" && (
          <div className="checkout-grid">
            <div className="cart-card">
              <h2>Your Cart</h2>

              {cart.length === 0 ? (
                <div className="empty-card">Your cart is empty.</div>
              ) : (
                <>
                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div className="cart-pill">
  {item.image ? (
    <img src={imageUrl(item.image)} alt={item.name} />
  ) : (
    <Pill size={22} />
  )}
</div>

                      <div>
                        <h4>{item.name}</h4>
                        <p>৳{money(item.price)} each</p>
                      </div>

                      <div className="qty-control">
                        <button onClick={() => changeQuantity(item.id, -1)} type="button">
                          <Minus size={14} />
                        </button>
                        <strong>{item.quantity}</strong>
                        <button onClick={() => changeQuantity(item.id, 1)} type="button">
                          <Plus size={14} />
                        </button>
                      </div>

                      <strong>৳{money(item.price * item.quantity)}</strong>

                      <button className="remove-btn" onClick={() => removeFromCart(item.id)} type="button">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  <div className="totals-card">
                    <Row label="MRP Total" value={`৳${money(totals.totalMrp)}`} />
                    <Row label="Discount" value={`-৳${money(totals.totalSavings)}`} good />
                    <Row label="Delivery Charge" value={totals.deliveryCharge === 0 ? "Free" : `৳${money(totals.deliveryCharge)}`} />
                    <Row label="Final Total" value={`৳${money(totals.finalTotal)}`} final />
                  </div>
                </>
              )}
            </div>

            <form className="checkout-card" onSubmit={placeOrder}>
              <h2>Delivery Details</h2>

              <label>
                Full Name *
                <input
                  name="customer_name"
                  value={checkout.customer_name}
                  onChange={updateCheckout}
                  required
                />
              </label>

              <label>
                Phone Number *
                <input
                  name="phone_number"
                  value={checkout.phone_number}
                  onChange={updateCheckout}
                  placeholder="017XXXXXXXX"
                  required
                />
              </label>

              <div className="two-col">
                <label>
                  Division *
                  <select
                    name="division"
                    value={checkout.division}
                    onChange={updateCheckout}
                    required
                  >
                    <option value="">Select Division</option>
                    {divisions.map((division) => (
                      <option key={division} value={division}>
                        {division}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  District *
                  <select
                    name="district"
                    value={checkout.district}
                    onChange={updateCheckout}
                    disabled={!checkout.division}
                    required
                  >
                    <option value="">Select District</option>
                    {districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Full Address *
                <textarea
                  name="address"
                  value={checkout.address}
                  onChange={updateCheckout}
                  required
                />
              </label>

              <label>
                Landmark
                <input
                  name="landmark"
                  value={checkout.landmark}
                  onChange={updateCheckout}
                />
              </label>

              <label>
                Delivery Time
                <select
                  name="delivery_time"
                  value={checkout.delivery_time}
                  onChange={updateCheckout}
                >
                  <option value="anytime">Anytime</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </label>

              <label>
                Special Instructions
                <textarea
                  name="special_instructions"
                  value={checkout.special_instructions}
                  onChange={updateCheckout}
                />
              </label>

              <button className="place-order-btn" disabled={loading || cart.length === 0}>
                <PackageCheck size={18} />
                {loading ? "Placing Order..." : "Place Order"}
              </button>
            </form>
          </div>
        )}

        {view === "track" && (
          <div className="track-grid">
            <form className="track-card" onSubmit={trackOrder}>
              <h2>Track Order</h2>
              <p>Enter your order ID to see order status and receipt.</p>

              <input
                value={trackId}
                onChange={(event) => setTrackId(event.target.value)}
                placeholder="Example: ORD69EF2FBAC9A1B"
              />

              <button className="place-order-btn">
                <PackageSearch size={18} />
                Track Order
              </button>
            </form>

            {trackedOrder && <OrderCard order={trackedOrder} />}
          </div>
        )}

        {view === "orders" && (
          <div className="orders-wrap">
            <h2>My Orders</h2>

            {!user && <div className="empty-card">Please sign in to view your orders.</div>}

            {user && myOrders.length === 0 && (
              <div className="empty-card">No orders found.</div>
            )}

            {myOrders.map((order) => (
              <OrderCard key={order.order_id} order={order} />
            ))}
          </div>
        )}

        {view === "admin" && <PharmacyAdminDashboard />}

        {totals.count > 0 && view !== "checkout" && (
          <button className="floating-cart" onClick={() => setView("checkout")}>
            <span>
              <ShoppingCart size={22} />
              <b>{totals.count}</b>
            </span>
            <div>
              <strong>View Cart</strong>
              <small>৳{money(totals.finalTotal)}</small>
            </div>
          </button>
        )}

        {orderSuccess && (
          <div className="success-modal">
            <div className="success-card">
              <button className="modal-close" onClick={() => setOrderSuccess(null)}>
                <X size={20} />
              </button>

              <div className="success-left">
                <div className="success-icon">
                  <CheckCircle size={34} />
                </div>
                <h2>Order Successful!</h2>
                <p>Your medicines order has been placed successfully.</p>

                <button
                  className="place-order-btn"
                  onClick={() => {
                    setTrackId(orderSuccess.order_id);
                    setTrackedOrder(orderSuccess);
                    setOrderSuccess(null);
                    setView("track");
                  }}
                >
                  Track Order
                </button>
              </div>

              <OrderCard order={orderSuccess} compact />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, value, good, final }) {
  return (
    <div className={`total-row ${final ? "final" : ""} ${good ? "good" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OrderCard({ order, compact = false }) {
  return (
    <article className={`order-card ${compact ? "compact" : ""}`}>
      <div className="order-head">
        <div>
          <h3>Order #{order.order_id}</h3>
          <p>{formatDate(order.created_at)}</p>
        </div>

        <span className={`status-badge ${order.status}`}>
          {statusIcon(order.status)}
          {order.status}
        </span>
      </div>

      <div className="receipt-items">
        {order.items?.map((item) => (
          <div className="receipt-item" key={item.id || item.product_id}>
            <div>
              <strong>{item.product_name}</strong>
              <p>Qty {item.quantity} × ৳{money(item.price)}</p>
            </div>
            <b>৳{money(item.line_total || item.price * item.quantity)}</b>
          </div>
        ))}
      </div>

      <div className="receipt-total">
        <Row label="Items Total" value={`৳${money(order.total_amount)}`} />
        <Row label="Savings" value={`৳${money(order.total_savings)}`} good />
        <Row label="Delivery" value={`৳${money(order.delivery_charge)}`} />
        <Row label="Final Total" value={`৳${money(order.final_total)}`} final />
      </div>

      <div className="delivery-box">
        <strong>{order.customer_name}</strong>
        <span>{order.phone_number}</span>
        <span>{order.address}, {order.district}, {order.division}</span>
      </div>
    </article>
  );
}

const styles = `
.pharm-page {
  background: #f8fafc;
  min-height: 100%;
  padding: 28px 16px 48px;
  color: #0f172a;
}

.pharm-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.pharm-hero {
  display: grid;
  grid-template-columns: 1.4fr .65fr;
  gap: 18px;
  margin-bottom: 18px;
}

.pharm-hero > div:first-child {
  background: linear-gradient(135deg, #2563eb, #4f46e5 55%, #10b981);
  color: white;
  border-radius: 26px;
  padding: clamp(26px, 5vw, 44px);
  box-shadow: 0 26px 60px rgba(37,99,235,.22);
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,.16);
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 900;
  margin-bottom: 16px;
}

.pharm-hero h1 {
  margin: 0;
  max-width: 780px;
  font-size: clamp(2rem, 5vw, 3.6rem);
  line-height: 1;
  letter-spacing: -.06em;
}

.pharm-hero p {
  color: #dbeafe;
  max-width: 680px;
  margin: 16px 0 0;
}

.hero-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 26px;
  padding: 22px;
  display: grid;
  gap: 12px;
  box-shadow: 0 18px 45px rgba(15,23,42,.08);
}

.hero-card > div {
  background: #f8fafc;
  border-radius: 18px;
  padding: 18px;
}

.hero-card strong {
  display: block;
  font-size: 2rem;
}

.hero-card span {
  color: #64748b;
  font-weight: 800;
  font-size: .86rem;
}

.pharm-notice {
  border-radius: 16px;
  padding: 13px 16px;
  margin-bottom: 16px;
  font-weight: 900;
}

.pharm-notice.success {
  background: #dcfce7;
  color: #166534;
}

.pharm-notice.error {
  background: #fee2e2;
  color: #991b1b;
}

.pharm-tabs {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  margin-bottom: 16px;
}

.pharm-tabs button {
  border: 1px solid #dbe3ef;
  background: white;
  color: #334155;
  border-radius: 999px;
  padding: 11px 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
}

.pharm-tabs button.active {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
  box-shadow: 0 10px 20px rgba(37,99,235,.22);
}

.pharm-tabs span {
  background: white;
  color: #2563eb;
  border-radius: 999px;
  padding: 2px 7px;
}

.filter-card,
.cart-card,
.checkout-card,
.track-card,
.order-card,
.empty-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  box-shadow: 0 14px 34px rgba(15,23,42,.07);
}

.filter-card {
  padding: 16px;
  display: grid;
  grid-template-columns: minmax(260px, 1.4fr) repeat(3, minmax(160px, 1fr)) auto;
  gap: 12px;
  margin-bottom: 18px;
  align-items: center;
}

.search-box {
  position: relative;
}

.search-box svg {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}

.search-box input {
  padding-left: 42px;
}

.filter-card input,
.filter-card select,
.checkout-card input,
.checkout-card select,
.checkout-card textarea,
.track-card input {
  width: 100%;
  border: 1px solid #dbe3ef;
  border-radius: 14px;
  padding: 12px;
  outline: none;
  font: inherit;
  font-weight: 700;
}

.checkout-card textarea {
  min-height: 88px;
  resize: vertical;
}

.special-check {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-weight: 900;
  background: #f8fafc;
  border-radius: 14px;
  padding: 12px;
}

.ghost-btn {
  border: 1px solid #dbe3ef;
  background: #f8fafc;
  color: #334155;
  border-radius: 14px;
  padding: 12px 16px;
  font-weight: 900;
  cursor: pointer;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.product-card {
  position: relative;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 18px;
  box-shadow: 0 14px 34px rgba(15,23,42,.07);
  overflow: hidden;
}

.offer-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #fee2e2;
  color: #b91c1c;
  border-radius: 999px;
  padding: 6px 9px;
  font-size: .74rem;
  font-weight: 950;
}

.product-image {
  width: 100%;
  height: 150px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  background: linear-gradient(135deg, #dbeafe, #dcfce7);
  color: #2563eb;
  margin-bottom: 16px;
  overflow: hidden;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-card h3 {
  margin: 0 0 6px;
  font-size: 1.05rem;
}

.product-card p {
  margin: 0;
  color: #64748b;
  font-size: .88rem;
}

.product-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 14px 0;
  font-size: .8rem;
  font-weight: 900;
}

.product-meta span:first-child {
  color: #2563eb;
  background: #dbeafe;
  border-radius: 999px;
  padding: 5px 8px;
}

.stock {
  color: #166534;
  background: #dcfce7;
  border-radius: 999px;
  padding: 5px 8px;
}

.stock.out {
  color: #991b1b;
  background: #fee2e2;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.price-row strong {
  display: block;
  font-size: 1.25rem;
  color: #047857;
}

.price-row del {
  color: #94a3b8;
  font-size: .85rem;
}

.add-btn,
.place-order-btn {
  border: none;
  background: #2563eb;
  color: white;
  border-radius: 14px;
  padding: 11px 14px;
  font-weight: 950;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 10px 20px rgba(37,99,235,.22);
}

.add-btn:disabled,
.place-order-btn:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.checkout-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 18px;
  align-items: start;
}

.cart-card,
.checkout-card,
.track-card,
.order-card {
  padding: 20px;
}

.cart-card h2,
.checkout-card h2,
.track-card h2,
.orders-wrap h2 {
  margin: 0 0 16px;
}

.cart-item {
  display: grid;
  grid-template-columns: 48px 1fr auto auto auto;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #e2e8f0;
}

.cart-pill {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 16px;
}

.cart-item h4 {
  margin: 0 0 4px;
}

.cart-item p {
  margin: 0;
  color: #64748b;
  font-size: .85rem;
}

.qty-control {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border: 1px solid #dbe3ef;
  border-radius: 999px;
  padding: 5px;
  background: #f8fafc;
}

.qty-control button,
.remove-btn {
  border: none;
  background: white;
  color: #2563eb;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.remove-btn {
  color: #dc2626;
  background: #fee2e2;
}

.totals-card {
  margin-top: 16px;
  background: #f8fafc;
  border-radius: 18px;
  padding: 16px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  color: #475569;
}

.total-row.good strong {
  color: #16a34a;
}

.total-row.final {
  border-top: 1px solid #dbe3ef;
  margin-top: 8px;
  padding-top: 12px;
  font-size: 1.15rem;
  color: #0f172a;
}

.checkout-card {
  display: grid;
  gap: 12px;
}

.checkout-card label {
  display: grid;
  gap: 7px;
  color: #334155;
  font-weight: 900;
  font-size: .88rem;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.track-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 18px;
  align-items: start;
}

.track-card {
  display: grid;
  gap: 12px;
}

.order-card {
  margin-bottom: 16px;
}

.order-card.compact {
  margin: 0;
}

.order-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 16px;
}

.order-head h3 {
  margin: 0 0 4px;
}

.order-head p {
  margin: 0;
  color: #64748b;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-transform: capitalize;
  border-radius: 999px;
  padding: 7px 10px;
  background: #fef3c7;
  color: #92400e;
  font-weight: 950;
  font-size: .8rem;
}

.status-badge.confirmed,
.status-badge.delivered {
  background: #dcfce7;
  color: #166534;
}

.status-badge.processing,
.status-badge.shipped {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-badge.cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.receipt-item {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px dashed #cbd5e1;
  padding: 10px 0;
}

.receipt-item p {
  margin: 3px 0 0;
  color: #64748b;
  font-size: .84rem;
}

.receipt-total {
  margin-top: 14px;
}

.delivery-box {
  margin-top: 14px;
  background: #f8fafc;
  border-radius: 16px;
  padding: 14px;
  display: grid;
  gap: 4px;
  color: #475569;
}

.delivery-box strong {
  color: #0f172a;
}

.empty-card {
  padding: 28px;
  text-align: center;
  color: #64748b;
}

.floating-cart {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1000;
  border: none;
  border-radius: 22px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  background: linear-gradient(135deg, #2563eb, #10b981);
  box-shadow: 0 24px 50px rgba(37,99,235,.35);
  cursor: pointer;
}

.floating-cart span {
  position: relative;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: rgba(255,255,255,.18);
}

.floating-cart b {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 24px;
  height: 24px;
  border-radius: 999px;
  background: white;
  color: #2563eb;
  display: grid;
  place-items: center;
  font-size: .75rem;
}

.floating-cart strong,
.floating-cart small {
  display: block;
  text-align: left;
}

.success-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(15,23,42,.56);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.success-card {
  position: relative;
  width: min(960px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  background: white;
  border-radius: 28px;
  padding: 26px;
  display: grid;
  grid-template-columns: .8fr 1.1fr;
  gap: 24px;
  box-shadow: 0 34px 90px rgba(15,23,42,.35);
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  cursor: pointer;
}

.success-left {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.success-icon {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #10b981, #2563eb);
  color: white;
  border-radius: 24px;
  margin-bottom: 18px;
}

.success-left h2 {
  font-size: 2.5rem;
  line-height: 1;
  margin: 0;
  letter-spacing: -.05em;
}

.success-left p {
  color: #64748b;
}

@media (max-width: 1040px) {
  .products-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .pharm-hero,
  .checkout-grid,
  .track-grid,
  .success-card {
    grid-template-columns: 1fr;
  }

  .filter-card {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.cart-pill {
  overflow: hidden;
}

.cart-pill img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 720px) {
  .products-grid,
  .filter-card,
  .two-col {
    grid-template-columns: 1fr;
  }

  .cart-item {
    grid-template-columns: 48px 1fr;
  }

  .floating-cart {
    left: 14px;
    right: 14px;
    bottom: 14px;
    justify-content: center;
  }
}
`;