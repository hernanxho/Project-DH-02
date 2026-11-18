import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../../compartido/db.js";
import { ErrorApp, conflictoVersion, noEncontrado, prohibido, transicionInvalida } from "../../compartido/errores.js";
import { buscarPersona } from "../../adaptadores/identidad.js";
import { registrarAuditoria } from "../auditoria/index.js";
import { cancelarPlazos, encolarNotificacion, programarPlazos } from "../notificaciones-plazos/index.js";
import { obtenerReglaConConexion } from "../reglas-politicas/index.js";
import { puedeAccederAOrden, puedeAdministrarSolicitud } from "../identidad-acceso/index.js";
import { transicionPermitida } from "./transiciones.js";

const entradaCrearOrden = z.object({
  solicitudId: z.string().trim().min(1).max(36),
  responsableSubject: z.string().trim().min(1).max(64),
  versionVista: z.number().int().positive(),
  advertenciaReconocida: z.boolean().optional().default(false),
});

function parsear(esquema, datos) {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    throw new ErrorApp(400, "VALIDACION", resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return resultado.data;
}

export async function crearOrden(conn, datos, actor) {
  const entrada = parsear(entradaCrearOrden, datos);
  const [solicitudes] = await conn.query(
    `SELECT s.id, s.afectado_subject, s.ubicacion_codigo, s.ubicacion_snapshot,
            s.ubicacion_verificada, s.categoria_reportada, s.urgencia_validada,
            s.estado, s.version
       FROM solicitud s
      WHERE s.id = ?
      FOR UPDATE`,
    [entrada.solicitudId],
  );
  const solicitud = solicitudes[0];
  if (!solicitud) throw noEncontrado("Solicitud no encontrada");
  if (!puedeAdministrarSolicitud(actor, solicitud, ["coordinador", "supervisor"])) throw prohibido("Tu alcance no incluye esa solicitud");
  if (solicitud.version !== entrada.versionVista) throw conflictoVersion();
  if (solicitud.estado !== "VALIDADA") {
    throw new ErrorApp(422, "SOLICITUD_NO_VALIDADA", "Solo se pueden crear órdenes desde solicitudes validadas");
  }
  if (!solicitud.ubicacion_verificada) {
    throw new ErrorApp(422, "UBICACION_NO_VERIFICADA", "La solicitud no tiene una ubicación verificada");
  }
  if (!solicitud.urgencia_validada) {
    throw new ErrorApp(422, "URGENCIA_NO_VALIDADA", "La solicitud no tiene una urgencia validada");
  }

  const [existentes] = await conn.query("SELECT id FROM orden_trabajo WHERE solicitud_id = ?", [solicitud.id]);
  if (existentes[0]) throw new ErrorApp(409, "ORDEN_EXISTENTE", "Esta solicitud ya tiene una orden de trabajo");

  const [perfiles] = await conn.query(
    `SELECT p.unidad, p.disponible, p.habilitado_restringidas, r.rol
       FROM perfil_tecnico p
       JOIN asignacion_rol r ON r.subject = p.subject AND r.rol IN ('tecnico', 'contratista')
      WHERE p.subject = ?
      ORDER BY CASE WHEN r.rol = 'tecnico' THEN 0 ELSE 1 END
      LIMIT 1`,
    [entrada.responsableSubject],
  );
  const perfil = perfiles[0];
  if (!perfil) throw new ErrorApp(422, "RESPONSABLE_INVALIDO", "El responsable no tiene un perfil técnico activo");
  if (!perfil.disponible) throw new ErrorApp(422, "RESPONSABLE_NO_DISPONIBLE", "El técnico seleccionado no está disponible");

  let snapshot = solicitud.ubicacion_snapshot;
  if (typeof snapshot === "string") {
    try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
  }
  const requiereAccesoEspecial = snapshot?.restringida === true;
  if (requiereAccesoEspecial && !perfil.habilitado_restringidas && !entrada.advertenciaReconocida) {
    throw new ErrorApp(409, "ADVERTENCIA_REQUIERE_CONFIRMACION", "El técnico no está habilitado para esta ubicación restringida. ¿Deseas continuar de todos modos?");
  }

  const tecnico = await buscarPersona(entrada.responsableSubject);
  if (!tecnico) throw new ErrorApp(422, "RESPONSABLE_INVALIDO", "No se encontró la identidad del técnico seleccionado");

  const id = `WO-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const asignacionId = randomUUID();
  await conn.query(
    `INSERT INTO orden_trabajo
      (id, solicitud_id, unidad_responsable, ubicacion_codigo,
       categoria_original, categoria_actual, prioridad, estado,
       responsable_subject, tipo_responsable, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ASIGNADA', ?, ?, 1)`,
    [id, solicitud.id, perfil.unidad, solicitud.ubicacion_codigo,
      solicitud.categoria_reportada, solicitud.categoria_reportada,
      solicitud.urgencia_validada, entrada.responsableSubject, perfil.rol],
  );
  await conn.query(
    `INSERT INTO asignacion
      (id, orden_id, de_subject, a_subject, tipo, motivo, asignada_por, vigente)
     VALUES (?, ?, NULL, ?, 'INICIAL', NULL, ?, TRUE)`,
    [asignacionId, id, entrada.responsableSubject, actor.subject],
  );
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: id, accion: "ORDEN_CREADA",
    actor: actor.subject, estadoHasta: "ASIGNADA",
    detalle: {
      solicitudId: solicitud.id,
      responsableSubject: entrada.responsableSubject,
      advertenciaAccesoReconocida: requiereAccesoEspecial && !perfil.habilitado_restringidas,
    },
  });
  await encolarNotificacion(conn, {
    destinatario: solicitud.afectado_subject,
    plantilla: "ORDEN_ASIGNADA",
    carga: { ordenId: id, solicitudId: solicitud.id, estado: "ASIGNADA" },
  });
  await encolarNotificacion(conn, {
    destinatario: entrada.responsableSubject,
    plantilla: "ORDEN_RECIBIDA",
    carga: { ordenId: id, ubicacionCodigo: solicitud.ubicacion_codigo, prioridad: solicitud.urgencia_validada },
  });

  return {
    id,
    solicitudId: solicitud.id,
    estado: "ASIGNADA",
    responsable: { subject: tecnico.subject, nombre: tecnico.nombre, unidad: perfil.unidad },
    version: 1,
    advertenciaAccesoReconocida: requiereAccesoEspecial && !perfil.habilitado_restringidas,
  };
}

