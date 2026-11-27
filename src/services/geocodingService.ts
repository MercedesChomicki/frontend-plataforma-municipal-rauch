const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export interface GeocodedLocation {
  direccion: string;
  latitud: number;
  longitud: number;
  verificacion: "verificada" | "aproximada";
  aproximada: boolean;
  calle: string | null;
  altura: string | null;
  barrio: string | null;
  localidad: string | null;
  nombre: string | null;
}

export interface ReverseGeocodingResult {
  encontrada: boolean;
  ubicacion: GeocodedLocation | null;
}

export class GeocodingError extends Error {
  readonly status: number;

  constructor(status: number) {
    const messages: Record<number, string> = {
      401: "Tu sesión venció. Volvé a ingresar.",
      403: "No tenés permiso para buscar ubicaciones.",
      422: "Revisá los datos ingresados para buscar la ubicación.",
      502: "La búsqueda de ubicaciones no está disponible. Podés completar los datos manualmente.",
      503: "La búsqueda de ubicaciones no está disponible. Podés completar los datos manualmente.",
    };

    super(
      messages[status] ??
        "No pudimos buscar la ubicación. Podés completarla manualmente.",
    );

    this.name = "GeocodingError";
    this.status = status;
  }
}

export async function searchAddress(
  token: string,
  address: string,
  signal: AbortSignal,
): Promise<GeocodedLocation[]> {
  const params = new URLSearchParams({
    q: address.trim(),
  });

  const response = await fetch(`${API_URL}/geocodificacion/buscar?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new GeocodingError(response.status);
  }

  return response.json();
}

export async function reverseGeocode(
  token: string,
  latitude: number,
  longitude: number,
  signal: AbortSignal,
): Promise<ReverseGeocodingResult> {
  const params = new URLSearchParams({
    latitud: String(latitude),
    longitud: String(longitude),
  });

  const response = await fetch(`${API_URL}/geocodificacion/inversa?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new GeocodingError(response.status);
  }

  return response.json();
}
