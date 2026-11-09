// Apoyo para las pruebas de integración (Fase 2/3, Evaluación 3).
// Levanta la API real (crearApp) en un puerto libre y la llama por HTTP, contra la base MySQL configurada en .env.
// No borra datos: cada prueba crea sus propias solicitudes y órdenes, así se puede repetir sobre la misma base.
import { randomUUID } from "node:crypto";
import { crearApp } from "../src/app.js";
import { pool } from "../src/compartido/db.js";

// Actores del pack DH-02 (ver docs/pack-dh02.md y db/seed.sql)
export const ACTOR = {
  estudiante: "HU-STU-2001",   // solicitante / afectado
  coordinador: "HU-EMP-2201",  // coordinación (alcance MAIN)
  supervisor: "HU-EMP-2202",   // supervisión (alcance MAIN)
  tecnico: "TECH-001",         // técnico eléctrico, disponible
  otroTecnico: "TECH-002",     // técnico sin relación con la orden
  tercerTecnico: "TECH-003",
};
export const UBICACION = "MAIN-B01-101";

let servidor;
let base;

export async function iniciarApi() {
  servidor = crearApp().listen(0);
  await new Promise((ok) => servidor.once("listening", ok));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
}

export async function detenerApi() {
  await new Promise((ok) => servidor.close(ok));
  await pool.end();
}

/** Llama a la API como `subject`. Los comandos (POST/PUT) llevan siempre Idempotency-Key. */
export async function api(subject, metodo, ruta, cuerpo, { clave } = {}) {
  const headers = { "content-type": "application/json", "x-subject": subject };
  if (metodo !== "GET") headers["idempotency-key"] = clave ?? randomUUID();
  const res = await fetch(base + ruta, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const texto = await res.text();
  return { estado: res.status, cuerpo: texto ? JSON.parse(texto) : null };
}

export async function contarAuditoria(entidadId) {
  const [filas] = await pool.query("SELECT COUNT(*) AS n FROM auditoria WHERE entidad_id = ?", [entidadId]);
  return Number(filas[0].n);
}

export async function versionOrden(ordenId) {
  const [filas] = await pool.query("SELECT version, estado FROM orden_trabajo WHERE id = ?", [ordenId]);
  return filas[0];
}

/** Lleva una solicitud nueva hasta una orden ASIGNADA y devuelve sus ids. */
export async function prepararOrdenAsignada(etiqueta, responsable = ACTOR.tecnico) {
  const sol = await api(ACTOR.estudiante, "POST", "/solicitudes", {
    ubicacionCodigo: UBICACION, categoria: "ELECTRICAL",
    descripcion: `[integración] ${etiqueta} ${randomUUID().slice(0, 8)}`, urgenciaSugerida: "Alta",
  });
  if (sol.estado !== 201) throw new Error(`crear solicitud: ${JSON.stringify(sol)}`);
  const val = await api(ACTOR.coordinador, "POST", `/solicitudes/${sol.cuerpo.id}/validar`, {
    urgenciaValidada: "Alta", versionVista: sol.cuerpo.version,
  });
  if (val.estado !== 200) throw new Error(`validar: ${JSON.stringify(val)}`);
  const orden = await api(ACTOR.coordinador, "POST", "/ordenes", {
    solicitudId: sol.cuerpo.id, responsableSubject: responsable, versionVista: val.cuerpo.version,
  });
  if (orden.estado !== 201) throw new Error(`crear orden: ${JSON.stringify(orden)}`);
  return { solicitudId: sol.cuerpo.id, ordenId: orden.cuerpo.id, version: orden.cuerpo.version };
}

/** Avanza una orden ASIGNADA hasta RESUELTA con evidencia y devuelve la versión final. */
export async function llevarAResuelta(ordenId, version, responsable = ACTOR.tecnico) {
  const inicio = await api(responsable, "POST", `/ejecucion/${ordenId}/evidencias`, {
    tipo: "observacion", resumen: "Llegué al sitio e inicio el trabajo", hacia: "EN_PROGRESO", versionVista: version,
  });
  if (inicio.estado !== 201) throw new Error(`iniciar: ${JSON.stringify(inicio)}`);
  const fin = await api(responsable, "POST", `/ejecucion/${ordenId}/evidencias`, {
    tipo: "observacion", resumen: "Se reemplazó el tomacorriente; funciona", hacia: "RESUELTA",
    versionVista: inicio.cuerpo.transicion.version,
  });
  if (fin.estado !== 201) throw new Error(`resolver: ${JSON.stringify(fin)}`);
  return fin.cuerpo.transicion.version;
}