export async function listarResponsables() {
  const [filas] = await pool.query(
    `SELECT p.subject, p.unidad, p.habilitado_restringidas,
            CASE WHEN MAX(r.rol = 'tecnico') THEN 'tecnico' ELSE 'contratista' END AS rol
       FROM perfil_tecnico p
       JOIN asignacion_rol r ON r.subject = p.subject AND r.rol IN ('tecnico', 'contratista')
      WHERE p.disponible = TRUE
      GROUP BY p.subject, p.unidad, p.habilitado_restringidas
      ORDER BY p.subject`,
  );
  const responsables = await Promise.all(filas.map(async (fila) => {
    const persona = await buscarPersona(fila.subject);
    return persona ? {
      subject: fila.subject,
      nombre: persona.nombre,
      unidad: fila.unidad,
      habilitadoRestringidas: Boolean(fila.habilitado_restringidas),
      tipo: fila.rol,
    } : null;
  }));
  return responsables.filter(Boolean);
}

export async function listarBloqueosAcceso(usuario) {
  if (!usuario.roles.some((r) => r.rol === "representante")) throw prohibido("Solo un representante puede consultar accesos pendientes");
  const [filas] = await pool.query(
    `SELECT o.id AS ordenId, o.version, o.ubicacion_codigo AS ubicacionCodigo,
            o.categoria_actual AS categoria, o.prioridad, s.descripcion,
            s.afectado_subject AS afectadoSubject, s.ubicacion_snapshot AS ubicacionSnapshot,
            b.id AS bloqueoId, b.parte_responsable AS parteResponsable,
            b.siguiente_accion AS siguienteAccion, b.seguimiento_en AS seguimientoEn
       FROM orden_trabajo o
       JOIN solicitud s ON s.id = o.solicitud_id
       JOIN bloqueo b ON b.orden_id = o.id AND b.resuelto_en IS NULL
      WHERE o.estado = 'BLOQUEADA_ACCESO'
      ORDER BY b.seguimiento_en IS NULL, b.seguimiento_en`,
  );
  return filas.filter((fila) => puedeAccederAOrden(usuario, fila))
    .map(({ afectadoSubject, ubicacionSnapshot, ...fila }) => fila);
}

const entradaCorregirCategoria = z.object({
  categoria: z.string().trim().min(1).max(64),
  motivo: z.string().trim().min(1).max(2000),
  versionVista: z.number().int().positive(),
});

export async function corregirCategoriaOrden(conn, ordenId, datos, actor) {
  const entrada = parsear(entradaCorregirCategoria, datos);
  const [filas] = await conn.query(
    `SELECT o.estado, o.version, o.responsable_subject AS responsableSubject,
            o.categoria_original AS categoriaOriginal, o.categoria_actual AS categoriaActual,
            o.ubicacion_codigo AS ubicacionCodigo, s.afectado_subject AS afectadoSubject,
            s.registrada_por AS registradaPor, s.ubicacion_snapshot AS ubicacionSnapshot
       FROM orden_trabajo o JOIN solicitud s ON s.id = o.solicitud_id
      WHERE o.id = ? FOR UPDATE`,
    [ordenId],
  );
  const orden = filas[0];
  if (!orden) throw noEncontrado("Orden no encontrada");
  const esResponsable = actor.subject === orden.responsableSubject && actor.roles.some((r) => ["tecnico", "contratista"].includes(r.rol));
  const esGestor = puedeAdministrarSolicitud(actor, orden, ["coordinador", "supervisor"]);
  if (!esResponsable && !esGestor) throw prohibido("Solo el responsable o coordinación puede corregir la categoría en su alcance");
  if (orden.version !== entrada.versionVista) throw conflictoVersion();
  if (["RESUELTA", "CERRADA"].includes(orden.estado)) throw new ErrorApp(422, "ORDEN_NO_EDITABLE", "No se puede corregir la categoría después de resolver el trabajo");
  const regla = await obtenerReglaConConexion(conn, "categorias_mantenimiento");
  const categorias = Array.isArray(regla?.valor) ? regla.valor : [];
  if (!categorias.some((categoria) => categoria.codigo === entrada.categoria)) {
    throw new ErrorApp(400, "CATEGORIA_INVALIDA", "La categoría no está en el catálogo vigente");
  }
  if (entrada.categoria === orden.categoriaActual) throw new ErrorApp(422, "CATEGORIA_SIN_CAMBIOS", "Selecciona una categoría distinta a la actual");

  const [actualizacion] = await conn.query(
    `UPDATE orden_trabajo SET categoria_actual = ?, version = version + 1
      WHERE id = ? AND version = ?`,
    [entrada.categoria, ordenId, entrada.versionVista],
  );
  if (actualizacion.affectedRows !== 1) throw conflictoVersion();
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: ordenId, accion: "CATEGORIA_CORREGIDA",
    actor: actor.subject, estadoDesde: orden.estado, estadoHasta: orden.estado,
    detalle: {
      categoriaOriginal: orden.categoriaOriginal, categoriaAnterior: orden.categoriaActual,
      categoriaNueva: entrada.categoria, motivo: entrada.motivo, versionPolitica: regla.version,
    },
  });
  for (const destinatario of new Set([orden.afectadoSubject, orden.registradaPor])) {
    if (destinatario) await encolarNotificacion(conn, {
      destinatario, plantilla: "CATEGORIA_ORDEN_CORREGIDA",
      carga: { ordenId, categoria: entrada.categoria },
    });
  }
  return { ordenId, categoriaOriginal: orden.categoriaOriginal, categoriaActual: entrada.categoria, version: entrada.versionVista + 1 };
}

