const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export interface ManagedUser {
  id: number;
  username: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  area: string | null;
  activo: boolean;
  fecha_creacion: string;
  roles: {
    id: number;
    nombre: string;
  }[];
}

export class UsersError extends Error {
  readonly status: number;

  constructor(status: number) {
    const messages: Record<number, string> = {
      401: "Tu sesión venció. Volvé a ingresar.",
      403: "No tenés permiso para realizar esta operación.",
      404: "La cuenta ya no está disponible.",
      409: "No se pudo cambiar el estado de esta cuenta.",
      422: "El sistema rechazó los datos enviados.",
    };

    super(
      messages[status] ??
        "No pudimos completar la operación. Intentá nuevamente.",
    );

    this.name = "UsersError";
    this.status = status;
  }
}

export async function getUsers(
  token: string,
  signal: AbortSignal,
): Promise<ManagedUser[]> {
  const response = await fetch(`${API_URL}/usuarios/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) throw new UsersError(response.status);

  return response.json();
}

export async function setUserActive(
  token: string,
  userId: number,
  activo: boolean,
): Promise<ManagedUser> {
  const response = await fetch(
    `${API_URL}/usuarios/${userId}/activo`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ activo }),
    },
  );

  if (!response.ok) throw new UsersError(response.status);

  return response.json();
}