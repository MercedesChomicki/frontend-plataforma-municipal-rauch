import { MapPin } from "lucide-react";
import "./Footer.scss";

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        © {new Date().getFullYear()} Municipalidad de Rauch
      </p>

      <div>
        <MapPin aria-hidden="true" />
        <span>Buenos Aires · Argentina</span>
      </div>
    </footer>
  );
}