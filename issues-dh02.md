# Issues del Project DH-02

Cada bloque es un issue: el título va en **Title** y el resto en la descripción. Los requisitos (RF), reglas de negocio (BR) y escenarios de calidad (QS) son los de su documento de diseño.

## Cómo cargarlos en GitHub

**Etiquetas a crear** (*Issues → Labels → New label*): `persona-1`, `persona-2`, `persona-3`, `compartido`, `backend`, `frontend`, `base-de-datos`, `pruebas`, `poc`.

**Milestones** (*Issues → Milestones*): `Fase 0: base común`, `Fase 1: módulos`, `Fase 2: integración y PoC`.

**Convención:** un issue = una rama `feature/<numero>-<nombre-corto>` = un Pull Request que cierra el issue con `Closes #N`. Otro compañero revisa antes del merge (1 revisa a 2, 2 revisa a 3, 3 revisa a 1).

**Criterio general de "hecho"** (aplica a todos): corre `npm test` y `npm run deps:check` sin errores, hay al menos una prueba del comportamiento nuevo, y el cambio quedó auditado si modifica estado (BR-10).

---

# FASE 0: Base común

### [Base] Levantar el esqueleto y confirmar que funciona en las tres máquinas
**Etiquetas:** `compartido`, `backend` · **Milestone:** Fase 0 · **Asignado:** cada integrante lo verifica

El esqueleto ya está en la rama `feature/esqueleto-inicial`. Cada integrante debe clonarlo y levantarlo.

Para revisar herramientas y dependencias instaladas, cada integrante puede ejecutar `bash scripts/verificar-entorno.sh` desde Git Bash en la raíz del repositorio y adjuntar la salida al issue. El script es auxiliar; no reemplaza la verificación de levantar Docker, la API y el frontend.

**Criterios de aceptación**
- [ ] `docker compose up -d` crea la base con las tablas y datos semilla.
- [ ] `GET /api/salud` responde `{"estado":"ok","baseDatos":"ok"}`.
- [ ] `npm test` y `npm run deps:check` pasan.
- [ ] El frontend abre en `localhost:5173` y permite entrar como los 4 usuarios simulados.
- [ ] Cada integrante adjuntó la salida de `scripts/verificar-entorno.sh` y anotó cualquier problema específico de su máquina.
- [ ] Los problemas de instalación encontrados quedan anotados en el README.

---

### [Base] Definir los contratos entre módulos (`docs/contratos.md`)
**Etiquetas:** `compartido` · **Milestone:** Fase 0 · **Asignado:** los tres (sesión conjunta)

Antes de programar, acordar qué función expone cada módulo en su `index.js` y qué consumen los demás. Aquí se rompen las integraciones si no se define primero.

Borrador inicial: [`docs/contratos.md`](docs/contratos.md). Las casillas de aprobación deben quedar marcadas en ese documento únicamente después de revisar el PR en conjunto.

**Criterios de aceptación**
- [ ] Documento con la firma de cada función pública (nombre, parámetros, retorno, errores).
- [ ] Contratos mínimos acordados:
  - `ordenes-trabajo.solicitarTransicion(conn, {ordenId, hacia, actor, versionVista, evidenciaId?, motivo?})`
  - `notificaciones-plazos.encolarNotificacion(conn, {destinatario, plantilla, carga})`
  - `notificaciones-plazos.programarPlazos(conn, ordenId)` y `cancelarPlazos(conn, ordenId)`
  - `auditoria.registrarAuditoria(conn, {...})` (ya existe)
  - `reglas-politicas.obtenerRegla(clave)` (ya existe)
- [ ] Todas las funciones que escriben reciben la **conexión de la transacción** (`conn`) como primer parámetro, para que estado + auditoría + notificación se confirmen juntos (sección 6.11).
- [ ] Aprobado por los tres vía Pull Request.

---

### [Base] Cargar ubicaciones y personas reales del pack del profesor
**Etiquetas:** `persona-1`, `backend`, `base-de-datos` · **Milestone:** Fase 0 · **Asignado:** Persona 1

Reemplazar los datos ficticios de `adaptadores/ubicaciones.js` e `identidad.js` y de `seed.sql` por los del pack (secciones 5.12 y 6.6 del diseño).

**Criterios de aceptación**
- [ ] El directorio de ubicaciones refleja las del pack, incluyendo las inactivas.
- [ ] Los roles (`asignacion_rol`) y perfiles técnicos (`perfil_tecnico`) se cargan por configuración, según ASM-016 y ASM-019.
- [ ] Las irregularidades del pack (6.6) tienen el tratamiento documentado en el diseño.
- [ ] `docker compose down -v && docker compose up -d` recrea todo sin errores.

