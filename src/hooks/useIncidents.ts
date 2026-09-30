import { useMemo, useState } from 'react';

/**
 * Estructura de un incidente
 */
interface Incident {
  id: string;
  title: string;
  location: string;
  category: string;
  status: string;
  timestamp: string;
}

/**
 * Datos necesarios para registrar un nuevo incidente.
 * El id, timestamp y status son generados automáticamente.
 */
type NewIncident = Omit<Incident, 'id' | 'timestamp' | 'status'>;

/**
 * Hook para la administración del estado de los incidentes registrados
 */
export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([
    {
      id: 'INC-2026-0841',
      title: 'Obstrucción de calzada en Av. San Martín',
      location: 'Av. San Martín y Belgrano',
      category: 'Tránsito',
      status: 'En Proceso',
      timestamp: '17:45 HS',
    },
    {
      id: 'INC-2026-0840',
      title: 'Falla en luminaria pública',
      location: 'Barrio Alvear, Calle 4',
      category: 'Servicios',
      status: 'Resuelto',
      timestamp: '16:20 HS',
    },
    {
      id: 'INC-2026-0839',
      title: 'Corte preventivo de arbolado',
      location: 'Plaza Mitre',
      category: 'Espacios Verdes',
      status: 'Pendiente',
      timestamp: '15:10 HS',
    },
  ]);

  const [search, setSearch] = useState<string>('');
  const [filter, setFilter] = useState<string>('Todos');

  const filteredIncidents = useMemo<Incident[]>(() => {
    return incidents.filter((item) => {
      const searchLowerCase = search.toLowerCase();

      const matchesSearch =
        item.title.toLowerCase().includes(searchLowerCase) ||
        item.id.toLowerCase().includes(searchLowerCase) ||
        item.location.toLowerCase().includes(searchLowerCase);

      const matchesFilter =
        filter === 'Todos' || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [incidents, search, filter]);

  const addIncident = (data: NewIncident): void => {
    const newInc: Incident = {
      ...data,
      id: `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp:
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }) + ' HS',
      status: 'Pendiente',
    };

    setIncidents((prev) => [newInc, ...prev]);
  };

  return {
    incidents: filteredIncidents,
    search,
    setSearch,
    filter,
    setFilter,
    addIncident,
  };
}