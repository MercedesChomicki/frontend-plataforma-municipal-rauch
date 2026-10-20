import type { EventRecord } from '../services/eventsService';

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

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
  second: '2-digit',
  hourCycle: 'h23',
});

function label(value: string | null): string {
  if (!value) return '';

  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dateParts(value: string | null): [string, string] {
  if (!value) return ['', ''];

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return ['', ''];
  }

  return [
    dateFormatter.format(date),
    timeFormatter.format(date),
  ];
}

function csvCell(value: string | number | null): string {
  let text = String(value ?? '');

  // Evita que un texto del evento se interprete como una fórmula.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function fileTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find(part => part.type === type)?.value ?? '';

  return (
    `${get('year')}-${get('month')}-${get('day')}` +
    `_${get('hour')}-${get('minute')}-${get('second')}`
  );
}

export function exportEventsCsv(events: EventRecord[]): void {
  if (events.length === 0) {
    throw new Error('Seleccioná al menos un evento para exportar.');
  }

  const headers = [
    'Número de evento',
    'Área',
    'Tipo',
    'Descripción',
    'Dirección',
    'Fecha de ocurrencia',
    'Hora de ocurrencia (Argentina)',
    'Turno',
    'Servicio actuante',
    'Estado',
  ];

  const rows = events.map(event => {
    const [date, time] = dateParts(event.fecha_ocurrencia);

    return [
      event.numero_evento,
      event.area === 'videoseguridad'
        ? 'Centro de Monitoreo'
        : label(event.area),
      label(event.tipo_evento),
      event.descripcion,
      event.direccion,
      date,
      time,
      label(event.turno),
      label(event.servicio_actuante),
      label(event.estado),
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(';'))
    .join('\r\n');

  // BOM UTF-8 para conservar tildes al abrir el archivo en Excel.
  const blob = new Blob(['\uFEFF', csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = url;
    link.download = `eventos_COM_${fileTimestamp()}.csv`;

    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();

    // Permite que el navegador inicie la descarga antes de liberar la URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}