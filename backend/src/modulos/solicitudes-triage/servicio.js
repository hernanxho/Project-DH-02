import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../../compartido/db.js";
import { ErrorApp, conflictoVersion, noEncontrado, prohibido, transicionInvalida } from "../../compartido/errores.js";
import { buscarPersona } from "../../adaptadores/identidad.js";
import { buscarUbicacion } from "../../adaptadores/ubicaciones.js";
import { registrarAuditoria } from "../auditoria/index.js";
import { encolarNotificacion } from "../notificaciones-plazos/index.js";
import { obtenerRegla, obtenerReglaConConexion } from "../reglas-politicas/index.js";
import { vincularAdjuntos } from "../archivos-adjuntos/index.js";

const entradaSolicitud = z.object({
  ubicacionCodigo: z.string().trim().min(1).max(64),
  categoria: z.string().trim().min(1).max(64),
  descripcion: z.string().trim().min(1).max(4000),
  urgenciaSugerida: z.enum(["Crítica", "Alta", "Normal", "Baja"]),
  afectadoSubject: z.string().trim().min(1).max(64).optional(),
  adjuntoIds: z.array(z.string().uuid()).max(5).optional().default([]),
});

function parsear(esquema, datos) {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new ErrorApp(400, "VALIDACION", resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return resultado.data;
}

function validarEntrada(datos) {
  return parsear(entradaSolicitud, datos);
}

function esCoordinador(usuario) {
  return usuario.roles.some((r) => r.rol === "coordinador");
}

export async function crearSolicitud(conn, datos, usuario) {
  const entrada = validarEntrada(datos);
  const puedeRegistrarTercero = esCoordinador(usuario);
  if (entrada.afectadoSubject && entrada.afectadoSubject !== usuario.subject && !puedeRegistrarTercero) {
    throw prohibido("Solo coordinación puede registrar una solicitud a nombre de otra persona");
  }

  const afectadoSubject = entrada.afectadoSubject ?? usuario.subject;
  const afectado = await buscarPersona(afectadoSubject);
  if (!afectado) throw new ErrorApp(400, "AFECTADO_INVALIDO", "La persona afectada no existe en el directorio simulado");

  let ubicacion;
  let ubicacionVerificada = true;
  try {
    ubicacion = await buscarUbicacion(entrada.ubicacionCodigo);
  } catch {
    ubicacion = null;
    ubicacionVerificada = false;
  }
  if (ubicacionVerificada && (!ubicacion || !ubicacion.activa)) {
    throw new ErrorApp(400, "UBICACION_INVALIDA", "La ubicación no existe o está inactiva");
  }

  const id = `MR-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const snapshot = ubicacion ? JSON.stringify({ ...ubicacion, capturadaEn: new Date().toISOString() }) : null;

  await conn.query(
    `INSERT INTO solicitud
      (id, registrada_por, afectado_subject, canal_origen, ubicacion_codigo,
       ubicacion_snapshot, ubicacion_verificada, categoria_reportada,
       descripcion, urgencia_sugerida, estado, version)
     VALUES (?, ?, ?, 'web', ?, ?, ?, ?, ?, ?, 'EN_REVISION', 1)`,
    [id, usuario.subject, afectadoSubject, entrada.ubicacionCodigo, snapshot,
      ubicacionVerificada, entrada.categoria, entrada.descripcion, entrada.urgenciaSugerida],
  );
  await vincularAdjuntos(conn, entrada.adjuntoIds, { entidad: "solicitud", entidadId: id }, usuario);
  await registrarAuditoria(conn, {
    entidad: "solicitud", entidadId: id, accion: "SOLICITUD_REGISTRADA",
    actor: usuario.subject, estadoHasta: "EN_REVISION",
    detalle: { ubicacionCodigo: entrada.ubicacionCodigo, ubicacionVerificada, adjuntoIds: entrada.adjuntoIds },
  });
  await encolarNotificacion(conn, {
    destinatario: afectadoSubject,
    plantilla: "SOLICITUD_RECIBIDA",
    carga: { solicitudId: id, estado: "EN_REVISION" },
  });

  return { id, estado: "EN_REVISION", version: 1, ubicacionVerificada, adjuntoIds: entrada.adjuntoIds };
}

function alcanceSolicitudes(usuario) {
  const roles = usuario.roles.map((r) => r.rol);
  if (roles.includes("coordinador") || roles.includes("supervisor")) return { sql: "1 = 1", params: [] };
  if (roles.includes("solicitante")) return { sql: "s.afectado_subject = ?", params: [usuario.subject] };
  throw prohibido("No tienes permiso para consultar solicitudes");
}

export async function listarSolicitudes(usuario) {
  const alcance = alcanceSolicitudes(usuario);
  const [filas] = await pool.query(
    `SELECT s.id, s.ubicacion_codigo AS ubicacionCodigo,
            s.ubicacion_verificada AS ubicacionVerificada, s.categoria_reportada AS categoria,
            s.descripcion, s.urgencia_sugerida AS urgenciaSugerida,
            s.urgencia_validada AS urgenciaValidada, s.estado, s.version,
            s.creada_en AS creadaEn, o.id AS ordenId, o.estado AS estadoOrden,
            o.tipo_cierre AS tipoCierre, o.version AS versionOrden,
            o.cerrada_en AS cerradaEn
       FROM solicitud s
       LEFT JOIN orden_trabajo o ON o.solicitud_id = s.id
      WHERE ${alcance.sql}
      ORDER BY s.creada_en DESC`,
    alcance.params,
  );
  return filas;
}

export async function obtenerSolicitud(id, usuario) {
  const alcance = alcanceSolicitudes(usuario);
  const [filas] = await pool.query(
    `SELECT s.id, s.registrada_por AS registradaPor, s.afectado_subject AS afectadoSubject,
            s.ubicacion_codigo AS ubicacionCodigo, s.categoria_reportada AS categoria,
            s.descripcion, s.urgencia_sugerida AS urgenciaSugerida,
            s.urgencia_validada AS urgenciaValidada, s.estado, s.version,
            s.creada_en AS creadaEn, o.id AS ordenId, o.estado AS estadoOrden,
            o.tipo_cierre AS tipoCierre
       FROM solicitud s
       LEFT JOIN orden_trabajo o ON o.solicitud_id = s.id
      WHERE s.id = ? AND ${alcance.sql}
      LIMIT 1`,
    [id, ...alcance.params],
  );
  if (!filas[0]) throw noEncontrado("Solicitud no encontrada");
  return filas[0];
}

const entradaValidacion = z.object({
  urgenciaValidada: z.string().trim().min(1).max(16),
  versionVista: z.number().int().positive(),
});

export async function validarSolicitud(conn, id, datos, usuario) {
  const entrada = parsear(entradaValidacion, datos);
  const [filas] = await conn.query(
    "SELECT afectado_subject, estado, version, ubicacion_verificada FROM solicitud WHERE id = ? FOR UPDATE",
    [id],
  );
  const solicitud = filas[0];
  if (!solicitud) throw noEncontrado("Solicitud no encontrada");
  if (solicitud.version !== entrada.versionVista) throw conflictoVersion();
  if (solicitud.estado !== "EN_REVISION") throw transicionInvalida(solicitud.estado, "VALIDADA");
  if (!solicitud.ubicacion_verificada) {
    throw new ErrorApp(422, "UBICACION_NO_VERIFICADA", "No se puede validar hasta verificar la ubicación");
  }

  const regla = await obtenerReglaConConexion(conn, "niveles_urgencia");
  if (!regla) throw new ErrorApp(503, "POLITICA_NO_CONFIGURADA", "Falta configurar la política de niveles de urgencia");
  const niveles = Array.isArray(regla.valor) ? regla.valor : [];
  if (!niveles.includes(entrada.urgenciaValidada)) {
    throw new ErrorApp(400, "URGENCIA_INVALIDA", "La urgencia no está permitida por la política vigente");
  }

  const [actualizacion] = await conn.query(
    `UPDATE solicitud
        SET estado = 'VALIDADA', urgencia_validada = ?, version = version + 1
      WHERE id = ? AND estado = 'EN_REVISION' AND version = ?`,
    [entrada.urgenciaValidada, id, entrada.versionVista],
  );
  if (actualizacion.affectedRows !== 1) throw conflictoVersion();

  await registrarAuditoria(conn, {
    entidad: "solicitud", entidadId: id, accion: "SOLICITUD_VALIDADA",
    actor: usuario.subject, estadoDesde: "EN_REVISION", estadoHasta: "VALIDADA",
    detalle: { urgenciaValidada: entrada.urgenciaValidada, versionPolitica: regla.version },
  });
  await encolarNotificacion(conn, {
    destinatario: solicitud.afectado_subject, plantilla: "SOLICITUD_VALIDADA",
    carga: { solicitudId: id, estado: "VALIDADA", urgencia: entrada.urgenciaValidada },
  });
  return { id, estado: "VALIDADA", urgenciaValidada: entrada.urgenciaValidada, version: entrada.versionVista + 1, versionPolitica: regla.version };
}

const entradaRechazo = z.object({
  motivo: z.enum(["FUERA_DE_ALCANCE", "INFORMACION_INCOMPLETA"]),
  versionVista: z.number().int().positive(),
});

export async function rechazarSolicitud(conn, id, datos, usuario) {
  const entrada = parsear(entradaRechazo, datos);
  const [filas] = await conn.query(
    "SELECT afectado_subject, estado, version FROM solicitud WHERE id = ? FOR UPDATE",
    [id],
  );
  const solicitud = filas[0];
  if (!solicitud) throw noEncontrado("Solicitud no encontrada");
  if (solicitud.version !== entrada.versionVista) throw conflictoVersion();
  if (solicitud.estado !== "EN_REVISION") throw transicionInvalida(solicitud.estado, "RECHAZADA");

  const [actualizacion] = await conn.query(
    `UPDATE solicitud
        SET estado = 'RECHAZADA', motivo_rechazo = ?, version = version + 1
      WHERE id = ? AND estado = 'EN_REVISION' AND version = ?`,
    [entrada.motivo, id, entrada.versionVista],
  );
  if (actualizacion.affectedRows !== 1) throw conflictoVersion();

  await registrarAuditoria(conn, {
    entidad: "solicitud", entidadId: id, accion: "SOLICITUD_RECHAZADA",
    actor: usuario.subject, estadoDesde: "EN_REVISION", estadoHasta: "RECHAZADA",
    detalle: { motivo: entrada.motivo },
  });
  await encolarNotificacion(conn, {
    destinatario: solicitud.afectado_subject, plantilla: "SOLICITUD_RECHAZADA",
    carga: { solicitudId: id, estado: "RECHAZADA", motivo: entrada.motivo },
  });
  return { id, estado: "RECHAZADA", motivo: entrada.motivo, version: entrada.versionVista + 1 };
}

export async function buscarDuplicados(id) {
  const [solicitudes] = await pool.query(
    "SELECT id, ubicacion_codigo, categoria_reportada, creada_en, estado FROM solicitud WHERE id = ?",
    [id],
  );
  const origen = solicitudes[0];
  if (!origen) throw noEncontrado("Solicitud no encontrada");
  if (origen.estado !== "EN_REVISION") throw new ErrorApp(422, "SOLICITUD_NO_ELEGIBLE", "Solo se buscan duplicados para solicitudes en revisión");
  const regla = await obtenerRegla("ventana_duplicados_horas");
  const horas = Number(regla?.valor?.horas);
  if (!Number.isFinite(horas) || horas <= 0) {
    throw new ErrorApp(503, "POLITICA_DUPLICADOS_INVALIDA", "Falta configurar la ventana de búsqueda de duplicados");
  }
  const [filas] = await pool.query(
    `SELECT s.id, s.categoria_reportada AS categoria,
            s.urgencia_sugerida AS urgenciaSugerida, s.estado, s.creada_en AS creadaEn,
            s.descripcion, (s.categoria_reportada = ?) AS mismaCategoria
       FROM solicitud s
      WHERE s.id <> ?
        AND s.ubicacion_codigo = ?
        AND s.solicitud_maestra_id IS NULL
        AND s.estado IN ('EN_REVISION', 'VALIDADA')
        AND ABS(TIMESTAMPDIFF(SECOND, s.creada_en, ?)) <= ?
      ORDER BY mismaCategoria DESC, s.creada_en DESC`,
    [origen.categoria_reportada, id, origen.ubicacion_codigo, origen.creada_en, Math.floor(horas * 3600)],
  );
  return { solicitudId: id, ventanaHoras: horas, candidatos: filas };
}

const entradaDuplicado = z.object({
  maestraId: z.string().trim().min(1).max(36),
  versionVista: z.number().int().positive(),
});

export async function vincularDuplicado(conn, id, datos, actor) {
  const entrada = parsear(entradaDuplicado, datos);
  if (id === entrada.maestraId) throw new ErrorApp(422, "DUPLICADO_INVALIDO", "Una solicitud no puede ser su propia maestra");
  const ids = [id, entrada.maestraId].sort();
  const [filas] = await conn.query(
    `SELECT id, afectado_subject, ubicacion_codigo, estado, version, solicitud_maestra_id
       FROM solicitud WHERE id IN (?, ?) ORDER BY id FOR UPDATE`,
    ids,
  );
  const secundaria = filas.find((fila) => fila.id === id);
  const maestra = filas.find((fila) => fila.id === entrada.maestraId);
  if (!secundaria || !maestra) throw noEncontrado("No se encontró una de las solicitudes");
  if (secundaria.version !== entrada.versionVista) throw conflictoVersion();
  if (secundaria.estado !== "EN_REVISION") throw new ErrorApp(422, "SOLICITUD_NO_ELEGIBLE", "Solo se pueden vincular solicitudes en revisión");
  if (maestra.estado === "RECHAZADA" || maestra.estado === "CERRADO_DUPLICADO" || maestra.solicitud_maestra_id) {
    throw new ErrorApp(422, "MAESTRA_INVALIDA", "La solicitud maestra debe ser válida y no puede ser otra duplicada");
  }
  if (secundaria.ubicacion_codigo !== maestra.ubicacion_codigo) {
    throw new ErrorApp(422, "UBICACION_DISTINTA", "Las solicitudes deben compartir ubicación");
  }

  const [actualizacion] = await conn.query(
    `UPDATE solicitud
        SET estado = 'CERRADO_DUPLICADO', solicitud_maestra_id = ?, version = version + 1
      WHERE id = ? AND estado = 'EN_REVISION' AND version = ?`,
    [maestra.id, secundaria.id, entrada.versionVista],
  );
  if (actualizacion.affectedRows !== 1) throw conflictoVersion();
  await registrarAuditoria(conn, {
    entidad: "solicitud", entidadId: secundaria.id, accion: "SOLICITUD_VINCULADA_DUPLICADO",
    actor: actor.subject, estadoDesde: "EN_REVISION", estadoHasta: "CERRADO_DUPLICADO",
    detalle: { solicitudMaestraId: maestra.id },
  });
  await encolarNotificacion(conn, {
    destinatario: secundaria.afectado_subject, plantilla: "SOLICITUD_DUPLICADA",
    carga: { solicitudId: secundaria.id, solicitudMaestraId: maestra.id, estado: "CERRADO_DUPLICADO" },
  });
  return { id: secundaria.id, estado: "CERRADO_DUPLICADO", solicitudMaestraId: maestra.id, version: entrada.versionVista + 1 };
}
