// Planificador interno (sección 5.9): reloj + procesadores de plazos y entregas.
// Debe ser idempotente: procesar dos veces el mismo plazo no puede duplicar efectos (QS-02, ASM-028).
// TODO (persona 3): procesarPlazosVencidos() -> cierre automático y recordatorios.
// TODO (persona 3): procesarEntregasPendientes() -> reintentar entregas fallidas.
let temporizador = null;

export function iniciarPlanificador({ intervaloMs = 30_000 } = {}) {
  if (temporizador) return;
  temporizador = setInterval(async () => {
    try {
      // await procesarPlazosVencidos();
      // await procesarEntregasPendientes();
    } catch (err) {
      console.error("[planificador] error:", err);
    }
  }, intervaloMs);
  console.log(`[planificador] iniciado (cada ${intervaloMs / 1000}s)`);
}

export function detenerPlanificador() {
  clearInterval(temporizador);
  temporizador = null;
}
