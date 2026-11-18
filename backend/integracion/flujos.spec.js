// Pruebas de integración de la Evaluación 3 (Fase 2: integración · Fase 3: validación).
// Se ejecutan contra la API real y MySQL real:  npm run test:integracion
// Cada prueba indica el requisito / escenario de calidad del documento de diseño (docs/eva2final.md) que verifica.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/compartido/db.js";
import { simulacion } from "../src/adaptadores/notificacion.js";
import { procesarEntregasPendientes, procesarPlazosVencidos } from "../src/planificador/index.js";
import {
  ACTOR, UBICACION, api, contarAuditoria, detenerApi, iniciarApi, llevarAResuelta, prepararOrdenAsignada, versionOrden,
} from "./apoyo.js";

before(iniciarApi);
after(detenerApi);

const enUnaHora = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

test("E2E · RF-01→RF-09: reporte → triage → orden → ejecución → bloqueo → resolución → cierre confirmado", async () => {
  // 1. RF-01: el estudiante reporta el daño
  const sol = await api(ACTOR.estudiante, "POST", "/solicitudes", {
    ubicacionCodigo: UBICACION, categoria: "ELECTRICAL",
    descripcion: `[integración] E2E tomacorriente quemado ${randomUUID().slice(0, 8)}`, urgenciaSugerida: "Alta",
  });
  assert.equal(sol.estado, 201);
  assert.equal(sol.cuerpo.estado, "EN_REVISION");
  assert.equal(sol.cuerpo.ubicacionVerificada, true);

  // 2. RF-05 (BR-03): no se puede crear orden sobre una solicitud aún no validada
  const prematura = await api(ACTOR.coordinador, "POST", "/ordenes", {
    solicitudId: sol.cuerpo.id, responsableSubject: ACTOR.tecnico, versionVista: sol.cuerpo.version,
  });
  assert.equal(prematura.estado, 422);
  assert.equal(prematura.cuerpo.codigo, "SOLICITUD_NO_VALIDADA");

  // 3. RF-03: coordinación valida y fija la urgencia
  const val = await api(ACTOR.coordinador, "POST", `/solicitudes/${sol.cuerpo.id}/validar`, {
    urgenciaValidada: "Alta", versionVista: sol.cuerpo.version,
  });
  assert.equal(val.estado, 200);
  assert.equal(val.cuerpo.estado, "VALIDADA");

  // 4. RF-05 (BR-04): orden con responsable explícito
  const orden = await api(ACTOR.coordinador, "POST", "/ordenes", {
    solicitudId: sol.cuerpo.id, responsableSubject: ACTOR.tecnico, versionVista: val.cuerpo.version,
  });
  assert.equal(orden.estado, 201);
  assert.equal(orden.cuerpo.estado, "ASIGNADA");
  const ordenId = orden.cuerpo.id;

  // 5. RF-06: el técnico ve la orden en su bandeja
  const bandeja = await api(ACTOR.tecnico, "GET", "/ordenes");
  assert.ok(bandeja.cuerpo.some((o) => o.id === ordenId));

  // 6. RF-07 (BR-05): iniciar sin evidencia se rechaza
  const sinEvidencia = await api(ACTOR.tecnico, "POST", `/ordenes/${ordenId}/transiciones`, {
    hacia: "EN_PROGRESO", versionVista: orden.cuerpo.version,
  });
  assert.equal(sinEvidencia.estado, 422);

  // 7. RF-07: iniciar con evidencia
  const inicio = await api(ACTOR.tecnico, "POST", `/ejecucion/${ordenId}/evidencias`, {
    tipo: "observacion", resumen: "Inspección inicial", hacia: "EN_PROGRESO", versionVista: orden.cuerpo.version,
  });
  assert.equal(inicio.estado, 201);
  assert.equal(inicio.cuerpo.transicion.estado, "EN_PROGRESO");

  // 8. Bloqueo por materiales con causal, responsable y seguimiento
  const bloqueo = await api(ACTOR.tecnico, "POST", `/ejecucion/${ordenId}/bloqueos`, {
    causal: "MATERIALES", parteResponsable: "Almacén", siguienteAccion: "Solicitar tomacorriente 20A",
    seguimientoEn: enUnaHora(), resumen: "No hay repuesto en el carro", versionVista: inicio.cuerpo.transicion.version,
  });
  assert.equal(bloqueo.estado, 201);
  assert.equal(bloqueo.cuerpo.estado, "BLOQUEADA_MATERIALES");

  // 9. Desbloqueo (evidencia opcional) y resolución con evidencia
  const reanudar = await api(ACTOR.tecnico, "POST", `/ordenes/${ordenId}/transiciones`, {
    hacia: "EN_PROGRESO", versionVista: bloqueo.cuerpo.version,
  });
  assert.equal(reanudar.estado, 200);
  const resuelta = await api(ACTOR.tecnico, "POST", `/ejecucion/${ordenId}/evidencias`, {
    tipo: "observacion", resumen: "Repuesto instalado y probado", hacia: "RESUELTA", versionVista: reanudar.cuerpo.version,
  });
  assert.equal(resuelta.cuerpo.transicion.estado, "RESUELTA");

  // 10. RF-09 (BR-07): el técnico NO puede cerrar; solo el afectado confirma
  const cierreTecnico = await api(ACTOR.tecnico, "POST", `/notificaciones/ordenes/${ordenId}/confirmar-cierre`, {
    versionVista: resuelta.cuerpo.transicion.version,
  });
  assert.equal(cierreTecnico.estado, 403);
  const pendientes = await api(ACTOR.estudiante, "GET", "/notificaciones/pendientes");
  assert.ok(pendientes.cuerpo.some((p) => p.ordenId === ordenId));
  const cierre = await api(ACTOR.estudiante, "POST", `/notificaciones/ordenes/${ordenId}/confirmar-cierre`, {
    versionVista: resuelta.cuerpo.transicion.version,
  });
  assert.equal(cierre.estado, 200);
  assert.equal((await versionOrden(ordenId)).estado, "CERRADA");

  // 11. RF-11: el historial reconstruye cada paso con su actor
  const historial = await api(ACTOR.estudiante, "GET", `/ordenes/${ordenId}/historial`);
  const pasos = historial.cuerpo.filter((e) => e.estadoHasta).map((e) => `${e.estadoHasta}:${e.actor}`);
  assert.deepEqual(pasos, [
    `ASIGNADA:${ACTOR.coordinador}`,
    `EN_PROGRESO:${ACTOR.tecnico}`,
    `BLOQUEADA_MATERIALES:${ACTOR.tecnico}`,
    `EN_PROGRESO:${ACTOR.tecnico}`,
    `RESUELTA:${ACTOR.tecnico}`,
    `CERRADA:${ACTOR.estudiante}`,
  ]);
});

