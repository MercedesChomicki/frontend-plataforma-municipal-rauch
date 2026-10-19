export type EventStatus = 'Abierto' | 'Cerrado' | 'Anulado';

export interface ApiEvent {
  id: number;
  numero_evento: number;
  area: string;
  tipo_evento: string;
  descripcion: string | null;
  estado: string;
  fecha_ocurrencia: string | null;
  direccion: string | null;
  servicio_actuante: string | null;
}

export interface ApiPeriod {
  desde: string;
  hasta: string;
}

export interface ApiDashboardSummary {
  area: string | null;
  generado_en: string;

  periodos: {
    hoy: ApiPeriod;
    semana: ApiPeriod;
    mes: ApiPeriod;
    ultimos_30_dias: ApiPeriod;
  };

  eventos_mes: number;
  eventos_semana: number;
  eventos_hoy: number;
  eventos_abiertos: number;

  evolucion_diaria: {
    fecha: string;
    cantidad: number;
  }[];

  distribucion_por_tipo: {
    area: string;
    tipo_evento: string;
    cantidad: number;
  }[];

  ultimos_eventos: ApiEvent[];
}

export interface MunicipalEvent {
  id: string;
  number: number;
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
  area: string | null;
  generatedAt: string;
  month: number;
  week: number;
  today: number;
  open: number;
  evolution: DailyCount[];
  byType: TypeCount[];
  recentEvents: MunicipalEvent[];
}