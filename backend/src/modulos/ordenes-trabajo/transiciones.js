// Tabla de transiciones de la orden (sección 6.9, E2-ADR-002).
// Cada fila es una prueba de transición VÁLIDA; toda combinación no listada es una prueba de transición PROHIBIDA.
// Este archivo es dominio puro: no importa base de datos ni adaptadores (Figura F06).

export const ESTADOS = Object.freeze({
  ASIGNADA: "ASIGNADA",
  EN_PROGRESO: "EN_PROGRESO",
  BLOQUEADA_MATERIALES: "BLOQUEADA_MATERIALES",
  BLOQUEADA_ACCESO: "BLOQUEADA_ACCESO",
  RESUELTA: "RESUELTA",
  CERRADA: "CERRADA",
});

// actores: 'responsable' | 'coordinador' | 'supervisor' | 'afectado' | 'sistema'
// evidencia: 'si' | 'no' | 'opcional' (matriz de 2.5, ASM-010)
export const TRANSICIONES = [
  { desde: null,                 hasta: "ASIGNADA",             actores: ["coordinador", "supervisor"], evidencia: "no" },
  { desde: "ASIGNADA",           hasta: "EN_PROGRESO",          actores: ["responsable"], evidencia: "si" },
  { desde: "EN_PROGRESO",        hasta: "BLOQUEADA_MATERIALES", actores: ["responsable"], evidencia: "si" },
  { desde: "EN_PROGRESO",        hasta: "BLOQUEADA_ACCESO",     actores: ["responsable"], evidencia: "si" },
  { desde: "BLOQUEADA_MATERIALES", hasta: "EN_PROGRESO",        actores: ["responsable"], evidencia: "opcional" },
  { desde: "BLOQUEADA_ACCESO",   hasta: "EN_PROGRESO",          actores: ["responsable"], evidencia: "opcional" },
  { desde: "EN_PROGRESO",        hasta: "RESUELTA",             actores: ["responsable"], evidencia: "si" },
  { desde: "RESUELTA",           hasta: "EN_PROGRESO",          actores: ["afectado"],    evidencia: "no" },
  { desde: "RESUELTA",           hasta: "CERRADA",              actores: ["afectado"],    evidencia: "no", tipoCierre: "CONFIRMADO" },
  { desde: "RESUELTA",           hasta: "CERRADA",              actores: ["sistema"],     evidencia: "no", tipoCierre: "AUTOMATICO" },
];

/** Devuelve la fila de la tabla que corresponde, o null si la transición está prohibida. */
export function buscarTransicion(desde, hasta, tipoCierre = undefined) {
  return (
    TRANSICIONES.find(
      (t) =>
        t.desde === desde &&
        t.hasta === hasta &&
        (t.tipoCierre === undefined || tipoCierre === undefined || t.tipoCierre === tipoCierre),
    ) ?? null
  );
}

export function transicionPermitida(desde, hasta, actor, tipoCierre = undefined) {
  const t = buscarTransicion(desde, hasta, tipoCierre);
  return t !== null && t.actores.includes(actor);
}
