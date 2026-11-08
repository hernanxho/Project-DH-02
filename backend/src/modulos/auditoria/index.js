// Auditoría: historial inmutable (RF-11, ADR-004). Solo se anexa; nunca UPDATE ni DELETE.
// Se llama DENTRO de la transacción del comando, con su misma conexión: si el comando falla, no queda rastro falso.
export async function registrarAuditoria(conn, { entidad, entidadId, accion, actor, estadoDesde = null, estadoHasta = null, detalle = null }) {
  await conn.query(
    `INSERT INTO auditoria (entidad, entidad_id, accion, actor_subject, estado_desde, estado_hasta, detalle)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entidad, entidadId, accion, actor, estadoDesde, estadoHasta, detalle ? JSON.stringify(detalle) : null],
  );
}
// TODO (RF-11): consulta del historial de una solicitud u orden.
