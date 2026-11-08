import { pool } from "../../compartido/db.js";
import { noEncontrado, prohibido } from "../../compartido/errores.js";
import { puedeAccederAOrden, puedeAccederASolicitud } from "../identidad-acceso/index.js";

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
  let consulta;
  let parametros;
  if (entidad === "solicitud") {
    const [recursos] = await pool.query(
      `SELECT registrada_por AS registradaPor, afectado_subject AS afectadoSubject,
              ubicacion_snapshot AS ubicacionSnapshot
         FROM solicitud WHERE id = ?`,
      [entidadId],
    );
    const solicitud = recursos[0];
    if (!solicitud) throw noEncontrado("Solicitud no encontrada");
    if (!puedeAccederASolicitud(usuario, solicitud)) throw prohibido("No tienes permiso para consultar el historial de esta solicitud");
    consulta = "SELECT id, accion, actor_subject AS actor, estado_desde AS estadoDesde, estado_hasta AS estadoHasta, detalle, ocurrida_en AS ocurridaEn FROM auditoria WHERE entidad = 'solicitud' AND entidad_id = ? ORDER BY ocurrida_en, id";
    parametros = [entidadId];
  } else if (entidad === "orden") {
    const [recursos] = await pool.query(
      `SELECT o.responsable_subject AS responsableSubject, s.afectado_subject AS afectadoSubject,
              s.ubicacion_snapshot AS ubicacionSnapshot
         FROM orden_trabajo o JOIN solicitud s ON s.id = o.solicitud_id
        WHERE o.id = ?`,
      [entidadId],
    );
    const orden = recursos[0];
    if (!orden) throw noEncontrado("Orden no encontrada");
    if (!puedeAccederAOrden(usuario, orden)) throw prohibido("No tienes permiso para consultar el historial de esta orden");
    consulta = "SELECT id, accion, actor_subject AS actor, estado_desde AS estadoDesde, estado_hasta AS estadoHasta, detalle, ocurrida_en AS ocurridaEn FROM auditoria WHERE entidad = 'orden' AND entidad_id = ? ORDER BY ocurrida_en, id";
    parametros = [entidadId];
  } else {
    throw noEncontrado("Tipo de historial desconocido");
  }
  const [filas] = await pool.query(consulta, parametros);
  return filas;
}
