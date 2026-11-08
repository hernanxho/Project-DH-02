import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ErrorApp, noEncontrado, prohibido } from "../../compartido/errores.js";
import { registrarAuditoria } from "../auditoria/index.js";
import { solicitarTransicion } from "../ordenes-trabajo/index.js";
import { vincularAdjuntos } from "../archivos-adjuntos/index.js";

function parsear(esquema, datos) {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new ErrorApp(400, "VALIDACION", resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return resultado.data;
}

async function exigirResponsable(conn, ordenId, actor) {
  const [filas] = await conn.query("SELECT responsable_subject FROM orden_trabajo WHERE id = ?", [ordenId]);
  if (!filas[0]) throw noEncontrado("Orden no encontrada");
  if (filas[0].responsable_subject !== actor.subject) throw prohibido("Solo el responsable puede registrar evidencia de ejecución");
}

const entradaEvidencia = z.object({
  tipo: z.string().trim().min(1).max(32).default("observacion"),
  resumen: z.string().trim().min(1).max(4000),
  adjuntoIds: z.array(z.string().uuid()).max(5).optional().default([]),
  hacia: z.string().trim().min(1).max(32).optional(),
  versionVista: z.number().int().positive().optional(),
  motivo: z.string().trim().min(1).max(2000).optional(),
});

export async function registrarEvidencia(conn, ordenId, datos, actor) {
  const entrada = parsear(entradaEvidencia, datos);
  await exigirResponsable(conn, ordenId, actor);
  const evidenciaId = randomUUID();
  await conn.query(
    `INSERT INTO evidencia (id, orden_id, autor_subject, tipo, visibilidad, resumen)
     VALUES (?, ?, ?, ?, 'interna', ?)`,
    [evidenciaId, ordenId, actor.subject, entrada.tipo, entrada.resumen],
  );
  await vincularAdjuntos(conn, entrada.adjuntoIds, { entidad: "evidencia", entidadId: evidenciaId }, actor);
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: ordenId, accion: "EVIDENCIA_REGISTRADA",
    actor: actor.subject, detalle: { evidenciaId, tipo: entrada.tipo, adjuntoIds: entrada.adjuntoIds },
  });
  let transicion = null;
  if (entrada.hacia) {
    if (!entrada.versionVista) throw new ErrorApp(400, "VERSION_REQUERIDA", "Incluye la versión de la orden para cambiar su estado");
    transicion = await solicitarTransicion(conn, {
      ordenId, hacia: entrada.hacia, versionVista: entrada.versionVista,
      evidenciaId, motivo: entrada.motivo,
    }, actor);
  }
  return { evidenciaId, ordenId, transicion };
}

const entradaBloqueo = z.object({
  causal: z.enum(["MATERIALES", "ACCESO"]),
  subcausa: z.string().trim().max(64).optional(),
  parteResponsable: z.string().trim().min(1).max(64),
  siguienteAccion: z.string().trim().min(1).max(2000),
  seguimientoEn: z.string().datetime({ offset: true }).refine((fecha) => Date.parse(fecha) > Date.now(), "Debe ser una fecha futura"),
  resumen: z.string().trim().min(1).max(4000),
  adjuntoIds: z.array(z.string().uuid()).max(5).optional().default([]),
  versionVista: z.number().int().positive(),
});

const entradaMaterial = z.object({
  codigo: z.string().trim().max(64).optional(),
  descripcion: z.string().trim().min(1).max(255),
  cantidad: z.number().positive().max(99999999),
  unidad: z.string().trim().min(1).max(16),
  costoUnitarioEstimado: z.number().nonnegative().max(9999999999).optional(),
  requiereCompra: z.boolean().default(false),
});

export async function registrarMaterial(conn, ordenId, datos, actor) {
  const entrada = parsear(entradaMaterial, datos);
  const [ordenes] = await conn.query(
    "SELECT responsable_subject, estado FROM orden_trabajo WHERE id = ? FOR UPDATE",
    [ordenId],
  );
  if (!ordenes[0]) throw noEncontrado("Orden no encontrada");
  if (ordenes[0].responsable_subject !== actor.subject) throw prohibido("Solo el responsable puede registrar materiales de ejecución");
  if (!["EN_PROGRESO", "BLOQUEADA_MATERIALES"].includes(ordenes[0].estado)) {
    throw new ErrorApp(409, "ORDEN_NO_ACTIVA", "Los materiales solo se registran durante la ejecución o un bloqueo por materiales");
  }
  const materialId = randomUUID();
  await conn.query(
    `INSERT INTO material_usado
      (id, orden_id, codigo, descripcion, cantidad, unidad, costo_unitario_estimado, requiere_compra)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [materialId, ordenId, entrada.codigo || null, entrada.descripcion, entrada.cantidad,
      entrada.unidad, entrada.costoUnitarioEstimado ?? null, entrada.requiereCompra],
  );
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: ordenId, accion: "MATERIAL_REGISTRADO", actor: actor.subject,
    detalle: { materialId, descripcion: entrada.descripcion, cantidad: entrada.cantidad,
      unidad: entrada.unidad, requiereCompra: entrada.requiereCompra },
  });
  return { materialId, ordenId };
}

export async function registrarBloqueo(conn, ordenId, datos, actor) {
  const entrada = parsear(entradaBloqueo, datos);
  await exigirResponsable(conn, ordenId, actor);
  const evidenciaId = randomUUID();
  const bloqueoId = randomUUID();
  await conn.query(
    `INSERT INTO evidencia (id, orden_id, autor_subject, tipo, visibilidad, resumen)
     VALUES (?, ?, ?, 'bloqueo', 'interna', ?)`,
    [evidenciaId, ordenId, actor.subject, entrada.resumen],
  );
  await vincularAdjuntos(conn, entrada.adjuntoIds, { entidad: "evidencia", entidadId: evidenciaId }, actor);
  await conn.query(
    `INSERT INTO bloqueo
      (id, orden_id, causal, subcausa, parte_responsable, siguiente_accion, seguimiento_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [bloqueoId, ordenId, entrada.causal, entrada.subcausa ?? null,
      entrada.parteResponsable ?? null, entrada.siguienteAccion, new Date(entrada.seguimientoEn)],
  );
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: ordenId, accion: "BLOQUEO_REGISTRADO",
    actor: actor.subject,
    detalle: {
      bloqueoId, evidenciaId, causal: entrada.causal,
      subcausa: entrada.subcausa ?? null,
      parteResponsable: entrada.parteResponsable ?? null,
      seguimientoEn: entrada.seguimientoEn,
      adjuntoIds: entrada.adjuntoIds,
    },
  });
  const hacia = entrada.causal === "MATERIALES" ? "BLOQUEADA_MATERIALES" : "BLOQUEADA_ACCESO";
  const transicion = await solicitarTransicion(conn, {
    ordenId, hacia, versionVista: entrada.versionVista, evidenciaId,
    motivo: entrada.siguienteAccion,
  }, actor);
  return { bloqueoId, evidenciaId, ordenId, estado: transicion.estado, version: transicion.version };
}
