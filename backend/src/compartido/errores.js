// Errores de aplicación con código HTTP. El manejador global de app.js los traduce a JSON.
export class ErrorApp extends Error {
  constructor(estado, codigo, mensaje) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}
export const noAutenticado = () => new ErrorApp(401, "NO_AUTENTICADO", "Identidad no reconocida");
export const prohibido = (m = "Acción no autorizada") => new ErrorApp(403, "PROHIBIDO", m);
export const noEncontrado = (m = "Recurso no encontrado") => new ErrorApp(404, "NO_ENCONTRADO", m);
export const conflictoVersion = () =>
  new ErrorApp(409, "CONFLICTO_VERSION", "El recurso cambió: recarga y reintenta");
export const transicionInvalida = (d, h) =>
  new ErrorApp(422, "TRANSICION_INVALIDA", `Transición no permitida: ${d} → ${h}`);
export const noImplementado = (que) =>
  new ErrorApp(501, "NO_IMPLEMENTADO", `Pendiente de implementar: ${que}`);
