import { ErrorApp } from "../../compartido/errores.js";
import { pool } from "../../compartido/db.js";
import { buscarPersona } from "../../adaptadores/identidad.js";
import { obtenerRegla } from "../reglas-politicas/index.js";

export async function obtenerTablero() {
  const regla = await obtenerRegla("alerta_sin_atencion_horas");
  const horas = Number(regla?.valor?.horas);
  if (!Number.isFinite(horas) || horas <= 0) {
    throw new ErrorApp(503, "POLITICA_ALERTA_INVALIDA", "Falta configurar el umbral de alerta por falta de atención");
  }
  const [atrasadas] = await pool.query(
    `SELECT o.id, o.ubicacion_codigo AS ubicacionCodigo, o.prioridad, o.estado,
            o.responsable_subject AS responsableSubject, o.version,
            TIMESTAMPDIFF(MINUTE,
              COALESCE((SELECT MAX(a.ocurrida_en) FROM auditoria a WHERE a.entidad = 'orden' AND a.entidad_id = o.id), o.creada_en),
              UTC_TIMESTAMP(3)) AS minutosSinAtencion
       FROM orden_trabajo o
      WHERE o.estado <> 'CERRADA'
        AND TIMESTAMPDIFF(MINUTE,
              COALESCE((SELECT MAX(a.ocurrida_en) FROM auditoria a WHERE a.entidad = 'orden' AND a.entidad_id = o.id), o.creada_en),
              UTC_TIMESTAMP(3)) >= ?
      ORDER BY o.prioridad = 'Crítica' DESC, minutosSinAtencion DESC`,
    [Math.floor(horas * 60)],
  );
  const [bloqueos] = await pool.query(
    `SELECT b.id, b.orden_id AS ordenId, b.causal, b.subcausa, b.parte_responsable AS parteResponsable,
            b.siguiente_accion AS siguienteAccion, b.seguimiento_en AS seguimientoEn,
            o.ubicacion_codigo AS ubicacionCodigo, o.responsable_subject AS responsableSubject
       FROM bloqueo b JOIN orden_trabajo o ON o.id = b.orden_id
      WHERE b.resuelto_en IS NULL
      ORDER BY b.seguimiento_en IS NULL, b.seguimiento_en`,
  );
  const [cargas] = await pool.query(
    `SELECT p.subject, p.unidad, COUNT(o.id) AS ordenesActivas
       FROM perfil_tecnico p
       LEFT JOIN orden_trabajo o ON o.responsable_subject = p.subject AND o.estado <> 'CERRADA'
      GROUP BY p.subject, p.unidad
      ORDER BY ordenesActivas DESC, p.subject`,
  );
  const cargaTecnicos = await Promise.all(cargas.map(async (fila) => {
    const persona = await buscarPersona(fila.subject);
    return { subject: fila.subject, nombre: persona?.nombre ?? fila.subject, unidad: fila.unidad, ordenesActivas: Number(fila.ordenesActivas) };
  }));
  const [ubicaciones] = await pool.query(
    `SELECT o.ubicacion_codigo AS codigo,
            COUNT(*) AS ordenesActivas,
            SUM(o.prioridad = 'Crítica') AS ordenesCriticas,
            MAX(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.ubicacion_snapshot, '$.restringida')) = 'true', FALSE)) AS restringida
       FROM orden_trabajo o JOIN solicitud s ON s.id = o.solicitud_id
      WHERE o.estado <> 'CERRADA'
      GROUP BY o.ubicacion_codigo
      HAVING SUM(o.prioridad = 'Crítica') > 0 OR MAX(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.ubicacion_snapshot, '$.restringida')) = 'true', FALSE)) = 1
      ORDER BY ordenesCriticas DESC, ordenesActivas DESC`,
  );
  return {
    umbralSinAtencionHoras: horas,
    versionPoliticaAlerta: regla.version,
    atrasadas,
    bloqueos,
    cargaTecnicos,
    ubicacionesCriticas: ubicaciones.map((u) => ({ ...u, ordenesActivas: Number(u.ordenesActivas), ordenesCriticas: Number(u.ordenesCriticas) })),
  };
}
