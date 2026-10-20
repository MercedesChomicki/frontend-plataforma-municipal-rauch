import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  EventsError,
  getEvent,
} from '../../services/eventsService';
import type { EventRecord } from '../../services/eventsService';

import type { User } from '../../hooks/useAuth';
import CloseEventForm from '../../components/events/CloseEventForm/CloseEventForm';

import './EventDetail.scss';

interface EventDetailProps {
  accessToken: string;
  user: User;
  onLogout: () => void;
}

const formatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatDate(value: string | null): string {
  if (!value) return 'Sin información';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Sin información'
    : formatter.format(date);
}

function label(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function EventDetail({
  accessToken,
  user,
  onLogout,
}: EventDetailProps) {
  const { id } = useParams<{ id: string }>();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [version, setVersion] = useState(0);

  const canClose = 
    event !== null &&
    event.estado === 'abierto' &&
    user.permisos.includes('eventos:write') &&
    user.areas_acceso.includes(event.area); 
  
  const canEdit =
    event !== null &&
    event.area === 'videoseguridad' &&
    (event.estado === 'abierto' || event.estado === 'cerrado') &&
    user.permisos.includes('eventos:write') &&
    user.areas_acceso.includes(event.area);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      setEvent(null);
      setSessionExpired(false);

      const eventId = Number(id);

      if (!Number.isSafeInteger(eventId) || eventId <= 0) {
        setError('El identificador del evento no es válido.');
        setIsLoading(false);
        return;
      }

      try {
        const result = await getEvent(
          accessToken,
          eventId,
          controller.signal,
        );

        if (!active) return;

        setEvent(result);
        
      } catch (err: unknown) {
        if (!active) return;

        setSessionExpired(
          err instanceof EventsError && err.status === 401,
        );

        setError(
          err instanceof EventsError
            ? err.message
            : 'No pudimos cargar el evento. Intentá nuevamente.',
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
  }, [id, accessToken, version]);

  return (
    <main className="event-detail">
      <div className="event-detail__container">
        <header className="event-detail__heading">
          <div>
            <h1>
              {event
                ? `Evento N.º ${event.numero_evento}`
                : 'Detalle del evento'}
            </h1>
            <p>Centro de Monitoreo · Consulta del registro</p>
          </div>

          <div className="event-detail__actions">
            {!isLoading && !error && canEdit && event && (
              <Link
                to={`/eventos/${event.id}/editar`}
                className="event-detail__secondary"
              >
                Editar evento
              </Link>
            )}

            <Link
              to="/eventos"
              className="event-detail__secondary"
            >
              Ver eventos
            </Link>
          </div>
        </header>

        {isLoading && (
          <p role="status">Cargando evento…</p>
        )}

        {error && (
          <div className="event-detail__error" role="alert">
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

        {!isLoading && !error && event && (
          <>
            <section
              className="event-detail__card"
              aria-labelledby="event-general-heading"
            >
              <h2 id="event-general-heading">
                Información del evento
              </h2>

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
                    {event.turno
                      ? label(event.turno)
                      : 'Sin información'}
                  </dd>
                </div>

                <div>
                  <dt>Fecha y hora de ocurrencia</dt>
                  <dd>{formatDate(event.fecha_ocurrencia)}</dd>
                </div>

                <div>
                  <dt>Fecha y hora de incorporación al sistema</dt>
                  <dd>{formatDate(event.fecha_creacion)}</dd>
                </div>

                <div className="event-detail__wide">
                  <dt>Dirección</dt>
                  <dd>{event.direccion || 'Sin información'}</dd>
                </div>

                <div className="event-detail__wide">
                  <dt>Servicio actuante</dt>
                  <dd>
                    {event.servicio_actuante
                      ? label(event.servicio_actuante)
                      : 'Sin información'}
                  </dd>
                </div>

                <div className="event-detail__wide">
                  <dt>Descripción</dt>
                  <dd>
                    {event.descripcion || 'Sin descripción'}
                  </dd>
                </div>
              </dl>
            </section>

            {canClose && event && (
              <section
                className="event-detail__card"
                aria-labelledby="event-close-heading"
              >
                <h2 id="event-close-heading">Cerrar evento</h2>

                <CloseEventForm
                  key={event.id}
                  accessToken={accessToken}
                  eventId={event.id}
                  onClosed={updatedEvent => {
                    setEvent(updatedEvent);
                  }}
                  onSessionExpired={onLogout}
                />
              </section>
            )}

            {event.estado === 'cerrado' && (
              <section
                className="event-detail__card"
                aria-labelledby="event-closure-heading"
              >
                <h2 id="event-closure-heading">
                  Información de cierre
                </h2>

                <dl className="event-detail__grid">
                  <div>
                    <dt>Fecha y hora de cierre</dt>
                    <dd>{formatDate(event.fecha_cierre)}</dd>
                  </div>

                  <div>
                    <dt>ID del usuario responsable</dt>
                    <dd>
                      {event.cerrado_por_id ?? 'Sin información'}
                    </dd>
                  </div>

                  <div className="event-detail__wide">
                    <dt>Observaciones de cierre</dt>
                    <dd>
                      {event.observaciones_cierre ||
                        'Sin información'}
                    </dd>
                  </div>
                </dl>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}