import { ArrowRight, Building2, LockKeyhole } from "lucide-react";

import municipalLogo from "../../assets/images/logo.svg";
import "./Home.scss";

interface HomeProps {
  onAccessClick: () => void;
}

export default function Home({ onAccessClick }: HomeProps) {
  return (
    <main className="home" aria-labelledby="home-title">
      <div className="home__content">
        <img
          className="home__logo"
          src={municipalLogo}
          alt="Municipalidad de Rauch"
        />

        <div className="home__eyebrow">
          <Building2 aria-hidden="true" />
          <span>Gestión municipal</span>
        </div>

        <h1 id="home-title" className="home__title">
          Sistema Integral de
          <span>Gestión de Eventos</span>
        </h1>

        <p className="home__description">
          Una plataforma para registrar, consultar y dar
          seguimiento a los eventos de cada área municipal.
        </p>

        <button
          className="home__access"
          type="button"
          onClick={onAccessClick}
        >
          Acceder al sistema
          <ArrowRight aria-hidden="true" />
        </button>

        <p className="home__note">
          <LockKeyhole aria-hidden="true" />
          Acceso exclusivo para personal autorizado
        </p>

        <div className="home__institution">
          <span>Municipalidad de Rauch</span>
          <span>Subsecretaría de Protección Ciudadana</span>
        </div>
      </div>
    </main>
  );
}