test("RF-09 · el afectado rechaza el cierre y la orden vuelve a EN_PROGRESO", async () => {
  const { ordenId, version } = await prepararOrdenAsignada("rechazo de cierre");
  const v = await llevarAResuelta(ordenId, version);
  const rechazo = await api(ACTOR.estudiante, "POST", `/notificaciones/ordenes/${ordenId}/rechazar-cierre`, {
    versionVista: v, motivo: "El tomacorriente sigue sin funcionar",
  });
  assert.equal(rechazo.estado, 200);
  assert.equal((await versionOrden(ordenId)).estado, "EN_PROGRESO");
  const [plazos] = await pool.query("SELECT COUNT(*) AS n FROM plazo WHERE orden_id = ? AND estado = 'PENDIENTE'", [ordenId]);
  assert.equal(Number(plazos[0].n), 0, "los plazos de cierre automático se cancelan");
});

test("QS-01 / RF-08 · dos reasignaciones simultáneas con la misma versión: una gana, la otra recibe 409", async () => {
  const { ordenId, version } = await prepararOrdenAsignada("concurrencia");
  const [a, b] = await Promise.all([
    api(ACTOR.supervisor, "POST", `/ordenes/${ordenId}/reasignaciones`, {
      responsableSubject: ACTOR.otroTecnico, versionVista: version, motivo: "Especialidad plomería",
    }),
    api(ACTOR.supervisor, "POST", `/ordenes/${ordenId}/reasignaciones`, {
      responsableSubject: ACTOR.tercerTecnico, versionVista: version, motivo: "Especialidad HVAC",
    }),
  ]);
  const estados = [a.estado, b.estado].sort();
  assert.deepEqual(estados, [200, 409]);
  const perdedor = a.estado === 409 ? a : b;
  assert.equal(perdedor.cuerpo.codigo, "CONFLICTO_VERSION");

  // Invariante BR-04: exactamente un responsable vigente, y es el del ganador
  const ganador = a.estado === 200 ? ACTOR.otroTecnico : ACTOR.tercerTecnico;
  const [filas] = await pool.query("SELECT responsable_subject, version FROM orden_trabajo WHERE id = ?", [ordenId]);
  assert.equal(filas[0].responsable_subject, ganador);
  assert.equal(filas[0].version, version + 1);
});