const entradaTransferencia = z.object({
  responsableSubject: z.string().trim().min(1).max(64),
  versionVista: z.number().int().positive(),
  motivo: z.string().trim().min(1).max(2000),
  advertenciaReconocida: z.boolean().optional().default(false),
});

export async function transferirOrden(conn, ordenId, datos, actor, tipoCambio) {
  const entrada = parsear(entradaTransferencia, datos);
  const [filas] = await conn.query(
    `SELECT o.estado, o.version, o.responsable_subject, o.unidad_responsable,
            s.ubicacion_snapshot AS ubicacionSnapshot, s.afectado_subject AS afectadoSubject
       FROM orden_trabajo o JOIN solicitud s ON s.id = o.solicitud_id
      WHERE o.id = ? FOR UPDATE`,
    [ordenId],
  );
  const orden = filas[0];
  if (!orden) throw noEncontrado("Orden no encontrada");
  if (tipoCambio === "REASIGNACION" && !puedeAdministrarSolicitud(actor, orden, ["supervisor"])) throw prohibido("Tu alcance no incluye esa orden");
  if (orden.version !== entrada.versionVista) throw conflictoVersion();
  if (entrada.responsableSubject === orden.responsable_subject) {
    throw new ErrorApp(422, "RESPONSABLE_IGUAL", "El responsable nuevo debe ser distinto al actual");
  }
  if (tipoCambio === "TRANSFERENCIA") {
    if (!actor.roles.some((rol) => ["tecnico", "contratista"].includes(rol.rol)) || actor.subject !== orden.responsable_subject) {
      throw prohibido("Solo el responsable técnico actual puede transferir la orden");
    }
    if (!["ASIGNADA", "EN_PROGRESO", "BLOQUEADA_MATERIALES", "BLOQUEADA_ACCESO"].includes(orden.estado)) {
      throw new ErrorApp(422, "ESTADO_NO_TRANSFERIBLE", "La orden no se puede transferir en su estado actual");
    }
  } else {
    if (!actor.roles.some((rol) => rol.rol === "supervisor")) throw prohibido("Solo supervisión puede reasignar una orden");
    if (!["ASIGNADA", "EN_PROGRESO", "BLOQUEADA_MATERIALES", "BLOQUEADA_ACCESO"].includes(orden.estado)) {
      throw new ErrorApp(422, "ESTADO_NO_REASIGNABLE", "La orden no se puede reasignar en su estado actual");
    }
  }

  const [perfiles] = await conn.query(
    `SELECT p.unidad, p.disponible, p.habilitado_restringidas, r.rol
       FROM perfil_tecnico p
       JOIN asignacion_rol r ON r.subject = p.subject AND r.rol IN ('tecnico', 'contratista')
      WHERE p.subject = ?
      ORDER BY CASE WHEN r.rol = 'tecnico' THEN 0 ELSE 1 END
      LIMIT 1`,
    [entrada.responsableSubject],
  );
  const perfil = perfiles[0];
  if (!perfil) throw new ErrorApp(422, "RESPONSABLE_INVALIDO", "El responsable no tiene perfil local de técnico o contratista");
  if (!perfil.disponible) throw new ErrorApp(422, "RESPONSABLE_NO_DISPONIBLE", "El responsable seleccionado no está disponible");
  let snapshot = orden.ubicacionSnapshot;
  if (typeof snapshot === "string") {
    try { snapshot = JSON.parse(snapshot); } catch { snapshot = null; }
  }
  const accesoEspecial = snapshot?.restringida === true && !perfil.habilitado_restringidas;
  if (accesoEspecial && !entrada.advertenciaReconocida) {
    throw new ErrorApp(409, "ADVERTENCIA_REQUIERE_CONFIRMACION", "El responsable no está habilitado para esta ubicación restringida. ¿Deseas continuar de todos modos?");
  }
  const persona = await buscarPersona(entrada.responsableSubject);
  if (!persona) throw new ErrorApp(422, "RESPONSABLE_INVALIDO", "No se encontró la identidad del responsable");

  await conn.query("UPDATE asignacion SET vigente = FALSE WHERE orden_id = ? AND vigente = TRUE", [ordenId]);
  await conn.query(
    `INSERT INTO asignacion (id, orden_id, de_subject, a_subject, tipo, motivo, asignada_por, vigente)
     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
    [randomUUID(), ordenId, orden.responsable_subject, entrada.responsableSubject,
      tipoCambio, entrada.motivo, actor.subject],
  );
  await conn.query(
    `UPDATE orden_trabajo
        SET responsable_subject = ?, tipo_responsable = ?, unidad_responsable = ?, version = version + 1
      WHERE id = ? AND version = ?`,
    [entrada.responsableSubject, perfil.rol, perfil.unidad, ordenId, entrada.versionVista],
  );
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: ordenId, accion: tipoCambio,
    actor: actor.subject, estadoDesde: orden.estado, estadoHasta: orden.estado,
    detalle: {
      responsableAnterior: orden.responsable_subject,
      responsableNuevo: entrada.responsableSubject,
      motivo: entrada.motivo,
      advertenciaAccesoReconocida: accesoEspecial,
    },
  });

  const destinatarios = tipoCambio === "TRANSFERENCIA"
    ? (await conn.query("SELECT subject FROM asignacion_rol WHERE rol = 'supervisor'"))[0].map((r) => r.subject)
    : [orden.responsable_subject, entrada.responsableSubject];
  for (const destinatario of new Set(destinatarios)) {
    await encolarNotificacion(conn, {
      destinatario,
      plantilla: tipoCambio === "TRANSFERENCIA" ? "ORDEN_TRANSFERIDA" : "ORDEN_REASIGNADA",
      carga: { ordenId, responsableAnterior: orden.responsable_subject, responsableNuevo: entrada.responsableSubject },
    });
  }
  return {
    ordenId, estado: orden.estado, version: entrada.versionVista + 1,
    responsable: { subject: persona.subject, nombre: persona.nombre, unidad: perfil.unidad },
  };
}

export async function listarOrdenesTecnico(usuario, filtros = {}) {
  if (!usuario.roles.some((rol) => ["tecnico", "contratista"].includes(rol.rol))) {
    throw prohibido("Solo el personal técnico puede consultar su lista de órdenes");
  }
  const condiciones = ["o.responsable_subject = ?"];
  const parametros = [usuario.subject];
  if (filtros.estado) {
    condiciones.push("o.estado = ?");
    parametros.push(filtros.estado);
  }
  if (filtros.ubicacion) {
    condiciones.push("o.ubicacion_codigo = ?");
    parametros.push(filtros.ubicacion);
  }
  if (filtros.prioridad) {
    condiciones.push("o.prioridad = ?");
    parametros.push(filtros.prioridad);
  }
  const [filas] = await pool.query(
    `SELECT o.id, o.solicitud_id AS solicitudId, o.ubicacion_codigo AS ubicacionCodigo,
            o.categoria_actual AS categoria, o.prioridad, o.estado, o.version,
            o.tipo_cierre AS tipoCierre, o.creada_en AS creadaEn, o.cerrada_en AS cerradaEn,
            o.responsable_subject AS responsableSubject, s.descripcion
       FROM orden_trabajo o
       JOIN solicitud s ON s.id = o.solicitud_id
      WHERE ${condiciones.join(" AND ")}
      ORDER BY FIELD(o.prioridad, 'Crítica', 'Alta', 'Normal', 'Baja'), o.creada_en DESC`,
    parametros,
  );
  return filas;
}

const entradaTransicion = z.object({
  ordenId: z.string().trim().min(1).max(36),
  hacia: z.string().trim().min(1).max(32),
  versionVista: z.number().int().positive(),
  evidenciaId: z.string().trim().min(1).max(36).optional(),
  motivo: z.string().trim().min(1).max(2000).optional(),
});

export async function solicitarTransicion(conn, datos, actor) {
  const entrada = parsear(entradaTransicion, datos);
  const [filas] = await conn.query(
    `SELECT o.id, o.estado, o.version, o.responsable_subject, o.resuelta_en,
            o.ubicacion_codigo AS ubicacionCodigo, s.afectado_subject AS afectadoSubject,
            s.registrada_por AS registradaPor, s.ubicacion_snapshot AS ubicacionSnapshot
       FROM orden_trabajo o
       JOIN solicitud s ON s.id = o.solicitud_id
      WHERE o.id = ?
      FOR UPDATE`,
    [datos.ordenId],
  );
  const orden = filas[0];
  if (!orden) throw noEncontrado("Orden no encontrada");
  if (orden.version !== entrada.versionVista) throw conflictoVersion();

  let tipoActor;
  if (orden.responsable_subject === actor.subject && actor.roles.some((r) => ["tecnico", "contratista"].includes(r.rol))) {
    tipoActor = "responsable";
  } else if (orden.afectadoSubject === actor.subject && actor.roles.some((r) => ["solicitante", "coordinador", "representante"].includes(r.rol))) {
    tipoActor = "afectado";
  } else if (orden.estado === "BLOQUEADA_ACCESO" && actor.roles.some((r) => r.rol === "representante") &&
      puedeAccederAOrden(actor, orden)) {
    tipoActor = "representante";
  } else throw prohibido("No tienes relación autorizada con esta orden");

  if (entrada.hacia === "CERRADA") {
    if (tipoActor === "responsable") throw prohibido("El responsable técnico no puede cerrar una orden");
    throw new ErrorApp(422, "CIERRE_REQUIERE_CONFIRMACION", "El cierre debe realizarse mediante el flujo de confirmación del afectado");
  }

  if (!transicionPermitida(orden.estado, entrada.hacia, tipoActor)) {
    throw transicionInvalida(orden.estado, entrada.hacia);
  }
  const rechazoCierre = orden.estado === "RESUELTA" && entrada.hacia === "EN_PROGRESO";
  if (rechazoCierre && !entrada.motivo) {
    throw new ErrorApp(400, "MOTIVO_REQUERIDO", "Indica el motivo para rechazar el cierre");
  }

  const politica = await obtenerReglaConConexion(conn, "matriz_evidencia");
  if (!politica) throw new ErrorApp(503, "POLITICA_NO_CONFIGURADA", "Falta configurar la matriz de evidencia");
  const matriz = politica.valor && typeof politica.valor === "object" ? politica.valor : {};
  const evidenciaRequerida = matriz[`${orden.estado}->${entrada.hacia}`];
  if (!["si", "no", "opcional"].includes(evidenciaRequerida)) {
    throw new ErrorApp(503, "POLITICA_EVIDENCIA_INVALIDA", "La política no define la evidencia para esta transición");
  }
  if (evidenciaRequerida === "si" && !entrada.evidenciaId) {
    throw new ErrorApp(422, "EVIDENCIA_REQUERIDA", "Esta transición requiere registrar evidencia");
  }
  if (entrada.evidenciaId) {
    const [evidencias] = await conn.query(
      "SELECT id FROM evidencia WHERE id = ? AND orden_id = ?",
      [entrada.evidenciaId, datos.ordenId],
    );
    if (!evidencias[0]) throw noEncontrado("La evidencia no corresponde a esta orden");
  }

  if (entrada.hacia === "BLOQUEADA_MATERIALES" || entrada.hacia === "BLOQUEADA_ACCESO") {
    const [bloqueos] = await conn.query(
      "SELECT id FROM bloqueo WHERE orden_id = ? AND resuelto_en IS NULL LIMIT 1",
      [datos.ordenId],
    );
    if (!bloqueos[0]) throw new ErrorApp(422, "CAUSAL_BLOQUEO_REQUERIDA", "Registra la causal del bloqueo antes de cambiar el estado");
  }

  const resueltaEn = entrada.hacia === "RESUELTA" ? new Date() : null;
  const [actualizacion] = await conn.query(
    `UPDATE orden_trabajo
        SET estado = ?, version = version + 1,
            resuelta_en = CASE WHEN ? = 'RESUELTA' THEN ? WHEN ? = 'EN_PROGRESO' AND estado = 'RESUELTA' THEN NULL ELSE resuelta_en END
      WHERE id = ? AND estado = ? AND version = ?`,
    [entrada.hacia, entrada.hacia, resueltaEn, entrada.hacia, datos.ordenId, orden.estado, entrada.versionVista],
  );
  if (actualizacion.affectedRows !== 1) throw conflictoVersion();

  if (orden.estado === "BLOQUEADA_MATERIALES" || orden.estado === "BLOQUEADA_ACCESO") {
    await conn.query(
      "UPDATE bloqueo SET resuelto_en = UTC_TIMESTAMP(3) WHERE orden_id = ? AND resuelto_en IS NULL",
      [datos.ordenId],
    );
  }

  if (rechazoCierre) {
    const [confirmaciones] = await conn.query(
      `SELECT id FROM confirmacion_cierre
        WHERE orden_id = ? AND respuesta IS NULL
        ORDER BY ciclo DESC LIMIT 1 FOR UPDATE`,
      [datos.ordenId],
    );
    if (!confirmaciones[0]) throw new ErrorApp(409, "CONFIRMACION_NO_PENDIENTE", "No hay una confirmación de cierre pendiente para rechazar");
    await conn.query(
      `UPDATE confirmacion_cierre
          SET respuesta = 'RECHAZADA', respondida_por = ?, respondida_en = UTC_TIMESTAMP(3), motivo = ?
        WHERE id = ? AND respuesta IS NULL`,
      [actor.subject, entrada.motivo, confirmaciones[0].id],
    );
  }

  let versionesPlazo = null;
  if (entrada.hacia === "RESUELTA") {
    const reglaCierre = await obtenerReglaConConexion(conn, "plazo_cierre_horas");
    const horas = Number(reglaCierre?.valor?.horas);
    if (!Number.isFinite(horas) || horas <= 0) {
      throw new ErrorApp(503, "POLITICA_PLAZOS_INVALIDA", "Falta configurar el plazo de confirmación de cierre");
    }
    const [ciclos] = await conn.query(
      "SELECT COALESCE(MAX(ciclo), 0) AS ultimoCiclo FROM confirmacion_cierre WHERE orden_id = ?",
      [datos.ordenId],
    );
    const venceEn = new Date(resueltaEn.getTime() + horas * 60 * 60 * 1000);
    await conn.query(
      `INSERT INTO confirmacion_cierre
        (id, orden_id, ciclo, solicitada_a_subject, solicitada_en, vence_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), datos.ordenId, Number(ciclos[0].ultimoCiclo) + 1, orden.afectadoSubject, resueltaEn, venceEn],
    );
    versionesPlazo = await programarPlazos(conn, datos.ordenId);
  } else if (orden.estado === "RESUELTA" && entrada.hacia === "EN_PROGRESO") {
    await cancelarPlazos(conn, datos.ordenId);
  }

  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: datos.ordenId, accion: "ESTADO_CAMBIADO",
    actor: actor.subject, estadoDesde: orden.estado, estadoHasta: entrada.hacia,
    detalle: {
      evidenciaId: entrada.evidenciaId ?? null,
      motivo: entrada.motivo ?? null,
      versionPoliticaEvidencia: politica.version,
      versionPoliticaPlazos: versionesPlazo?.versionCierre ?? null,
      versionPoliticaRecordatorios: versionesPlazo?.versionRecordatorios ?? null,
    },
  });
  await encolarNotificacion(conn, {
    destinatario: orden.afectadoSubject,
    plantilla: "ORDEN_ESTADO_CAMBIADO",
    carga: { ordenId: datos.ordenId, estado: entrada.hacia },
  });

  if (orden.registradaPor && orden.registradaPor !== orden.afectadoSubject) {
    await encolarNotificacion(conn, {
      destinatario: orden.registradaPor, plantilla: "ORDEN_ESTADO_CAMBIADO",
      carga: { ordenId: datos.ordenId, estado: entrada.hacia },
    });
  }

  if (entrada.hacia === "BLOQUEADA_MATERIALES" || entrada.hacia === "BLOQUEADA_ACCESO") {
    const [supervisores] = await conn.query("SELECT subject FROM asignacion_rol WHERE rol = 'supervisor'");
    for (const supervisor of supervisores) {
      await encolarNotificacion(conn, {
        destinatario: supervisor.subject,
        plantilla: "ORDEN_BLOQUEADA",
        carga: { ordenId: datos.ordenId, estado: entrada.hacia },
      });
    }
  }

  return { ordenId: datos.ordenId, estado: entrada.hacia, version: entrada.versionVista + 1 };
}

