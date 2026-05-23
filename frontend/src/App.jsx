import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Hospitals from "./pages/Hospitals.jsx";
import DiagnosticCenters from "./pages/DiagnosticCenters.jsx";
import BloodBanks from "./pages/BloodBanksPhp.jsx";
import Pharmacies from "./pages/Pharmacies.jsx";
import Ambulance from "./pages/Ambulance.jsx";
import Telemedicine from "./pages/Telemedicine.jsx";
import DrugInteractions from "./pages/DrugInteractions.jsx";
import Appointments from "./pages/Appointments.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import PharmacyAdminDashboard from "./pages/PharmacyAdminDashboard.jsx";
import AmbulanceManagerDashboard from "./pages/AmbulanceManagerDashboard.jsx";
import DoctorTelemedicineDashboard from "./pages/DoctorTelemedicineDashboard.jsx";

export default function App() {
  return (
    <Routes>
      {/* Public auth pages */}
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Admin / manager pages use their own login */}
      <Route path="/pharmacy-admin" element={<PharmacyAdminDashboard />} />
      <Route path="/ambulance-manager" element={<AmbulanceManagerDashboard />} />
      <Route path="/telemedicine-doctor" element={<DoctorTelemedicineDashboard />} />

      {/* User app pages require normal user sign in */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/hospitals" element={<Hospitals />} />
        <Route path="/diagnostic-centers" element={<DiagnosticCenters />} />
        <Route path="/blood-banks" element={<BloodBanks />} />
        <Route path="/pharmacies" element={<Pharmacies />} />
        <Route path="/ambulance" element={<Ambulance />} />
        <Route path="/telemedicine" element={<Telemedicine />} />
        <Route path="/drug-interactions" element={<DrugInteractions />} />
        <Route path="/appointments" element={<Appointments />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
