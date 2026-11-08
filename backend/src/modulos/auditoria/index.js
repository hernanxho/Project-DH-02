import { pool } from "../../compartido/db.js";
import { noEncontrado, prohibido } from "../../compartido/errores.js";

// Auditoría: historial inmutable (RF-11, ADR-004). Solo se anexa; nunca UPDATE ni DELETE.
// Se llama DENTRO de la transacción del comando, con su misma conexión: si el comando falla, no queda rastro falso.
export async function registrarAuditoria(conn, { entidad, entidadId, accion, actor, estadoDesde = null, estadoHasta = null, detalle = null }) {
  await conn.query(
    `INSERT INTO auditoria (entidad, entidad_id, accion, actor_subject, estado_desde, estado_hasta, detalle)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entidad, entidadId, accion, actor, estadoDesde, estadoHasta, detalle ? JSON.stringify(detalle) : null],
  );
}

export async function consultarAuditoria(entidad, entidadId, usuario) {
  const roles = usuario.roles.map((r) => r.rol);
  let consulta;
  let parametros;
  if (entidad === "solicitud") {
    const [recursos] = await pool.query(
      "SELECT registrada_por, afectado_subject FROM solicitud WHERE id = ?",
      [entidadId],
    );
    const solicitud = recursos[0];
    if (!solicitud) throw noEncontrado("Solicitud no encontrada");
    const puedeVer = roles.includes("coordinador") || roles.includes("supervisor") ||
      solicitud.registrada_por === usuario.subject || solicitud.afectado_subject === usuario.subject;
    if (!puedeVer) throw prohibido("No tienes permiso para consultar el historial de esta solicitud");
    consulta = "SELECT id, accion, actor_subject AS actor, estado_desde AS estadoDesde, estado_hasta AS estadoHasta, detalle, ocurrida_en AS ocurridaEn FROM auditoria WHERE entidad = 'solicitud' AND entidad_id = ? ORDER BY ocurrida_en, id";
    parametros = [entidadId];
  } else if (entidad === "orden") {
    const [recursos] = await pool.query(
      `SELECT o.responsable_subject, s.registrada_por, s.afectado_subject
         FROM orden_trabajo o JOIN solicitud s ON s.id = o.solicitud_id
        WHERE o.id = ?`,
      [entidadId],
    );
    const orden = recursos[0];
    if (!orden) throw noEncontrado("Orden no encontrada");
    const puedeVer = roles.includes("coordinador") || roles.includes("supervisor") ||
      orden.responsable_subject === usuario.subject ||
      orden.registrada_por === usuario.subject || orden.afectado_subject === usuario.subject;
    if (!puedeVer) throw prohibido("No tienes permiso para consultar el historial de esta orden");
    consulta = "SELECT id, accion, actor_subject AS actor, estado_desde AS estadoDesde, estado_hasta AS estadoHasta, detalle, ocurrida_en AS ocurridaEn FROM auditoria WHERE entidad = 'orden' AND entidad_id = ? ORDER BY ocurrida_en, id";
    parametros = [entidadId];
  } else {
    throw noEncontrado("Tipo de historial desconocido");
  }
  const [filas] = await pool.query(consulta, parametros);
  return filas;
}
