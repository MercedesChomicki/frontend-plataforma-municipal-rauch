import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { EventsError, getEvents } from "../../services/eventsService";

import type { EventRecord } from "../../services/eventsService";
import { exportEventsCsv } from "../../utils/exportEventsCsv";

import "./Reports.scss";

interface ReportsProps {
  accessToken: string;
  onLogout: () => void;
}

interface Filters {
  from: string;
  to: string;
  type: string;
  service: string;
  status: string;
}

interface CountItem {
  label: string;
  value: number;
}

interface GeneratedReport {
  filters: Filters;
  generatedAt: string;
  events: EventRecord[];
  open: number;
  closed: number;
  cancelled: number;
  byType: CountItem[];
  byService: CountItem[];
  daily: CountItem[];
}

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const PAGE_SIZE = 10;

const calendarFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timestampFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

function dayKey(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const parts = calendarFormatter.formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function displayDay(value: string): string {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function label(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function initialFilters(): Filters {
  const today = dayKey(new Date())!;

  return {
    from: `${today.slice(0, 7)}-01`,
    to: today,
    type: "",
    service: "",
    status: "",
  };
}

function options(values: Array<string | null>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort((a, b) => a.localeCompare(b, "es"));
}

function groupBy(
  events: EventRecord[],
  getLabel: (event: EventRecord) => string,
): CountItem[] {
  const counts = new Map<string, number>();

  for (const event of events) {
    const key = getLabel(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, value]) => ({
      label: name,
      value,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
}

function daysInPeriod(from: string, to: string): number {
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000 +
    1
  );
}

function buildReport(events: EventRecord[], filters: Filters): GeneratedReport {
  const matching = events
    .filter((event) => {
      if (!event.fecha_ocurrencia) return false;

      const key = dayKey(event.fecha_ocurrencia);

      if (!key || key < filters.from || key > filters.to) {
        return false;
      }

      return (
        (!filters.type || event.tipo_evento === filters.type) &&
        (!filters.service || event.servicio_actuante === filters.service) &&
        (!filters.status || event.estado === filters.status)
      );
    })
    .sort(
      (a, b) =>
        new Date(b.fecha_ocurrencia!).getTime() -
          new Date(a.fecha_ocurrencia!).getTime() || b.id - a.id,
    );

  const dailyCounts = new Map<string, number>();

  for (const event of matching) {
    const key = dayKey(event.fecha_ocurrencia!)!;
    dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }

  const daily = Array.from(
    { length: daysInPeriod(filters.from, filters.to) },
    (_, index) => {
      // Operación sobre días calendario, sin convertirlos a hora local.
      const date = new Date(`${filters.from}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);

      const key = date.toISOString().slice(0, 10);

      return {
        label: displayDay(key),
        value: dailyCounts.get(key) ?? 0,
      };
    },
  );

  return {
    filters: { ...filters },
    generatedAt: new Date().toISOString(),
    events: matching,
    open: matching.filter((event) => event.estado === "abierto").length,
    closed: matching.filter((event) => event.estado === "cerrado").length,
    cancelled: matching.filter((event) => event.estado === "anulado").length,

    byType: groupBy(matching, (event) => label(event.tipo_evento)),

    byService: groupBy(matching, (event) =>
      event.servicio_actuante
        ? label(event.servicio_actuante)
        : "Sin servicio informado",
    ),

    daily,
  };
}

function CountChart({ data }: { data: CountItem[] }) {
  const maximum = Math.max(1, ...data.map((item) => item.value));

  if (data.length === 0) {
    return <p>No hay eventos para los criterios elegidos.</p>;
  }

  return (
    <ul className="reports-page__bars">
      {data.map((item) => (
        <li key={item.label}>
          <div className="reports-page__bar-heading">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>

          <div className="reports-page__track" aria-hidden="true">
            <span style={{ width: `${(item.value / maximum) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Reports({ accessToken, onLogout }: ReportsProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [report, setReport] = useState<GeneratedReport | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [version, setVersion] = useState(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const generationPending = useRef(false);
  const generationController = useRef<AbortController | null>(null);

  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      setActionError(null);
      setMessage(null);
      setSessionExpired(false);
      setReport(null);
      setEvents([]);

      try {
        const result = await getEvents(accessToken, controller.signal);

        if (active) setEvents(result);
      } catch (err: unknown) {
        if (!active) return;

        setSessionExpired(err instanceof EventsError && err.status === 401);

        setLoadError(
          err instanceof EventsError
            ? err.message
            : "No pudimos cargar los datos del reporte. Intentá nuevamente.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken, version]);

  useEffect(() => {
    return () => {
      generationController.current?.abort();
      generationController.current = null;
      generationPending.current = false;
    };
  }, [accessToken]);

  function changeFilter(field: keyof Filters, value: string) {
    setFilters((previous) => ({ ...previous, [field]: value }));
    setActionError(null);
    setMessage(null);
  }

  function resetFilters() {
    if (isLoading || generationPending.current) return;

    setFilters(initialFilters());
    setActionError(null);
    setMessage("Filtros restablecidos al mes actual.");
  }

  const reportEvents = report?.events ?? [];

  const pageCount = Math.max(1, Math.ceil(reportEvents.length / PAGE_SIZE));

  const currentPage = Math.min(page, pageCount);

  const visibleEvents = reportEvents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const firstVisible =
    reportEvents.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;

  const lastVisible = Math.min(currentPage * PAGE_SIZE, reportEvents.length);

  const pendingChanges =
    report !== null &&
    (Object.keys(filters) as Array<keyof Filters>).some(
      (key) => filters[key] !== report.filters[key],
    );

  const withoutOccurrence = events.filter(
    (event) => !event.fecha_ocurrencia || !dayKey(event.fecha_ocurrencia),
  ).length;

  async function generate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (generationPending.current || isLoading || loadError || sessionExpired) {
      return;
    }

    setActionError(null);
    setMessage(null);

    // Conservamos los criterios correspondientes a esta solicitud.
    const appliedFilters = { ...filters };

    const days = daysInPeriod(appliedFilters.from, appliedFilters.to);

    if (
      !appliedFilters.from ||
      !appliedFilters.to ||
      !Number.isFinite(days) ||
      days < 1
    ) {
      setActionError("Ingresá un período válido.");
      return;
    }

    if (days > 366) {
      setActionError(
        "Seleccioná un período de hasta 366 días para este reporte.",
      );
      return;
    }

    const controller = new AbortController();

    generationController.current = controller;
    generationPending.current = true;

    setIsGenerating(true);
    setSessionExpired(false);

    // El informe anterior deja de estar disponible mientras consultamos.
    setReport(null);
    setPage(1);

    try {
      const freshEvents = await getEvents(accessToken, controller.signal);

      if (controller.signal.aborted) return;

      const consultedAt = new Date().toISOString();

      const nextReport = buildReport(freshEvents, appliedFilters);

      setEvents(freshEvents);

      setReport({
        ...nextReport,
        generatedAt: consultedAt,
      });

      setMessage("Reporte generado con los datos recién consultados.");
    } catch (err: unknown) {
      if (controller.signal.aborted) return;

      const expired = err instanceof EventsError && err.status === 401;

      setSessionExpired(expired);

      setActionError(
        err instanceof EventsError
          ? err.message
          : "No pudimos consultar los datos para generar el reporte. Intentá nuevamente.",
      );
    } finally {
      if (generationController.current === controller) {
        generationController.current = null;
        generationPending.current = false;
        setIsGenerating(false);
      }
    }
  }

  function download() {
    if (!report || pendingChanges) return;

    setActionError(null);
    setMessage(null);

    try {
      exportEventsCsv(report.events);
      setMessage("Se solicitó la descarga de los registros del reporte.");
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "No pudimos generar la descarga.",
      );
    }
  }

  return (
    <main className="reports-page">
      <div className="reports-page__container">
        <header className="reports-page__heading">
          <div>
            <h1>Reportes</h1>
            <p>Centro de Monitoreo · Análisis por ocurrencia</p>
          </div>
        </header>

        {isLoading && (
          <p role="status">Cargando datos para generar reportes…</p>
        )}

        {loadError && (
          <div className="reports-page__error" role="alert">
            <p>{loadError}</p>

            <button
              type="button"
              onClick={
                sessionExpired
                  ? onLogout
                  : () => setVersion((value) => value + 1)
              }
            >
              {sessionExpired ? "Volver al login" : "Reintentar"}
            </button>
          </div>
        )}

        <form className="reports-page__screen-only" onSubmit={generate}>
          <fieldset
            disabled={
              isLoading || isGenerating || Boolean(loadError) || sessionExpired
            }
          >
            <legend>Criterios del reporte</legend>

            <div className="reports-page__filters">
              <label>
                Ocurrencia desde *
                <input
                  required
                  type="date"
                  value={filters.from}
                  onChange={(e) => changeFilter("from", e.target.value)}
                />
              </label>

              <label>
                Ocurrencia hasta *
                <input
                  required
                  type="date"
                  min={filters.from || undefined}
                  value={filters.to}
                  onChange={(e) => changeFilter("to", e.target.value)}
                />
              </label>

              <label>
                Tipo
                <select
                  value={filters.type}
                  onChange={(e) => changeFilter("type", e.target.value)}
                >
                  <option value="">Todos</option>
                  {options(events.map((event) => event.tipo_evento)).map(
                    (value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Servicio
                <select
                  value={filters.service}
                  onChange={(e) => changeFilter("service", e.target.value)}
                >
                  <option value="">Todos</option>
                  {options(events.map((event) => event.servicio_actuante)).map(
                    (value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Estado
                <select
                  value={filters.status}
                  onChange={(e) => changeFilter("status", e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="abierto">Abierto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </label>

              <div className="reports-page__filter-actions">
                <button type="button" onClick={resetFilters}>
                  Restablecer filtros
                </button>

                <button type="submit" className="reports-page__primary">
                  {isGenerating ? "Generando reporte…" : "Generar reporte"}
                </button>
              </div>
            </div>
          </fieldset>
        </form>

        {isGenerating && (
          <p className="reports-page__screen-only" role="status">
            Consultando los datos y generando el reporte…
          </p>
        )}

        {actionError && (
          <div className="reports-page__error" role="alert">
            <p>{actionError}</p>

            {sessionExpired && (
              <button type="button" onClick={onLogout}>
                Volver al login
              </button>
            )}
          </div>
        )}

        {message && (
          <p className="reports-page__screen-only" role="status">
            {message}
          </p>
        )}

        {pendingChanges && (
          <p className="reports-page__notice" role="status">
            Modificaste los filtros. Generá el reporte nuevamente para
            aplicarlos.
          </p>
        )}

        {!isLoading &&
          !isGenerating &&
          !loadError &&
          !actionError &&
          !report && <p>Elegí los criterios y presioná Generar reporte.</p>}

        {report && (
          <section aria-labelledby="report-title">
            <div className="reports-page__card">
              <h2 id="report-title">Informe de eventos de COM</h2>

              <p>
                <strong>Ocurrencia:</strong> {displayDay(report.filters.from)}{" "}
                al {displayDay(report.filters.to)}.
              </p>

              <p>
                <strong>Tipo:</strong>{" "}
                {report.filters.type ? label(report.filters.type) : "Todos"}
                {" · "}
                <strong>Servicio:</strong>{" "}
                {report.filters.service
                  ? label(report.filters.service)
                  : "Todos"}
                {" · "}
                <strong>Estado:</strong>{" "}
                {report.filters.status ? label(report.filters.status) : "Todos"}
              </p>

              <p>
                Datos consultados el{" "}
                <time dateTime={report.generatedAt}>
                  {timestampFormatter.format(new Date(report.generatedAt))}
                </time>
                . Horario argentino.
              </p>

              <p>
                Los estados corresponden al momento de la consulta, no al estado
                que tenían los eventos al finalizar el período.
              </p>

              {withoutOccurrence > 0 && (
                <p>
                  Hay {withoutOccurrence} registro(s) en los datos consultados
                  sin una fecha de ocurrencia válida. No se incluyen en este
                  informe.
                </p>
              )}

              <div className="reports-page__actions reports-page__screen-only">
                <button
                  type="button"
                  onClick={download}
                  disabled={pendingChanges || report.events.length === 0}
                >
                  Descargar registros CSV ({report.events.length})
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={pendingChanges}
                >
                  Imprimir / Guardar PDF
                </button>
              </div>
            </div>

            <div
              className="reports-page__indicators"
              aria-label="Resumen del conjunto filtrado"
            >
              {[
                ["Total", report.events.length],
                ["Abiertos", report.open],
                ["Cerrados", report.closed],
              ].map(([name, value]) => (
                <article className="reports-page__card" key={name}>
                  <h3>{name}</h3>
                  <strong className="reports-page__value">{value}</strong>
                </article>
              ))}

              {report.cancelled > 0 && (
                <article className="reports-page__card">
                  <h3>Anulados</h3>
                  <strong className="reports-page__value">
                    {report.cancelled}
                  </strong>
                </article>
              )}
            </div>

            <div className="reports-page__charts">
              <article className="reports-page__card">
                <h2>Distribución por tipo</h2>
                <CountChart data={report.byType} />
              </article>

              <article className="reports-page__card">
                <h2>Distribución por servicio</h2>
                <CountChart data={report.byService} />
              </article>
            </div>

            <article className="reports-page__card">
              <h2>Evolución diaria</h2>

              <p>
                Cantidad de eventos por día de ocurrencia, incluyendo los días
                sin eventos.
              </p>

              <div
                className="reports-page__daily"
                role="region"
                aria-label="Evolución diaria del período"
                tabIndex={0}
              >
                <CountChart data={report.daily} />
              </div>
            </article>

            <article className="reports-page__card reports-page__screen-only">
              <h2 id="report-events-heading">
                Eventos incluidos ({report.events.length})
              </h2>

              <p>
                Estos registros corresponden a los criterios del informe
                generado. El CSV incluye todos los resultados,
                independientemente de la página visible.
              </p>

              <div
                className="reports-page__table"
                role="region"
                aria-labelledby="report-events-heading"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Número</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Fecha y hora de ocurrencia</th>
                      <th scope="col">Servicio</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleEvents.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          No hay eventos para los criterios del informe.
                        </td>
                      </tr>
                    ) : (
                      visibleEvents.map((event) => {
                        const occurrence = event.fecha_ocurrencia
                          ? new Date(event.fecha_ocurrencia)
                          : null;

                        const validOccurrence =
                          occurrence !== null &&
                          !Number.isNaN(occurrence.getTime());

                        return (
                          <tr key={event.id}>
                            <td>{event.numero_evento}</td>

                            <td>{label(event.tipo_evento)}</td>

                            <td>
                              {validOccurrence ? (
                                <time
                                  dateTime={event.fecha_ocurrencia ?? undefined}
                                >
                                  {timestampFormatter.format(occurrence)}
                                </time>
                              ) : (
                                "Sin fecha válida"
                              )}
                            </td>

                            <td>
                              {event.servicio_actuante
                                ? label(event.servicio_actuante)
                                : "Sin servicio informado"}
                            </td>

                            <td>{label(event.estado)}</td>

                            <td>
                              <Link
                                to={`/eventos/${event.id}`}
                                className="reports-page__detail-link"
                                aria-label={`Ver detalle del evento ${event.numero_evento}`}
                              >
                                Ver detalle ↗
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {reportEvents.length > 0 && (
                <nav
                  className="reports-page__pagination"
                  aria-label="Paginación de eventos del reporte"
                >
                  <span role="status">
                    Mostrando {firstVisible}–{lastVisible} de{" "}
                    {reportEvents.length}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Anterior
                  </button>

                  <span>
                    Página {currentPage} de {pageCount}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Siguiente
                  </button>
                </nav>
              )}
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