function puedeResponderCierre(usuario, orden) {
  const afectadoSubject = orden.afectadoSubject ?? orden.afectado_subject;
  const ubicacionSnapshot = orden.ubicacionSnapshot ?? orden.ubicacion_snapshot;
  if (usuario.subject === afectadoSubject) return true;
  let ubicacion = ubicacionSnapshot;
  if (typeof ubicacionSnapshot === "string") {
    try { ubicacion = JSON.parse(ubicacionSnapshot || "null"); } catch { ubicacion = null; }
  }
  return usuario.roles.some((rol) =>
    rol.rol === "representante" && rol.alcance && rol.alcance === ubicacion?.edificioCodigo,
  );
}

export async function listarPendientesCierre(usuario) {
  const [filas] = await pool.query(
    `SELECT o.id AS ordenId, o.solicitud_id AS solicitudId, o.ubicacion_codigo AS ubicacionCodigo,
            o.categoria_actual AS categoria, o.prioridad, o.estado, o.version,
            c.ciclo, c.vence_en AS venceEn, s.descripcion, s.afectado_subject AS afectadoSubject,
            s.ubicacion_snapshot AS ubicacionSnapshot
       FROM orden_trabajo o
       JOIN solicitud s ON s.id = o.solicitud_id
       JOIN confirmacion_cierre c ON c.orden_id = o.id
      WHERE o.estado = 'RESUELTA' AND c.respuesta IS NULL
      ORDER BY c.vence_en`,
  );
  return filas.filter((fila) => puedeResponderCierre(usuario, fila)).map(({ afectadoSubject, ubicacionSnapshot, ...fila }) => fila);
}

