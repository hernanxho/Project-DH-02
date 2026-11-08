// Planificador interno: procesa plazos persistidos y reintenta notificaciones.
import { conTransaccion, pool } from "../compartido/db.js";
import { config } from "../compartido/config.js";
import { encolarNotificacion } from "../modulos/notificaciones-plazos/index.js";
import { cerrarAutomaticamente } from "../modulos/ordenes-trabajo/index.js";
import { enviar } from "../adaptadores/notificacion.js";
import { rm } from "node:fs/promises";
import path from "node:path";

let temporizador = null;

async function procesarUnPlazo(id) {
  const [referencias] = await pool.query("SELECT orden_id FROM plazo WHERE id = ?", [id]);
  if (!referencias[0]) return false;
  const ordenId = referencias[0].orden_id;
  return conTransaccion(async (conn) => {
    const [ordenes] = await conn.query("SELECT estado FROM orden_trabajo WHERE id = ? FOR UPDATE", [ordenId]);
    const [plazos] = await conn.query("SELECT tipo, vence_en, estado FROM plazo WHERE id = ? FOR UPDATE", [id]);
    const plazo = plazos[0];
    if (!ordenes[0] || !plazo || plazo.estado !== "PENDIENTE" || new Date(plazo.vence_en).getTime() > Date.now()) return false;

    if (plazo.tipo === "CIERRE_AUTOMATICO") {
      const resultado = await cerrarAutomaticamente(conn, ordenId, id);
      if (!resultado.procesada) {
        await conn.query(
          "UPDATE plazo SET estado = 'CANCELADO' WHERE id = ? AND estado = 'PENDIENTE'",
          [id],
        );
      }
      return resultado.procesada;
    }

    if (plazo.tipo === "RECORDATORIO" && ordenes[0].estado === "RESUELTA") {
      const [confirmaciones] = await conn.query(
        `SELECT id, ciclo, solicitada_a_subject, vence_en
           FROM confirmacion_cierre
          WHERE orden_id = ? AND respuesta IS NULL AND vence_en > ?
          ORDER BY ciclo DESC LIMIT 1 FOR UPDATE`,
        [ordenId, plazo.vence_en],
      );
      const confirmacion = confirmaciones[0];
      if (confirmacion) {
        await encolarNotificacion(conn, {
          destinatario: confirmacion.solicitada_a_subject,
          plantilla: "RECORDATORIO_CONFIRMACION",
          carga: { ordenId, ciclo: confirmacion.ciclo, venceEn: confirmacion.vence_en },
        });
        await conn.query(
          "UPDATE plazo SET estado = 'PROCESADO', procesado_en = UTC_TIMESTAMP(3) WHERE id = ? AND estado = 'PENDIENTE'",
          [id],
        );
        return true;
      }
    }

    await conn.query("UPDATE plazo SET estado = 'CANCELADO' WHERE id = ? AND estado = 'PENDIENTE'", [id]);
    return false;
  });
}

export async function procesarPlazosVencidos({ limite = 50 } = {}) {
  const [filas] = await pool.query(
    `SELECT id FROM plazo
      WHERE estado = 'PENDIENTE' AND vence_en <= UTC_TIMESTAMP(3)
      ORDER BY vence_en LIMIT ?`,
    [limite],
  );
  let procesados = 0;
  for (const fila of filas) if (await procesarUnPlazo(fila.id)) procesados += 1;
  return { encontrados: filas.length, procesados };
}

export async function procesarEntregasPendientes({ limite = 50 } = {}) {
  const [filas] = await pool.query(
    `SELECT id FROM entrega_notificacion
      WHERE estado IN ('PENDIENTE', 'FALLIDA')
      ORDER BY creada_en LIMIT ?`,
    [limite],
  );
  let entregadas = 0;
  let fallidas = 0;
  for (const { id } of filas) {
    const resultado = await conTransaccion(async (conn) => {
      const [mensajes] = await conn.query("SELECT * FROM entrega_notificacion WHERE id = ? FOR UPDATE", [id]);
      const mensaje = mensajes[0];
      if (!mensaje || !["PENDIENTE", "FALLIDA"].includes(mensaje.estado)) return null;
      const carga = typeof mensaje.carga === "string" ? JSON.parse(mensaje.carga || "{}") : (mensaje.carga ?? {});
      try {
        await enviar(mensaje.destinatario_subject, mensaje.plantilla, { ...carga, notificacionId: id });
        await conn.query(
          `UPDATE entrega_notificacion SET estado = 'ENTREGADA', intentos = intentos + 1,
                  entregada_en = UTC_TIMESTAMP(3) WHERE id = ?`,
          [id],
        );
        return "ENTREGADA";
      } catch (err) {
        await conn.query("UPDATE entrega_notificacion SET estado = 'FALLIDA', intentos = intentos + 1 WHERE id = ?", [id]);
        console.warn(`[planificador] notificación ${id} falló: ${err.message}`);
        return "FALLIDA";
      }
    });
    if (resultado === "ENTREGADA") entregadas += 1;
    if (resultado === "FALLIDA") fallidas += 1;
  }
  return { encontrados: filas.length, entregadas, fallidas };
}

export async function limpiarAdjuntosNoVinculados({ limite = 50 } = {}) {
  const [filas] = await pool.query(
    `SELECT id FROM adjunto
      WHERE solicitud_id IS NULL AND evidencia_id IS NULL
        AND creada_en <= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR
      ORDER BY creada_en LIMIT ?`,
    [limite],
  );
  let eliminados = 0;
  for (const { id } of filas) {
    const eliminado = await conTransaccion(async (conn) => {
      const [adjuntos] = await conn.query(
        `SELECT ruta_almacen FROM adjunto
          WHERE id = ? AND solicitud_id IS NULL AND evidencia_id IS NULL
            AND creada_en <= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR
          FOR UPDATE`,
        [id],
      );
      const adjunto = adjuntos[0];
      if (!adjunto) return false;
      const ruta = path.resolve(config.almacenAdjuntos, path.basename(adjunto.ruta_almacen));
      await rm(ruta, { force: true });
      await conn.query("DELETE FROM adjunto WHERE id = ?", [id]);
      return true;
    });
    if (eliminado) eliminados += 1;
  }
  return { encontrados: filas.length, eliminados };
}

async function ejecutarCiclo() {
  try {
    await procesarPlazosVencidos();
    await procesarEntregasPendientes();
    await limpiarAdjuntosNoVinculados();
  } catch (err) {
    console.error("[planificador] error:", err);
  }
}

export function iniciarPlanificador({ intervaloMs = 30_000 } = {}) {
  if (temporizador) return;
  void ejecutarCiclo();
  temporizador = setInterval(() => { void ejecutarCiclo(); }, intervaloMs);
  console.log(`[planificador] iniciado (cada ${intervaloMs / 1000}s)`);
}

export function detenerPlanificador() {
  clearInterval(temporizador);
  temporizador = null;
}
