import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  createOperator,
  getOperatorRoleId,
  UsersError,
} from "../../../services/usersService";

interface CreateOperatorFormProps {
  accessToken: string;
  onCreated: () => void;
  onCancel: () => void;
  onSessionExpired: () => void;
}

export default function CreateOperatorForm({
  accessToken,
  onCreated,
  onCancel,
  onSessionExpired,
}: CreateOperatorFormProps) {
  const [roleId, setRoleId] = useState<number | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [mustCheckList, setMustCheckList] = useState(false);

  const submitting = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    void getOperatorRoleId(accessToken, controller.signal)
      .then(id => {
        if (!controller.signal.aborted) setRoleId(id);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        setExpired(
          err instanceof UsersError && err.status === 401,
        );

        setError(
          err instanceof TypeError
            ? "No pudimos cargar los datos del formulario. Revisá la conexión."
            : err instanceof Error
              ? err.message
              : "No pudimos preparar el formulario.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRole(false);
      });

    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [accessToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      submitting.current ||
      roleId === null ||
      expired ||
      mustCheckList
    ) {
      return;
    }

    const data = new FormData(event.currentTarget);
    const get = (field: string) => String(data.get(field) ?? "");

    const nombre = get("nombre").trim();
    const apellido = get("apellido").trim();
    const username = get("username").trim();
    const email = get("email").trim();
    const password = get("password");
    const confirmation = get("confirmation");

    if (!nombre || !apellido || !username || !password) {
      setError("Completá los campos obligatorios.");
      return;
    }

    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    submitting.current = true;
    setIsSaving(true);
    setError(null);

    try {
      await createOperator(accessToken, roleId, {
        nombre,
        apellido,
        username,
        email,
        password,
      });

      if (mounted.current) onCreated();
    } catch (err: unknown) {
      if (!mounted.current) return;

      const sessionExpired =
        err instanceof UsersError && err.status === 401;

      setExpired(sessionExpired);

      // Si no sabemos si la API alcanzó a guardar la cuenta,
      // no permitimos repetir la creación sin consultar el listado.
      const uncertain =
        err instanceof TypeError ||
        (err instanceof UsersError && err.status >= 500) ||
        (err instanceof SyntaxError);

      setMustCheckList(uncertain);

      setError(
        uncertain
          ? "No pudimos confirmar la creación. Cerrá el formulario y actualizá el listado para comprobar si la cuenta fue creada antes de intentarlo nuevamente."
          : err instanceof Error
            ? err.message
            : "No pudimos crear la cuenta.",
      );
    } finally {
      submitting.current = false;
      if (mounted.current) setIsSaving(false);
    }
  }

  const blocked =
    loadingRole ||
    roleId === null ||
    isSaving ||
    expired ||
    mustCheckList;

  return (
    <section
      className="users-page__create"
      aria-labelledby="create-operator-heading"
    >
      <h2 id="create-operator-heading">Crear operador</h2>

      <p>
        La cuenta tendrá el rol Operador y pertenecerá al
        Centro de Monitoreo. Los campos con * son obligatorios.
      </p>

      {loadingRole && (
        <p role="status">Preparando formulario…</p>
      )}

      <form onSubmit={handleSubmit} aria-busy={isSaving}>
        <fieldset disabled={blocked}>
          <legend>Datos de la cuenta</legend>

          <div className="users-page__form-grid">
            <label>
              Nombre *
              <input
                name="nombre"
                autoComplete="given-name"
                required
              />
            </label>

            <label>
              Apellido *
              <input
                name="apellido"
                autoComplete="family-name"
                required
              />
            </label>

            <label>
              Nombre de usuario *
              <input
                name="username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>

            <label>
              Correo electrónico
              <input
                name="email"
                type="email"
                autoComplete="email"
              />
            </label>

            <label>
              Contraseña inicial *
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              Confirmar contraseña *
              <input
                name="confirmation"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          </div>
        </fieldset>

        {error && (
          <div className="users-page__error" role="alert">
            <p>{error}</p>

            {expired && (
              <button type="button" onClick={onSessionExpired}>
                Volver al login
              </button>
            )}
          </div>
        )}

        <div className="users-page__actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
          >
            {mustCheckList ? "Cerrar formulario" : "Cancelar"}
          </button>

          <button type="submit" disabled={blocked}>
            {isSaving ? "Creando cuenta…" : "Crear operador"}
          </button>
        </div>
      </form>
    </section>
  );
}