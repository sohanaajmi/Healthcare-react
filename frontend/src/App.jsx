import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
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
      {/* Admin page without main Header/Navbar */}
      <Route path="/pharmacy-admin" element={<PharmacyAdminDashboard />} />
      <Route path="/ambulance-manager" element={<AmbulanceManagerDashboard />} />

      {/* Public app pages with main Header/Navbar */}
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/hospitals" replace />} />
        <Route path="/hospitals" element={<Hospitals />} />
        <Route path="/diagnostic-centers" element={<DiagnosticCenters />} />
        <Route path="/blood-banks" element={<BloodBanks />} />
        <Route path="/pharmacies" element={<Pharmacies />} />
        <Route path="/ambulance" element={<Ambulance />} />
        <Route path="/telemedicine" element={<Telemedicine />} />
        <Route path="/telemedicine-doctor" element={<DoctorTelemedicineDashboard />} />
        <Route path="/drug-interactions" element={<DrugInteractions />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
      </Route>
    </Routes>
  );
}