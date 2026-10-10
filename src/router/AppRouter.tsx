import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

interface AppRouterProps {
  home: ReactElement;
  login: ReactElement;
  panel: ReactElement;
  events: ReactElement;
}

export default function AppRouter({
  home,
  login,
  panel,
  events,
}: AppRouterProps) {
  return (
    <Routes>
      <Route path="/" element={home} />
      <Route path="/login" element={login} />
      <Route path="/panel" element={panel} />
      <Route path="/eventos" element={events} />
     
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}