---

# FASE 1: Persona 1 · Entrada y control

### [P1] RF-13: Autorización por rol y por recurso
**Etiquetas:** `persona-1`, `backend`, `pruebas` · **Milestone:** Fase 1

Hoy solo existe `exigirRol`. Falta autorizar según la relación del usuario con la orden o solicitud (BR-12).

**Criterios de aceptación**
- [ ] El solicitante solo ve sus propias solicitudes; el técnico solo sus órdenes; el representante solo las de su edificio.
- [ ] El contratista no ve órdenes ajenas.
- [ ] La autorización se verifica en el servidor; ningún rol enviado por el navegador se acepta.
- [ ] Función reutilizable `puedeAccederAOrden(usuario, orden)` expuesta en `index.js`.
- [ ] Pruebas negativas por rol, alcance y relación con la orden (QS-04).

---

### [P1] RF-01: Registrar solicitud con ubicación, categoría y foto
**Etiquetas:** `persona-1`, `backend` · **Milestone:** Fase 1

`POST /api/solicitudes`

**Criterios de aceptación**
- [ ] Valida el cuerpo con zod: ubicación, categoría del catálogo, descripción, urgencia sugerida.
- [ ] Verifica la ubicación contra el directorio simulado y guarda copia en `ubicacion_snapshot`. Si el directorio no responde, registra con `ubicacion_verificada = false` (ASM-021).
- [ ] Permite adjuntar foto: archivo al almacén, metadatos en `adjunto`.
- [ ] El coordinador puede registrar a nombre de un tercero.
- [ ] La solicitud nace `EN_REVISION`, con auditoría y notificación al solicitante, **en una sola transacción**.

---

### [P1] RF-02: Consultar el estado de mis solicitudes
**Etiquetas:** `persona-1`, `backend` · **Milestone:** Fase 1

`GET /api/solicitudes` (y `/:id`)

**Criterios de aceptación**
- [ ] Lista las solicitudes del usuario con su estado actual y el de la orden asociada, si existe.
- [ ] Muestra tipo de cierre cuando aplica (confirmado o automático).
- [ ] No expone datos de otros usuarios (depende de RF-13).

---

### [P1] RF-03: Validar o rechazar solicitud (triage)
**Etiquetas:** `persona-1`, `backend` · **Milestone:** Fase 1

`POST /api/solicitudes/:id/validar` y `/rechazar`

**Criterios de aceptación**
- [ ] Solo el coordinador con alcance (BR-02).
- [ ] Validar exige confirmar la urgencia y registra la versión de política usada.
- [ ] Rechazar exige motivo (obligatorio).
- [ ] Usa la versión vista para detectar conflictos (`409 CONFLICTO_VERSION`).
- [ ] Auditoría y notificación al solicitante en la misma transacción (BR-10, BR-11).
- [ ] Solo se permiten las transiciones del diagrama 6.8; las demás responden `422`.

---

### [P1] RF-04: Sugerir y vincular duplicados
**Etiquetas:** `persona-1`, `backend` · **Milestone:** Fase 1

`GET /api/solicitudes/:id/duplicados-sugeridos` y `POST /:id/vincular-duplicado`

**Criterios de aceptación**
- [ ] La sugerencia usa ubicación + ventana de tiempo; la categoría ordena pero no filtra (caso `MNT-2001` / `MNT-2002` del pack).
- [ ] Solo el coordinador vincula (BR-03).
- [ ] La maestra existe, no es duplicada y comparte ubicación.
- [ ] La secundaria pasa a `CERRADO_DUPLICADO` con el ID de la maestra, y el solicitante es notificado con ese ID.

---

### [P1] Frontend: páginas Solicitante y Coordinador (triage)
**Etiquetas:** `persona-1`, `frontend` · **Milestone:** Fase 1

**Criterios de aceptación**
- [ ] Solicitante: formulario de reporte con foto; lista de mis solicitudes con estado.
- [ ] Coordinador: cola de solicitudes *En Revisión*; acciones validar, rechazar (con motivo) y vincular duplicado; ver sugerencias.
- [ ] Muestra los errores de la API (`403`, `409`, `422`) de forma comprensible.
- [ ] El cliente envía la versión vista en cada comando.

---

### [P1] Matriz de pruebas de seguridad por rol (QS-04)
**Etiquetas:** `persona-1`, `pruebas` · **Milestone:** Fase 2

