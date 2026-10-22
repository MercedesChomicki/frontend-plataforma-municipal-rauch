import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EventsError, getEvents } from "../../services/eventsService";
import type { EventRecord } from "../../services/eventsService";

import EventsMap from "../../components/maps/EventsMap/EventsMap";
import type { MapView } from "../../components/maps/EventsMap/EventsMap";

import "./EventMap.scss";

interface EventMapProps {
  accessToken: string;
  onLogout: () => void;
}

interface Filters {
  from: string;
  to: string;
  type: string;
  status: string;
}

const EMPTY_FILTERS: Filters = {
  from: "",
  to: "",
  type: "",
  status: "",
};

const calendarFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  dateStyle: "short",
  timeStyle: "short",
});

function label(value: string): string {
  const text = value.replace(/_/g, " ");

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function occurrenceDay(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const parts = calendarFormatter.formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDate(value: string | null): string {
  if (!value) return "Sin información";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Sin información"
    : dateFormatter.format(date);
}

function hasCoordinates(event: EventRecord): boolean {
  return (
    typeof event.latitud === "number" &&
    typeof event.longitud === "number" &&
    Number.isFinite(event.latitud) &&
    Number.isFinite(event.longitud) &&
    event.latitud >= -90 &&
    event.latitud <= 90 &&
    event.longitud >= -180 &&
    event.longitud <= 180 &&
    !(event.latitud === 0 && event.longitud === 0)
  );
}

export default function EventMap({ accessToken, onLogout }: EventMapProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<MapView>("events");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      setSessionExpired(false);
      setEvents([]);
      setSelectedId(null);

      try {
        const result = await getEvents(accessToken, controller.signal);

        if (active) {
          setEvents(result);
        }
      } catch (err: unknown) {
        if (!active) return;

        setSessionExpired(err instanceof EventsError && err.status === 401);

        setError(
          err instanceof EventsError
            ? err.message
            : "No pudimos cargar los eventos del mapa. Revisá tu conexión e intentá nuevamente.",
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

  const types = useMemo(
    () =>
      [...new Set(events.map((event) => event.tipo_evento))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [events],
  );

  const invalidRange = Boolean(
    filters.from && filters.to && filters.from > filters.to,
  );

  const filtered = useMemo(() => {
    if (invalidRange) return [];

    return events.filter((event) => {
      if (filters.type && event.tipo_evento !== filters.type) {
        return false;
      }

      if (filters.status && event.estado !== filters.status) {
        return false;
      }

      if (filters.from || filters.to) {
        const day = occurrenceDay(event.fecha_ocurrencia);

        if (!day) return false;
        if (filters.from && day < filters.from) return false;
        if (filters.to && day > filters.to) return false;
      }

      return true;
    });
  }, [events, filters, invalidRange]);

  const locatedEvents = useMemo(
    () => filtered.filter(hasCoordinates),
    [filtered],
  );

  const missingCoordinates = filtered.length - locatedEvents.length;

  const selectedEvent =
    locatedEvents.find((event) => event.id === selectedId) ?? null;

  const selectEvent = useCallback((event: EventRecord) => {
    setSelectedId(event.id);
  }, []);

  function changeFilter(field: keyof Filters, value: string) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));

    setSelectedId(null);
  }

  return (
    <main className="map-page">
      <div className="map-page__container">
        <header className="map-page__heading">
          <div>
            <h1>Mapa de eventos</h1>
            <p>
              Centro de Monitoreo · Ubicación de los eventos según su fecha de
              ocurrencia.
            </p>
          </div>

          <button
            type="button"
            disabled={isLoading || sessionExpired}
            onClick={() => setVersion((current) => current + 1)}
          >
            {isLoading ? "Actualizando…" : "Actualizar datos"}
          </button>
        </header>

        {isLoading && <p role="status">Cargando eventos…</p>}

        {error && (
          <div className="map-page__error" role="alert">
            <p>{error}</p>

            <button
              type="button"
              onClick={
                sessionExpired
                  ? onLogout
                  : () => setVersion((current) => current + 1)
              }
            >
              {sessionExpired ? "Volver al login" : "Reintentar"}
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <section
              className="map-page__filters"
              aria-label="Filtros del mapa"
            >
              <label>
                Desde
                <input
                  type="date"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(e) => changeFilter("from", e.target.value)}
                />
              </label>

              <label>
                Hasta
                <input
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(e) => changeFilter("to", e.target.value)}
                />
              </label>

              <label>
                Tipo de evento
                <select
                  value={filters.type}
                  onChange={(e) => changeFilter("type", e.target.value)}
                >
                  <option value="">Todos</option>

                  {types.map((type) => (
                    <option key={type} value={type}>
                      {label(type)}
                    </option>
                  ))}
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
                  <option value="anulado">Anulado</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setFilters({ ...EMPTY_FILTERS });
                  setSelectedId(null);
                }}
              >
                Limpiar filtros
              </button>
            </section>

            {invalidRange && (
              <p className="map-page__error" role="alert">
                La fecha desde no puede ser posterior a la fecha hasta.
              </p>
            )}

            <p className="map-page__summary" role="status">
              {locatedEvents.length} eventos ubicados de {filtered.length}{" "}
              resultados.
              {missingCoordinates > 0 && (
                <> {missingCoordinates} sin coordenadas válidas.</>
              )}
            </p>

            {view === "events" && (
              <>
                <ul className="map-page__legend" aria-label="Estados">
                  <li>
                    <span className="map-page__dot map-page__dot--open" />
                    Abierto
                  </li>

                  <li>
                    <span className="map-page__dot map-page__dot--closed" />
                    Cerrado
                  </li>

                  <li>
                    <span className="map-page__dot map-page__dot--cancelled" />
                    Anulado
                  </li>
                </ul>

                <p className="map-page__hint">
                  Seleccioná un punto para consultar el evento. Los círculos
                  numerados agrupan eventos cercanos; presionalos para ampliar.
                </p>
              </>
            )}

            <EventsMap
              events={locatedEvents}
              view={view}
              onViewChange={(nextView) => {
                setView(nextView);
                setSelectedId(null);
              }}
              onSelect={selectEvent}
            />

            {filtered.length === 0 && !invalidRange && (
              <p className="map-page__notice">
                No hay eventos que coincidan con los filtros.
              </p>
            )}

            {filtered.length > 0 && locatedEvents.length === 0 && (
              <p className="map-page__notice">
                Los resultados no tienen coordenadas válidas para mostrarse en
                el mapa.
              </p>
            )}

            {view === "events" && selectedEvent && (
              <section
                className="map-page__detail"
                aria-labelledby="map-event-heading"
                aria-live="polite"
              >
                <h2 id="map-event-heading">
                  Evento N.º {selectedEvent.numero_evento}
                </h2>

                <dl>
                  <div>
                    <dt>Tipo</dt>
                    <dd>{label(selectedEvent.tipo_evento)}</dd>
                  </div>

                  <div>
                    <dt>Estado</dt>
                    <dd>{label(selectedEvent.estado)}</dd>
                  </div>

                  <div>
                    <dt>Fecha y hora de ocurrencia</dt>
                    <dd>{formatDate(selectedEvent.fecha_ocurrencia)}</dd>
                  </div>

                  <div>
                    <dt>Dirección</dt>
                    <dd>{selectedEvent.direccion || "Sin información"}</dd>
                  </div>
                </dl>

                <Link to={`/eventos/${selectedEvent.id}`}>
                  Ver detalle del evento
                </Link>
              </section>
            )}

            <details className="map-page__list">
              <summary>
                Consultar los resultados en un listado ({filtered.length})
              </summary>

              {filtered.length === 0 ? (
                <p>No hay resultados.</p>
              ) : (
                <ul>
                  {filtered.map((event) => (
                    <li key={event.id}>
                      <Link to={`/eventos/${event.id}`}>
                        Evento N.º {event.numero_evento}
                      </Link>

                      <span>
                        {label(event.tipo_evento)} ·{" "}
                        {formatDate(event.fecha_ocurrencia)} ·{" "}
                        {label(event.estado)}
                      </span>

                      <span>
                        {event.direccion || "Sin dirección"}
                        {!hasCoordinates(event) && " · Sin coordenadas válidas"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </>
        )}
      </div>
    </main>
  );
}
