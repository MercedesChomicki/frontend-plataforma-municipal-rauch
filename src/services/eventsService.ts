const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/+$/, '');

export interface EventRecord {
  id: number;
  numero_evento: number;
  area: string;
  tipo_evento: string;
  descripcion: string | null;
  estado: string;
  fecha_ocurrencia: string | null;
  fecha_creacion: string;
  direccion: string | null;
  turno: string | null;
  servicio_actuante: string | null;
}

export class EventsError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'EventsError';
    this.status = status;
  }
}

export async function getEvents(
  token: string,
  signal: AbortSignal,
): Promise<EventRecord[]> {
  const response = await fetch(
    `${API_URL}/eventos/?area=videoseguridad`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    },
  );

  if (!response.ok) {
    throw new EventsError(
      response.status === 401
        ? 'Tu sesión venció. Volvé a ingresar.'
        : response.status === 403
          ? 'No tenés permiso para consultar estos eventos.'
          : 'No pudimos cargar los eventos. Intentá nuevamente.',
      response.status,
    );
  }

  const events: EventRecord[] = await response.json();

  return events.filter(event => event.area === 'videoseguridad');
}

export interface EventType {
  id: number;
  area: string;
  nombre: string;
}

export interface CreateEventInput {
  tipo_evento_id: number;
  descripcion: string;
  fuente: 'manual';
  estado: 'abierto';
  fecha_ocurrencia: string;
  latitud: number;
  longitud: number;
  turno?: string;
  direccion: string;
  origen?: string;
  recibio_nombre?: string;
  recibio_funcion?: string;
  servicio_actuante_id?: number;
}

function requestError(status: number): EventsError {
  const message =
    status === 401
      ? 'Tu sesión venció. Volvé a ingresar.'
      : status === 403
        ? 'No tenés permiso para realizar esta operación.'
        : status === 422
          ? 'El sistema rechazó algunos datos. Revisá el formulario.'
          : status === 400
            ? 'No pudimos guardar el evento. Revisá los datos ingresados.'
            : 'No pudimos completar la operación. Intentá nuevamente.';

  return new EventsError(message, status);
}

export async function getEventTypes(
  token: string,
  signal: AbortSignal,
): Promise<EventType[]> {
  const response = await fetch(
    `${API_URL}/eventos/tipos?area=videoseguridad`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );

  if (!response.ok) throw requestError(response.status);

  const types: EventType[] = await response.json();

  return types.filter(type => type.area === 'videoseguridad');
}

export async function createEvent(
  token: string,
  input: CreateEventInput,
): Promise<EventRecord> {
  const response = await fetch(`${API_URL}/eventos/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw requestError(response.status);

  return response.json();
}