**Criterios de aceptación**
- [ ] Casos negativos: técnico que intenta cerrar; solicitante que consulta la solicitud de otro; representante de otro edificio que confirma; contratista que ve orden ajena.
- [ ] Todos responden `403` y **no producen ninguna escritura** (verificado en la base).
- [ ] Los resultados quedan en una tabla del README o de `docs/`.

---

# FASE 1: Persona 2 · Núcleo de órdenes

### [P2] Comando atómico: transacción + versión + auditoría + idempotencia
**Etiquetas:** `persona-2`, `backend` · **Milestone:** Fase 1 · **Prioridad alta: desbloquea a los demás**

Ayudante común para todos los comandos que cambian estado (sección 6.11, QS-06).

**Criterios de aceptación**
- [ ] Función que ejecuta un comando dentro de `conTransaccion`, verifica la versión vista (optimista) y reintenta o responde `409` si cambió.
- [ ] Soporta una **clave de idempotencia** (`comando_procesado`): repetir el mismo comando 3 veces produce un solo cambio y un solo registro de auditoría.
- [ ] Se registra auditoría dentro de la misma transacción.
- [ ] Documentado en `docs/contratos.md` para que lo usen los otros módulos.

---

### [P2] RF-05: Crear orden desde solicitud validada y asignar responsable
**Etiquetas:** `persona-2`, `backend` · **Milestone:** Fase 1

`POST /api/ordenes`

**Criterios de aceptación**
- [ ] Solo coordinador o supervisor con alcance.
- [ ] La solicitud debe estar `VALIDADA` y sin orden previa (restricción `UNIQUE solicitud_id`).
- [ ] Responsable activo obligatorio (BR-04); si el técnico no está habilitado para ubicaciones restringidas, devuelve **advertencia** que debe ser reconocida, no bloqueo (ASM-022).
- [ ] Crea orden `ASIGNADA`, asignación inicial vigente, auditoría y notificaciones al solicitante y al responsable, en una transacción.

---

### [P2] RF-07: Transiciones de estado con regla de evidencia
**Etiquetas:** `persona-2`, `backend` · **Milestone:** Fase 1

`POST /api/ordenes/:id/transiciones` y `solicitarTransicion` en `index.js`

**Criterios de aceptación**
- [ ] Usa la tabla de `transiciones.js`: cualquier transición no listada responde `422 TRANSICION_INVALIDA`.
- [ ] Verifica que el actor sea el permitido (responsable, afectado, sistema).
- [ ] Exige evidencia cuando la matriz lo indica (BR-09); la matriz se lee de `reglas-politicas` (no está en el código).
- [ ] Solo el responsable resuelve; **el técnico nunca cierra** (BR-05).
- [ ] Al resolver, programa los plazos de confirmación llamando al contrato de `notificaciones-plazos` (72 h, recordatorios a 24 h y 48 h).
- [ ] Pruebas: una por cada fila de la tabla (válida) y las prohibidas (por ejemplo, `ASIGNADA → RESUELTA`).

---

### [P2] Ejecución: evidencias, materiales y bloqueos
**Etiquetas:** `persona-2`, `backend` · **Milestone:** Fase 1

`POST /api/ejecucion/:ordenId/evidencias | materiales | bloqueos`

**Criterios de aceptación**
- [ ] Registra observaciones, fotos (almacén + metadatos), materiales (solo como justificación, sin compras, BR-13).
- [ ] Un bloqueo exige causal (acceso o materiales), parte responsable y fecha de seguimiento; notifica al supervisor y al solicitante (BR-08).
- [ ] Este módulo **no cambia el estado**: solicita la transición a `ordenes-trabajo`.
- [ ] Desbloquear permite que lo haga otra persona cuando corresponde (por ejemplo, el representante concede el acceso, ASM-024).

---

### [P2] RF-08: Transferir y reasignar con control de concurrencia (QS-01)
**Etiquetas:** `persona-2`, `backend`, `pruebas` · **Milestone:** Fase 1

`POST /api/ordenes/:id/transferencias` y `/reasignaciones`

**Criterios de aceptación**
- [ ] Transferir: lo hace el responsable; destino activo y distinto; motivo obligatorio; solo en estados `ASIGNADA`, `EN_PROGRESO` o `BLOQUEADA`; avisa al supervisor.
- [ ] Reasignar: lo hace el supervisor, motivo obligatorio; avisa al técnico anterior y al nuevo.
- [ ] El cambio de responsable es **atómico**: nunca queda una orden activa sin responsable (BR-04).
- [ ] La asignación anterior pasa a `vigente = false` y solo hay una vigente.
- [ ] **Prueba de concurrencia:** dos cambios de responsable simultáneos sobre la misma orden → solo uno gana, el otro recibe `409`, y la auditoría tiene un solo registro (caso de la PoC).

