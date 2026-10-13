import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import './NewEventButton.scss';

export default function NewEventButton() {
  return (
    <Link to="/eventos/nuevo" className="new-event-button">
      <Plus aria-hidden="true" />
      Nuevo evento
    </Link>
  );
}