const entradaRespuestaCierre = z.object({ versionVista: z.number().int().positive() });
const entradaRechazoCierre = entradaRespuestaCierre.extend({ motivo: z.string().trim().min(1).max(2000) });

async function cargarCierrePendiente(conn, ordenId, versionVista, usuario) {
  const [filas] = await conn.query(
    `SELECT o.estado, o.version, o.responsable_subject, o.ubicacion_codigo,
            s.afectado_subject, s.registrada_por, s.ubicacion_snapshot
       FROM orden_trabajo o JOIN solicitud s ON s.id = o.solicitud_id
      WHERE o.id = ? FOR UPDATE`,
    [ordenId],
  );
  const orden = filas[0];
  if (!orden) throw noEncontrado("Orden no encontrada");
  if (!puedeResponderCierre(usuario, orden)) throw prohibido("No tienes permiso para responder por esta orden");
  if (orden.version !== versionVista) throw conflictoVersion();
  if (orden.estado !== "RESUELTA") throw transicionInvalida(orden.estado, "CERRADA");
  const [confirmaciones] = await conn.query(
    `SELECT id, ciclo, vence_en FROM confirmacion_cierre
      WHERE orden_id = ? AND respuesta IS NULL
      ORDER BY ciclo DESC LIMIT 1 FOR UPDATE`,
    [ordenId],
  );
  const confirmacion = confirmaciones[0];
  if (!confirmacion) throw new ErrorApp(409, "CONFIRMACION_NO_PENDIENTE", "No hay una confirmación de cierre pendiente");
  if (new Date(confirmacion.vence_en).getTime() <= Date.now()) {
    throw new ErrorApp(409, "CONFIRMACION_VENCIDA", "El plazo de confirmación ya venció");
  }
  return { orden, confirmacion };
}

