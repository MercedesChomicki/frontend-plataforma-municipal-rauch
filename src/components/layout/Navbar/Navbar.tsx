import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";

import municipalLogo from "../../../assets/images/logo.svg";
import "./Navbar.scss";

interface NavbarProps {
  user: {
    name: string;
    role?: string;
    permisos: string[];
    areas_acceso: string[];
  };
  onLogout: () => void;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  return (
    <header className="navbar">
      <NavLink
        to="/panel"
        className="navbar__brand"
        aria-label="Ir al panel de control"
      >
        <img src={municipalLogo} alt="Municipalidad de Rauch" />
      </NavLink>

      <nav className="navbar__nav" aria-label="Navegación principal">
        <NavLink
          to="/panel"
          end
          className={({ isActive }) =>
            `navbar__link${isActive ? " navbar__link--active" : ""}`
          }
        >
          Panel de control
        </NavLink>

        <NavLink
          to="/eventos"
          className={({ isActive }) =>
            `navbar__link${isActive ? " navbar__link--active" : ""}`
          }
        >
          Eventos
        </NavLink>

        <NavLink
          to="/reportes"
          className={({ isActive }) =>
            `navbar__link${isActive ? " navbar__link--active" : ""}`
          }
        >
          Reportes
        </NavLink>

        <NavLink
          to="/mapa"
          className={({ isActive }) =>
            `navbar__link${isActive ? " navbar__link--active" : ""}`
          }
        >
          Mapa
        </NavLink>

        {user.areas_acceso.includes("videoseguridad") &&
          (user.permisos.includes("users:read") ||
            user.permisos.includes("eventos:read")) && (
            <NavLink
              to="/configuracion"
              className={({ isActive }) =>
                `navbar__link${isActive ? " navbar__link--active" : ""}`
              }
            >
              Configuración
            </NavLink>
          )}
      </nav>

      <div className="navbar__account">
        <NavLink
          to="/perfil"
          className="navbar__avatar"
          aria-label="Ver mi perfil"
          title="Ver mi perfil"
        >
          {getInitials(user.name)}
        </NavLink>

        <NavLink
          to="/perfil"
          className="navbar__user"
          aria-label={`Ver perfil de ${user.name}`}
          title="Ver mi perfil"
        >
          <strong>{user.name}</strong>
          {user.role && <span>{user.role}</span>}
        </NavLink>

        <button
          className="navbar__logout"
          type="button"
          onClick={onLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
