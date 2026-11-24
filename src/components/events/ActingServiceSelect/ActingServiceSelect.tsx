import { useEffect, useState } from "react";

import {
  EventsError,
  getActingServices,
} from "../../../services/eventsService";

import type {
  ActingService,
} from "../../../services/eventsService";

interface ActingServiceSelectProps {
  accessToken: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  currentLabel?: string | null;
  onSessionExpired: () => void;
}

const SERVICE_LABELS: Record<string, string> = {
  policia: "Policía",
  transito: "Tránsito",
  bomberos: "Bomberos",
  same: "SAME",
};

function serviceLabel(value: string): string {
  return SERVICE_LABELS[value] ?? value;
}

export default function ActingServiceSelect({
  accessToken,
  value,
  onChange,
  disabled = false,
  currentLabel,
  onSessionExpired,
}: ActingServiceSelectProps) {
  const [services, setServices] = useState<ActingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setExpired(false);

      try {
        const result = await getActingServices(
          accessToken,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setServices(result);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;

        setExpired(
          err instanceof EventsError && err.status === 401,
        );

        setError(
          err instanceof EventsError
            ? err.message
            : "No pudimos cargar los servicios actuantes.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [accessToken, version]);

  const hasCurrentOption =
    value !== "" &&
    !services.some((service) => String(service.id) === value);

  return (
    <div>
      <label>
        Servicio actuante
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || loading || Boolean(error)}
        >
          <option value="">
            {loading ? "Cargando servicios…" : "Sin informar"}
          </option>

          {hasCurrentOption && (
            <option value={value}>
              {currentLabel
                ? serviceLabel(currentLabel)
                : "Servicio actual"}
            </option>
          )}

          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {serviceLabel(service.nombre)}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div className="new-event__error" role="alert">
          <p>{error}</p>

          <p>
            {value
              ? "Si guardás otros cambios, se conservará el servicio actual."
              : "Podés continuar sin informar un servicio."}
          </p>

          <button
            type="button"
            disabled={disabled}
            onClick={
              expired
                ? onSessionExpired
                : () => setVersion((previous) => previous + 1)
            }
          >
            {expired ? "Volver al login" : "Reintentar servicios"}
          </button>
        </div>
      )}
    </div>
  );
}