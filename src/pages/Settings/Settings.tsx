import { ArrowRight, Hash, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";

import type { User } from "../../hooks/useAuth";
import "./Settings.scss";

interface SettingsProps {
  user: User;
}

export default function Settings({ user }: SettingsProps) {
  const hasComAccess =
    user.areas_acceso.includes("videoseguridad");

  const canReadUsers =
    hasComAccess && user.permisos.includes("users:read");

  const canReadNumbering =
    hasComAccess && user.permisos.includes("eventos:read");

  const canConfigureNumbering =
    user.permisos.includes("numeracion:configurar");

  return (
    <main className="settings-page">
      <div className="settings-page__container">
        <header className="settings-page__heading">
          <p>Centro de Monitoreo</p>
          <h1>Configuración</h1>
          <p>
            Accedé a las opciones disponibles según tus permisos.
          </p>
        </header>

        {!canReadUsers && !canReadNumbering ? (
          <p>No tenés opciones de configuración disponibles para COM.</p>
        ) : (
          <div className="settings-page__grid">
            {canReadUsers && (
              <Link
                to="/configuracion/usuarios"
                className="settings-page__card"
              >
                <span
                  className="settings-page__icon"
                  aria-hidden="true"
                >
                  <UsersRound />
                </span>

                <h2>Usuarios</h2>

                <p>
                  Consultá las cuentas del área y gestioná los
                  operadores según tus permisos.
                </p>

                <span className="settings-page__access">
                  Ver usuarios
                  <ArrowRight aria-hidden="true" />
                </span>
              </Link>
            )}

            {canReadNumbering && (
              <Link
                to="/configuracion/numeracion"
                className="settings-page__card"
              >
                <span
                  className="settings-page__icon"
                  aria-hidden="true"
                >
                  <Hash />
                </span>

                <h2>Numeración de eventos</h2>

                <p>
                  {canConfigureNumbering
                    ? "Consultá el contador del área y realizá su configuración inicial si todavía está pendiente."
                    : "Consultá el estado de la numeración de eventos del área."}
                </p>

                <span className="settings-page__access">
                  Ver numeración
                  <ArrowRight aria-hidden="true" />
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}