export async function confirmarCierre(conn, ordenId, datos, usuario) {
  const entrada = parsear(entradaRespuestaCierre, datos);
  const { orden, confirmacion } = await cargarCierrePendiente(conn, ordenId, entrada.versionVista, usuario);
  if (!transicionPermitida("RESUELTA", "CERRADA", "afectado", "CONFIRMADO")) {
    throw transicionInvalida("RESUELTA", "CERRADA");
  }
  await conn.query(
    `UPDATE orden_trabajo SET estado = 'CERRADA', tipo_cierre = 'CONFIRMADO',
            cerrada_en = UTC_TIMESTAMP(3), version = version + 1
      WHERE id = ? AND estado = 'RESUELTA' AND version = ?`,
    [ordenId, entrada.versionVista],
  );
  await conn.query(
    `UPDATE confirmacion_cierre
        SET respuesta = 'CONFIRMADA', respondida_por = ?, respondida_en = UTC_TIMESTAMP(3)
      WHERE id = ? AND respuesta IS NULL`,
    [usuario.subject, confirmacion.id],
  );
  await cancelarPlazos(conn, ordenId);
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: ordenId, accion: "CIERRE_CONFIRMADO",
    actor: usuario.subject, estadoDesde: "RESUELTA", estadoHasta: "CERRADA",
    detalle: { tipoCierre: "CONFIRMADO", ciclo: confirmacion.ciclo },
  });
  await encolarNotificacion(conn, {
    destinatario: orden.responsable_subject, plantilla: "CIERRE_CONFIRMADO",
    carga: { ordenId, estado: "CERRADA", tipoCierre: "CONFIRMADO" },
  });
  for (const destinatario of new Set([orden.afectado_subject, orden.registrada_por])) {
    if (destinatario && destinatario !== orden.responsable_subject) await encolarNotificacion(conn, {
      destinatario, plantilla: "CIERRE_CONFIRMADO",
      carga: { ordenId, estado: "CERRADA", tipoCierre: "CONFIRMADO" },
    });
  }
  return { ordenId, estado: "CERRADA", tipoCierre: "CONFIRMADO", version: entrada.versionVista + 1 };
}

