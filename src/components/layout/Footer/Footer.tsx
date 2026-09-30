import './Footer.scss';
import { MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>© 2026 Municipalidad de Rauch</p>
      <div><MapPin aria-hidden="true" /><span>Buenos Aires - Argentina</span></div>
    </footer>
  );
}