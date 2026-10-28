import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";

import type { User } from "../../hooks/useAuth";
import "./Profile.scss";

interface ProfileProps {
  user: User;
}

const AREA_LABELS: Record<string, string> = {
  videoseguridad: "Centro de Monitoreo",
  zoonosis: "Zoonosis",
  bromatologia: "Bromatología",
};

function displayValue(value: string | null): string {
  return value?.trim() || "Sin información";
}

export default function Profile({ user }: ProfileProps) {
  return (
    <main className="profile-page">
      <div className="profile-page__container">
        <header className="profile-page__heading">
          <div>
            <p>Mi cuenta</p>
            <h1>Perfil de usuario</h1>
            <p>Consultá tus datos personales y de acceso.</p>
          </div>

          <Link
            to="/panel"
            className="profile-page__back"
          >
            Volver al panel
          </Link>
        </header>

        <section
          className="profile-page__card"
          aria-labelledby="profile-personal-heading"
        >
          <div className="profile-page__identity">
            <span
              className="profile-page__avatar"
              aria-hidden="true"
            >
              <UserRound />
            </span>

            <div>
              <h2 id="profile-personal-heading">
                Datos personales
              </h2>
              <p>{user.name}</p>
            </div>
          </div>

          <dl className="profile-page__grid">
            <div>
              <dt>Nombre</dt>
              <dd>{displayValue(user.nombre)}</dd>
            </div>

            <div>
              <dt>Apellido</dt>
              <dd>{displayValue(user.apellido)}</dd>
            </div>

            <div>
              <dt>Nombre de usuario</dt>
              <dd>{user.username}</dd>
            </div>

            <div>
              <dt>Correo electrónico</dt>
              <dd>{displayValue(user.email)}</dd>
            </div>
          </dl>
        </section>

        <section
          className="profile-page__card"
          aria-labelledby="profile-access-heading"
        >
          <h2 id="profile-access-heading">
            Acceso al sistema
          </h2>

          <dl className="profile-page__grid">
            <div>
              <dt>Rol</dt>
              <dd>{user.role}</dd>
            </div>

            <div>
              <dt>Área asignada</dt>
              <dd>
                {user.area
                  ? AREA_LABELS[user.area] ?? user.area
                  : "Sin área asignada"}
              </dd>
            </div>

            <div className="profile-page__wide">
              <dt>Áreas a las que tenés acceso</dt>
              <dd>
                {user.areas_acceso.length > 0 ? (
                  <ul className="profile-page__areas">
                    {user.areas_acceso.map(area => (
                      <li key={area}>
                        {AREA_LABELS[area] ?? area}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "Sin áreas de acceso"
                )}
              </dd>
            </div>
          </dl>
        </section>

        <p className="profile-page__note">
          Los datos corresponden a tu último inicio de sesión.
          Si necesitás corregirlos, contactá al responsable de
          administrar tu cuenta.
        </p>
      </div>
    </main>
  );
}