import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  EventsError,
  getEvent,
  updateEvent,
} from "../../services/eventsService";

import type {
  EventRecord,
  UpdateEventInput,
} from "../../services/eventsService";

import type { User } from "../../hooks/useAuth";

import LocationPicker from "../../components/maps/LocationPicker/LocationPicker";
import type { LocationValue } from "../../components/maps/LocationPicker/LocationPicker";

import "../NewEvent/NewEvent.scss";

interface EditEventProps {
  accessToken: string;
  user: User;
  onLogout: () => void;
}

interface FormValues {
  occurrence: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  shift: string;
  receivedBy: string;
  receivedRole: string;
}

const initialValues: FormValues = {
  occurrence: "",
  description: "",
  address: "",
  latitude: "",
  longitude: "",
  shift: "",
  receivedBy: "",
  receivedRole: "",
};

const occurrenceFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toLocalOccurrence(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const parts = occurrenceFormatter.formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return (
    `${get("year")}-${get("month")}-${get("day")}` +
    `T${get("hour")}:${get("minute")}`
  );
}

function label(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toFormValues(event: EventRecord): FormValues {
  return {
    occurrence: toLocalOccurrence(event.fecha_ocurrencia),
    description: event.descripcion ?? "",
    address: event.direccion ?? "",
    latitude: String(event.latitud),
    longitude: String(event.longitud),
    shift: event.turno ?? "",
    receivedBy: event.recibio_nombre ?? "",
    receivedRole: event.recibio_funcion ?? "",
  };
}

export default function EditEvent({
  accessToken,
  user,
  onLogout,
}: EditEventProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  const submitting = useRef(false);

  const canEdit =
    event !== null &&
    event.area === "videoseguridad" &&
    user.areas_acceso.includes(event.area) &&
    user.permisos.includes("eventos:write") &&
    (event.estado === "abierto" || event.estado === "cerrado");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      setSaveError(null);
      setSessionExpired(false);
      setEvent(null);

      const eventId = Number(id);

      if (!Number.isSafeInteger(eventId) || eventId <= 0) {
        setLoadError("El identificador del evento no es válido.");
        setIsLoading(false);
        return;
      }

      try {
        const result = await getEvent(accessToken, eventId, controller.signal);

        if (!active) return;

        setEvent(result);
        setValues(toFormValues(result));
      } catch (err: unknown) {
        if (!active) return;

        setSessionExpired(err instanceof EventsError && err.status === 401);

        setLoadError(
          err instanceof EventsError
            ? err.message
            : "No pudimos cargar el evento. Intentá nuevamente.",
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

  function update(field: keyof FormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setSaveError(null);
  }

  function updateLocation(location: LocationValue) {
    if (saving || sessionExpired || !canEdit) return;

    setValues((previous) => ({
      ...previous,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    }));

    setSaveError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!event || !canEdit || submitting.current || sessionExpired) {
      return;
    }

    if (!values.description.trim() || !values.address.trim()) {
      setSaveError("Completá la descripción y la dirección.");
      return;
    }

    const occurrence = `${values.occurrence}:00-03:00`;

    if (!values.occurrence || Number.isNaN(new Date(occurrence).getTime())) {
      setSaveError("Ingresá una fecha y hora de ocurrencia válida.");
      return;
    }

    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);

    if (
      !values.latitude.trim() ||
      !values.longitude.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      (latitude === 0 && longitude === 0)
    ) {
      setSaveError("Seleccioná una ubicación válida o revisá las coordenadas.");
      return;
    }

    const shifts = ["matutino", "vespertino", "nocturno"];

    if (
      values.shift !== (event.turno ?? "") &&
      values.shift !== "" &&
      !shifts.includes(values.shift)
    ) {
      setSaveError("Seleccioná un turno válido.");
      return;
    }

    // Enviamos únicamente los campos que cambiaron.
    const input: UpdateEventInput = {};

    const description = values.description.trim();
    const address = values.address.trim();
    const receivedBy = values.receivedBy.trim();
    const receivedRole = values.receivedRole.trim();

    if (description !== (event.descripcion ?? "")) {
      input.descripcion = description;
    }

    if (address !== (event.direccion ?? "")) {
      input.direccion = address;
    }

    if (values.occurrence !== toLocalOccurrence(event.fecha_ocurrencia)) {
      input.fecha_ocurrencia = occurrence;
    }

    if (latitude !== event.latitud) {
      input.latitud = latitude;
    }

    if (longitude !== event.longitud) {
      input.longitud = longitude;
    }

    if (values.shift !== (event.turno ?? "")) {
      input.turno = values.shift;
    }

    if (receivedBy !== (event.recibio_nombre ?? "")) {
      input.recibio_nombre = receivedBy;
    }

    if (receivedRole !== (event.recibio_funcion ?? "")) {
      input.recibio_funcion = receivedRole;
    }

    if (Object.keys(input).length === 0) {
      setSaveError("No realizaste cambios para guardar.");
      return;
    }

    submitting.current = true;
    setSaving(true);
    setSaveError(null);

    try {
      const updatedEvent = await updateEvent(accessToken, event.id, input);

      navigate(`/eventos/${updatedEvent.id}`, {
        replace: true,
      });
    } catch (err: unknown) {
      setSessionExpired(err instanceof EventsError && err.status === 401);

      setSaveError(
        err instanceof EventsError
          ? err.message
          : "No pudimos confirmar el guardado. Consultá el detalle antes de volver a enviar los cambios.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <main className="new-event">
      <header className="new-event__heading">
        <div>
          <h1>
            {event
              ? `Editar evento N.º ${event.numero_evento}`
              : "Editar evento"}
          </h1>
          <p>Centro de Monitoreo · Corrección del registro</p>
        </div>

        {!saving && (
          <Link to={event ? `/eventos/${event.id}` : "/eventos"}>
            {event ? "Ver detalle" : "Ver eventos"}
          </Link>
        )}
      </header>

      {isLoading && <p role="status">Cargando información del evento…</p>}

      {loadError && (
        <div className="new-event__error" role="alert">
          <p>{loadError}</p>

          <button
            type="button"
            onClick={
              sessionExpired
                ? onLogout
                : () => setVersion((previous) => previous + 1)
            }
          >
            {sessionExpired ? "Volver al login" : "Reintentar"}
          </button>
        </div>
      )}

      {!isLoading && !loadError && event && !canEdit && (
        <div className="new-event__error" role="alert">
          <p>
            No tenés habilitada la edición de este evento por sus permisos, área
            o estado.
          </p>
          <Link to={`/eventos/${event.id}`}>Ver detalle</Link>
        </div>
      )}

      {!isLoading && !loadError && event && canEdit && (
        <>
          <p className="new-event__note">
            El evento conservará su número y su estado actual:{" "}
            <strong>{label(event.estado)}</strong>.
            {event.estado === "cerrado" &&
              " La corrección conservará los datos del cierre."}{" "}
            Las fechas se ingresan en horario argentino.
          </p>

          <form onSubmit={handleSubmit} aria-busy={saving}>
            <fieldset disabled={saving || sessionExpired}>
              <legend>Datos del evento</legend>

              <div className="new-event__grid">
                <div>
                  <strong>Tipo de evento</strong>
                  <p>{label(event.tipo_evento)}</p>
                </div>

                <div>
                  <strong>Servicio actuante</strong>
                  <p>
                    {event.servicio_actuante
                      ? label(event.servicio_actuante)
                      : "Sin información"}
                  </p>
                </div>

                <label>
                  Fecha y hora de ocurrencia *
                  <input
                    required
                    type="datetime-local"
                    step="60"
                    value={values.occurrence}
                    onChange={(e) => update("occurrence", e.target.value)}
                  />
                </label>

                <label>
                  Turno
                  <select
                    value={values.shift}
                    onChange={(e) => update("shift", e.target.value)}
                  >
                    <option value="">Sin informar</option>
                    <option value="matutino">Matutino</option>
                    <option value="vespertino">Vespertino</option>
                    <option value="nocturno">Nocturno</option>

                    {values.shift &&
                      !["matutino", "vespertino", "nocturno"].includes(
                        values.shift,
                      ) && (
                        <option value={values.shift}>
                          {label(values.shift)} (valor existente)
                        </option>
                      )}
                  </select>
                </label>

                <label className="new-event__wide">
                  Descripción *
                  <textarea
                    required
                    rows={4}
                    value={values.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset disabled={saving || sessionExpired}>
              <legend>Ubicación</legend>

              <div className="new-event__grid">
                <label className="new-event__wide">
                  Dirección o referencia de ubicación *
                  <input
                    required
                    type="text"
                    value={values.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </label>

                <div className="new-event__wide">
                  <LocationPicker
                    latitude={values.latitude}
                    longitude={values.longitude}
                    disabled={saving || sessionExpired || !canEdit}
                    onChange={updateLocation}
                  />
                </div>

                <label>
                  Latitud *
                  <input
                    required
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={values.latitude}
                    onChange={(e) => update("latitude", e.target.value)}
                  />
                </label>

                <label>
                  Longitud *
                  <input
                    required
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={values.longitude}
                    onChange={(e) => update("longitude", e.target.value)}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset disabled={saving || sessionExpired}>
              <legend>Recepción</legend>

              <div className="new-event__grid">
                <label>
                  Recibido por
                  <input
                    type="text"
                    value={values.receivedBy}
                    onChange={(e) => update("receivedBy", e.target.value)}
                  />
                </label>

                <label>
                  Jerarquía o función
                  <input
                    type="text"
                    value={values.receivedRole}
                    onChange={(e) => update("receivedRole", e.target.value)}
                  />
                </label>
              </div>
            </fieldset>

            {saveError && (
              <div className="new-event__error" role="alert">
                <p>{saveError}</p>

                {sessionExpired && (
                  <button type="button" onClick={onLogout}>
                    Volver al login
                  </button>
                )}
              </div>
            )}

            <div className="new-event__actions">
              {!saving && <Link to={`/eventos/${event.id}`}>Cancelar</Link>}

              <button
                className="new-event__primary"
                type="submit"
                disabled={saving || sessionExpired}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  );
}
