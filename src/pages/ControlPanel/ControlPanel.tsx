import {
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  Clock3,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useDashboard } from "../../hooks/useDashboard";
import type { DailyCount, TypeCount } from "../../types/dashboard";
import type { User } from "../../hooks/useAuth";
import NewEventButton from "../../components/events/NewEventButton/NewEventButton";
import "./ControlPanel.scss";

type PanelSection = "eventos" | "mapa" | "reportes";

interface ControlPanelProps {
  user: User;
  accessToken: string;
  onLogout: () => void;
  onNavigate: (section: PanelSection) => void;
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  dateStyle: "short",
  timeStyle: "short",
});

function formatUpdate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : dateFormatter.format(date);
}

const statusClasses: Record<string, string> = {
  Abierto: "open",
  Cerrado: "closed",
  Anulado: "cancelled",
};

function EvolutionChart({ data }: { data: DailyCount[] }) {
  if (data.length === 0) {
    return (
      <p className="control-panel__empty">
        No hay información de evolución disponible.
      </p>
    );
  }
  const left = 42;
  const right = 790;
  const top = 20;
  const bottom = 205;

  const step = Math.max(
    1,
    Math.ceil(Math.max(0, ...data.map((item) => item.value)) / 4),
  );

  const maximum = step * 4;
  const ticks = Array.from({ length: 5 }, (_, index) => index * step);

  const xAt = (index: number) =>
    left + (index / Math.max(1, data.length - 1)) * (right - left);

  const yAt = (value: number) => bottom - (value / maximum) * (bottom - top);

  const points = data
    .map((item, index) => `${xAt(index)},${yAt(item.value)}`)
    .join(" ");

  return (
    <svg
      className="control-panel__line-chart"
      viewBox="0 0 820 245"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Eventos diarios: ${data
        .map((item) => `${item.label}: ${item.value}`)
        .join("; ")}`}
    >
      {ticks.map((value) => (
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
        fill="rgba(225, 173, 44, 0.12)"
      />

      <polyline
        points={points}
        fill="none"
        stroke="#b98208"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {data
        .filter((item) => item.value > 0)
        .map((item) => {
          const index = data.indexOf(item);

          return (
            <circle
              key={item.date}
              cx={xAt(index)}
              cy={yAt(item.value)}
              r="3"
              fill="#b98208"
            >
              <title>{`${item.label}: ${item.value} eventos`}</title>
            </circle>
          );
        })}

      <line className="chart-axis" x1={left} y1={top} x2={left} y2={bottom} />
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
  const items = [...data]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
  const maximum = Math.max(1, ...items.map((item) => item.value));
  const colors = [
    "#d5a124",
    "#218b93",
    "#d3664d",
    "#6173a8",
    "#9470a8",
    "#4d8970",
  ];
  if (items.length === 0)
    return (
      <p className="control-panel__empty">
        No hay eventos en los últimos 30 días.
      </p>
    );
  return (
    <ul className="type-chart">
      {items.map((item, index) => (
        <li key={item.label}>
          <div className="type-chart__label">
            <span
              className="type-chart__dot"
              style={{ backgroundColor: colors[index % colors.length] }}
              aria-hidden="true"
            />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="type-chart__track" aria-hidden="true">
            <span
              style={{
                width: `${(item.value / maximum) * 100}%`,
                backgroundColor: colors[index % colors.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ControlPanel({
  user,
  accessToken,
  onLogout,
  onNavigate,
}: ControlPanelProps) {
  const { data, isLoading, error, sessionExpired, refresh } =
    useDashboard(accessToken);
  const canCreate =
    user.permisos.includes("eventos:write") &&
    user.areas_acceso.includes("videoseguridad");
  const indicators = [
    { label: "Eventos del mes", value: data?.month ?? "—", icon: CalendarDays },
    { label: "Esta semana", value: data?.week ?? "—", icon: CalendarCheck },
    { label: "Eventos de hoy", value: data?.today ?? "—", icon: TriangleAlert },
    { label: "Eventos abiertos", value: data?.open ?? "—", icon: Clock3 },
  ];
  return (
    <main className="control-panel">
      <div className="control-panel__main">
        <header className="control-panel__heading">
          <div>
            <p className="control-panel__eyebrow">
              Centro de Monitoreo · Municipalidad de Rauch
            </p>

            <h1>Panel de control</h1>

            <p className="control-panel__intro">
              Una mirada general a la actividad de tu área.
            </p>
          </div>

          <div className="control-panel__heading-actions">
            {canCreate && <NewEventButton />}

            {user.permisos.includes("numeracion:configurar") &&
              user.areas_acceso.includes("videoseguridad") && (
                <Link
                  to="/configuracion/numeracion"
                  className="control-panel__settings-link"
                >
                  Configurar numeración
                </Link>
              )}

            <div className="control-panel__update">
              <p>
                {data ? (
                  <>
                    Actualizado{" "}
                    <time dateTime={data.generatedAt}>
                      {formatUpdate(data.generatedAt)}
                    </time>
                  </>
                ) : (
                  "Resumen de actividad"
                )}
              </p>

              <button
                type="button"
                onClick={refresh}
                disabled={isLoading || sessionExpired}
                aria-label="Actualizar datos del panel"
                title="Actualizar datos"
              >
                <RefreshCw aria-hidden="true" />
                <span>Actualizar</span>
              </button>
            </div>
          </div>
        </header>

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
            <button type="button" onClick={sessionExpired ? onLogout : refresh}>
              {sessionExpired ? "Volver al login" : "Reintentar"}
            </button>
          </div>
        )}
        <section
          className="control-panel__indicators"
          aria-label="Indicadores de eventos"
          aria-busy={isLoading}
        >
          {indicators.map(({ label, value, icon: Icon }) => (
            <article className="indicator-card" key={label}>
              <div className="indicator-card__heading">
                <h2>{label}</h2>
                <span className="indicator-card__icon">
                  <Icon aria-hidden="true" />
                </span>
              </div>
              <p>{value}</p>
            </article>
          ))}
        </section>
        {data && (
          <>
            <section
              className="control-panel__charts"
              aria-label="Gráficos de actividad"
            >
              <article className="chart-card">
                <div className="chart-card__heading">
                  <div>
                    <p className="control-panel__kicker">Actividad reciente</p>
                    <h2>Evolución últimos 30 días</h2>
                  </div>
                </div>
                <EvolutionChart data={data.evolution} />
              </article>
              <article className="chart-card">
                <div className="chart-card__heading">
                  <div>
                    <p className="control-panel__kicker">Clasificación</p>
                    <h2>Eventos por tipo</h2>
                  </div>
                  <span className="chart-card__period">Últimos 30 días</span>
                </div>
                <TypeChart data={data.byType} />
              </article>
            </section>
            <section
              className="events-table"
              aria-labelledby="recent-events-title"
            >
              <div className="events-table__heading">
                <div>
                  <p className="control-panel__kicker">Registro operativo</p>
                  <h2 id="recent-events-title">Últimos eventos ocurridos</h2>
                </div>
                <button type="button" onClick={() => onNavigate("eventos")}>
                  Ver todos <ArrowRight aria-hidden="true" />
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
                      <th scope="col">Ubicación</th>
                      <th scope="col">Fecha y hora</th>
                      <th scope="col">Servicio</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentEvents.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          No hay eventos con fecha de ocurrencia para mostrar.
                        </td>
                      </tr>
                    )}
                    {data.recentEvents.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <div className="events-table__event">
                            <span
                              className="events-table__avatar"
                              aria-hidden="true"
                            >
                              {event.type
                                .trim()
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part.charAt(0))
                                .join("")
                                .toUpperCase()}
                            </span>
                            <div>
                              <strong>{event.type}</strong>
                              <span>Evento N.º {event.number}</span>
                              <p>{event.title}</p>
                            </div>
                          </div>
                        </td>
                        <td>{event.location}</td>
                        <td>
                          {event.date}
                          <span className="events-table__time">
                            {event.time}
                          </span>
                        </td>
                        <td>{event.service}</td>
                        <td>
                          <span
                            className={`event-status event-status--${statusClasses[event.status] ?? "unknown"}`}
                          >
                            {event.status}
                          </span>
                        </td>
                        <td>
                          <Link
                            className="events-table__detail"
                            to={`/eventos/${event.id}`}
                            aria-label={`Ver detalle del evento número ${event.number}`}
                          >
                            Ver detalle <ArrowRight aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
