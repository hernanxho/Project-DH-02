// Cliente de la API. Toda llamada lleva la identidad simulada (x-subject).
let subject = localStorage.getItem("subject") ?? "";

export const fijarSubject = (s) => {
  subject = s;
  localStorage.setItem("subject", s);
};

async function obtenerClave(metodo, ruta, cuerpo) {
  const contenido = `${subject}:${metodo}:${ruta}:${JSON.stringify(cuerpo ?? null)}`;
  const huella = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contenido));
  const huellaHex = [...new Uint8Array(huella)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const claveAlmacenada = `idempotencia:${huellaHex}`;
  const clave = sessionStorage.getItem(claveAlmacenada) ?? crypto.randomUUID();
  sessionStorage.setItem(claveAlmacenada, clave);
  return { clave, claveAlmacenada };
}

export async function api(ruta, { metodo = "GET", cuerpo, claveIdempotencia } = {}) {
  const headers = { "Content-Type": "application/json", "x-subject": subject };
  const comando = metodo === "GET" ? null : await obtenerClave(metodo, ruta, cuerpo);
  if (comando) headers["Idempotency-Key"] = claveIdempotencia ?? comando.clave;
  const resp = await fetch(`/api${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(datos.mensaje ?? "Error"), { codigo: datos.codigo, estado: resp.status });
  if (comando) sessionStorage.removeItem(comando.claveAlmacenada);
  return datos;
}
