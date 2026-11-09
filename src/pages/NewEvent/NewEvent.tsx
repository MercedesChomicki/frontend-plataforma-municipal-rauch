import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import {
  createEvent,
  EventsError,
  getEventTypes,
} from "../../services/eventsService";

import type {
  CreateEventInput,
  EventRecord,
  EventType,
} from "../../services/eventsService";

import LocationPicker from "../../components/maps/LocationPicker/LocationPicker";
import type { LocationValue } from "../../components/maps/LocationPicker/LocationPicker";

import {
  getAreaNumbering,
  NumberingError,
} from "../../services/numberingService";

import type { AreaNumbering } from "../../services/numberingService";

import "./NewEvent.scss";

interface NewEventProps {
  accessToken: string;
  onLogout: () => void;
  canConfigureNumbering: boolean;
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

interface HistoricalValues {
  number: string;
  status: "abierto" | "cerrado";
  registrationDate: string;
  shift: string;
  reference: string;
  closureDate: string;
  closureFirstName: string;
  closureLastName: string;
  closureNotes: string;
}

const initialHistoricalValues: HistoricalValues = {
  number: "",
  status: "abierto",
  registrationDate: "",
  shift: "",
  reference: "",
  closureDate: "",
  closureFirstName: "",
  closureLastName: "",
  closureNotes: "",
};

function argentinaDate(value: string): string | null {
  if (!value) return null;

  const result = `${value}:00-03:00`;

  return Number.isNaN(new Date(result).getTime()) ? null : result;
}

function displayLabel(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function NewEvent({
  accessToken,
  onLogout,
  canConfigureNumbering,
}: NewEventProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<EventRecord | null>(null);
  const [version, setVersion] = useState(0);

  const submitting = useRef(false);
  const [numberingVersion, setNumberingVersion] = useState(0);
  const numberingKey = JSON.stringify([accessToken, numberingVersion]);
  const [numberingResult, setNumberingResult] = useState<{
    key: string;
    data: AreaNumbering | null;
    error: string | null;
    expired: boolean;
  } | null>(null);
  const currentNumbering =
    numberingResult?.key === numberingKey ? numberingResult : null;
  const numbering = currentNumbering?.data ?? null;
  const loadingNumbering = currentNumbering === null;
  const numberingError = currentNumbering?.error ?? null;
  const numberingSessionExpired = currentNumbering?.expired ?? false;
  const numberingReady =
    !loadingNumbering && !numberingError && numbering?.inicializada === true;
  const catalogKey = JSON.stringify([accessToken, version]);
  const [catalogResult, setCatalogResult] = useState<{
    key: string;
    data: EventType[];
    error: string | null;
    expired: boolean;
  } | null>(null);
  const currentCatalog =
    catalogResult?.key === catalogKey ? catalogResult : null;
  const types = currentCatalog?.data ?? [];
  const loadingTypes = currentCatalog === null;
  const catalogError = currentCatalog?.error ?? null;
  const catalogExpired = currentCatalog?.expired ?? false;
  const sessionBlocked =
    sessionExpired || numberingSessionExpired || catalogExpired;

  const [mode, setMode] = useState<"nuevo" | "historico">("nuevo");
  const [historical, setHistorical] = useState<HistoricalValues>(
    initialHistoricalValues,
  );
  const [mustCheckList, setMustCheckList] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void getAreaNumbering(accessToken, controller.signal)
      .then((result) => {
        if (active)
          setNumberingResult({
            key: numberingKey,
            data: result,
            error: null,
            expired: false,
          });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setNumberingResult({
          key: numberingKey,
          data: null,
          expired: err instanceof NumberingError && err.status === 401,
          error:
            err instanceof NumberingError
              ? err.message
              : "No pudimos consultar la numeración. Reintentá antes de guardar.",
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken, numberingKey]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void getEventTypes(accessToken, controller.signal)
      .then((result) => {
        if (active)
          setCatalogResult({
            key: catalogKey,
            data: result,
            error: null,
            expired: false,
          });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setCatalogResult({
          key: catalogKey,
          data: [],
          expired: err instanceof EventsError && err.status === 401,
          error:
            err instanceof EventsError
              ? err.message
              : "No pudimos cargar los tipos de evento.",
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken, catalogKey]);

  function update(field: keyof FormValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setError(null);
  }

  function updateHistorical<K extends keyof HistoricalValues>(
    field: K,
    value: HistoricalValues[K],
  ) {
    setHistorical((previous) => ({
      ...previous,
      [field]: value,
    }));

    setError(null);
  }

  function updateLocation(location: LocationValue) {
    if (saving || sessionBlocked || !numberingReady || mustCheckList) return;

    setValues((previous) => ({
      ...previous,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    }));

    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      submitting.current ||
      created ||
      sessionBlocked ||
      mustCheckList ||
      loadingTypes ||
      catalogError
    ) {
      return;
    }

    if (!numberingReady) {
      setError("La numeración debe estar configurada antes de guardar.");
      return;
    }

    const typeId = Number(values.typeId);

    if (!values.typeId || !types.some((type) => type.id === typeId)) {
      setError("Seleccioná un tipo de evento disponible.");
      return;
    }

    const occurrence = argentinaDate(values.occurrence);

    if (!occurrence) {
      setError("Ingresá una fecha y hora de ocurrencia válidas.");
      return;
    }

    if (!values.description.trim() || !values.address.trim()) {
      setError("Completá la descripción y la dirección o referencia.");
      return;
    }

    const hasLatitude = values.latitude.trim() !== "";
    const hasLongitude = values.longitude.trim() !== "";

    if (hasLatitude !== hasLongitude) {
      setError("Completá ambas coordenadas o dejá las dos vacías.");
      return;
    }

    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);

    if (
      hasLatitude &&
      (!Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        (latitude === 0 && longitude === 0))
    ) {
      setError("Ingresá coordenadas válidas para la ubicación.");
      return;
    }

    const common = {
      tipo_evento_id: typeId,
      descripcion: values.description.trim(),
      fuente: "manual" as const,
      fecha_ocurrencia: occurrence,
      direccion: values.address.trim(),
      turno: values.shift || undefined,
      recibio_nombre: values.receivedBy.trim() || undefined,
      recibio_funcion: values.receivedRole.trim() || undefined,
      ...(hasLatitude ? { latitud: latitude, longitud: longitude } : {}),
    };

    let input: CreateEventInput;

    if (mode === "nuevo") {
      input = {
        ...common,
        modalidad: "nuevo",
        estado: "abierto",
      };
    } else {
      const originalNumber = Number(historical.number);

      if (
        !/^\d+$/.test(historical.number) ||
        !Number.isSafeInteger(originalNumber) ||
        originalNumber < 1 ||
        originalNumber > 2147483647
      ) {
        setError("Ingresá un número original entero y positivo válido.");
        return;
      }

      const registrationDate = argentinaDate(historical.registrationDate);

      const closureDate = argentinaDate(historical.closureDate);

      if (historical.registrationDate && !registrationDate) {
        setError("Revisá la fecha y hora del registro original.");
        return;
      }

      if (
        historical.status === "cerrado" &&
        historical.closureDate &&
        !closureDate
      ) {
        setError("Revisá la fecha y hora del cierre original.");
        return;
      }

      if (
        registrationDate &&
        new Date(occurrence).getTime() > new Date(registrationDate).getTime()
      ) {
        setError(
          "La fecha y hora de ocurrencia no pueden ser posteriores a la fecha y hora del registro original.",
        );
        return;
      }

      if (
        historical.status === "cerrado" &&
        registrationDate &&
        closureDate &&
        new Date(closureDate).getTime() < new Date(registrationDate).getTime()
      ) {
        setError(
          "La fecha y hora del cierre no pueden ser anteriores a la fecha y hora del registro original.",
        );
        return;
      }

      if (
        historical.status === "cerrado" &&
        closureDate &&
        new Date(closureDate).getTime() < new Date(occurrence).getTime()
      ) {
        setError(
          "La fecha y hora del cierre no pueden ser anteriores a la fecha y hora de ocurrencia.",
        );
        return;
      }

      const originalRegistration = {
        fecha: registrationDate,
        responsable_nombre: null,
        responsable_apellido: null,
        area: "videoseguridad",
        turno: historical.shift || null,
        referencia: historical.reference.trim() || null,
      };

      if (historical.status === "cerrado") {
        input = {
          ...common,
          modalidad: "historico",
          numero_evento: originalNumber,
          estado: "cerrado",
          registro_original: originalRegistration,
          cierre_original: {
            nombre: historical.closureFirstName.trim() || null,
            apellido: historical.closureLastName.trim() || null,
            fecha: closureDate,
            observaciones: historical.closureNotes.trim() || null,
          },
        };
      } else {
        input = {
          ...common,
          modalidad: "historico",
          numero_evento: originalNumber,
          estado: "abierto",
          registro_original: originalRegistration,
        };
      }
    }

    submitting.current = true;
    setSaving(true);
    setError(null);

    try {
      const result = await createEvent(accessToken, input);
      setCreated(result);
    } catch (err: unknown) {
      setSessionExpired(err instanceof EventsError && err.status === 401);

      const uncertain = !(err instanceof EventsError) || err.status >= 500;

      setMustCheckList(uncertain);

      if (err instanceof EventsError && err.status === 409) {
        setNumberingVersion((value) => value + 1);
      }

      setError(
        uncertain
          ? "No pudimos confirmar el guardado. Consultá el listado antes de iniciar otra carga para evitar duplicados."
          : err instanceof EventsError && err.status === 409
            ? "No se pudo guardar por un conflicto con el número o la numeración del área. Revisá si el evento ya existe y consultá la configuración."
            : err.message,
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
          <p className="new-event__eyebrow">
            Centro de Monitoreo · Municipalidad de Rauch
          </p>
          <h1>Registrar evento</h1>
          <p className="new-event__intro">
            Registrá un evento y su ubicación para realizar el seguimiento.
          </p>
        </div>

        {!saving && <Link to="/eventos">Ver eventos</Link>}
      </div>

      <div className="new-event__mode">
        <label>
          ¿Qué querés registrar?
          <select
            value={mode}
            disabled={saving || sessionBlocked || mustCheckList}
            onChange={(event) => {
              setMode(
                event.target.value === "historico" ? "historico" : "nuevo",
              );
              setError(null);
            }}
          >
            <option value="nuevo">Nuevo evento</option>
            <option value="historico">Digitalizar registro en papel</option>
          </select>
        </label>
      </div>

      <p className="new-event__note">
        {mode === "nuevo"
          ? "El número se asignará al guardar y el evento comenzará abierto."
          : "Se conservarán el número y los datos del registro en papel. La carga histórica no modifica el contador automático."}{" "}
        Las fechas se ingresan en horario argentino.
      </p>

      {loadingNumbering && (
        <p role="status">Consultando numeración del área…</p>
      )}
      {numberingError && (
        <div className="new-event__error" role="alert">
          <p>{numberingError}</p>
          <button
            type="button"
            onClick={
              numberingSessionExpired
                ? onLogout
                : () => setNumberingVersion((v) => v + 1)
            }
          >
            {numberingSessionExpired
              ? "Volver al login"
              : "Reintentar consulta"}
          </button>
        </div>
      )}
      {!loadingNumbering &&
        !numberingError &&
        numbering &&
        !numbering.inicializada && (
          <div className="new-event__error" role="alert">
            <p>
              {canConfigureNumbering
                ? "Configurá la numeración inicial del área para habilitar el registro de eventos."
                : "El administrador del área debe configurar la numeración antes de que puedas registrar eventos."}
            </p>

            <div className="new-event__actions">
              {canConfigureNumbering && (
                <Link
                  to="/configuracion/numeracion"
                  className="new-event__primary"
                >
                  Configurar numeración
                </Link>
              )}

              <button
                type="button"
                onClick={() => setNumberingVersion((v) => v + 1)}
              >
                Volver a consultar
              </button>
            </div>
          </div>
        )}

      {catalogError && (
        <div className="new-event__error" role="alert">
          <p>{catalogError}</p>
          <button
            type="button"
            onClick={
              sessionExpired || catalogExpired
                ? onLogout
                : () => setVersion((value) => value + 1)
            }
          >
            {sessionExpired || catalogExpired
              ? "Volver al login"
              : "Reintentar"}
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
            sessionBlocked ||
            !numberingReady ||
            mustCheckList
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

        <fieldset
          disabled={
            saving || sessionBlocked || !numberingReady || mustCheckList
          }
        >
          <legend>Ubicación</legend>

          <p>
            Las coordenadas son opcionales. Podés seleccionar un punto en el
            mapa, completar ambas coordenadas o dejar las dos vacías.
          </p>

          <div className="new-event__grid">
            <div className="new-event__wide">
              <LocationPicker
                address={values.address}
                onAddressChange={(address) => update("address", address)}
                latitude={values.latitude}
                longitude={values.longitude}
                disabled={
                  saving || sessionBlocked || !numberingReady || mustCheckList
                }
                onChange={updateLocation}
              />
              <button
                type="button"
                disabled={
                  saving || sessionBlocked || !numberingReady || mustCheckList
                }
                onClick={() => {
                  setValues((previous) => ({
                    ...previous,
                    latitude: "",
                    longitude: "",
                  }));
                  setError(null);
                }}
              >
                Quitar coordenadas
              </button>
            </div>

            <label>
              Latitud
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={values.latitude}
                onChange={(event) => update("latitude", event.target.value)}
              />
            </label>

            <label>
              Longitud
              <input
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

        {mode === "nuevo" && (
          <fieldset
            disabled={
              saving || sessionBlocked || !numberingReady || mustCheckList
            }
          >
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
                  onChange={(event) =>
                    update("receivedRole", event.target.value)
                  }
                />
              </label>
            </div>
          </fieldset>
        )}

        {mode === "historico" && (
          <fieldset
            disabled={
              saving || sessionBlocked || !numberingReady || mustCheckList
            }
          >
            <legend>Registro original en papel</legend>

            <p>
              Completá solamente la información que figura en el registro. Los
              datos desconocidos pueden quedar vacíos, excepto el número.
            </p>

            <div className="new-event__grid">
              <label>
                Número original *
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]+"
                  maxLength={10}
                  required
                  value={historical.number}
                  onChange={(event) =>
                    updateHistorical("number", event.target.value)
                  }
                />
              </label>

              <label>
                Estado que figura en el registro *
                <select
                  value={historical.status}
                  onChange={(event) =>
                    updateHistorical(
                      "status",
                      event.target.value === "cerrado" ? "cerrado" : "abierto",
                    )
                  }
                >
                  <option value="abierto">Abierto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </label>

              <label>
                Fecha y hora del registro original
                <input
                  type="datetime-local"
                  step="60"
                  value={historical.registrationDate}
                  onChange={(event) =>
                    updateHistorical("registrationDate", event.target.value)
                  }
                />
              </label>

              <label>
                Turno del registro original
                <select
                  value={historical.shift}
                  onChange={(event) =>
                    updateHistorical("shift", event.target.value)
                  }
                >
                  <option value="">Sin información</option>
                  <option value="matutino">Matutino</option>
                  <option value="vespertino">Vespertino</option>
                  <option value="nocturno">Nocturno</option>
                </select>
              </label>

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
                  onChange={(event) =>
                    update("receivedRole", event.target.value)
                  }
                />
              </label>

              <label className="new-event__wide">
                Libro, folio o página
                <input
                  value={historical.reference}
                  onChange={(event) =>
                    updateHistorical("reference", event.target.value)
                  }
                />
              </label>
            </div>
          </fieldset>
        )}

        {mode === "historico" && historical.status === "cerrado" && (
          <fieldset
            disabled={
              saving || sessionBlocked || !numberingReady || mustCheckList
            }
          >
            <legend>Cierre original en papel</legend>

            <p>
              Estos datos corresponden al cierre original, no a la persona que
              está digitalizando el registro.
            </p>

            <div className="new-event__grid">
              <label>
                Nombre de quien cerró el evento
                <input
                  value={historical.closureFirstName}
                  onChange={(event) =>
                    updateHistorical("closureFirstName", event.target.value)
                  }
                />
              </label>

              <label>
                Apellido de quien cerró el evento
                <input
                  value={historical.closureLastName}
                  onChange={(event) =>
                    updateHistorical("closureLastName", event.target.value)
                  }
                />
              </label>

              <label>
                Fecha y hora del cierre original
                <input
                  type="datetime-local"
                  step="60"
                  value={historical.closureDate}
                  onChange={(event) =>
                    updateHistorical("closureDate", event.target.value)
                  }
                />
              </label>

              <label className="new-event__wide">
                Observaciones del cierre original
                <textarea
                  rows={4}
                  value={historical.closureNotes}
                  onChange={(event) =>
                    updateHistorical("closureNotes", event.target.value)
                  }
                />
              </label>
            </div>
          </fieldset>
        )}

        {error && (
          <div className="new-event__error" role="alert">
            <p>{error}</p>

            {sessionBlocked && (
              <button type="button" onClick={onLogout}>
                Volver al login
              </button>
            )}

            {mustCheckList && (
              <Link to="/eventos">Consultar listado de eventos</Link>
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
              sessionBlocked ||
              !numberingReady ||
              mustCheckList
            }
          >
            {saving
              ? "Guardando…"
              : mode === "historico"
                ? "Guardar registro histórico"
                : "Guardar evento"}
          </button>
        </div>
      </form>
    </main>
  );
}