---

### [P2] RF-11: Historial inmutable y consulta
**Etiquetas:** `persona-2`, `backend`, `base-de-datos`, `pruebas` · **Milestone:** Fase 1

**Criterios de aceptación**
- [ ] `GET` del historial de una orden o solicitud, ordenado, con actor, instante UTC, acción, estado previo y nuevo, motivo.
- [ ] La aplicación **no puede** actualizar ni borrar registros de `auditoria`: el usuario de BD de la aplicación solo tiene `INSERT` y `SELECT` sobre esa tabla (o un trigger lo impide).
- [ ] Prueba que intenta editar un registro y falla (QS-03).
- [ ] Las acciones automáticas aparecen con actor `SISTEMA`.

---

### [P2] RF-06: Mis órdenes asignadas por ubicación y urgencia
**Etiquetas:** `persona-2`, `backend` · **Milestone:** Fase 1

`GET /api/ordenes`

**Criterios de aceptación**
- [ ] El técnico ve solo las órdenes de las que es responsable, filtrables por ubicación, estado y prioridad.
- [ ] Orden por urgencia.
- [ ] Respuesta apta para pantalla móvil (campos mínimos).

---

### [P2] Frontend: página Técnico
**Etiquetas:** `persona-2`, `frontend` · **Milestone:** Fase 1

**Criterios de aceptación**
- [ ] Lista de mis órdenes con filtros.
- [ ] Cambiar estado adjuntando foto y observaciones; registrar bloqueo con causal; transferir con motivo.
- [ ] **Conserva el borrador local** si falla el envío y lo reenvía con la misma clave de idempotencia (QS-06).
- [ ] Diseño usable en móvil.

---

# FASE 1: Persona 3 · Cierre y vigilancia

### [P3] Notificaciones: cola de entrega y servicio simulado (QS-07)
**Etiquetas:** `persona-3`, `backend`, `base-de-datos` · **Milestone:** Fase 1 · **Prioridad alta: lo usan los demás**

**Criterios de aceptación**
- [ ] `encolarNotificacion(conn, ...)` inserta en `entrega_notificacion` **dentro de la transacción del comando** (si el comando falla, no hay notificación).
- [ ] Un procesador de entregas envía por el adaptador simulado, con estados `PENDIENTE → ENTREGADA | FALLIDA` y reintentos.
- [ ] Si el servicio simulado está caído (`simulacion.caido = true`), nada se pierde: se reintenta al restablecerse.
- [ ] Sin duplicados visibles para el usuario.
- [ ] Notifica al solicitante en cada cambio de estado de su solicitud (BR-11).

---

### [P3] Planificador: plazos idempotentes y recordatorios
**Etiquetas:** `persona-3`, `backend` · **Milestone:** Fase 1

**Criterios de aceptación**
- [ ] `programarPlazos` crea: recordatorios a 24 h y 48 h y cierre automático a 72 h desde `resuelta_en`; los valores salen de `reglas-politicas`.
- [ ] `cancelarPlazos` se usa cuando el afectado responde.
- [ ] `procesarPlazosVencidos()` es **idempotente**: procesar dos veces el mismo plazo no duplica efectos.
- [ ] Tras un **reinicio de la aplicación**, los plazos pendientes se siguen procesando (están en la base, no en memoria).
- [ ] Recuperación de plazos vencidos durante una caída, según ASM-028.

---

### [P3] RF-09: Confirmar o rechazar el cierre, pendientes y cierre automático (QS-02)
**Etiquetas:** `persona-3`, `backend`, `pruebas` · **Milestone:** Fase 1

`GET /api/notificaciones/pendientes`, `POST /ordenes/:id/confirmar-cierre | rechazar-cierre`

**Criterios de aceptación**
- [ ] El afectado (o el representante con alcance) confirma el cierre; rechazar exige motivo y devuelve la orden a `EN_PROGRESO` con el mismo responsable (BR-07).
- [ ] El apartado de pendientes muestra la orden desde `resuelta_en`.
- [ ] Al vencer el plazo, cierre automático con tipo `AUTOMATICO`, actor `SISTEMA` en la auditoría y aviso al afectado con opción de reapertura.
- [ ] El tipo de cierre siempre queda registrado (BR-06).
- [ ] **Prueba de carrera de cierre (QS-02):** confirmación y vencimiento simultáneos, ejecutados concurrentemente contra la base real → exactamente un cierre y un registro de auditoría; la operación perdedora recibe "ya cerrada".

