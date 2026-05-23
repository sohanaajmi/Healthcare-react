import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  Dna,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
  Mail,
  Pill,
  ShieldCheck,
  
  Stethoscope,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function SignIn() {
  const navigate = useNavigate();
  
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(form.email, form.password);

      if (result.success) {
        navigate("/dashboard", { replace: true });
      } else {
        setError(result.message || "Login failed.");
      }
    } catch (error) {
      setError(error.response?.data?.message || "Login failed. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="medical-auth-page">
      <style>{styles}</style>

      <div className="auth-bg-glow glow-one" />
      <div className="auth-bg-glow glow-two" />
      <div className="floating-med med-one"><Dna size={56} /></div>
      <div className="floating-med med-two"><HeartPulse size={30} /></div>
      <div className="floating-med med-three"><Pill size={25} /></div>
      <div className="floating-med med-four"><Stethoscope size={48} /></div>

      <svg className="ecg-line" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 112H180L210 82L248 150L285 112H375L394 112H520L545 112H690L716 112H880L910 62L946 162L985 112H1440" />
      </svg>

      <div className="wave-layer wave-a" />
      <div className="wave-layer wave-b" />

      <form className="medical-auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-icon">
          <Stethoscope size={35} />
        </div>

        <div className="auth-title-block">
          <span><ShieldCheck size={15} /> Secure Healthcare Access</span>
          <h1>Welcome Back!</h1>
          <p>Sign in to continue using hospitals, pharmacy, telemedicine, ambulance, appointments and more.</p>
        </div>

        {error && <div className="auth-alert">{error}</div>}

        <label className="line-field">
          <span>Email or Phone</span>
          <div>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={updateField}
              required
              placeholder="Enter your email"
              autoComplete="email"
            />
            <Mail size={17} />
          </div>
        </label>

        <label className="line-field">
          <span>Password</span>
          <div>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={updateField}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button type="button" className="field-icon-btn" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <div className="auth-row">
          <span><LockKeyhole size={14} /> Login required for all features</span>
          <button type="button">Forgot Password?</button>
        </div>

        <button className="auth-submit" disabled={loading}>
          {loading ? <><Activity className="spin" size={18} /> Signing In...</> : "SIGN IN"}
        </button>

        <p className="auth-switch-text">
          Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </form>
    </section>
  );
}

