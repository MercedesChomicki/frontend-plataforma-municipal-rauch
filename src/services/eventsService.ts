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