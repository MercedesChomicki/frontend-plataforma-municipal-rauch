import { useEffect, useId, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

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
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join("")
      .toUpperCase() || "U"
  );
}

export default function Navbar(props: NavbarProps) {
  const { pathname } = useLocation();

  // Reinicia el menú al cambiar de página.
  return <NavbarContent key={pathname} {...props} />;
}

function NavbarContent({ user, onLogout }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigationId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);

  const canSeeSettings =
    user.areas_acceso.includes("videoseguridad") &&
    (
      user.permisos.includes("users:read") ||
      user.permisos.includes("eventos:read")
    );

  const links = [
    { to: "/panel", label: "Panel de control", end: true },
    { to: "/eventos", label: "Eventos", end: false },
    { to: "/reportes", label: "Reportes", end: false },
    { to: "/mapa", label: "Mapa", end: false },
    ...(canSeeSettings
      ? [
          {
            to: "/configuracion",
            label: "Configuración",
            end: false,
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (!menuOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) return;

      if (
        !navigationRef.current?.contains(target) &&
        !menuButtonRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <NavLink
          to="/panel"
          className="navbar__brand"
          aria-label="Ir al panel de control"
          onClick={() => setMenuOpen(false)}
        >
          <img
            src={municipalLogo}
            alt="Municipalidad de Rauch"
          />
        </NavLink>

        <button
          ref={menuButtonRef}
          className="navbar__menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls={navigationId}
          onClick={() => setMenuOpen(value => !value)}
        >
          {menuOpen ? (
            <X aria-hidden="true" />
          ) : (
            <Menu aria-hidden="true" />
          )}
          <span>{menuOpen ? "Cerrar" : "Menú"}</span>
        </button>

        <nav
          ref={navigationRef}
          id={navigationId}
          className={`navbar__nav${
            menuOpen ? " navbar__nav--open" : ""
          }`}
          aria-label="Navegación principal"
        >
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `navbar__link${
                  isActive ? " navbar__link--active" : ""
                }`
              }
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="navbar__account">
          <NavLink
            to="/perfil"
            className={({ isActive }) =>
              `navbar__profile${
                isActive ? " navbar__profile--active" : ""
              }`
            }
            aria-label={`Ver perfil de ${user.name}`}
            title="Ver mi perfil"
            onClick={() => setMenuOpen(false)}
          >
            <span className="navbar__avatar" aria-hidden="true">
              {getInitials(user.name)}
            </span>

            <span className="navbar__user">
              <strong>{user.name}</strong>
              {user.role && <span>{user.role}</span>}
            </span>
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
      </div>
    </header>
  );
}