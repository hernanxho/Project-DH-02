export { router } from "./rutas.js";
import { randomUUID } from "node:crypto";
import { ErrorApp } from "../../compartido/errores.js";
import { obtenerReglaConConexion } from "../reglas-politicas/index.js";

// Encola dentro de la transacción de negocio. La entrega se procesa después.
export async function encolarNotificacion(conn, { destinatario, plantilla, carga }) {
  const id = randomUUID();
  await conn.query(
    `INSERT INTO entrega_notificacion
      (id, destinatario_subject, plantilla, carga, estado, intentos)
     VALUES (?, ?, ?, ?, 'PENDIENTE', 0)`,
    [id, destinatario, plantilla, JSON.stringify(carga ?? {})],
  );
  return { notificacionId: id };
}

export async function programarPlazos(conn, ordenId) {
  const plazoCierre = await obtenerReglaConConexion(conn, "plazo_cierre_horas");
  const recordatorios = await obtenerReglaConConexion(conn, "recordatorios_horas");
  const cierreHoras = Number(plazoCierre?.valor?.horas);
  const horasRecordatorio = Array.isArray(recordatorios?.valor) ? recordatorios.valor.map(Number) : [];
  if (!Number.isFinite(cierreHoras) || cierreHoras <= 0 || horasRecordatorio.some((h) => !Number.isFinite(h) || h <= 0 || h >= cierreHoras)) {
    throw new ErrorApp(503, "POLITICA_PLAZOS_INVALIDA", "La política de plazos de cierre no está configurada correctamente");
  }
  const [filas] = await conn.query("SELECT resuelta_en FROM orden_trabajo WHERE id = ?", [ordenId]);
  if (!filas[0]?.resuelta_en) throw new ErrorApp(409, "ORDEN_NO_RESUELTA", "No se pueden programar plazos para una orden no resuelta");
  const origen = new Date(filas[0].resuelta_en);
  for (const horas of [...horasRecordatorio, cierreHoras]) {
    const id = randomUUID();
    const vence = new Date(origen.getTime() + horas * 60 * 60 * 1000);
    const tipo = horas === cierreHoras ? "CIERRE_AUTOMATICO" : "RECORDATORIO";
    const [existentes] = await conn.query(
      "SELECT id FROM plazo WHERE orden_id = ? AND tipo = ? AND vence_en = ? LIMIT 1",
      [ordenId, tipo, vence],
    );
    if (!existentes[0]) {
      await conn.query(
        "INSERT INTO plazo (id, orden_id, tipo, vence_en, estado) VALUES (?, ?, ?, ?, 'PENDIENTE')",
        [id, ordenId, tipo, vence],
      );
    }
  }
  return { versionCierre: plazoCierre.version, versionRecordatorios: recordatorios.version };
}

export async function cancelarPlazos(conn, ordenId) {
  await conn.query(
    "UPDATE plazo SET estado = 'CANCELADO' WHERE orden_id = ? AND estado = 'PENDIENTE'",
    [ordenId],
  );
}
