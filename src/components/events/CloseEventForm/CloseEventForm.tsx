import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import {
  closeEvent,
  EventsError,
} from '../../../services/eventsService';
import type { EventRecord } from '../../../services/eventsService';

interface CloseEventFormProps {
  accessToken: string;
  eventId: number;
  onClosed: (event: EventRecord) => void;
  onSessionExpired: () => void;
}

export default function CloseEventForm({
  accessToken,
  eventId,
  onClosed,
  onSessionExpired,
}: CloseEventFormProps) {
  const [observations, setObservations] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const submitting = useRef(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submitting.current || sessionExpired) return;

    if (!observations.trim()) {
      setError('Ingresá las observaciones de cierre.');
      return;
    }

    submitting.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const result = await closeEvent(
        accessToken,
        eventId,
        observations,
      );

      onClosed(result);
    } catch (err: unknown) {
      const expired =
        err instanceof EventsError && err.status === 401;

      setSessionExpired(expired);

      setError(
        err instanceof EventsError
          ? err.message
          : 'No pudimos confirmar el cierre. Actualizá el detalle antes de volver a enviarlo.',
      );
    } finally {
      submitting.current = false;
      setIsSaving(false);
    }
  }

  return (
    <form
      className="event-detail__close-form"
      onSubmit={handleSubmit}
      aria-busy={isSaving}
    >
      <label>
        Observaciones de cierre *
        <textarea
          required
          rows={4}
          value={observations}
          disabled={isSaving || sessionExpired}
          onChange={e => {
            setObservations(e.target.value);
            setError(null);
          }}
        />
      </label>

      <p>
        Al confirmar, el evento quedará cerrado y se registrarán
        tu usuario y la fecha y hora de la operación.
      </p>

      {error && (
        <div className="event-detail__error" role="alert">
          <p>{error}</p>

          {sessionExpired && (
            <button type="button" onClick={onSessionExpired}>
              Volver al login
            </button>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={
          isSaving ||
          sessionExpired ||
          !observations.trim()
        }
      >
        {isSaving ? 'Cerrando…' : 'Confirmar cierre'}
      </button>
    </form>
  );
}