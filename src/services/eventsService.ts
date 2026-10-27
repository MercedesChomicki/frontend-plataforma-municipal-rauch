const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");
export interface EventClosure {
  origen: string | null;
  usuario_id: number | null;
  nombre: string | null;
  apellido: string | null;
  fecha: string | null;
  observaciones: string | null;
}
export interface EventCancellation {
  usuario_id: number | null;
  nombre: string | null;
  apellido: string | null;
  fecha: string | null;
  motivo: string | null;
}
export interface EventRecord {
  id: number;
  numero_evento: number;
  area: string;
  tipo_evento: string;
  descripcion: string | null;
  estado: string;
  fecha_ocurrencia: string | null;
  fecha_creacion: string;
  fecha_actualizacion?: string | null;
  direccion: string | null;
  latitud: number;
  longitud: number;
  turno: string | null;
  servicio_actuante: string | null;
  recibio_nombre: string | null;
  recibio_funcion: string | null;
  fecha_cierre: string | null;
  cerrado_por_id: number | null;
  observaciones_cierre: string | null;
  cierre?: EventClosure | null;
  anulacion?: EventCancellation | null;
}
export interface EventAudit {
  id: number;
  evento_id: number | null;
  numeracion_area: string | null;
  accion: string;
  usuario_id: number;
  usuario_nombre: string | null;
  usuario_apellido: string | null;
  area: string | null;
  turno: string | null;
  fecha: string | null;
  detalle: Record<string, unknown> | null;
}
export class EventsError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "EventsError";
    this.status = status;
  }
}
function requestError(status: number): EventsError {
  const messages: Record<number, string> = {
    400: "No se pudo realizar la operación. Revisá los datos ingresados.",
    401: "Tu sesión venció. Volvé a ingresar.",
    403: "No tenés permiso para realizar esta operación.",
    404: "El evento no existe o ya no está disponible.",
    409: "No se pudo completar la operación por el estado actual del registro o de la numeración. Consultá su estado actualizado.",
    422: "El sistema rechazó algunos datos. Revisá el formulario.",
  };
  return new EventsError(
    messages[status] ??
      "No pudimos completar la operación. Intentá nuevamente.",
    status,
  );
}
export async function getEvents(
  token: string,
  signal: AbortSignal,
  options: { includeCancelled?: boolean } = {},
): Promise<EventRecord[]> {
  async function load(cancelled: boolean): Promise<EventRecord[]> {
    const params = new URLSearchParams({ area: "videoseguridad" });
    if (cancelled) params.set("estado", "anulado");
    const response = await fetch(`${API_URL}/eventos/?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!response.ok) throw requestError(response.status);
    return response.json();
  }
  // Solo el listado operativo solicita ambos conjuntos. Reportes/mapa mantienen su alcance.
  const groups = await Promise.all(
    options.includeCancelled ? [load(false), load(true)] : [load(false)],
  );
  const unique = new Map<number, EventRecord>();
  for (const event of groups.flat()) {
    if (event.area === "videoseguridad") unique.set(event.id, event);
  }
  return [...unique.values()];
}
export interface EventType {
  id: number;
  area: string;
  nombre: string;
}
export interface CreateEventInput {
  tipo_evento_id: number;
  descripcion: string;
  fuente: "manual";
  estado: "abierto";
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
export async function getEventTypes(
  token: string,
  signal: AbortSignal,
): Promise<EventType[]> {
  const response = await fetch(`${API_URL}/eventos/tipos?area=videoseguridad`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) throw requestError(response.status);
  const types: EventType[] = await response.json();
  return types.filter((type) => type.area === "videoseguridad");
}
export async function createEvent(
  token: string,
  input: CreateEventInput,
): Promise<EventRecord> {
  const response = await fetch(`${API_URL}/eventos/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw requestError(response.status);
  return response.json();
}
export async function getEvent(
  token: string,
  id: number,
  signal: AbortSignal,
): Promise<EventRecord> {
  const response = await fetch(`${API_URL}/eventos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) throw requestError(response.status);
  return response.json();
}
export async function closeEvent(
  token: string,
  id: number,
  observations: string,
): Promise<EventRecord> {
  const text = observations.trim();
  if (!text) throw new EventsError("Ingresá las observaciones de cierre.", 400);
  const response = await fetch(`${API_URL}/eventos/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ estado: "cerrado", observaciones_cierre: text }),
  });
  if (!response.ok) throw requestError(response.status);
  return response.json();
}
export interface UpdateEventInput {
  descripcion?: string;
  fecha_ocurrencia?: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  turno?: string;
  recibio_nombre?: string;
  recibio_funcion?: string;
}
export async function updateEvent(
  token: string,
  id: number,
  input: UpdateEventInput,
): Promise<EventRecord> {
  const body: UpdateEventInput = {
    descripcion: input.descripcion,
    fecha_ocurrencia: input.fecha_ocurrencia,
    direccion: input.direccion,
    latitud: input.latitud,
    longitud: input.longitud,
    turno: input.turno,
    recibio_nombre: input.recibio_nombre,
    recibio_funcion: input.recibio_funcion,
  };
  const response = await fetch(`${API_URL}/eventos/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw requestError(response.status);
  return response.json();
}
export async function cancelEvent(
  token: string,
  id: number,
  reason: string,
): Promise<EventRecord> {
  const motivo = reason.trim();
  if (!motivo) throw new EventsError("Ingresá el motivo de la anulación.", 400);
  const response = await fetch(`${API_URL}/eventos/${id}/anular`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ motivo }),
  });
  if (!response.ok) throw requestError(response.status);
  return response.json();
}
export async function getEventHistory(
  token: string,
  id: number,
  signal: AbortSignal,
): Promise<EventAudit[]> {
  const response = await fetch(`${API_URL}/eventos/${id}/historial`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) throw requestError(response.status);
  return response.json();
}