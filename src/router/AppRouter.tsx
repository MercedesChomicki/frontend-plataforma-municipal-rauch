import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

interface AppRouterProps {
  home: ReactElement;
  login: ReactElement;
}

export default function AppRouter({
  home,
  login,
}: AppRouterProps) {
  return (
    <Routes>
      <Route path="/" element={home} />
      <Route path="/login" element={login} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}