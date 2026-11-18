# Evaluación 3 · Trazabilidad

Cadena: **requisito / driver → decisión → componente → implementación → prueba → estado**.
Las rutas son relativas a `backend/`. Pruebas de integración: `integracion/flujos.spec.js` (contra MySQL real). Pruebas unitarias: `test/`.

## 1. Requisitos funcionales

| Requisito | Decisión | Módulo | Implementación | Prueba | Estado |
|---|---|---|---|---|---|
| RF-01 Registrar solicitud | E2-ADR-008, E3-ADR-006 | solicitudes-triage, archivos-adjuntos | `servicio.js · crearSolicitud`; `POST /api/solicitudes`; `POST /api/adjuntos` | E2E (paso 1) | VERIFICADO |
| RF-02 Consultar estado y notificaciones | E2-ADR-005 | solicitudes-triage, notificaciones-plazos | `listarSolicitudes`; `GET /api/notificaciones` | Manual (pantalla Solicitante) | IMPLEMENTADO |
| RF-03 Triage: validar / rechazar | E2-ADR-003, E2-ADR-006 | solicitudes-triage | `validarSolicitud`, `rechazarSolicitud` | E2E (paso 3); QS-04 (técnico → 403) | VERIFICADO |
| RF-04 Duplicados | E2-ADR-006 (ventana 24 h configurable) | solicitudes-triage | `buscarDuplicados`, `vincularDuplicado` | Manual (`docs/fase-1.md`) | IMPLEMENTADO |
| RF-05 Orden con responsable explícito | E2-ADR-002, BR-03, BR-04 | ordenes-trabajo | `crearOrden`; `responsable_subject NOT NULL` | E2E (pasos 2 y 4: `422` sin validar, `201` validada) | VERIFICADO |
| RF-06 Bandeja del técnico | E2-ADR-007 | ordenes-trabajo | `listarOrdenesTecnico` (filtra por subject en servidor) | E2E (paso 5) | VERIFICADO |
| RF-07 Transiciones con evidencia; bloqueos con causal | E2-ADR-002, E3-ADR-002 | ordenes-trabajo, ejecucion-evidencia | `transiciones.js`; `solicitarTransicion`; `registrarEvidencia`; `registrarBloqueo` | E2E (pasos 6–9); `test/transiciones.test.js` | VERIFICADO |
| RF-08 Transferir / reasignar | E2-ADR-003, E3-ADR-001 | ordenes-trabajo | `transferirOrden` | QS-01 | VERIFICADO |
| RF-09 Cierre en dos fases + automático | E2-ADR-005, E3-ADR-003 | ordenes-trabajo, notificaciones-plazos, planificador | `confirmarCierre`, `rechazarCierre`, `cerrarAutomaticamente`, `programarPlazos` | E2E (paso 10); “rechaza el cierre”; QS-02 | VERIFICADO |
| RF-10 Reabrir | E2-ADR-004 | ordenes-trabajo | `reabrirOrden` (nueva solicitud con `reabre_orden_id`) | Manual (`docs/fase-1.md`) | IMPLEMENTADO |
| RF-11 Historial inmutable | E2-ADR-004 | auditoria | `registrarAuditoria`; triggers en `db/schema.sql` | E2E (paso 11: historial con actor); BR-12 | VERIFICADO |
| RF-12 Tablero | — | reportes-tablero | `servicio.js` (sin atención, bloqueos, carga, ubicaciones) | Manual (pantalla Supervisor) | IMPLEMENTADO |
| RF-13 Identidad y autorización | E2-ADR-007 | identidad-acceso | `autenticacion.js`, `autorizacion-recursos.js` | QS-04; `test/autorizacion-recursos.test.js` | VERIFICADO |

## 2. Escenarios de calidad (drivers)

| Driver / QS | Decisión | Mecanismo en el código | Prueba | Resultado |
|---|---|---|---|---|
| QS-01 Concurrencia en asignación | E2-ADR-003 → E3-ADR-001 | `FOR UPDATE` + `version` en `transferirOrden` | `QS-01 / RF-08 · dos reasignaciones simultáneas` | `[200, 409]`, un responsable, `version + 1` |
| QS-02 Carrera de cierre | E2-ADR-005 → E3-ADR-003 | `procesarUnPlazo` + `cargarCierrePendiente` (`409 CONFIRMACION_VENCIDA`) | `QS-02 · carrera entre confirmación tardía y cierre automático` | 1 cierre `AUTOMATICO`, 1 auditoría |
| QS-03 Auditabilidad | E2-ADR-004 | `registrarAuditoria` en cada comando; triggers | E2E paso 11 + `BR-12` | Historial completo; `UPDATE/DELETE` rechazados |
| QS-04 Seguridad | E2-ADR-007 | `exigirRol` + `puedeAccederAOrden` / `puedeAdministrarSolicitud` | `QS-04 / RF-13 · acciones no autorizadas` | `403`/`401`, 0 escrituras |
| QS-05 Reglas modificables | E2-ADR-006 → E3-ADR-002 | `regla_politica` + `PUT /api/politicas/:clave` | `QS-05 / E2-ADR-006 · cambiar la matriz de evidencia` | Comportamiento cambia sin código; `403` a coordinación |
| QS-06 Reenvíos | E3-ADR-005 | `conIdempotencia` + `comando_procesado` | `QS-06 · reenviar 3 veces` + `test/idempotencia.test.js` | 1 cambio, 1 evidencia; clave reutilizada → `409` |
| QS-07 Notificación caída | E2-ADR-005 → E3-ADR-003 | `entrega_notificacion` + `procesarEntregasPendientes` | `QS-07 · servicio de notificación caído` | Estado confirmado; entrega única al volver |
| QS-10 Fronteras de módulos | E2-ADR-001 | `.dependency-cruiser.cjs` | `npm run deps:check` | 0 violaciones |

## 3. Riesgos de la Evaluación 1 → respuesta en el código

| Riesgo | Respuesta arquitectónica | Evidencia |
|---|---|---|
| RSK-01 Volatilidad de reglas | Reglas versionadas en BD (E3-ADR-002) | Prueba QS-05 |
| RSK-02 Concurrencia de estados | Comando atómico con versión y bloqueo (E3-ADR-001) + auditoría inmutable | Pruebas QS-01, QS-02, BR-12 |
