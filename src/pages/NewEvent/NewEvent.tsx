import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import {
  createEvent,
  EventsError,
  getEventTypes,
} from "../../services/eventsService";

import type { EventRecord, EventType } from "../../services/eventsService";

import LocationPicker from "../../components/maps/LocationPicker/LocationPicker";
import type { LocationValue } from "../../components/maps/LocationPicker/LocationPicker";

import "./NewEvent.scss";

interface NewEventProps {
  accessToken: string;
  onLogout: () => void;
}

interface FormValues {
  typeId: string;
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
  typeId: "",
  occurrence: "",
  description: "",
  address: "",
  latitude: "",
  longitude: "",
  shift: "",
  receivedBy: "",
  receivedRole: "",
};

function displayLabel(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function NewEvent({ accessToken, onLogout }: NewEventProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [types, setTypes] = useState<EventType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<EventRecord | null>(null);
  const [version, setVersion] = useState(0);

  const submitting = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadTypes() {
      setLoadingTypes(true);
      setCatalogError(null);
      setSessionExpired(false);

      try {
        const result = await getEventTypes(accessToken, controller.signal);

        if (active) setTypes(result);
      } catch (err: unknown) {
        if (!active) return;

        setSessionExpired(err instanceof EventsError && err.status === 401);

        setCatalogError(
          err instanceof EventsError
            ? err.message
            : "No pudimos cargar los tipos de evento.",
        );
      } finally {
        if (active) setLoadingTypes(false);
      }
    }

    void loadTypes();

    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken, version]);

  function update(field: keyof FormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setError(null);
  }

  function updateLocation(location: LocationValue) {
    if (saving || sessionExpired) return;

    setValues((previous) => ({
      ...previous,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    }));

    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current || created || sessionExpired) return;

    const typeId = Number(values.typeId);
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);

    if (!values.typeId || !types.some((type) => type.id === typeId)) {
      setError("Seleccioná un tipo de evento disponible.");
      return;
    }

    if (!values.occurrence) {
      setError("Ingresá la fecha y hora de ocurrencia.");
      return;
    }

    // El campo datetime-local se interpreta como hora argentina.
    const occurrence = `${values.occurrence}:00-03:00`;

    if (Number.isNaN(new Date(occurrence).getTime())) {
      setError("La fecha y hora de ocurrencia no son válidas.");
      return;
    }

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
      setError("Ingresá coordenadas válidas para la ubicación.");
      return;
    }

    if (!values.description.trim() || !values.address.trim()) {
      setError("Completá la descripción y la dirección.");
      return;
    }

    submitting.current = true;
    setSaving(true);
    setError(null);

    try {
      const result = await createEvent(accessToken, {
        tipo_evento_id: typeId,
        descripcion: values.description.trim(),
        fuente: "manual",
        estado: "abierto",
        fecha_ocurrencia: occurrence,
        latitud: latitude,
        longitud: longitude,
        direccion: values.address.trim(),
        turno: values.shift || undefined,
        recibio_nombre: values.receivedBy.trim() || undefined,
        recibio_funcion: values.receivedRole.trim() || undefined,
      });

      setCreated(result);
    } catch (err: unknown) {
      setSessionExpired(err instanceof EventsError && err.status === 401);

      setError(
        err instanceof EventsError
          ? err.message
          : "No pudimos confirmar el guardado. Consultá el listado antes de volver a enviar para evitar duplicados.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  if (created) {
    return (
      <main className="new-event">
        <section className="new-event__success" role="status">
          <h1>Evento registrado</h1>
          <p>
            Se guardó el evento número <strong>{created.numero_evento}</strong>.
          </p>
          <Link className="new-event__primary" to="/eventos">
            Ver eventos
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="new-event">
      <div className="new-event__heading">
        <div>
          <h1>Registrar evento</h1>
          <p>Centro de Monitoreo · Nuevo registro</p>
        </div>

        {!saving && <Link to="/eventos">Ver eventos</Link>}
      </div>

      <p className="new-event__note">
        El número se asignará al guardar. El evento se creará abierto. Las
        fechas se ingresan en horario argentino.
      </p>

      {catalogError && (
        <div className="new-event__error" role="alert">
          <p>{catalogError}</p>
          <button
            type="button"
            onClick={
              sessionExpired ? onLogout : () => setVersion((value) => value + 1)
            }
          >
            {sessionExpired ? "Volver al login" : "Reintentar"}
          </button>
        </div>
      )}

      {!loadingTypes && !catalogError && types.length === 0 && (
        <p className="new-event__error" role="alert">
          No hay tipos de evento disponibles para COM.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={
            saving ||
            loadingTypes ||
            Boolean(catalogError) ||
            types.length === 0 ||
            sessionExpired
          }
        >
          <legend>Datos del evento</legend>

          <div className="new-event__grid">
            <label>
              Tipo de evento *
              <select
                required
                value={values.typeId}
                onChange={(event) => update("typeId", event.target.value)}
              >
                <option value="">
                  {loadingTypes ? "Cargando tipos…" : "Seleccionar"}
                </option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {displayLabel(type.nombre)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fecha y hora de ocurrencia *
              <input
                type="datetime-local"
                required
                step="60"
                value={values.occurrence}
                onChange={(event) => update("occurrence", event.target.value)}
              />
            </label>

            <label>
              Turno
              <select
                value={values.shift}
                onChange={(event) => update("shift", event.target.value)}
              >
                <option value="">Seleccionar</option>
                <option value="matutino">Matutino</option>
                <option value="vespertino">Vespertino</option>
                <option value="nocturno">Nocturno</option>
              </select>
            </label>

            <label className="new-event__wide">
              Descripción *
              <textarea
                required
                rows={4}
                value={values.description}
                onChange={(event) => update("description", event.target.value)}
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
                onChange={(event) => update("address", event.target.value)}
              />
            </label>

            <div className="new-event__wide">
              <LocationPicker
                latitude={values.latitude}
                longitude={values.longitude}
                disabled={saving || sessionExpired}
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
                onChange={(event) => update("latitude", event.target.value)}
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
                onChange={(event) => update("longitude", event.target.value)}
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
                onChange={(event) => update("receivedBy", event.target.value)}
              />
            </label>

            <label>
              Jerarquía o función
              <input
                type="text"
                value={values.receivedRole}
                onChange={(event) => update("receivedRole", event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        {error && (
          <div className="new-event__error" role="alert">
            <p>{error}</p>
            {sessionExpired && (
              <button type="button" onClick={onLogout}>
                Volver al login
              </button>
            )}
          </div>
        )}

        <div className="new-event__actions">
          {!saving && <Link to="/eventos">Cancelar</Link>}

          <button
            className="new-event__primary"
            type="submit"
            disabled={
              saving ||
              loadingTypes ||
              Boolean(catalogError) ||
              types.length === 0 ||
              sessionExpired
            }
          >
            {saving ? "Guardando…" : "Guardar evento"}
          </button>
        </div>
      </form>
    </main>
  );
}
