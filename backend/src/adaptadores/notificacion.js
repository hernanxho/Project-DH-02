// Servicio de notificación SIMULADO. Puede fallar a propósito para probar QS-07.
export const simulacion = { caido: false };

export async function enviar(destinatarioSubject, plantilla, carga) {
  if (simulacion.caido) throw new Error("Servicio de notificación no disponible");
  console.log(`[notificación simulada] → ${destinatarioSubject}: ${plantilla}`, carga ?? "");
}
