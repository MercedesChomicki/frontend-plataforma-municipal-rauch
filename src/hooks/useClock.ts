import { useEffect, useState } from 'react';

interface DateTime {
  timeStr: string;
  dateStr: string;
}

/**
 * Hook para la gestión del reloj en tiempo real
 * y formateo de fecha oficial.
 */
export default function useClock(): DateTime {
  const [dateTime, setDateTime] = useState<DateTime>({
    timeStr: '',
    dateStr: '',
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();

      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');

      const ampm = hours >= 12 ? 'P.M.' : 'A.M.';

      hours = hours % 12 || 12;

      const formattedHours = hours
        .toString()
        .padStart(2, '0');

      const days = [
        'Domingo',
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
      ];

      const months = [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre',
      ];

      setDateTime({
        timeStr: `${formattedHours}:${minutes} ${ampm} HS`,
        dateStr: `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`,
      });
    };

    update();

    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, []);

  return dateTime;
}