export async function rechazarCierre(conn, ordenId, datos, usuario) {
  const entrada = parsear(entradaRechazoCierre, datos);
  const { orden, confirmacion } = await cargarCierrePendiente(conn, ordenId, entrada.versionVista, usuario);
  if (!transicionPermitida("RESUELTA", "EN_PROGRESO", "afectado")) {
    throw transicionInvalida("RESUELTA", "EN_PROGRESO");
  }
  await conn.query(
    `UPDATE orden_trabajo SET estado = 'EN_PROGRESO', resuelta_en = NULL,
            version = version + 1
      WHERE id = ? AND estado = 'RESUELTA' AND version = ?`,
    [ordenId, entrada.versionVista],
  );
  await conn.query(
    `UPDATE confirmacion_cierre
        SET respuesta = 'RECHAZADA', respondida_por = ?, respondida_en = UTC_TIMESTAMP(3), motivo = ?
      WHERE id = ? AND respuesta IS NULL`,
    [usuario.subject, entrada.motivo, confirmacion.id],
  );
  await cancelarPlazos(conn, ordenId);
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: ordenId, accion: "CIERRE_RECHAZADO",
    actor: usuario.subject, estadoDesde: "RESUELTA", estadoHasta: "EN_PROGRESO",
    detalle: { ciclo: confirmacion.ciclo, motivo: entrada.motivo },
  });
  await encolarNotificacion(conn, {
    destinatario: orden.responsable_subject, plantilla: "CIERRE_RECHAZADO",
    carga: { ordenId, estado: "EN_PROGRESO", motivo: entrada.motivo },
  });
  for (const destinatario of new Set([orden.afectado_subject, orden.registrada_por])) {
    if (destinatario && destinatario !== orden.responsable_subject) await encolarNotificacion(conn, {
      destinatario, plantilla: "CIERRE_RECHAZADO",
      carga: { ordenId, estado: "EN_PROGRESO", motivo: entrada.motivo },
    });
  }
  return { ordenId, estado: "EN_PROGRESO", version: entrada.versionVista + 1 };
}

const entradaReapertura = z.object({
  versionVista: z.number().int().positive(),
  descripcion: z.string().trim().min(1).max(4000),
});

