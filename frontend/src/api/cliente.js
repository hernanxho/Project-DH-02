// Cliente de la API. Toda llamada lleva la identidad simulada (x-subject).
// TODO (persona 2): reenvío idempotente de comandos del técnico (QS-06): enviar una clave de idempotencia por comando.
let subject = localStorage.getItem("subject") ?? "";

export const fijarSubject = (s) => {
  subject = s;
  localStorage.setItem("subject", s);
};

export async function api(ruta, { metodo = "GET", cuerpo } = {}) {
  const resp = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", "x-subject": subject },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(datos.mensaje ?? "Error"), { codigo: datos.codigo, estado: resp.status });
  return datos;
}
