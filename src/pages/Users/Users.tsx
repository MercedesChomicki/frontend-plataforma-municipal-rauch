import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { User } from "../../hooks/useAuth";
import {
  getUsers,
  setUserActive,
  UsersError,
} from "../../services/usersService";
import type { ManagedUser } from "../../services/usersService";
import CreateOperatorForm from "../../components/users/CreateOperatorForm/CreateOperatorForm";

import "./Users.scss";

interface UsersProps {
  accessToken: string;
  user: User;
  onLogout: () => void;
}

function fullName(user: ManagedUser): string {
  return (
    [user.nombre, user.apellido].filter(Boolean).join(" ").trim() ||
    user.username
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function Users(props: UsersProps) {
  const [revision, setRevision] = useState(0);

  const canRead =
    props.user.permisos.includes("users:read") &&
    props.user.areas_acceso.includes("videoseguridad");

  if (!canRead) {
    return (
      <main className="users-page">
        <div className="users-page__container">
          <h1>Usuarios</h1>
          <p>No tenés permiso para consultar los usuarios de COM.</p>
          <Link to="/panel">Volver al panel</Link>
          <Link to="/configuracion">Volver a configuración</Link>
        </div>
      </main>
    );
  }

  return (
    <UsersContent
      key={JSON.stringify([props.accessToken, props.user.id, revision])}
      {...props}
      onRefresh={() => setRevision((value) => value + 1)}
    />
  );
}

function UsersContent({
  accessToken,
  user,
  onLogout,
  onRefresh,
}: UsersProps & { onRefresh: () => void }) {
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const [showCreate, setShowCreate] = useState(false);

  const submitting = useRef(false);
  const mounted = useRef(false);

  const canWrite = user.permisos.includes("users:write");

  const canCreate =
    canWrite &&
    user.area === "videoseguridad" &&
    user.areas_acceso.includes("videoseguridad");

  useEffect(() => {
    const controller = new AbortController();
    mounted.current = true;

    void getUsers(accessToken, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result.filter((item) => item.area === "videoseguridad"));
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        setExpired(err instanceof UsersError && err.status === 401);
        setError(
          err instanceof UsersError
            ? err.message
            : "No pudimos cargar los usuarios. Revisá la conexión.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [accessToken]);

  const query = normalize(search.trim());

  const filtered = items.filter((item) => {
    const matchesSearch = normalize(
      `${fullName(item)} ${item.username} ${item.email ?? ""}`,
    ).includes(query);

    const matchesStatus =
      status === "todos" ||
      (status === "activos" && item.activo) ||
      (status === "inactivos" && !item.activo);

    return matchesSearch && matchesStatus;
  });

  function canManage(item: ManagedUser): boolean {
    return (
      canWrite &&
      item.id !== user.id &&
      item.area === "videoseguridad" &&
      user.areas_acceso.includes(item.area) &&
      item.roles.length === 1 &&
      item.roles[0].nombre === "operador"
    );
  }

  async function confirmChange() {
    if (
      !selected ||
      !canManage(selected) ||
      submitting.current ||
      expired ||
      needsRefresh
    ) {
      return;
    }

    submitting.current = true;
    setIsSaving(true);
    setError(null);

    try {
      await setUserActive(accessToken, selected.id, !selected.activo);

      if (mounted.current) onRefresh();
    } catch (err: unknown) {
      if (!mounted.current) return;

      setExpired(err instanceof UsersError && err.status === 401);
      setNeedsRefresh(true);
      setError(
        err instanceof UsersError
          ? err.message
          : "No pudimos confirmar el cambio. Actualizá el listado antes de volver a intentarlo.",
      );
    } finally {
      submitting.current = false;
      if (mounted.current) setIsSaving(false);
    }
  }

  return (
    <main className="users-page">
      <div className="users-page__container">
        <header className="users-page__heading">
          <div>
            <p className="users-page__eyebrow">
              Centro de Monitoreo · Municipalidad de Rauch
            </p>

            <h1>Usuarios</h1>

            <p className="users-page__intro">
              Consultá las cuentas del área y gestioná el acceso de los
              operadores.
            </p>
          </div>

          <div className="users-page__heading-actions">
            {canCreate && (
              <button
                className="users-page__primary"
                type="button"
                disabled={
                  isLoading ||
                  isSaving ||
                  expired ||
                  needsRefresh ||
                  selected !== null ||
                  showCreate
                }
                onClick={() => setShowCreate(true)}
              >
                Crear operador
              </button>
            )}

            <button
              className="users-page__refresh"
              type="button"
              onClick={onRefresh}
              disabled={isLoading || isSaving || expired || showCreate}
            >
              Actualizar listado
            </button>
          </div>
        </header>

        {showCreate && canCreate && (
          <CreateOperatorForm
            key={accessToken}
            accessToken={accessToken}
            onCreated={onRefresh}
            onCancel={() => setShowCreate(false)}
            onSessionExpired={onLogout}
          />
        )}

        {error && (
          <div className="users-page__error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={expired ? onLogout : onRefresh}
              disabled={isSaving || showCreate}
            >
              {expired ? "Volver al login" : "Volver a consultar"}
            </button>
          </div>
        )}

        {isLoading && <p role="status">Cargando usuarios…</p>}

        {!isLoading && (!error || items.length > 0) && (
          <>
            <div className="users-page__filters">
              <label>
                Buscar usuario
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, apellido, usuario o correo"
                />
              </label>

              <label>
                Estado de la cuenta
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="activos">Activas</option>
                  <option value="inactivos">Inactivas</option>
                </select>
              </label>
            </div>

            <p role="status">{filtered.length} cuenta(s) encontrada(s).</p>

            {selected && (
              <section
                className="users-page__confirmation"
                aria-labelledby="user-confirm-heading"
                aria-busy={isSaving}
              >
                <h2 id="user-confirm-heading">
                  {selected.activo ? "Desactivar" : "Activar"} cuenta
                </h2>

                <p>
                  ¿Querés {selected.activo ? "desactivar" : "activar"} la cuenta
                  de <strong>{fullName(selected)}</strong> ({selected.username}
                  )?
                </p>

                <p>
                  {selected.activo
                    ? "La cuenta quedará inhabilitada para iniciar sesión. Sus eventos e historial deben conservarse."
                    : "La cuenta quedará habilitada para iniciar sesión."}
                </p>

                <div className="users-page__actions">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmChange()}
                    disabled={isSaving || expired || needsRefresh}
                  >
                    {isSaving ? "Guardando…" : "Confirmar"}
                  </button>
                </div>
              </section>
            )}

            <div className="users-page__table">
              <table>
                <caption className="users-page__caption">
                  Cuentas del Centro de Monitoreo
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    <th scope="col">Usuario</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        No hay usuarios para los criterios seleccionados.
                      </td>
                    </tr>
                  )}

                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{fullName(item)}</strong>
                        <small>{item.email || "Sin correo informado"}</small>
                      </td>
                      <td>{item.username}</td>
                      <td>
                        {item.roles
                          .map((role) =>
                            role.nombre === "admin"
                              ? "Administrador de Área"
                              : role.nombre === "operador"
                                ? "Operador"
                                : role.nombre,
                          )
                          .join(", ") || "Sin rol"}
                      </td>
                      <td>
                        <span
                          className={`users-page__badge ${
                            item.activo ? "users-page__badge--active" : ""
                          }`}
                        >
                          {item.activo ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td>
                        {item.id === user.id ? (
                          "Tu cuenta"
                        ) : canManage(item) ? (
                          <button
                            type="button"
                            disabled={
                              isSaving ||
                              expired ||
                              needsRefresh ||
                              selected !== null ||
                              showCreate
                            }
                            onClick={() => setSelected(item)}
                            aria-label={`${
                              item.activo ? "Desactivar" : "Activar"
                            } cuenta de ${fullName(item)}`}
                          >
                            {item.activo ? "Desactivar" : "Activar"}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
