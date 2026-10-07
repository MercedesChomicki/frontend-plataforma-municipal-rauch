export type EventStatus = 'Abierto' | 'Cerrado';

export interface ApiEvent {
  id: number;
  area: string;
  tipo_evento: string;
  descripcion: string | null;
  estado: 'abierto' | 'cerrado';
  fecha_ocurrencia: string | null;
  fecha_creacion: string;
  direccion: string | null;
  servicio_actuante: string | null;
}

export interface MunicipalEvent {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  location: string;
  service: string;
  status: EventStatus;
}

export interface DailyCount {
  date: string;
  label: string;
  value: number;
}

export interface TypeCount {
  label: string;
  value: number;
  color: string;
}

export interface DashboardSummary {
  month: number;
  week: number;
  today: number;
  open: number;
  evolution: DailyCount[];
  byType: TypeCount[];
  recentEvents: MunicipalEvent[];
  withoutOccurrence: number;
}