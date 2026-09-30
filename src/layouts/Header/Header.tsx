import './Header.scss'

interface HeaderProps {
  timeStr?: string;
  dateStr?: string;
}

/**
 * Componente del Encabezado con Indicadores
 */
export function Header({ timeStr, dateStr }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__status">
        <span className="site-header__dot" aria-hidden="true" />
        <span>SISTEMA EN LÍNEA</span>
      </div>
      <div className="site-header__clock">
        <span>{timeStr}</span>
        <span>{dateStr}</span>
      </div>
    </header>
  );
}