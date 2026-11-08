// Servicio de notificación SIMULADO. Puede fallar a propósito para probar QS-07.
export const simulacion = { caido: false };
const entregadasEnEstaSesion = new Set();

export async function enviar(destinatarioSubject, plantilla, carga) {
  if (simulacion.caido) throw new Error("Servicio de notificación no disponible");
  if (carga?.notificacionId && entregadasEnEstaSesion.has(carga.notificacionId)) return;
  console.log(`[notificación simulada] → ${destinatarioSubject}: ${plantilla}`, carga ?? "");
  if (carga?.notificacionId) entregadasEnEstaSesion.add(carga.notificacionId);
}