const styles = `
.medical-auth-page {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 28px 18px;
  background:
    radial-gradient(circle at 20% 18%, rgba(255,255,255,.23), transparent 18%),
    linear-gradient(135deg, #14a6b1 0%, #24bdc3 50%, #43d3d1 100%);
  color: #075c65;
  isolation: isolate;
}

.auth-bg-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(8px);
  opacity: .45;
  animation: slowFloat 8s ease-in-out infinite alternate;
}

.glow-one {
  width: 420px;
  height: 420px;
  background: rgba(255,255,255,.18);
  top: 4%;
  left: 14%;
}

.glow-two {
  width: 360px;
  height: 360px;
  background: rgba(255,255,255,.16);
  right: 11%;
  bottom: 20%;
  animation-delay: -2s;
}

.floating-med {
  position: absolute;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: rgba(255,255,255,.78);
  background: rgba(255,255,255,.24);
  border: 1px solid rgba(255,255,255,.26);
  box-shadow: 0 28px 60px rgba(0, 106, 116, .18);
  animation: floatIcon 5.8s ease-in-out infinite;
  z-index: 1;
}

.med-one { width: 122px; height: 122px; left: 2.5%; top: 17%; animation-delay: -.4s; }
.med-two { width: 64px; height: 64px; left: 31%; top: 1.6%; animation-delay: -1.4s; }
.med-three { width: 54px; height: 54px; right: 40%; top: 10%; animation-delay: -.9s; }
.med-four { width: 92px; height: 92px; right: 6%; top: 22%; animation-delay: -2.2s; }

.ecg-line {
  position: absolute;
  left: 0;
  bottom: 140px;
  width: 100%;
  height: 190px;
  z-index: 1;
  pointer-events: none;
  opacity: .78;
}

.ecg-line path {
  fill: none;
  stroke: rgba(227, 255, 255, .9);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1900;
  stroke-dashoffset: 1900;
  animation: drawEcg 4.2s ease-in-out infinite;
}

.wave-layer {
  position: absolute;
  left: -10%;
  right: -10%;
  bottom: -210px;
  height: 360px;
  border-radius: 50% 50% 0 0;
  transform-origin: center bottom;
  z-index: 0;
}

.wave-a {
  background: rgba(210, 255, 255, .58);
  animation: waveMove 7s ease-in-out infinite alternate;
}

.wave-b {
  bottom: -245px;
  background: rgba(234, 255, 255, .42);
  animation: waveMove 8s ease-in-out infinite alternate-reverse;
}

.medical-auth-card {
  position: relative;
  z-index: 3;
  width: min(500px, 100%);
  min-height: 530px;
  border-radius: 14px;
  padding: 34px 54px 30px;
  background: rgba(221, 250, 250, .72);
  border: 1px solid rgba(255,255,255,.55);
  box-shadow: 0 34px 85px rgba(1, 93, 104, .24);
  backdrop-filter: blur(15px);
  display: grid;
  gap: 18px;
  overflow: hidden;
}

.medical-auth-card::before {
  content: "";
  position: absolute;
  left: -10%;
  right: -10%;
  bottom: -68px;
  height: 130px;
  background: rgba(241, 255, 255, .7);
  border-radius: 50% 50% 0 0;
  z-index: -1;
}

.auth-card-icon {
  width: 70px;
  height: 70px;
  margin: -16px auto 0;
  border-radius: 999px;
  background: rgba(236, 255, 255, .9);
  color: #1295a0;
  display: grid;
  place-items: center;
  box-shadow: 0 14px 28px rgba(0, 113, 122, .14);
  animation: pulseIcon 2.8s ease-in-out infinite;
}

.auth-title-block {
  text-align: center;
}

.auth-title-block span {
  width: fit-content;
  margin: 0 auto 10px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: 999px;
  color: #087b85;
  background: rgba(255,255,255,.52);
  font-size: .78rem;
  font-weight: 900;
}

.auth-title-block h1 {
  margin: 0;
  color: #5f7479;
  font-weight: 500;
  letter-spacing: .03em;
  font-size: clamp(2rem, 4vw, 2.35rem);
}

.auth-title-block p {
  margin: 9px auto 0;
  max-width: 370px;
  color: #5f797d;
  font-size: .9rem;
  font-weight: 700;
  line-height: 1.5;
}

.auth-alert {
  border-radius: 10px;
  padding: 11px 13px;
  background: rgba(254, 226, 226, .82);
  color: #991b1b;
  font-weight: 850;
  font-size: .87rem;
}

.line-field {
  display: grid;
  gap: 7px;
  color: #07818b;
  font-weight: 900;
  font-size: .86rem;
}

.line-field > div {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  border-bottom: 1px solid rgba(8, 126, 136, .32);
  background: rgba(246, 251, 255, .82);
  min-height: 34px;
}

.line-field input {
  width: 100%;
  min-height: 34px;
  border: none;
  outline: none;
  padding: 6px 7px;
  background: transparent;
  color: #12363b;
  font: inherit;
  font-weight: 700;
}

.line-field svg {
  color: rgba(8, 126, 136, .55);
  margin-right: 2px;
}

.field-icon-btn {
  width: 31px;
  height: 31px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.auth-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-top: -2px;
}

.auth-row span,
.auth-row button {
  border: none;
  background: transparent;
  color: #087b85;
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-weight: 900;
  font-size: .78rem;
}

.auth-row button {
  cursor: pointer;
  padding: 0;
}

.auth-submit {
  min-height: 55px;
  border: none;
  border-radius: 6px;
  margin-top: 6px;
  background: linear-gradient(135deg, #19b9c0, #06909a);
  color: white;
  font-size: 1rem;
  font-weight: 950;
  letter-spacing: .08em;
  cursor: pointer;
  box-shadow: 0 16px 35px rgba(6, 144, 154, .25);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
}

.auth-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 42px rgba(6, 144, 154, .32);
}

.auth-submit:disabled {
  opacity: .7;
  cursor: not-allowed;
  transform: none;
}

.auth-switch-text {
  margin: 6px 0 0;
  text-align: center;
  color: #71858a;
  font-size: .88rem;
  font-weight: 700;
}

.auth-switch-text a {
  color: #087b85;
  font-weight: 950;
  text-decoration: none;
}

.spin { animation: spin .9s linear infinite; }

@keyframes floatIcon {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  50% { transform: translate3d(0, -18px, 0) rotate(3deg); }
}

@keyframes slowFloat {
  from { transform: translate3d(-12px, 0, 0) scale(1); }
  to { transform: translate3d(16px, 20px, 0) scale(1.06); }
}

@keyframes drawEcg {
  0% { stroke-dashoffset: 1900; opacity: .15; }
  35% { opacity: .9; }
  68%, 100% { stroke-dashoffset: 0; opacity: .76; }
}

@keyframes waveMove {
  from { transform: translateX(-22px) scaleY(1); }
  to { transform: translateX(22px) scaleY(1.04); }
}

@keyframes pulseIcon {
  0%,100% { transform: translateY(0) scale(1); box-shadow: 0 14px 28px rgba(0, 113, 122, .14); }
  50% { transform: translateY(-3px) scale(1.04); box-shadow: 0 20px 36px rgba(0, 113, 122, .21); }
}

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 720px) {
  .medical-auth-card { padding: 30px 24px 28px; min-height: auto; }
  .med-one { width: 86px; height: 86px; left: -24px; top: 11%; }
  .med-four { width: 74px; height: 74px; right: -16px; top: 14%; }
  .med-two, .med-three { display: none; }
  .ecg-line { bottom: 90px; }
  .auth-row { flex-direction: column; align-items: flex-start; }
}
`;
