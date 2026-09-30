import "./Home.scss";
import { ShieldCheck, ArrowRight } from 'lucide-react';
import municipalLogo from '../../assets/images/logo-letras-blancas.svg';

/**
 * Componente de la sección Principal / Hero
 */
export default function Home({ onAccessClick }: { onAccessClick: () => void }) {
  return (
    <main className="home">
      <img className="home__logo" src={municipalLogo} alt="Municipalidad de Rauch" />
      <h1 className="home__title">
        <span>Sistema Integral de</span>
        <span className="home__title-accent">Gestión de Eventos</span>
      </h1>
      <p className="home__description">
        Registro y seguimiento de incidentes en la ciudad de Rauch
      </p>
      <button className="home__access" onClick={onAccessClick}>
        <span>Acceder al sistema</span>
        <ArrowRight aria-hidden="true" />
      </button>
      <div className="secure-note">
        <ShieldCheck aria-hidden="true" />
        <span>Acceso seguro - Plataforma oficial</span>
      </div>
    </main>
  );
}