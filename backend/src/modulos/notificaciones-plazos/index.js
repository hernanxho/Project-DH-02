export { router } from "./rutas.js";
import { randomUUID } from "node:crypto";

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
