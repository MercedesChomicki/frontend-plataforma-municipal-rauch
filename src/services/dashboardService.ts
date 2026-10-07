import type {
  ApiEvent,
  DashboardSummary,
  MunicipalEvent,
} from '../types/dashboard';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/+$/, '');

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

const colors = [
  '#2864ef',
  '#1db579',
  '#f3a000',
  '#ef4545',
  '#9048d7',
  '#0ea5d8',
  '#de3b91',
];

export class DashboardError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DashboardError';
    this.status = status;
  }
}

const calendarFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function calendarKey(date: Date): string {
  const parts = calendarFormatter.formatToParts(date);

  const get = (type: string) =>
    parts.find(part => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

// UTC se usa aquí únicamente para operar sobre días calendario,
// después de obtener el día correspondiente al horario argentino.
function shiftDay(key: string, amount: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function shortDate(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

function typeLabel(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function occurrence(event: ApiEvent): Date | null {
  if (!event.fecha_ocurrencia) return null;

  const date = new Date(event.fecha_ocurrencia);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toTableEvent(event: ApiEvent): MunicipalEvent {
  const date = occurrence(event);

  return {
    id: String(event.id),
    title: event.descripcion || 'Sin descripción',
    type: typeLabel(event.tipo_evento),
    date: date
      ? new Intl.DateTimeFormat('es-AR', {
          timeZone: TIME_ZONE,
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(date)
      : 'Sin fecha de ocurrencia',
    time: date
      ? new Intl.DateTimeFormat('es-AR', {
          timeZone: TIME_ZONE,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(date)
      : '—',
    location: event.direccion || 'Sin ubicación',
    service: event.servicio_actuante || 'Sin servicio informado',
    status: event.estado === 'abierto' ? 'Abierto' : 'Cerrado',
  };
}

export function calculateSummary(
  events: ApiEvent[],
  now: Date = new Date(),
): DashboardSummary {
  const today = calendarKey(now);
  const monthStart = `${today.slice(0, 7)}-01`;

  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = shiftDay(today, -((weekday + 6) % 7));
  const periodStart = shiftDay(today, -29);

  const datedEvents = events.flatMap(event => {
    const date = occurrence(event);

    return date
      ? [{ event, date, key: calendarKey(date) }]
      : [];
  });

  const inRange = (key: string, start: string) =>
    key >= start && key <= today;

  const dailyCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();

  for (const item of datedEvents) {
    if (!inRange(item.key, periodStart)) continue;

    dailyCounts.set(
      item.key,
      (dailyCounts.get(item.key) ?? 0) + 1,
    );

    const type = item.event.tipo_evento;

    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  const evolution = Array.from({ length: 30 }, (_, index) => {
    const date = shiftDay(periodStart, index);

    return {
      date,
      label: shortDate(date),
      value: dailyCounts.get(date) ?? 0,
    };
  });

  const byType = [...typeCounts.entries()]
    .sort(([typeA, countA], [typeB, countB]) =>
      countB - countA || typeA.localeCompare(typeB),
    )
    .map(([type, value]) => ({
      label: typeLabel(type),
      value,
      color: colors[
        [...type].reduce(
          (total, character) => total + character.charCodeAt(0),
          0,
        ) % colors.length
      ],
    }));

  const recentEvents = [...datedEvents]
    .sort((a, b) =>
      b.date.getTime() - a.date.getTime() ||
      b.event.id - a.event.id,
    )
    .slice(0, 5)
    .map(item => toTableEvent(item.event));

  return {
    month: datedEvents.filter(item =>
      inRange(item.key, monthStart),
    ).length,
    week: datedEvents.filter(item =>
      inRange(item.key, weekStart),
    ).length,
    today: datedEvents.filter(item => item.key === today).length,
    open: events.filter(event => event.estado === 'abierto').length,
    evolution,
    byType,
    recentEvents,
    withoutOccurrence: events.length - datedEvents.length,
  };
}

export async function getDashboard(
  accessToken: string,
  signal: AbortSignal,
): Promise<DashboardSummary> {
  const response = await fetch(
    `${API_URL}/eventos/?area=videoseguridad`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    },
  );

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'Tu sesión venció. Volvé a ingresar.'
        : response.status === 403
          ? 'No tenés permiso para consultar estos eventos.'
          : 'No pudimos cargar el panel. Intentá nuevamente.';

    throw new DashboardError(message, response.status);
  }

  const events: ApiEvent[] = await response.json();

  // No presentar un estado desconocido como si fuera "cerrado".
  if (
    events.some(event =>
      event.estado !== 'abierto' && event.estado !== 'cerrado',
    )
  ) {
    throw new Error(
      'Hay eventos con estados no compatibles. Deben revisarse en el sistema.',
    );
  }

  return calculateSummary(
    events.filter(event => event.area === 'videoseguridad'),
  );
}