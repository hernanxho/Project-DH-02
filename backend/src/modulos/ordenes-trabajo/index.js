// Interfaz pública del módulo Órdenes de Trabajo. Otros módulos importan SOLO este archivo.
// Única fuente de verdad del estado de la orden (5.5): Ejecución y Evidencia solicita transiciones aquí.
export { router } from "./rutas.js";
export { routerCierres } from "./cierres-rutas.js";
export { ESTADOS, TRANSICIONES, transicionPermitida } from "./transiciones.js";
export { corregirCategoriaOrden, crearOrden, listarBloqueosAcceso, listarOrdenesTecnico, listarResponsables, solicitarTransicion, listarPendientesCierre, confirmarCierre, rechazarCierre, reabrirOrden, cerrarAutomaticamente, transferirOrden } from "./servicio.js";
