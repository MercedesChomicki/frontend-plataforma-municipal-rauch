import {
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  Clock3,
  LogOut,
  MapPin,
  Plus,
  TriangleAlert,
} from 'lucide-react';

import municipalLogo from '../../assets/images/logo-letras-blancas.svg';

import { useDashboard } from '../../hooks/useDashboard';
import type {
  DailyCount,
  EventStatus,
  TypeCount,
} from '../../types/dashboard';

import './ControlPanel.scss';

type PanelSection = 'eventos' | 'mapa' | 'reportes';

interface ControlPanelProps {
  user: {
    name: string;
    department?: string;
    role?: string;
  };
  onLogout: () => void;
  onNewEvent: () => void;
  onNavigate: (section: PanelSection) => void;
  accessToken: string;
}

const statusClasses: Record<EventStatus, string> = {
  Abierto: 'open',
  Cerrado: 'closed',
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase();
}

function EvolutionChart({ data }: { data: DailyCount[] }) {
  const left = 42;
  const right = 390;
  const top = 20;
  const bottom = 205;

  const step = Math.max(
    1,
    Math.ceil(Math.max(0, ...data.map(item => item.value)) / 4),
  );

  const maximum = step * 4;
  const ticks = Array.from({ length: 5 }, (_, index) => index * step);

  const xAt = (index: number) =>
    left + (index / Math.max(1, data.length - 1)) * (right - left);

  const yAt = (value: number) =>
    bottom - (value / maximum) * (bottom - top);

  const points = data
    .map((item, index) => `${xAt(index)},${yAt(item.value)}`)
    .join(' ');

  return (
    <svg
      className="control-panel__line-chart"
      viewBox="0 0 420 245"
      role="img"
      aria-label={`Eventos diarios: ${data
        .map(item => `${item.label}: ${item.value}`)
        .join('; ')}`}
    >
      {ticks.map(value => (
        <g key={value}>
          <line
            className="chart-grid"
            x1={left}
            y1={yAt(value)}
            x2={right}
            y2={yAt(value)}
          />
          <text
            className="chart-label"
            x={left - 10}
            y={yAt(value) + 4}
            textAnchor="end"
          >
            {value}
          </text>
        </g>
      ))}

      {data.map((item, index) =>
        index % 5 === 0 || index === data.length - 1 ? (
          <text
            key={item.date}
            className="chart-label"
            x={xAt(index)}
            y={bottom + 20}
            textAnchor="middle"
          >
            {item.label}
          </text>
        ) : null,
      )}

      <polygon
        points={`${left},${bottom} ${points} ${right},${bottom}`}
        fill="rgba(73, 119, 177, 0.10)"
      />

      <polyline
        points={points}
        fill="none"
        stroke="#4977b1"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {data.filter(item => item.value > 0).map(item => {
        const index = data.indexOf(item);

        return (
          <circle
            key={item.date}
            cx={xAt(index)}
            cy={yAt(item.value)}
            r="3"
            fill="#4977b1"
          >
            <title>{`${item.label}: ${item.value} eventos`}</title>
          </circle>
        );
      })}

      <line
        className="chart-axis"
        x1={left}
        y1={top}
        x2={left}
        y2={bottom}
      />
      <line
        className="chart-axis"
        x1={left}
        y1={bottom}
        x2={right}
        y2={bottom}
      />
    </svg>
  );
}

