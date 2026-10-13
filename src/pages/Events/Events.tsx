import { useEffect, useState } from 'react';
import { EventsError, getEvents } from '../../services/eventsService';
import type { EventRecord } from '../../services/eventsService';
import './Events.scss';
import NewEventButton from '../../components/events/NewEventButton/NewEventButton';

interface EventsProps {
  accessToken: string;
  onLogout: () => void;
}

const TIME_ZONE = 'America/Argentina/Buenos_Aires';
const PAGE_SIZE = 10;

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const calendarFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function occurrenceDate(value: string | null): Date | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date: Date): string {
  const parts = calendarFormatter.formatToParts(date);

  const get = (type: string) =>
    parts.find(part => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function label(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function uniqueOptions(values: Array<string | null>): string[] {
  return [...new Set(values.filter(
    (value): value is string => Boolean(value),
  ))].sort((a, b) => a.localeCompare(b, 'es'));
}

const statusClasses: Record<string, string> = {
  abierto: 'events-page__status--open',
  cerrado: 'events-page__status--closed',
  anulado: 'events-page__status--cancelled',
};

export default function Events({
  accessToken,
  onLogout,
}: EventsProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [version, setVersion] = useState(0);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [service, setService] = useState('');
  const [shift, setShift] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [address, setAddress] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      setSessionExpired(false);
      setEvents([]);
      setSelected(new Set());
      setPage(1);

      try {
        const result = await getEvents(
          accessToken,
          controller.signal,
        );

        if (active) setEvents(result);
      } catch (err: unknown) {
        if (!active) return;

        setSessionExpired(
          err instanceof EventsError && err.status === 401,
        );

        setError(
          err instanceof TypeError
            ? 'No pudimos conectar con el sistema. Intentá nuevamente.'
            : err instanceof Error
              ? err.message
              : 'No pudimos cargar los eventos.',
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

  function changeFilter(update: () => void) {
    update();
    setPage(1);
    setSelected(new Set());
  }

  function clearFilters() {
    changeFilter(() => {
      setSearch('');
      setStatus('');
      setType('');
      setService('');
      setShift('');
      setFrom('');
      setTo('');
      setAddress('');
    });
  }

  const invalidDates = Boolean(from && to && from > to);
  const query = normalize(search);

  const filtered = events.filter(event => {
    if (invalidDates) return false;
    if (status && event.estado !== status) return false;
    if (type && event.tipo_evento !== type) return false;
    if (service && event.servicio_actuante !== service) return false;
    if (shift && event.turno !== shift) return false;
    if (address.trim() && !normalize(event.direccion ?? '').includes(normalize(address))) return false;

    const date = occurrenceDate(event.fecha_ocurrencia);

    if (from || to) {
      if (!date) return false;

      const key = dayKey(date);
      if (from && key < from) return false;
      if (to && key > to) return false;
    }

    const searchable = [
      event.numero_evento,
      event.descripcion,
      event.direccion,
      event.tipo_evento,
      event.servicio_actuante,
    ].join(' ');

    return !query || normalize(searchable).includes(query);
  }).sort((a, b) => {
    const dateA = occurrenceDate(a.fecha_ocurrencia)?.getTime();
    const dateB = occurrenceDate(b.fecha_ocurrencia)?.getTime();

    return (dateB ?? -Infinity) - (dateA ?? -Infinity) ||
      b.id - a.id;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const openCount = filtered.filter(
    event => event.estado === 'abierto',
  ).length;

  const closedCount = filtered.filter(
    event => event.estado === 'cerrado',
  ).length;

  const cancelledCount = filtered.filter(
    event => event.estado === 'anulado',
  ).length;

  const allSelected =
    filtered.length > 0 &&
    filtered.every(event => selected.has(event.id));

  function toggleSelection(id: number) {
    setSelected(previous => {
      const next = new Set(previous);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allSelected
        ? new Set()
        : new Set(filtered.map(event => event.id)),
    );
  }

  return (
    <div className="events-page">
      <main className="events-page__main">
        <div className="events-page__heading">
          <div>
            <h1>Eventos</h1>
            <p>Centro de Monitoreo · Consulta de registros</p>
          </div>

          <div className="events-page__actions">
            <NewEventButton />

            <button
              type="button"
              disabled={isLoading}
              onClick={() => setVersion(value => value + 1)}
            >
              {isLoading ? 'Cargando…' : 'Actualizar'}
            </button>
          </div>
          
        </div>

        <section className="events-page__filters" aria-label="Filtros">
          <label className="events-page__search">
            Buscar
            <input
              type="search"
              placeholder="Número, descripción o dirección"
              value={search}
              onChange={event => changeFilter(
                () => setSearch(event.target.value),
              )}
            />
          </label>

          <label>
            Estado
            <select
              value={status}
              onChange={event => changeFilter(
                () => setStatus(event.target.value),
              )}
            >
              <option value="">Todos</option>
              <option value="abierto">Abierto</option>
              <option value="cerrado">Cerrado</option>
              <option value="anulado">Anulado</option>
            </select>
          </label>

          <label>
            Tipo
            <select
              value={type}
              onChange={event => changeFilter(
                () => setType(event.target.value),
              )}
            >
              <option value="">Todos</option>
              {uniqueOptions(events.map(event => event.tipo_evento))
                .map(value => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Servicio
            <select
              value={service}
              onChange={event => changeFilter(
                () => setService(event.target.value),
              )}
            >
              <option value="">Todos</option>
              {uniqueOptions(events.map(event => event.servicio_actuante))
                .map(value => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Turno
            <select
              value={shift}
              onChange={event => changeFilter(
                () => setShift(event.target.value),
              )}
            >
              <option value="">Todos</option>
              <option value="matutino">Matutino</option>
              <option value="vespertino">Vespertino</option>
              <option value="nocturno">Nocturno</option>
            </select>
          </label>

          <label>
            Dirección
            <input
              type="search"
              placeholder="Calle o dirección"
              value={address}
              onChange={event => changeFilter(
                () => setAddress(event.target.value),
              )}
            />
          </label>

          <label>
            Ocurrencia desde
            <input
              type="date"
              value={from}
              onChange={event => changeFilter(
                () => setFrom(event.target.value),
              )}
            />
          </label>

          <label>
            Ocurrencia hasta
            <input
              type="date"
              value={to}
              onChange={event => changeFilter(
                () => setTo(event.target.value),
              )}
            />
          </label>

          <button type="button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </section>

        {invalidDates && (
          <p className="events-page__error" role="alert">
            La fecha desde no puede ser posterior a la fecha hasta.
          </p>
        )}

        {error && (
          <div className="events-page__error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={
                sessionExpired
                  ? onLogout
                  : () => setVersion(value => value + 1)
              }
            >
              {sessionExpired ? 'Volver al login' : 'Reintentar'}
            </button>
          </div>
        )}

        {!isLoading && !error && !invalidDates && (
          <>
            <section className="events-page__summary" aria-label="Resultados">
              <span>Total: <strong>{filtered.length}</strong></span>
              <span>Abiertos: <strong>{openCount}</strong></span>
              <span>Cerrados: <strong>{closedCount}</strong></span>
              <span>Anulados: <strong>{cancelledCount}</strong></span>
              <span>Seleccionados: <strong>{selected.size}</strong></span>
            </section>

            <div className="events-page__selection">
              <button
                type="button"
                onClick={toggleAll}
                disabled={filtered.length === 0}
              >
                {allSelected
                  ? 'Quitar selección'
                  : 'Seleccionar todos los resultados'}
              </button>
              <p>
                La selección incluye los resultados de todas las páginas.
                Al cambiar los filtros, se limpia la selección.
              </p>
            </div>
          </>
        )}

        <div
          className="events-page__table"
          role="region"
          aria-label="Listado de eventos"
          tabIndex={0}
          aria-busy={isLoading}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Selección</th>
                <th scope="col">Número</th>
                <th scope="col">Tipo</th>
                <th scope="col">Descripción</th>
                <th scope="col">Dirección</th>
                <th scope="col">Fecha y hora de ocurrencia</th>
                <th scope="col">Servicio</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} role="status">Cargando eventos…</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8}>No se pudo cargar el listado.</td>
                </tr>
              ) : invalidDates ? (
                <tr>
                  <td colSpan={8}>Corregí el rango de fechas.</td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    {events.length === 0
                      ? 'Todavía no hay eventos registrados.'
                      : 'No hay eventos que coincidan con los filtros.'}
                  </td>
                </tr>
              ) : visible.map(event => {
                const date = occurrenceDate(event.fecha_ocurrencia);

                return (
                  <tr key={event.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(event.id)}
                        onChange={() => toggleSelection(event.id)}
                        aria-label={`Seleccionar evento ${event.numero_evento}`}
                      />
                    </td>
                    <td>{event.numero_evento}</td>
                    <td>{label(event.tipo_evento)}</td>
                    <td>{event.descripcion || 'Sin descripción'}</td>
                    <td>{event.direccion || 'Sin dirección'}</td>
                    <td>
                      {date ? (
                        <time dateTime={event.fecha_ocurrencia ?? undefined}>
                          {dateFormatter.format(date)}
                          <small>{timeFormatter.format(date)}</small>
                        </time>
                      ) : 'Sin fecha'}
                    </td>
                    <td>
                      {event.servicio_actuante
                        ? label(event.servicio_actuante)
                        : 'Sin servicio informado'}
                    </td>
                    <td>
                      <span
                        className={[
                          'events-page__status',
                          statusClasses[event.estado] ?? '',
                        ].filter(Boolean).join(' ')}
                      >
                        {label(event.estado)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && !error && !invalidDates && filtered.length > 0 && (
          <nav className="events-page__pagination" aria-label="Paginación">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </button>

            <span>Página {currentPage} de {pageCount}</span>

            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}