const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export interface AreaNumbering {
  area: string;
  inicializada: boolean;
  siguiente_numero: number | null;
  ultimo_informado: number | null;
  ultimo_numero: number | null;
  configurado_por: {
    usuario_id: number | null;
    nombre: string | null;
    apellido: string | null;
  } | null;
  fecha_configuracion: string | null;
}
export class NumberingError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "NumberingError";
    this.status = status;
  }
}
async function errorFor(response: Response): Promise<NumberingError> {
  const messages: Record<number, string> = {
    400: "El último número no puede ser menor que los eventos ya existentes en esta área. Revisá el valor en el registro.",
    401: "Tu sesión venció. Volvé a ingresar.",
    403: "No tenés permiso para consultar o configurar la numeración de esta área.",
    404: "No se encontró la configuración de esta área.",
    409: "La numeración ya fue configurada. Consultá su estado actualizado.",
    422: "Ingresá un número entero mayor o igual a cero.",
  };
  return new NumberingError(
    messages[response.status] ??
      "No pudimos completar la operación. Consultá el estado antes de volver a intentarlo.",
    response.status,
  );
}
export async function getAreaNumbering(
  token: string,
  signal?: AbortSignal,
): Promise<AreaNumbering> {
  const response = await fetch(`${API_URL}/numeracion/videoseguridad`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) throw await errorFor(response);
  return response.json();
}
export async function initializeAreaNumbering(
  token: string,
  lastNumber: number,
): Promise<AreaNumbering> {
  if (
    !Number.isSafeInteger(lastNumber) ||
    lastNumber < 0 ||
    lastNumber > 2147483646
  ) {
    throw new NumberingError("Ingresá un entero entre 0 y 2147483646.", 422);
  }
  const response = await fetch(
    `${API_URL}/numeracion/videoseguridad/inicializar`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ultimo_numero: lastNumber }),
    },
  );
  if (!response.ok) throw await errorFor(response);
  return response.json();
}
