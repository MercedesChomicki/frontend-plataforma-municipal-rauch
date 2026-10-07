const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/+$/, '');

export interface Permission {
  id: number;
  code: string;
  description: string;
}

export interface Role {
  id: number;
  nombre: string;
  permissions: Permission[];
}

export interface ApiUser {
  id: number;
  username: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  roles: Role[];
  activo: boolean;
  fecha_creacion: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface AuthSession {
  accessToken: string;
  user: ApiUser;
}

export async function iniciarSesion(
  username: string,
  password: string,
): Promise<AuthSession> {
  const body = new URLSearchParams({
    username: username.trim(),
    password,
  });

  const tokenResponse = await fetch(`${API_URL}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!tokenResponse.ok) {
    if (
      tokenResponse.status === 400 ||
      tokenResponse.status === 401
    ) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    if (tokenResponse.status === 403) {
      throw new Error('Tu cuenta no tiene acceso al sistema.');
    }

    throw new Error(
      `No se pudo iniciar sesión. Código: ${tokenResponse.status}.`,
    );
  }

  const token: TokenResponse = await tokenResponse.json();

  if (!token.access_token) {
    throw new Error('El backend no devolvió un token de acceso.');
  }

  const userResponse = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error(
      'No se pudieron obtener los datos del usuario.',
    );
  }

  const user: ApiUser = await userResponse.json();

  if (!user.activo) {
    throw new Error('La cuenta está deshabilitada.');
  }

  return {
    accessToken: token.access_token,
    user,
  };
}