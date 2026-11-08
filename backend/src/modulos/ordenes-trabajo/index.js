// Interfaz pública del módulo Órdenes de Trabajo. Otros módulos importan SOLO este archivo.
// Única fuente de verdad del estado de la orden (5.5): Ejecución y Evidencia solicita transiciones aquí.
export { router } from "./rutas.js";
export { ESTADOS, TRANSICIONES, transicionPermitida } from "./transiciones.js";
// TODO: export { solicitarTransicion } — comando atómico: estado + auditoría + notificación (6.11).