test("QS-04 / RF-13 · acciones no autorizadas devuelven 403 y no escriben nada", async () => {
  const { solicitudId, ordenId, version } = await prepararOrdenAsignada("no autorizado");
  const auditoriaOrden = await contarAuditoria(ordenId);
  const auditoriaSolicitud = await contarAuditoria(solicitudId);

  // Un técnico sin relación con la orden intenta iniciarla
  const ajeno = await api(ACTOR.otroTecnico, "POST", `/ejecucion/${ordenId}/evidencias`, {
    resumen: "intento", hacia: "EN_PROGRESO", versionVista: version,
  });
  assert.equal(ajeno.estado, 403);
  // Un estudiante intenta reasignar (solo supervisión)
  const estudiante = await api(ACTOR.estudiante, "POST", `/ordenes/${ordenId}/reasignaciones`, {
    responsableSubject: ACTOR.otroTecnico, versionVista: version, motivo: "quiero otro",
  });
  assert.equal(estudiante.estado, 403);
  // Un técnico intenta validar una solicitud (solo coordinación)
  const triage = await api(ACTOR.tecnico, "POST", `/solicitudes/${solicitudId}/rechazar`, {
    motivo: "FUERA_DE_ALCANCE", versionVista: 1,
  });
  assert.equal(triage.estado, 403);
  // Sin identidad
  const anonimo = await api("NADIE", "GET", "/solicitudes");
  assert.equal(anonimo.estado, 401);

  assert.equal(await contarAuditoria(ordenId), auditoriaOrden, "sin escrituras en la auditoría de la orden");
  assert.equal(await contarAuditoria(solicitudId), auditoriaSolicitud, "sin escrituras en la auditoría de la solicitud");
  assert.equal((await versionOrden(ordenId)).version, version, "la orden no cambió");
});

test("QS-02 · carrera entre confirmación tardía y cierre automático: un solo cierre, una sola auditoría", async () => {
  const { ordenId, version } = await prepararOrdenAsignada("cierre automático");
  const v = await llevarAResuelta(ordenId, version);

  // Simula que pasaron las 72 h: vence la confirmación y el plazo de cierre automático
  await pool.query("UPDATE confirmacion_cierre SET vence_en = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE orden_id = ?", [ordenId]);
  await pool.query(
    "UPDATE plazo SET vence_en = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE orden_id = ? AND tipo = 'CIERRE_AUTOMATICO'",
    [ordenId],
  );

  const [confirmacion] = await Promise.all([
    api(ACTOR.estudiante, "POST", `/notificaciones/ordenes/${ordenId}/confirmar-cierre`, { versionVista: v }),
    procesarPlazosVencidos(),
  ]);
  assert.notEqual(confirmacion.estado, 200, "una confirmación vencida no puede ganar");

  const [orden] = await pool.query("SELECT estado, tipo_cierre FROM orden_trabajo WHERE id = ?", [ordenId]);
  assert.equal(orden[0].estado, "CERRADA");
  assert.equal(orden[0].tipo_cierre, "AUTOMATICO");
  const [cierres] = await pool.query(
    "SELECT COUNT(*) AS n FROM auditoria WHERE entidad_id = ? AND estado_hasta = 'CERRADA'", [ordenId],
  );
  assert.equal(Number(cierres[0].n), 1);

  // Volver a correr el planificador no cierra dos veces
  await procesarPlazosVencidos();
  const [otra] = await pool.query(
    "SELECT COUNT(*) AS n FROM auditoria WHERE entidad_id = ? AND estado_hasta = 'CERRADA'", [ordenId],
  );
  assert.equal(Number(otra[0].n), 1);
});

test("QS-06 · reenviar 3 veces el mismo comando produce un solo cambio y una sola auditoría", async () => {
  const { ordenId, version } = await prepararOrdenAsignada("idempotencia");
  const clave = randomUUID();
  const cuerpo = { tipo: "observacion", resumen: "Inicio (red inestable)", hacia: "EN_PROGRESO", versionVista: version };
  const respuestas = [];
  for (let i = 0; i < 3; i += 1) respuestas.push(await api(ACTOR.tecnico, "POST", `/ejecucion/${ordenId}/evidencias`, cuerpo, { clave }));

  assert.ok(respuestas.every((r) => r.estado === 201));
  assert.ok(respuestas.every((r) => r.cuerpo.evidenciaId === respuestas[0].cuerpo.evidenciaId), "misma respuesta");
  const [cambios] = await pool.query(
    "SELECT COUNT(*) AS n FROM auditoria WHERE entidad_id = ? AND estado_hasta = 'EN_PROGRESO'", [ordenId],
  );
  assert.equal(Number(cambios[0].n), 1);
  const [evidencias] = await pool.query("SELECT COUNT(*) AS n FROM evidencia WHERE orden_id = ?", [ordenId]);
  assert.equal(Number(evidencias[0].n), 1);

  // Misma clave con otro contenido: se rechaza en vez de ejecutarse
  const reutilizada = await api(ACTOR.tecnico, "POST", `/ejecucion/${ordenId}/evidencias`, { ...cuerpo, resumen: "otro" }, { clave });
  assert.equal(reutilizada.estado, 409);
});

