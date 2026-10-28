import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

interface AppRouterProps {
  home: ReactElement;
  login: ReactElement;
  panel: ReactElement;
  events: ReactElement;
  newEvent: ReactElement;
  eventDetail: ReactElement;
  editEvent: ReactElement;
  reports: ReactElement;
  map: ReactElement;
  numbering: ReactElement;
  users: ReactElement;
}

export default function AppRouter({
  home,
  login,
  panel,
  events,
  newEvent,
  eventDetail,
  editEvent,
  reports,
  map,
  numbering,
  users,
}: AppRouterProps) {
  return (
    <Routes>
      <Route path="/" element={home} />
      <Route path="/login" element={login} />
      <Route path="/panel" element={panel} />

      <Route path="/eventos" element={events} />
      <Route path="/eventos/nuevo" element={newEvent} />
      <Route path="/eventos/:id" element={eventDetail} />
      <Route path="/eventos/:id/editar" element={editEvent} />

      <Route path="/reportes" element={reports} />
      <Route path="/mapa" element={map} />
      <Route path="/configuracion/numeracion" element={numbering} />
      <Route path="/configuracion/usuarios" element={users} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}