export async function reabrirOrden(conn, ordenId, datos, usuario) {
  const entrada = parsear(entradaReapertura, datos);
  const [filas] = await conn.query(
    `SELECT o.estado, o.version, o.cerrada_en, o.prioridad,
            s.afectado_subject, s.ubicacion_codigo, s.ubicacion_snapshot,
            s.ubicacion_verificada, s.categoria_reportada
       FROM orden_trabajo o JOIN solicitud s ON s.id = o.solicitud_id
      WHERE o.id = ? FOR UPDATE`,
    [ordenId],
  );
  const orden = filas[0];
  if (!orden) throw noEncontrado("Orden no encontrada");
  if (!puedeResponderCierre(usuario, orden)) throw prohibido("No tienes permiso para reabrir esta orden");
  if (orden.version !== entrada.versionVista) throw conflictoVersion();
  if (orden.estado !== "CERRADA" || !orden.cerrada_en) throw new ErrorApp(422, "ORDEN_NO_CERRADA", "Solo se puede reabrir una orden cerrada");

  const regla = await obtenerReglaConConexion(conn, "ventana_reapertura_horas");
  const horas = Number(regla?.valor?.horas);
  if (!Number.isFinite(horas) || horas <= 0) throw new ErrorApp(503, "POLITICA_REAPERTURA_INVALIDA", "Falta configurar la ventana de reapertura");
  if (Date.now() - new Date(orden.cerrada_en).getTime() > horas * 60 * 60 * 1000) {
    throw new ErrorApp(422, "VENTANA_REAPERTURA_VENCIDA", "La ventana para reabrir esta orden ya venció");
  }
  const [anteriores] = await conn.query("SELECT id FROM solicitud WHERE reabre_orden_id = ? LIMIT 1", [ordenId]);
  if (anteriores[0]) throw new ErrorApp(409, "REAPERTURA_EXISTENTE", "Ya existe una solicitud de reapertura para esta orden");

  const solicitudId = `MR-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const ubicacionSnapshot = typeof orden.ubicacion_snapshot === "string"
    ? orden.ubicacion_snapshot
    : JSON.stringify(orden.ubicacion_snapshot ?? null);
  await conn.query(
    `INSERT INTO solicitud
      (id, registrada_por, afectado_subject, canal_origen, ubicacion_codigo,
       ubicacion_snapshot, ubicacion_verificada, categoria_reportada,
       descripcion, urgencia_sugerida, estado, reabre_orden_id, version)
     VALUES (?, ?, ?, 'web', ?, ?, ?, ?, ?, ?, 'EN_REVISION', ?, 1)`,
    [solicitudId, usuario.subject, orden.afectado_subject, orden.ubicacion_codigo,
      ubicacionSnapshot, orden.ubicacion_verificada, orden.categoria_reportada,
      entrada.descripcion, orden.prioridad, ordenId],
  );
  await registrarAuditoria(conn, {
    entidad: "solicitud", entidadId: solicitudId, accion: "REAPERTURA_REGISTRADA",
    actor: usuario.subject, estadoHasta: "EN_REVISION",
    detalle: { ordenCerradaId: ordenId, versionPolitica: regla.version },
  });
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: ordenId, accion: "REAPERTURA_SOLICITADA",
    actor: usuario.subject, estadoDesde: "CERRADA", estadoHasta: "CERRADA",
    detalle: { solicitudId },
  });
  await encolarNotificacion(conn, {
    destinatario: orden.afectado_subject, plantilla: "REAPERTURA_SOLICITADA",
    carga: { ordenId, solicitudId, estado: "EN_REVISION" },
  });
  return { solicitudId, ordenId, estado: "EN_REVISION", versionPolitica: regla.version };
}

export async function cerrarAutomaticamente(conn, ordenId, plazoId = null) {
  const [filas] = await conn.query(
    `SELECT o.estado, o.version, s.afectado_subject AS afectadoSubject,
            s.registrada_por AS registradaPor
       FROM orden_trabajo o JOIN solicitud s ON s.id = o.solicitud_id
      WHERE o.id = ? FOR UPDATE`,
    [ordenId],
  );
  const orden = filas[0];
  if (!orden || orden.estado !== "RESUELTA") return { procesada: false };
  if (!transicionPermitida("RESUELTA", "CERRADA", "sistema", "AUTOMATICO")) {
    throw transicionInvalida("RESUELTA", "CERRADA");
  }
  const [confirmaciones] = await conn.query(
    `SELECT id, ciclo, vence_en AS venceEn FROM confirmacion_cierre
      WHERE orden_id = ? AND respuesta IS NULL AND vence_en <= UTC_TIMESTAMP(3)
      ORDER BY ciclo DESC LIMIT 1 FOR UPDATE`,
    [ordenId],
  );
  const confirmacion = confirmaciones[0];
  if (!confirmacion) return { procesada: false };

  const retrasoMs = Date.now() - new Date(confirmacion.venceEn).getTime();
  if (retrasoMs > 60 * 60 * 1000) {
    const [recordatorios] = await conn.query(
      `SELECT id FROM plazo
        WHERE orden_id = ? AND tipo = 'RECORDATORIO' AND estado = 'PENDIENTE'
          AND vence_en <= UTC_TIMESTAMP(3)
        ORDER BY vence_en FOR UPDATE`,
      [ordenId],
    );
    for (const recordatorio of recordatorios) {
      await encolarNotificacion(conn, {
        destinatario: orden.afectadoSubject,
        plantilla: "RECORDATORIO_CONFIRMACION",
        carga: { ordenId, ciclo: confirmacion.ciclo, recuperacion: true },
      });
      await conn.query(
        "UPDATE plazo SET estado = 'PROCESADO', procesado_en = UTC_TIMESTAMP(3) WHERE id = ? AND estado = 'PENDIENTE'",
        [recordatorio.id],
      );
    }
    const nuevaVenceEn = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await conn.query("UPDATE confirmacion_cierre SET vence_en = ? WHERE id = ? AND respuesta IS NULL", [nuevaVenceEn, confirmacion.id]);
    if (plazoId) {
      await conn.query("UPDATE plazo SET vence_en = ?, estado = 'PENDIENTE', procesado_en = NULL WHERE id = ?", [nuevaVenceEn, plazoId]);
    }
    await registrarAuditoria(conn, {
      entidad: "orden", entidadId: ordenId, accion: "CIERRE_REPROGRAMADO_POR_RECUPERACION",
      actor: "SISTEMA", estadoDesde: "RESUELTA", estadoHasta: "RESUELTA",
      detalle: { ciclo: confirmacion.ciclo, minutosDeRetraso: Math.floor(retrasoMs / 60000), nuevaVenceEn },
    });
    for (const destinatario of new Set([orden.afectadoSubject, orden.registradaPor])) {
      if (!destinatario) continue;
      await encolarNotificacion(conn, {
        destinatario, plantilla: "CIERRE_REPROGRAMADO",
        carga: { ordenId, ciclo: confirmacion.ciclo, venceEn: nuevaVenceEn },
      });
    }
    return { procesada: true, reprogramada: true, ordenId, venceEn: nuevaVenceEn };
  }
  const [actualizacion] = await conn.query(
    `UPDATE orden_trabajo SET estado = 'CERRADA', tipo_cierre = 'AUTOMATICO',
            cerrada_en = UTC_TIMESTAMP(3), version = version + 1
      WHERE id = ? AND estado = 'RESUELTA' AND version = ?`,
    [ordenId, orden.version],
  );
  if (actualizacion.affectedRows !== 1) throw conflictoVersion();
  await conn.query(
    `UPDATE confirmacion_cierre
        SET respuesta = 'VENCIDA', respondida_por = 'SISTEMA', respondida_en = UTC_TIMESTAMP(3)
      WHERE id = ? AND respuesta IS NULL`,
    [confirmacion.id],
  );
  await cancelarPlazos(conn, ordenId);
  if (plazoId) {
    await conn.query(
      "UPDATE plazo SET estado = 'PROCESADO', procesado_en = UTC_TIMESTAMP(3) WHERE id = ?",
      [plazoId],
    );
  }
  await registrarAuditoria(conn, {
    entidad: "orden", entidadId: ordenId, accion: "CIERRE_AUTOMATICO",
    actor: "SISTEMA", estadoDesde: "RESUELTA", estadoHasta: "CERRADA",
    detalle: { tipoCierre: "AUTOMATICO", ciclo: confirmacion.ciclo },
  });
  await encolarNotificacion(conn, {
    destinatario: orden.afectadoSubject, plantilla: "CIERRE_AUTOMATICO",
    carga: { ordenId, estado: "CERRADA", tipoCierre: "AUTOMATICO", puedeReabrir: true },
  });
  if (orden.registradaPor && orden.registradaPor !== orden.afectadoSubject) {
    await encolarNotificacion(conn, {
      destinatario: orden.registradaPor, plantilla: "CIERRE_AUTOMATICO",
      carga: { ordenId, estado: "CERRADA", tipoCierre: "AUTOMATICO", puedeReabrir: true },
    });
  }
  return { procesada: true, ordenId, tipoCierre: "AUTOMATICO" };
}
