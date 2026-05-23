import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <section className="auth-loading-screen">
        <style>{`
          .auth-loading-screen {
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: linear-gradient(135deg, #ecfeff, #eff6ff, #f8fafc);
            color: #0f172a;
            font-weight: 950;
            letter-spacing: .03em;
          }

          .auth-loading-screen::before {
            content: "";
            width: 54px;
            height: 54px;
            border-radius: 50%;
            border: 5px solid #dbeafe;
            border-top-color: #2563eb;
            animation: spinAuth 850ms linear infinite;
          }

          @keyframes spinAuth {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </section>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
