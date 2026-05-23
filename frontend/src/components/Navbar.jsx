import { NavLink } from "react-router-dom";
import {
  Ambulance as AmbulanceIcon,
  CalendarDays,
  Droplet,
  Hospital,
  Info,
  LayoutDashboard,
  Microscope,
  Pill,
  Video,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Hospitals",
    path: "/hospitals",
    icon: Hospital,
  },
  {
    label: "Diagnostic Centers",
    path: "/diagnostic-centers",
    icon: Microscope,
  },
  {
    label: "Blood Banks",
    path: "/blood-banks",
    icon: Droplet,
  },
  {
    label: "Pharmacies",
    path: "/pharmacies",
    icon: Pill,
  },
  {
    label: "Ambulance",
    path: "/ambulance",
    icon: AmbulanceIcon,
  },
  {
    label: "Telemedicine",
    path: "/telemedicine",
    icon: Video,
  },
  {
    label: "Drug Interactions",
    path: "/drug-interactions",
    icon: Info,
  },
  {
    label: "Appointments",
    path: "/appointments",
    icon: CalendarDays,
  },
];

const navFixStyles = `
.nav .nav-container.dashboard-nav-fix {
  width: 100%;
  max-width: 100%;
  justify-content: flex-start;
  overflow-x: auto;
  overflow-y: hidden;
  padding-left: 24px;
  padding-right: 26px;
  gap: 6px;
  scrollbar-width: thin;
}

.nav .nav-container.dashboard-nav-fix::-webkit-scrollbar {
  height: 6px;
}

.nav .nav-container.dashboard-nav-fix::-webkit-scrollbar-thumb {
  background: rgba(37, 99, 235, .28);
  border-radius: 999px;
}

.nav .nav-container.dashboard-nav-fix .nav-item {
  flex: 0 0 auto;
  min-width: max-content;
  white-space: nowrap;
  padding-left: 12px;
  padding-right: 12px;
  gap: 7px;
}

.nav .nav-container.dashboard-nav-fix .nav-item span {
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .nav .nav-container.dashboard-nav-fix {
    padding-left: 12px;
    padding-right: 12px;
  }

  .nav .nav-container.dashboard-nav-fix .nav-item {
    padding-left: 10px;
    padding-right: 10px;
    font-size: .92rem;
  }
}
`;

export default function Navbar() {
  return (
    <nav className="nav">
      <style>{navFixStyles}</style>

      <div className="container nav-container dashboard-nav-fix">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
