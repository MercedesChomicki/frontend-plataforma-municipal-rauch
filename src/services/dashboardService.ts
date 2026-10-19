import type {
  ApiDashboardSummary,
  ApiEvent,
  DashboardSummary,
  EventStatus,
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

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export class DashboardError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DashboardError';
    this.status = status;
  }
}

function typeLabel(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shortDate(value: string): string {
  // La API devuelve un día calendario: YYYY-MM-DD.
  // No lo convertimos a Date para evitar desplazamientos horarios.
  return `${value.slice(8, 10)}/${value.slice(5, 7)}`;
}

function typeColor(type: string): string {
  const hash = [...type].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return colors[hash % colors.length];
}

function statusLabel(status: string): EventStatus {
  switch (status) {
    case 'abierto':
      return 'Abierto';

    case 'cerrado':
      return 'Cerrado';

    case 'anulado':
      return 'Anulado';

    default:
      throw new DashboardError(
        'El panel recibió un estado de evento no compatible.',
        200,
      );
  }
}

function toTableEvent(event: ApiEvent): MunicipalEvent {
  const parsedDate = event.fecha_ocurrencia
    ? new Date(event.fecha_ocurrencia)
    : null;

  const date =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate
      : null;

  return {
    id: String(event.id),
    number: event.numero_evento,
    title: event.descripcion || 'Sin descripción',
    type: typeLabel(event.tipo_evento),
    date: date
      ? dateFormatter.format(date)
      : 'Sin fecha de ocurrencia',
    time: date ? timeFormatter.format(date) : '—',
    location: event.direccion || 'Sin ubicación',
    service: event.servicio_actuante
      ? typeLabel(event.servicio_actuante)
      : 'Sin servicio informado',
    status: statusLabel(event.estado),
  };
}

function adaptSummary(
  summary: ApiDashboardSummary,
): DashboardSummary {
  return {
    area: summary.area,
    generatedAt: summary.generado_en,
    month: summary.eventos_mes,
    week: summary.eventos_semana,
    today: summary.eventos_hoy,
    open: summary.eventos_abiertos,

    evolution: summary.evolucion_diaria.map(item => ({
      date: item.fecha,
      label: shortDate(item.fecha),
      value: item.cantidad,
    })),

    byType: summary.distribucion_por_tipo
      .filter(item => item.cantidad > 0)
      .sort(
        (a, b) =>
          b.cantidad - a.cantidad ||
          a.tipo_evento.localeCompare(b.tipo_evento),
      )
      .map(item => ({
        label: typeLabel(item.tipo_evento),
        value: item.cantidad,
        color: typeColor(item.tipo_evento),
      })),

    // Conservamos el orden y la selección definidos por backend.
    recentEvents: summary.ultimos_eventos.map(toTableEvent),
  };
}

export async function getDashboard(
  accessToken: string,
  signal: AbortSignal,
): Promise<DashboardSummary> {
  const query = new URLSearchParams({
    area: 'videoseguridad',
  });

  const response = await fetch(
    `${API_URL}/dashboard/resumen?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    },
  );

  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Tu sesión venció. Volvé a ingresar.',
      403: 'No tenés permiso para consultar el panel de esta área.',
      404: 'El resumen del panel no está disponible.',
      422: 'No pudimos consultar el panel con los parámetros enviados.',
    };

    throw new DashboardError(
      messages[response.status] ??
        'No pudimos cargar el panel. Intentá nuevamente.',
      response.status,
    );
  }

  const summary: ApiDashboardSummary = await response.json();

  if (summary.area !== 'videoseguridad') {
    throw new DashboardError(
      'El resumen recibido no corresponde al Centro de Monitoreo.',
      response.status,
    );
  }

  return adaptSummary(summary);
}