function TypeChart({ data }: { data: TypeCount[] }) {
  if (data.length === 0) {
    return (
      <p className="control-panel__empty">
        No hay eventos en los últimos 30 días.
      </p>
    );
  }

  const step = Math.max(
    1,
    Math.ceil(Math.max(...data.map(item => item.value)) / 4),
  );

  const maximum = step * 4;
  const ticks = [4, 3, 2, 1, 0].map(value => value * step);

  return (
    <div
      className="type-chart"
      role="img"
      aria-label={`Eventos por tipo: ${data
        .map(item => `${item.label}: ${item.value}`)
        .join('; ')}`}
    >
      <div className="type-chart__scale" aria-hidden="true">
        {ticks.map(value => <span key={value}>{value}</span>)}
      </div>

      <div className="type-chart__plot" aria-hidden="true">
        <div className="type-chart__grid">
          {ticks.map(value => <span key={value} />)}
        </div>

        <div className="type-chart__columns">
          {data.map(item => (
            <div className="type-chart__column" key={item.label}>
              <div className="type-chart__track">
                <div
                  className="type-chart__bar"
                  style={{
                    height: `${(item.value / maximum) * 100}%`,
                    backgroundColor: item.color,
                  }}
                >
                  <span>{item.value}</span>
                </div>
              </div>

              <span className="type-chart__label">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ControlPanel({
  user,
  accessToken,
  onLogout,
  onNewEvent,
  onNavigate,
}: ControlPanelProps) {

  const {
    data,
    isLoading,
    error,
    sessionExpired,
    refresh,
  } = useDashboard(accessToken);

  const indicators = [
    {
      label: 'Eventos mes',
      value: data?.month ?? '—',
      icon: CalendarDays,
    },
    {
      label: 'Eventos semana',
      value: data?.week ?? '—',
      icon: CalendarCheck,
    },
    {
      label: 'Eventos hoy',
      value: data?.today ?? '—',
      icon: TriangleAlert,
    },
    {
      label: 'Eventos abiertos',
      value: data?.open ?? '—',
      icon: Clock3,
    },
  ];

  const recentEvents = data?.recentEvents ?? [];

  return (
    <div className="control-panel">
      <header className="panel-header">
        <img
          className="panel-header__logo"
          src={municipalLogo}
          alt="Municipalidad de Rauch"
        />

        <nav
          className="panel-header__nav"
          aria-label="Navegación del panel"
        >
          <button
            className="panel-header__nav-item panel-header__nav-item--active"
            type="button"
            aria-current="page"
          >
            Panel de control
          </button>

          <button
            className="panel-header__nav-item"
            type="button"
            onClick={() => onNavigate('eventos')}
          >
            Eventos
          </button>

          <button
            className="panel-header__nav-item"
            type="button"
            onClick={() => onNavigate('mapa')}
          >
            Mapa
          </button>

          <button
            className="panel-header__nav-item"
            type="button"
            onClick={() => onNavigate('reportes')}
          >
            Reportes
          </button>
        </nav>

        <div className="panel-header__account">
          <span className="panel-header__avatar" aria-hidden="true">
            {getInitials(user.name)}
          </span>

          <div className="panel-header__user">
            <strong>{user.name}</strong>
            <span>{user.role || 'Operador'}</span>
          </div>

          <button
            className="panel-header__logout"
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="control-panel__main">
        <section
          className="control-panel__heading"
          aria-labelledby="panel-title"
        >
          <div>
            <h1 id="panel-title">Panel de Control</h1>

            <p>
              {user.department || 'Centro de Monitoreo'}
              {' · '}
              Resumen general de actividad
            </p>
          </div>

          <button
            className="control-panel__new-event"
            type="button"
            onClick={onNewEvent}
          >
            <Plus aria-hidden="true" />
            Nuevo evento
          </button>
        </section>

        {isLoading && (
          <p className="control-panel__feedback" role="status">
            Cargando información del panel…
          </p>
        )}

        {error && (
          <div
            className="control-panel__feedback control-panel__feedback--error"
            role="alert"
          >
            <p>{error}</p>

            <button
              type="button"
              onClick={sessionExpired ? onLogout : refresh}
            >
              {sessionExpired ? 'Volver al login' : 'Reintentar'}
            </button>
          </div>
        )}

        {data && (
          <div className="control-panel__feedback">
            <button type="button" onClick={refresh}>
              Actualizar datos
            </button>

            {data.withoutOccurrence > 0 && (
              <p>
                {data.withoutOccurrence} evento(s) sin fecha de ocurrencia
                no se incluyen en las estadísticas por período ni en
                la tabla de últimos eventos.
              </p>
            )}
          </div>
        )}

        <section
          className="control-panel__indicators"
          aria-label="Indicadores de eventos"
        >
          {indicators.map(({ label, value, icon: Icon }) => (
            <article className="indicator-card" key={label}>
              <div>
                <h2>{label}</h2>
                <p>{value}</p>
              </div>

              <span className="indicator-card__icon">
                <Icon aria-hidden="true" />
              </span>
            </article>
          ))}
        </section>

        <section
          className="control-panel__charts"
          aria-label="Gráficos de actividad"
        >
          <article className="chart-card">
            <h2>Evolución últimos 30 días</h2>
            {data && <EvolutionChart data={data.evolution} />}
          </article>

          <article className="chart-card">
            <h2>Eventos por tipo · últimos 30 días</h2>
            {data && <TypeChart data={data.byType} />}
          </article>
        </section>

        <section
          className="events-table"
          aria-labelledby="recent-events-title"
        >
          <div className="events-table__heading">
            <h2 id="recent-events-title">Últimos eventos</h2>

            <button
              type="button"
              onClick={() => onNavigate('eventos')}
            >
              Ver todos
              <ArrowRight aria-hidden="true" />
            </button>
          </div>

          <div
            className="events-table__scroll"
            role="region"
            aria-label="Tabla de últimos eventos"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Evento</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Ubicación</th>
                  <th scope="col">Servicio</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>

              <tbody>
                {data && recentEvents.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      No hay eventos con fecha de ocurrencia para mostrar.
                    </td>
                  </tr>
                )}
                {recentEvents.map(event => (
                  <tr key={event.id}>
                    <td>{event.title}</td>
                    <td>{event.type}</td>

                    <td>
                      <time>{event.date}</time>
                      <span className="events-table__time">
                        {event.time}
                      </span>
                    </td>

                    <td>
                      <span className="events-table__location">
                        <MapPin aria-hidden="true" />
                        {event.location}
                      </span>
                    </td>

                    <td>{event.service}</td>

                    <td>
                      <span
                        className={`event-status event-status--${statusClasses[event.status]}`}
                      >
                        {event.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}