test("QS-07 · con el servicio de notificación caído el cambio se confirma y la notificación se entrega después, una vez", async () => {
  simulacion.caido = true;
  let ordenId;
  try {
    ({ ordenId } = await prepararOrdenAsignada("notificación caída"));
    assert.equal((await versionOrden(ordenId)).estado, "ASIGNADA", "el negocio no depende del proveedor");
    const caido = await procesarEntregasPendientes({ limite: 500 });
    assert.ok(caido.fallidas > 0);
  } finally {
    simulacion.caido = false;
  }
  const [antes] = await pool.query(
    `SELECT COUNT(*) AS n FROM entrega_notificacion
      WHERE estado = 'FALLIDA' AND JSON_UNQUOTE(JSON_EXTRACT(carga, '$.ordenId')) = ?`, [ordenId],
  );
  assert.ok(Number(antes[0].n) > 0, "la notificación quedó persistida en la cola (sobrevive a un reinicio)");

  await procesarEntregasPendientes({ limite: 500 });
  const [despues] = await pool.query(
    `SELECT estado, COUNT(*) AS n FROM entrega_notificacion
      WHERE JSON_UNQUOTE(JSON_EXTRACT(carga, '$.ordenId')) = ? GROUP BY estado`, [ordenId],
  );
  assert.deepEqual(despues.map((f) => f.estado), ["ENTREGADA"]);
  const segunda = await procesarEntregasPendientes({ limite: 500 });
  assert.equal(segunda.encontrados, 0, "no se reenvía lo ya entregado");
});

test("BR-12 · la auditoría es de solo anexado: la base rechaza modificarla", async () => {
  const { ordenId } = await prepararOrdenAsignada("auditoría inmutable");
  await assert.rejects(pool.query("UPDATE auditoria SET actor_subject = 'X' WHERE entidad_id = ?", [ordenId]));
  await assert.rejects(pool.query("DELETE FROM auditoria WHERE entidad_id = ?", [ordenId]));
});

test("QS-05 / E2-ADR-006 · cambiar la matriz de evidencia por configuración cambia el comportamiento sin tocar código", async () => {
  const actual = (await api(ACTOR.supervisor, "GET", "/politicas")).cuerpo.find((r) => r.clave === "matriz_evidencia");
  const valorOriginal = typeof actual.valor === "string" ? JSON.parse(actual.valor) : actual.valor;
  // Solo supervisión puede cambiar reglas
  const coord = await api(ACTOR.coordinador, "PUT", "/politicas/matriz_evidencia", { valor: valorOriginal, versionVista: actual.version });
  assert.equal(coord.estado, 403);

  const nueva = await api(ACTOR.supervisor, "PUT", "/politicas/matriz_evidencia", {
    valor: { ...valorOriginal, "ASIGNADA->EN_PROGRESO": "opcional" }, versionVista: actual.version,
  });
  assert.equal(nueva.estado, 200);
  try {
    const { ordenId, version } = await prepararOrdenAsignada("regla configurable");
    const sinEvidencia = await api(ACTOR.tecnico, "POST", `/ordenes/${ordenId}/transiciones`, { hacia: "EN_PROGRESO", versionVista: version });
    assert.equal(sinEvidencia.estado, 200, "con la versión nueva de la regla, iniciar ya no exige evidencia");
  } finally {
    // Restaura la regla (queda una versión nueva con el valor original; las versiones anteriores se conservan)
    const restaurada = await api(ACTOR.supervisor, "PUT", "/politicas/matriz_evidencia", { valor: valorOriginal, versionVista: nueva.cuerpo.version });
    assert.equal(restaurada.estado, 200);
  }
  const { ordenId, version } = await prepararOrdenAsignada("regla restaurada");
  const otraVez = await api(ACTOR.tecnico, "POST", `/ordenes/${ordenId}/transiciones`, { hacia: "EN_PROGRESO", versionVista: version });
  assert.equal(otraVez.estado, 422);
  assert.equal(otraVez.cuerpo.codigo, "EVIDENCIA_REQUERIDA");
});
