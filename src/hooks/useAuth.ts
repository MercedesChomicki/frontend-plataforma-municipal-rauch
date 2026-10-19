import { useRef, useState } from 'react';
import { iniciarSesion } from '../services/authService';
import type { ApiUser, Role } from '../services/authService';

export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  department: string;
  roles: Role[];

  area: string | null;
  permisos: string[];
  areas_acceso: string[];
}

const AREA_LABELS: Record<string, string> = {
  videoseguridad: 'Centro de Monitoreo',
  zoonosis: 'Zoonosis',
  bromatologia: 'Bromatología',
};

function adaptarUsuario(apiUser: ApiUser): User {
  const fullName = [
    apiUser.nombre,
    apiUser.apellido,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const roleNames = apiUser.roles.map(item => item.nombre);

  if (roleNames.length === 0 && apiUser.rol) {
    roleNames.push(apiUser.rol);
  }

  const role = roleNames
    .map(name =>
      name === 'adminDios' ? 'Superadministrador' : name,
    )
    .join(', ');

  const area = apiUser.area;

  return {
    id: apiUser.id,
    username: apiUser.username,
    name: fullName || apiUser.username,
    role: role || 'Sin rol asignado',
    department: area 
      ? AREA_LABELS[area] ?? area 
      : apiUser.areas_acceso.length > 1 
        ? 'Todas las áreas'
        : 'Sin área asignada',
    roles: apiUser.roles,
    area,
    permisos: apiUser.permisos,
    areas_acceso: apiUser.areas_acceso,
  };
}

export function useAuth() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evita enviar dos solicitudes al mismo tiempo.
  const loginPending = useRef(false);

  // Permite descartar una respuesta si se cerró la sesión.
  const requestId = useRef(0);

  const isAuthenticated = user !== null && accessToken !== null;

  const openModal = (): void => {
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = (): void => {
    setIsModalOpen(false);
    setError(null);
  };

  const login = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    if (loginPending.current) {
      return false;
    }

    setError(null);

    if (!username.trim() || !password) {
      setError('Ingresá tu usuario y contraseña.');
      return false;
    }

    loginPending.current = true;
    const currentRequest = ++requestId.current;
    setIsLoading(true);

    try {
      const session = await iniciarSesion(username, password);

      if (currentRequest !== requestId.current) {
        return false;
      }

      setAccessToken(session.accessToken);
      setUser(adaptarUsuario(session.user));
      setIsModalOpen(false);

      return true;
    } catch (err: unknown) {
      if (currentRequest !== requestId.current) {
        return false;
      }

      setAccessToken(null);
      setUser(null);

      setError(
        err instanceof TypeError
          ? 'No pudimos conectar con el sistema. Intentá nuevamente en unos minutos. Si el problema continúa, contactá al administrador.'
          : err instanceof Error
            ? err.message
            : 'Ocurrió un error al iniciar sesión.',
      );

      return false;
    } finally {
      loginPending.current = false;

      if (currentRequest === requestId.current) {
        setIsLoading(false);
      }
    }
  };

  const logout = (): void => {
    requestId.current += 1;

    setAccessToken(null);
    setUser(null);
    setError(null);
    setIsLoading(false);
    setIsModalOpen(false);
  };

  return {
    isModalOpen,
    isAuthenticated,
    user,
    accessToken,
    isLoading,
    error,
    openModal,
    closeModal,
    login,
    logout,
  };
}