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

export interface CreateOperatorInput {
  username: string;
  email?: string;
  nombre: string;
  apellido: string;
  password: string;
}

interface UserRole {
  id: number;
  nombre: string;
}

export async function getOperatorRoleId(
  token: string,
  signal: AbortSignal,
): Promise<number> {
  const response = await fetch(`${API_URL}/usuarios/roles`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) throw new UsersError(response.status);

  const roles: UserRole[] = await response.json();
  const operator = roles.find(role => role.nombre === "operador");

  if (!operator) {
    throw new Error(
      "No está disponible el rol Operador. Contactá al administrador.",
    );
  }

  return operator.id;
}

export async function createOperator(
  token: string,
  roleId: number,
  input: CreateOperatorInput,
): Promise<ManagedUser> {
  const response = await fetch(`${API_URL}/usuarios/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: input.username.trim(),
      email: input.email?.trim() || undefined,
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim(),
      password: input.password,
      rol_ids: [roleId],
      area: "videoseguridad",
    }),
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error(
        "No se pudo crear la cuenta. Comprobá si el usuario o el correo ya están registrados.",
      );
    }

    throw new UsersError(response.status);
  }

  return response.json();
}