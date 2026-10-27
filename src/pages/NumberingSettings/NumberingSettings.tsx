import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import type { User } from "../../hooks/useAuth";
import {
  getAreaNumbering,
  initializeAreaNumbering,
  NumberingError,
} from "../../services/numberingService";
import type { AreaNumbering } from "../../services/numberingService";
import "./NumberingSettings.scss";

interface Props {
  accessToken: string;
  user: User;
  onLogout: () => void;
}
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  dateStyle: "short",
  timeStyle: "short",
});
function dateLabel(value: string | null) {
  if (!value) return "Sin información";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin información"
    : dateFormatter.format(date);
}
export default function NumberingSettings(props: Props) {
  const [revision, setRevision] = useState(0);
  const canRead =
    props.user.permisos.includes("eventos:read") &&
    props.user.areas_acceso.includes("videoseguridad");
  if (!canRead)
    return (
      <main className="numbering-settings">
        <div className="numbering-settings__container">
          <h1>Numeración de eventos</h1>
          <p role="alert">
            No tenés permiso para consultar esta configuración.
          </p>
          <Link to="/eventos">Ver eventos</Link>
        </div>
      </main>
    );
  return (
    <NumberingSettingsContent
      key={JSON.stringify([props.accessToken, props.user.id, revision])}
      {...props}
      onReload={() => setRevision((v) => v + 1)}
    />
  );
}
function NumberingSettingsContent({
  accessToken,
  user,
  onLogout,
  onReload,
}: Props & { onReload: () => void }) {
  const [data, setData] = useState<AreaNumbering | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [lastNumber, setLastNumber] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const canRead =
    user.permisos.includes("eventos:read") &&
    user.areas_acceso.includes("videoseguridad");
  const canConfigure =
    canRead && user.permisos.includes("numeracion:configurar");
  const number = /^\d+$/.test(lastNumber) ? Number(lastNumber) : NaN;
  const valid =
    Number.isSafeInteger(number) && number >= 0 && number <= 2147483646;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void getAreaNumbering(accessToken, controller.signal)
      .then((result) => {
        if (!active) return;
        setData(result);
        setNeedsReload(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setSessionExpired(err instanceof NumberingError && err.status === 401);
        setError(
          err instanceof NumberingError
            ? err.message
            : "No pudimos consultar la numeración. Revisá la conexión e intentá nuevamente.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submitting.current ||
      !canConfigure ||
      !data ||
      data.inicializada ||
      !valid ||
      !confirmed ||
      needsReload ||
      sessionExpired
    )
      return;
    submitting.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const result = await initializeAreaNumbering(accessToken, number);
      if (mounted.current) {
        setData(result);
        setConfirmed(false);
      }
    } catch (err: unknown) {
      if (!mounted.current) return;
      setSessionExpired(err instanceof NumberingError && err.status === 401);
      // Ante un resultado incierto, consultar antes de repetir una operación única.
      setNeedsReload(true);
      setConfirmed(false);
      setError(
        err instanceof NumberingError
          ? err.message
          : "No pudimos confirmar el resultado. Consultá el estado: la configuración podría haberse guardado.",
      );
    } finally {
      submitting.current = false;
      if (mounted.current) setIsSaving(false);
    }
  }
  return (
    <main className="numbering-settings">
      <div className="numbering-settings__container">
        <header>
          <div>
            <p>Centro de Monitoreo</p>
            <h1>Numeración de eventos</h1>
          </div>
          <Link to="/eventos">Ver eventos</Link>
        </header>
        {!canRead ? (
          <p role="alert">
            No tenés permiso para consultar esta configuración.
          </p>
        ) : (
          <>
            {isLoading && <p role="status">Consultando numeración…</p>}
            {error && (
              <div className="numbering-settings__error" role="alert">
                <p>{error}</p>
                <button
                  type="button"
                  disabled={isSaving || isLoading}
                  onClick={sessionExpired ? onLogout : onReload}
                >
                  {sessionExpired ? "Volver al login" : "Consultar estado"}
                </button>
              </div>
            )}
            {!isLoading && data && (
              <section className="numbering-settings__card">
                {data.inicializada ? (
                  <>
                    <h2>Numeración configurada</h2>
                    <p>
                      Esta configuración ya fue realizada y no puede repetirse.
                    </p>
                    <dl>
                      <div>
                        <dt>Último número informado al configurar</dt>
                        <dd>{data.ultimo_informado}</dd>
                      </div>
                      <div>
                        <dt>Último número utilizado</dt>
                        <dd>{data.ultimo_numero}</dd>
                      </div>
                      <div>
                        <dt>Siguiente número disponible al consultar</dt>
                        <dd>{data.siguiente_numero}</dd>
                      </div>
                      <div>
                        <dt>Configurado por</dt>
                        <dd>
                          {[
                            data.configurado_por?.nombre,
                            data.configurado_por?.apellido,
                          ]
                            .filter(Boolean)
                            .join(" ") || "Nombre no informado"}
                        </dd>
                      </div>
                      <div>
                        <dt>Fecha de configuración</dt>
                        <dd>{dateLabel(data.fecha_configuracion)}</dd>
                      </div>
                    </dl>
                    <p>
                      El siguiente número no está reservado: puede cambiar si
                      otra persona registra un evento.
                    </p>
                    <Link to="/eventos/nuevo">Ir al registro de eventos</Link>
                  </>
                ) : (
                  <>
                    <h2>Configuración inicial</h2>
                    <p>
                      Ingresá el último número utilizado en el registro en papel
                      de COM. Se configura una sola vez. La numeración de las
                      otras áreas es independiente.
                    </p>
                    {canConfigure ? (
                      <form onSubmit={submit} aria-busy={isSaving}>
                        <fieldset
                          disabled={isSaving || sessionExpired || needsReload}
                        >
                          <label htmlFor="last-number">
                            Último número utilizado en papel
                          </label>
                          <input
                            id="last-number"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]+"
                            maxLength={10}
                            required
                            value={lastNumber}
                            onChange={(e) => {
                              setLastNumber(e.target.value);
                              setConfirmed(false);
                            }}
                          />
                          {lastNumber !== "" && !valid && (
                            <p role="alert">
                              Ingresá un entero entre 0 y 2147483646.
                            </p>
                          )}
                          {valid && (
                            <p>
                              El primer evento nuevo recibirá el número{" "}
                              <strong>{number + 1}</strong>.
                            </p>
                          )}
                          <label className="numbering-settings__confirmation">
                            <input
                              type="checkbox"
                              checked={confirmed}
                              onChange={(e) => setConfirmed(e.target.checked)}
                              required
                            />
                            Verifiqué el número en el registro y entiendo que no
                            podré cambiar esta configuración.
                          </label>
                          <button type="submit" disabled={!valid || !confirmed}>
                            {isSaving
                              ? "Configurando…"
                              : "Confirmar numeración inicial"}
                          </button>
                        </fieldset>
                      </form>
                    ) : (
                      <p>
                        El administrador del área debe configurar la numeración
                        antes de que puedas registrar eventos.
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}