---

### [P3] RF-10: Reabrir un caso cerrado
**Etiquetas:** `persona-3`, `backend` · **Milestone:** Fase 1

`POST /api/notificaciones/ordenes/:id/reabrir`

**Criterios de aceptación**
- [ ] Solo el afectado o el representante con alcance, y solo si `cerrada_en` tiene menos de 48 h (la ventana sale de `reglas-politicas`).
- [ ] Crea una **solicitud nueva `EN_REVISION`** vinculada (`reabre_orden_id`); la orden cerrada no cambia.
- [ ] Auditoría y notificaciones.

---

### [P3] Reglas y políticas configurables y versionadas (BR-14, QS-05)
**Etiquetas:** `persona-3`, `backend`, `pruebas` · **Milestone:** Fase 1

**Criterios de aceptación**
- [ ] La matriz de evidencia por transición, los plazos y las categorías se leen de `regla_politica`, no del código.
- [ ] Cada evaluación registra la **versión de la regla** usada.
- [ ] Cambiar un valor (por ejemplo, el plazo de 72 h a 48 h) se aplica a las transiciones nuevas **sin tocar código ni esquema**.
- [ ] Pruebas de regresión con la versión anterior y la nueva.

---

### [P3] RF-12: Tablero operativo
**Etiquetas:** `persona-3`, `backend` · **Milestone:** Fase 1

`GET /api/reportes/tablero`

**Criterios de aceptación**
- [ ] Muestra órdenes atrasadas, bloqueos abiertos, carga por técnico y ubicaciones críticas.
- [ ] Solo supervisor y coordinador.
- [ ] Solo lectura, con definiciones de negocio únicas (qué es "atrasada", qué es "crítica") documentadas.

---

### [P3] Frontend: Supervisor y pendientes del afectado
**Etiquetas:** `persona-3`, `frontend` · **Milestone:** Fase 1

**Criterios de aceptación**
- [ ] Supervisor: tablero y reasignación de órdenes atrasadas.
- [ ] Afectado: apartado de pendientes con acciones confirmar, rechazar con motivo y reabrir.
- [ ] El cierre automático se distingue visualmente del confirmado.

---

# FASE 2: Integración y prueba de concepto

### [PoC] Flujo completo de extremo a extremo
**Etiquetas:** `compartido`, `poc`, `pruebas` · **Milestone:** Fase 2 · **Asignado:** los tres

El flujo propuesto en 1.2: reporte → triage → orden asignada → ejecución con evidencia → bloqueo → resolución → cierre.

**Criterios de aceptación**
- [ ] Script o prueba automática que recorre el flujo completo contra la base real.
- [ ] Demostrable en vivo desde el frontend con los 4 usuarios simulados.
- [ ] El historial final de la orden reconstruye cada paso con su actor.

---

### [PoC] Los tres casos críticos adicionales
**Etiquetas:** `compartido`, `poc`, `pruebas` · **Milestone:** Fase 2

**Criterios de aceptación**
- [ ] **Asignación concurrente** sobre la misma orden (issue RF-08 de Persona 2): una sola gana.
- [ ] **Acción no autorizada** (issue QS-04 de Persona 1): denegada y sin escrituras.
- [ ] **Cierre automático por vencimiento** (issue RF-09 de Persona 3).
- [ ] Cada caso queda documentado con la evidencia que produce.

---

### [PoC] Verificación de fallos: notificación caída y reinicio (QS-07, QS-06)
**Etiquetas:** `persona-3`, `poc`, `pruebas` · **Milestone:** Fase 2

**Criterios de aceptación**
- [ ] Con el servicio de notificación caído, el cambio de estado queda confirmado.
- [ ] Tras reiniciar la aplicación, las notificaciones, recordatorios y el cierre automático no se pierden.
- [ ] Al restablecerse el servicio, la notificación se entrega y no se duplica.
- [ ] Reenviar 3 veces el mismo comando produce un solo cambio y un solo registro de auditoría.

---

### [Docs] Actualizar el documento de diseño con lo implementado y lo verificado
**Etiquetas:** `compartido` · **Milestone:** Fase 2

Su documento marca todo como **DISEÑADO**. Cuando haya código, actualizar el estado de evidencia solo de lo que realmente se pruebe.

**Criterios de aceptación**
- [ ] Cada comportamiento pasa a IMPLEMENTADO solo si existe código, y a VERIFICADO solo si existe una prueba que lo demuestre.
- [ ] Las diferencias entre el diseño y lo construido quedan registradas con justificación.
- [ ] El README refleja cómo ejecutar todo.
