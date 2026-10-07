import { useEffect, useState } from 'react';
import {
  DashboardError,
  getDashboard,
} from '../services/dashboardService';
import type { DashboardSummary } from '../types/dashboard';

export function useDashboard(accessToken: string) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      setData(null);
      setSessionExpired(false);

      try {
        const summary = await getDashboard(
          accessToken,
          controller.signal,
        );

        if (active) setData(summary);
      } catch (err: unknown) {
        if (!active) return;

        setSessionExpired(
          err instanceof DashboardError && err.status === 401,
        );

        setError(
          err instanceof TypeError
            ? 'No pudimos conectar con el sistema. Intentá nuevamente en unos minutos.'
            : err instanceof Error
              ? err.message
              : 'No pudimos cargar el panel.',
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken, requestVersion]);

  const refresh = () => {
    setRequestVersion(version => version + 1);
  };

  return {
    data,
    isLoading,
    error,
    sessionExpired,
    refresh,
  };
}