// Reglas de negocio versionadas: cada cambio agrega una versión y conserva la anterior.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../../compartido/db.js";
import { ErrorApp, conflictoVersion } from "../../compartido/errores.js";
import { registrarAuditoria } from "../auditoria/index.js";

const valoresPermitidos = new Set([
  "niveles_urgencia", "categorias_mantenimiento", "matriz_evidencia",
  "plazo_cierre_horas", "recordatorios_horas", "ventana_reapertura_horas",
  "ventana_duplicados_horas", "alerta_sin_atencion_horas",
]);

export async function obtenerRegla(clave) {
  const [filas] = await pool.query(
    "SELECT version, valor FROM regla_politica WHERE clave = ? AND vigente = TRUE ORDER BY version DESC LIMIT 1",
    [clave],
  );
  return filas[0] ?? null;
}

export async function obtenerReglaConConexion(conn, clave) {
  const [filas] = await conn.query(
    "SELECT version, valor FROM regla_politica WHERE clave = ? AND vigente = TRUE ORDER BY version DESC LIMIT 1 FOR UPDATE",
    [clave],
  );
  return filas[0] ?? null;
}

export async function listarReglas() {
  const [filas] = await pool.query("SELECT clave, version, valor FROM regla_politica WHERE vigente = TRUE ORDER BY clave");
  return filas;
}

function validarValor(clave, valor) {
  if (!valoresPermitidos.has(clave)) throw new ErrorApp(404, "REGLA_DESCONOCIDA", "La regla no existe o no puede modificarse");
  if (clave === "niveles_urgencia") {
    if (!Array.isArray(valor) || !valor.length || valor.some((v) => typeof v !== "string" || !v.trim()) || new Set(valor).size !== valor.length) {
      throw new ErrorApp(400, "REGLA_INVALIDA", "Los niveles deben ser una lista de nombres únicos");
    }
  } else if (clave === "categorias_mantenimiento") {
    const resultado = z.array(z.object({ codigo: z.string().trim().min(1).max(64), nombre: z.string().trim().min(1).max(100) })).min(1).safeParse(valor);
    if (!resultado.success || new Set(valor.map((c) => c.codigo)).size !== valor.length) {
      throw new ErrorApp(400, "REGLA_INVALIDA", "Las categorías requieren códigos y nombres únicos y válidos");
    }
  } else if (clave === "matriz_evidencia") {
    if (!valor || typeof valor !== "object" || Array.isArray(valor) || Object.keys(valor).length === 0 ||
        Object.entries(valor).some(([transicion, requerido]) => !/^[A-Z_]+->[A-Z_]+$/.test(transicion) || !["si", "no", "opcional"].includes(requerido))) {
      throw new ErrorApp(400, "REGLA_INVALIDA", "La matriz debe asignar si, no u opcional a transiciones válidas");
    }
  } else if (clave === "recordatorios_horas") {
    if (!Array.isArray(valor) || valor.some((v) => !Number.isFinite(Number(v)) || Number(v) <= 0) ||
        valor.some((v, i) => i > 0 && Number(v) <= Number(valor[i - 1]))) {
      throw new ErrorApp(400, "REGLA_INVALIDA", "Los recordatorios deben ser horas positivas y ordenadas");
    }
  } else {
    const horas = Number(valor?.horas);
    if (!Number.isFinite(horas) || horas <= 0 || horas > 24 * 365) {
      throw new ErrorApp(400, "REGLA_INVALIDA", "Las horas deben ser un número positivo menor a un año");
    }
  }
}

export async function actualizarRegla(conn, { clave, valor, versionVista, actor }) {
  validarValor(clave, valor);
  if (!Number.isInteger(versionVista) || versionVista < 1) throw new ErrorApp(400, "VERSION_REQUERIDA", "Indica la versión de la regla que estás editando");
  const actual = await obtenerReglaConConexion(conn, clave);
  if (!actual) throw new ErrorApp(404, "REGLA_DESCONOCIDA", "No se encontró una versión vigente de la regla");
  if (actual.version !== versionVista) throw conflictoVersion();

  const plazoCierre = clave === "plazo_cierre_horas" ? Number(valor.horas) :
    Number((await obtenerReglaConConexion(conn, "plazo_cierre_horas"))?.valor?.horas);
  const recordatorios = clave === "recordatorios_horas" ? valor.map(Number) :
    (await obtenerReglaConConexion(conn, "recordatorios_horas"))?.valor;
  if (Array.isArray(recordatorios) && recordatorios.some((hora) => Number(hora) >= plazoCierre)) {
    throw new ErrorApp(400, "REGLA_INVALIDA", "Cada recordatorio debe ocurrir antes del cierre automático");
  }

  const nuevaVersion = actual.version + 1;
  await conn.query("UPDATE regla_politica SET vigente = FALSE WHERE clave = ? AND vigente = TRUE", [clave]);
  await conn.query(
    "INSERT INTO regla_politica (id, clave, version, valor, vigente) VALUES (?, ?, ?, ?, TRUE)",
    [randomUUID(), clave, nuevaVersion, JSON.stringify(valor)],
  );
  await registrarAuditoria(conn, {
    entidad: "regla", entidadId: randomUUID(), accion: "REGLA_ACTUALIZADA",
    actor, detalle: { clave, versionAnterior: actual.version, versionNueva: nuevaVersion, valor },
  });
  return { clave, version: nuevaVersion, valor };
}
