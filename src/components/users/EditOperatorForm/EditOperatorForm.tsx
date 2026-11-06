import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  updateUserData,
  UsersError,
} from "../../../services/usersService";
import type { ManagedUser } from "../../../services/usersService";

interface EditOperatorFormProps {
  accessToken: string;
  operator: ManagedUser;
  onSaved: () => void;
  onCancel: () => void;
  onReload: () => void;
  onSessionExpired: () => void;
}

export default function EditOperatorForm({
  accessToken,
  operator,
  onSaved,
  onCancel,
  onReload,
  onSessionExpired,
}: EditOperatorFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [mustReload, setMustReload] = useState(false);

  const submitting = useRef(false);
  const mounted = useRef(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    firstInput.current?.focus();

    return () => {
      mounted.current = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      submitting.current ||
      expired ||
      forbidden ||
      mustReload
    ) {
      return;
    }

    const data = new FormData(event.currentTarget);

    const get = (field: string) =>
      String(data.get(field) ?? "").trim();

    const nombre = get("nombre").replace(/\s+/g, " ");
    const apellido = get("apellido").replace(/\s+/g, " ");
    const email = get("email");

    const validName = (value: string) =>
      value.length >= 2 &&
      value.length <= 100 &&
      /\p{L}/u.test(value);

    if (!validName(nombre) || !validName(apellido)) {
      setError(
        "Ingresá nombre y apellido de entre 2 y 100 caracteres, con al menos una letra.",
      );
      return;
    }

    if (!email) {
      setError("Ingresá el correo electrónico.");
      return;
    }

    submitting.current = true;
    setIsSaving(true);
    setError(null);

    try {
      await updateUserData(accessToken, operator.id, {
        nombre,
        apellido,
        email,
      });

      if (mounted.current) onSaved();
    } catch (err: unknown) {
      if (!mounted.current) return;

      const status = err instanceof UsersError ? err.status : null;

      const uncertain =
        err instanceof TypeError ||
        err instanceof SyntaxError ||
        (status !== null && status >= 500);

      setExpired(status === 401);
      setForbidden(status === 403);
      setMustReload(uncertain || status === 404);

      setError(
        uncertain
          ? "No pudimos confirmar el resultado. Volvé a consultar el listado para comprobar si los cambios se guardaron."
          : err instanceof Error
            ? err.message
            : "No pudimos guardar los datos.",
      );
    } finally {
      submitting.current = false;

      if (mounted.current) setIsSaving(false);
    }
  }

  const blocked =
    isSaving || expired || forbidden || mustReload;

  return (
    <section
      className="users-page__create"
      aria-labelledby="edit-operator-heading"
    >
      <h2 id="edit-operator-heading">Editar datos del operador</h2>

      <p>
        Cuenta: <strong>{operator.username}</strong>. Los campos
        con * son obligatorios.
      </p>

      <form onSubmit={handleSubmit} aria-busy={isSaving}>
        <fieldset disabled={blocked}>
          <legend>Datos personales</legend>

          <div className="users-page__form-grid">
            <label>
              Nombre *
              <input
                ref={firstInput}
                name="nombre"
                autoComplete="given-name"
                defaultValue={operator.nombre ?? ""}
                minLength={2}
                maxLength={100}
                required
              />
            </label>

            <label>
              Apellido *
              <input
                name="apellido"
                autoComplete="family-name"
                defaultValue={operator.apellido ?? ""}
                minLength={2}
                maxLength={100}
                required
              />
            </label>

            <label>
              Correo electrónico *
              <input
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={operator.email ?? ""}
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
            disabled={isSaving}
            onClick={mustReload ? onReload : onCancel}
          >
            {mustReload ? "Volver a consultar listado" : "Cancelar"}
          </button>

          <button type="submit" disabled={blocked}>
            {isSaving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </section>
  );
}