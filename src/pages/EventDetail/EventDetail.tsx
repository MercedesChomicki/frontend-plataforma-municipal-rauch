import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  EventsError,
  getEvent,
  getEventHistory,
  cancelEvent,
  closeEvent,
} from "../../services/eventsService";
import type { EventRecord, EventAudit } from "../../services/eventsService";
import type { User } from "../../hooks/useAuth";
import "./EventDetail.scss";
import "./EventDetailUpdates.scss";

interface EventDetailProps {
  accessToken: string;
  user: User;
  onLogout: () => void;
}
const formatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  dateStyle: "short",
  timeStyle: "short",
});
function formatDate(value: string | null | undefined): string {
  if (!value) return "Sin información";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin información"
    : formatter.format(date);
}
function label(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function name(first?: string | null, last?: string | null): string {
  return (
    [first, last].filter(Boolean).join(" ").trim() || "Nombre no informado"
  );
}
const actionLabels: Record<string, string> = {
  create: "Registro",
  update: "Corrección",
  cerrar: "Cierre",
  anular: "Anulación",
  reabrir: "Reapertura",
  inicializar_numeracion: "Inicialización de numeración",
};
const historyFieldLabels: Record<string, string> = {
  descripcion: "Descripción",
  direccion: "Dirección",
  fecha_ocurrencia: "Fecha y hora de ocurrencia",
  estado: "Estado",
  turno: "Turno",
  latitud: "Latitud",
  longitud: "Longitud",
  recibio_nombre: "Recibido por",
  recibio_funcion: "Jerarquía o función",
  observaciones_cierre: "Observaciones de cierre",
  cierre: "Información de cierre",
  fecha: "Fecha y hora",
  nombre: "Nombre",
  apellido: "Apellido",
  usuario_id: "ID del usuario",
  origen: "Origen",
  observaciones: "Observaciones",
  motivo: "Motivo",
};

function historyFieldLabel(field: string): string {
  return historyFieldLabels[field] ?? label(field);
}

function isHistoryObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function HistoryValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="history-change__empty">Sin información</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Sí" : "No"}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <ul>
        {value.map((item, index) => (
          <li key={index}>
            <HistoryValue value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (isHistoryObject(value)) {
    return (
      <dl className="history-change__fields">
        {Object.entries(value).map(([field, content]) => (
          <div key={field}>
            <dt>{historyFieldLabel(field)}</dt>
            <dd>
              <HistoryValue value={content} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span>{String(value)}</span>;
}

interface HistoryProps {
  accessToken: string;
  eventId: number;
  version: number;
  onLogout: () => void;
}
function History(props: HistoryProps) {
  const [retry, setRetry] = useState(0);
  return (
    <HistoryContent
      key={JSON.stringify([
        props.accessToken,
        props.eventId,
        props.version,
        retry,
      ])}
      accessToken={props.accessToken}
      eventId={props.eventId}
      onLogout={props.onLogout}
      onRetry={() => setRetry((v) => v + 1)}
    />
  );
}
function HistoryContent({
  accessToken,
  eventId,
  onLogout,
  onRetry,
}: Omit<HistoryProps, "version"> & { onRetry: () => void }) {
  const [items, setItems] = useState<EventAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void getEventHistory(accessToken, eventId, controller.signal)
      .then((result) => {
        if (active) setItems([...result].sort((a, b) => b.id - a.id));
      })
      .catch((err: unknown) => {
        if (!active) return;
        setExpired(err instanceof EventsError && err.status === 401);
        setError(
          err instanceof EventsError
            ? err.message
            : "No pudimos cargar el historial.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken, eventId]);
  return (
    <section
      className="event-detail__card"
      aria-labelledby="event-history-heading"
    >
      <h2 id="event-history-heading">Historial de operaciones</h2>
      {loading && <p role="status">Cargando historial…</p>}
      {error && (
        <div className="event-detail__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={expired ? onLogout : onRetry}>
            {expired ? "Volver al login" : "Reintentar historial"}
          </button>
        </div>
      )}
      {!loading &&
        !error &&
        (items.length === 0 ? (
          <p>No hay operaciones disponibles en el historial.</p>
        ) : (
          <ol className="event-detail__history">
            {items.map((item) => (
              <li key={item.id}>
                <strong>
                  {actionLabels[item.accion] ?? label(item.accion)}
                </strong>
                <p>
                  {formatDate(item.fecha)} ·{" "}
                  {name(item.usuario_nombre, item.usuario_apellido)}
                </p>
                <p>
                  Área: {item.area ? label(item.area) : "Sin información"} ·
                  Turno: {item.turno ? label(item.turno) : "Sin información"}
                </p>
                {item.detalle && Object.keys(item.detalle).length > 0 && (
                  <details>
                    <summary>Ver cambios registrados</summary>
                    <div className="history-changes">
                      {Object.entries(item.detalle).map(([field, value]) => {
                        const isChange =
                          isHistoryObject(value) &&
                          ("from" in value || "to" in value);

                        return (
                          <section className="history-change" key={field}>
                            <h3>{historyFieldLabel(field)}</h3>

                            {isChange ? (
                              <dl className="history-change__comparison">
                                <div>
                                  <dt>Antes</dt>
                                  <dd>
                                    <HistoryValue value={value.from} />
                                  </dd>
                                </div>

                                <div>
                                  <dt>Después</dt>
                                  <dd>
                                    <HistoryValue value={value.to} />
                                  </dd>
                                </div>
                              </dl>
                            ) : (
                              <div className="history-change__value">
                                <HistoryValue value={value} />
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}
export default function EventDetail(props: EventDetailProps) {
  const { id } = useParams<{ id: string }>();
  const [revision, setRevision] = useState(0);
  const eventId = Number(id);
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    return (
      <main className="event-detail">
        <div className="event-detail__container">
          <h1>Detalle del evento</h1>
          <p role="alert">El identificador del evento no es válido.</p>
          <Link to="/eventos">Ver eventos</Link>
        </div>
      </main>
    );
  }
  return (
    <EventDetailContent
      key={JSON.stringify([id, props.accessToken, revision])}
      {...props}
      onReload={() => setRevision((v) => v + 1)}
    />
  );
}
function EventDetailContent({
  accessToken,
  user,
  onLogout,
  onReload,
}: EventDetailProps & { onReload: () => void }) {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [operation, setOperation] = useState<"close" | "cancel" | null>(null);
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const submitting = useRef(false);
  const generation = useRef(0);
  const canWrite =
    event !== null &&
    event.area === "videoseguridad" &&
    user.areas_acceso.includes(event.area) &&
    user.permisos.includes("eventos:write");
  const canClose = canWrite && event?.estado === "abierto";
  const canEdit =
    canWrite && (event?.estado === "abierto" || event?.estado === "cerrado");
  const canCancel =
    event !== null &&
    event.area === "videoseguridad" &&
    (event.estado === "abierto" || event.estado === "cerrado") &&
    user.areas_acceso.includes(event.area) &&
    user.permisos.includes("eventos:anular");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    generation.current += 1;
    const eventId = Number(id);
    {
      void getEvent(accessToken, eventId, controller.signal)
        .then((result) => {
          if (active) setEvent(result);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setSessionExpired(err instanceof EventsError && err.status === 401);
          setError(
            err instanceof EventsError
              ? err.message
              : "No pudimos cargar el evento. Intentá nuevamente.",
          );
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }
    return () => {
      active = false;
      generation.current += 1;
      controller.abort();
    };
  }, [id, accessToken]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      submitting.current ||
      !event ||
      !operation ||
      !text.trim() ||
      needsReload ||
      sessionExpired
    )
      return;
    if (
      (operation === "close" && !canClose) ||
      (operation === "cancel" && (!canCancel || !confirmed))
    )
      return;
    const current = generation.current;
    submitting.current = true;
    setSaving(true);
    setOperationError(null);
    setMessage(null);
    try {
      const result =
        operation === "close"
          ? await closeEvent(accessToken, event.id, text)
          : await cancelEvent(accessToken, event.id, text);
      if (current !== generation.current) return;
      setEvent(result);
      setOperation(null);
      setText("");
      setConfirmed(false);
      setHistoryVersion((v) => v + 1);
      setMessage(
        operation === "close"
          ? "El evento quedó cerrado."
          : "El evento quedó anulado.",
      );
      // Consulta nuevamente el historial después de confirmar la operación.
    } catch (err: unknown) {
      if (current !== generation.current) return;
      setSessionExpired(err instanceof EventsError && err.status === 401);
      setNeedsReload(true);
      setOperationError(
        err instanceof EventsError
          ? err.message
          : "No pudimos confirmar el resultado. Actualizá el detalle antes de repetir la operación.",
      );
    } finally {
      submitting.current = false;
      if (current === generation.current) setSaving(false);
    }
  }
  return (
    <main className="event-detail">
      <div className="event-detail__container">
        <header className="event-detail__heading">
          <div>
            <p className="event-detail__eyebrow">
              Centro de Monitoreo · Municipalidad de Rauch
            </p>
            <h1>
              {event
                ? `Evento N.º ${event.numero_evento}`
                : "Detalle del evento"}
            </h1>
            <p className="event-detail__intro">
              Consultá la información del evento y su historial de operaciones.
            </p>
          </div>
          <div className="event-detail__actions">
            {!isLoading &&
              !error &&
              canEdit &&
              event &&
              !saving &&
              !needsReload &&
              !sessionExpired && (
                <Link
                  to={`/eventos/${event.id}/editar`}
                  className="event-detail__secondary"
                >
                  Editar evento
                </Link>
              )}
            <Link to="/eventos" className="event-detail__secondary">
              Ver eventos
            </Link>
          </div>
        </header>
        {isLoading && <p role="status">Cargando evento…</p>}
        {error && (
          <div className="event-detail__error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={sessionExpired ? onLogout : onReload}
            >
              {sessionExpired ? "Volver al login" : "Reintentar"}
            </button>
          </div>
        )}
        {!isLoading && !error && event && (
          <>
            {message && <p role="status">{message}</p>}
            <section
              className="event-detail__card"
              aria-labelledby="event-general-heading"
            >
              <h2 id="event-general-heading">Información del evento</h2>
              <dl className="event-detail__grid">
                <div>
                  <dt>Número</dt>
                  <dd>{event.numero_evento}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{label(event.estado)}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{label(event.tipo_evento)}</dd>
                </div>
                <div>
                  <dt>Turno</dt>
                  <dd>
                    {event.turno ? label(event.turno) : "Sin información"}
                  </dd>
                </div>
                <div>
                  <dt>Fecha y hora de ocurrencia</dt>
                  <dd>{formatDate(event.fecha_ocurrencia)}</dd>
                </div>
                <div>
                  <dt>
                    {event.modalidad === "historico"
                      ? "Fecha y hora de digitalización"
                      : "Fecha y hora de incorporación al sistema"}
                  </dt>
                  <dd>
                    {formatDate(
                      event.modalidad === "historico"
                        ? (event.digitalizacion?.fecha ?? event.fecha_creacion)
                        : event.fecha_creacion,
                    )}
                  </dd>
                </div>
                <div className="event-detail__wide">
                  <dt>Dirección</dt>
                  <dd>{event.direccion || "Sin información"}</dd>
                </div>
                <div className="event-detail__wide">
                  <dt>Servicio actuante</dt>
                  <dd>
                    {event.servicio_actuante
                      ? label(event.servicio_actuante)
                      : "Sin información"}
                  </dd>
                </div>
                {event.modalidad !== "historico" && (
                  <>
                    <div>
                      <dt>Recibido por</dt>
                      <dd>{event.recibio_nombre || "Sin información"}</dd>
                    </div>
                    <div>
                      <dt>Jerarquía o función</dt>
                      <dd>{event.recibio_funcion || "Sin información"}</dd>
                    </div>
                  </>
                )}
                <div className="event-detail__wide">
                  <dt>Descripción</dt>
                  <dd>{event.descripcion || "Sin descripción"}</dd>
                </div>
              </dl>
            </section>
            {event.modalidad === "historico" && (
              <section
                className="event-detail__card"
                aria-labelledby="event-original-heading"
              >
                <h2 id="event-original-heading">Registro original en papel</h2>

                <dl className="event-detail__grid">
                  <div>
                    <dt>Fecha y hora del registro original</dt>
                    <dd>{formatDate(event.registro_original?.fecha)}</dd>
                  </div>

                  <div>
                    <dt>Turno del registro original</dt>
                    <dd>
                      {event.registro_original?.turno
                        ? label(event.registro_original.turno)
                        : "Sin información"}
                    </dd>
                  </div>

                  <div>
                    <dt>Recibido por</dt>
                    <dd>{event.recibio_nombre || "Sin información"}</dd>
                  </div>

                  <div>
                    <dt>Jerarquía o función</dt>
                    <dd>{event.recibio_funcion || "Sin información"}</dd>
                  </div>

                  <div className="event-detail__wide">
                    <dt>Libro, folio o página</dt>
                    <dd>
                      {event.registro_original?.referencia || "Sin información"}
                    </dd>
                  </div>
                </dl>
              </section>
            )}
            {event.estado === "cerrado" && (
              <section
                className="event-detail__card"
                aria-labelledby="event-closure-heading"
              >
                <h2 id="event-closure-heading">
                  {event.cierre?.origen === "historico"
                    ? "Cierre original en papel"
                    : "Información de cierre"}
                </h2>
                <dl className="event-detail__grid">
                  <div>
                    <dt>Fecha y hora de cierre</dt>
                    <dd>
                      {formatDate(event.cierre?.fecha ?? event.fecha_cierre)}
                    </dd>
                  </div>
                  <div>
                    <dt>Responsable del cierre</dt>
                    <dd>
                      {name(event.cierre?.nombre, event.cierre?.apellido)}
                    </dd>
                  </div>
                  <div>
                    <dt>Origen del cierre</dt>
                    <dd>
                      {event.cierre?.origen === "sistema"
                        ? "Realizado en la aplicación"
                        : event.cierre?.origen === "historico"
                          ? "Registro original en papel"
                          : "Sin información"}
                    </dd>
                  </div>
                  <div className="event-detail__wide">
                    <dt>Observaciones de cierre</dt>
                    <dd>
                      {event.cierre?.observaciones ??
                        event.observaciones_cierre ??
                        "Sin información"}
                    </dd>
                  </div>
                </dl>
              </section>
            )}
            {event.estado === "anulado" && (
              <section
                className="event-detail__card"
                aria-labelledby="event-cancelled-heading"
              >
                <h2 id="event-cancelled-heading">Información de anulación</h2>
                <p>
                  El registro conserva su número y no admite modificaciones. Las
                  operaciones anteriores pueden consultarse en el historial.
                </p>
                <dl className="event-detail__grid">
                  <div>
                    <dt>Responsable</dt>
                    <dd>
                      {name(event.anulacion?.nombre, event.anulacion?.apellido)}
                    </dd>
                  </div>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{formatDate(event.anulacion?.fecha)}</dd>
                  </div>
                  <div className="event-detail__wide">
                    <dt>Motivo</dt>
                    <dd>{event.anulacion?.motivo || "Sin información"}</dd>
                  </div>
                </dl>
              </section>
            )}
            {(canClose || canCancel) && (
              <section
                className="event-detail__card"
                aria-labelledby="event-operations-heading"
              >
                <h2 id="event-operations-heading">Acciones del evento</h2>
                <div className="event-detail__actions">
                  {canClose && (
                    <button
                      type="button"
                      disabled={saving || needsReload || sessionExpired}
                      onClick={() => {
                        setOperation("close");
                        setText("");
                        setConfirmed(false);
                      }}
                    >
                      Cerrar evento
                    </button>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      className="event-detail__danger"
                      disabled={saving || needsReload || sessionExpired}
                      onClick={() => {
                        setOperation("cancel");
                        setText("");
                        setConfirmed(false);
                      }}
                    >
                      Anular evento
                    </button>
                  )}
                </div>
                {operation && (
                  <form
                    className="event-detail__close-form"
                    onSubmit={submit}
                    aria-busy={saving}
                  >
                    <label>
                      {operation === "close"
                        ? "Observaciones de cierre *"
                        : "Motivo de anulación *"}
                      <textarea
                        rows={4}
                        required
                        value={text}
                        disabled={saving || needsReload || sessionExpired}
                        onChange={(e) => {
                          setText(e.target.value);
                          setConfirmed(false);
                        }}
                      />
                    </label>
                    <p>
                      {operation === "close"
                        ? "Se guardarán tu usuario y la fecha y hora de la operación."
                        : "La anulación conserva el registro y su historial, y bloquea las modificaciones. No es un cierre."}
                    </p>
                    {operation === "cancel" && (
                      <label className="event-detail__confirm">
                        <input
                          type="checkbox"
                          required
                          checked={confirmed}
                          disabled={saving || needsReload || sessionExpired}
                          onChange={(e) => setConfirmed(e.target.checked)}
                        />
                        Confirmo la anulación del evento N.º{" "}
                        {event.numero_evento}.
                      </label>
                    )}
                    <div className="event-detail__actions">
                      <button
                        type="submit"
                        disabled={
                          saving ||
                          needsReload ||
                          sessionExpired ||
                          !text.trim() ||
                          (operation === "cancel" && !confirmed)
                        }
                      >
                        {saving
                          ? "Guardando…"
                          : operation === "close"
                            ? "Confirmar cierre"
                            : "Confirmar anulación"}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setOperation(null);
                          setText("");
                          setConfirmed(false);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
                {operationError && (
                  <div className="event-detail__error" role="alert">
                    <p>{operationError}</p>
                  </div>
                )}
                {needsReload && (
                  <button
                    type="button"
                    onClick={sessionExpired ? onLogout : onReload}
                  >
                    {sessionExpired ? "Volver al login" : "Actualizar detalle"}
                  </button>
                )}
              </section>
            )}
            <History
              accessToken={accessToken}
              eventId={event.id}
              version={historyVersion}
              onLogout={onLogout}
            />
          </>
        )}
      </div>
    </main>
  );
}
