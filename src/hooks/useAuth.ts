import { useState } from 'react';

/**
 * Información del usuario autenticado
 */
interface User {
  name: string;
  role: string;
  department: string;
}

/**
 * Hook de autenticación y control de acceso
 */
export function useAuth() {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = (): void => {
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = (): void => {
    setIsModalOpen(false);
    setError(null);
  };

  const login = (username: string, password: string): void => {
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      if (username.trim() && password.length >= 4) {
        setIsAuthenticated(true);

        setUser({
          name: username,
          role: 'Operador de Guardia',
          department: 'Centro de Monitoreo Rauch',
        });

        setIsModalOpen(false);
      } else {
        setError(
          'Credenciales inválidas. Ingrese un usuario y clave válidos.'
        );
      }

      setIsLoading(false);
    }, 800);
  };

  const logout = (): void => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return {
    isModalOpen,
    isAuthenticated,
    user,
    isLoading,
    error,
    openModal,
    closeModal,
    login,
    logout,
  };
}