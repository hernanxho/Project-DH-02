# Contratos entre módulos (propuesta para Fase 0)

Este documento establece las interfaces públicas dentro del backend. Es una propuesta basada en el diseño de Evaluación 2 y el esqueleto actual; requiere revisión de los tres integrantes antes de considerarse acordada. Los módulos solo importan el `index.js` público de otro módulo.

## Reglas compartidas

- Los módulos usan JavaScript ESM y nombres/campos en español, como el esquema actual.
- Las operaciones de escritura reciben `conn` (una conexión de `mysql2/promise`) como primer parámetro. El llamador abre, confirma o revierte la transacción; el módulo no hace `BEGIN`, `COMMIT` ni `ROLLBACK` por su cuenta.
- Las operaciones de lectura pueden usar `pool` internamente, salvo que deban leer dentro de una transacción; en ese caso reciben `conn`.
- Las funciones lanzan `ErrorApp` (`src/compartido/errores.js`) para errores esperados. Errores inesperados se propagan al manejador global, que actualmente responde `500 ERROR_INTERNO`; si se define una respuesta `503`, se actualizará aquí y en las pruebas de API.
- Los `index.js` exportan solo la API pública del módulo. Los controladores y rutas no se importan desde otros módulos.

## Identidad y acceso

### `identidad-acceso`

| Función | Firma propuesta | Retorno | Errores / reglas |
|---|---|---|---|
| `obtenerIdentidad` | `async obtenerIdentidad(subject)` | `Promise<{ subject, nombre, correo } \| null>` | La identidad simulada puede devolver `null` si no existe. No incluye roles; estos se consultan localmente. |
| `obtenerContextoAcceso` | `async obtenerContextoAcceso(subject)` | `Promise<{ subject, roles: string[], tecnicoId: number \| null }>` | `401 NO_AUTENTICADO` si no hay identidad; los roles vienen de `asignacion_rol` y el perfil de `perfil_tecnico`. |
| `exigirRol` | `exigirRol(contexto, rolesPermitidos)` | `void` | `403 PROHIBIDO` si el contexto no tiene uno de los roles. |
| `exigirAccesoOrden` | `async exigirAccesoOrden(conn, contexto, ordenId, accion)` | `Promise<void>` | Aplica autorización por relación con la orden; `404 NO_ENCONTRADO` cuando el recurso no debe revelarse y `403 PROHIBIDO` según política acordada. |

Los detalles de ocultamiento de existencia y los nombres exactos de roles deben seguir BR-12/RF-13 y acordarse con la implementación de autorización.

## Solicitudes y triage

### `solicitudes-triage`

| Función | Firma propuesta | Retorno | Errores / reglas |
|---|---|---|---|
| `crearSolicitud` | `async crearSolicitud(conn, datos, actor)` | `Promise<{ id, estado, version, ubicacionVerificada }>` | Implementada: valida identidad afectada y ubicación simulada; inserta solicitud, auditoría y notificación en la conexión recibida. En la API la transacción se abre con `conTransaccion`. Aún no carga foto ni valida categoría contra el catálogo del pack. |
| `obtenerSolicitud` | `async obtenerSolicitud(id, contexto)` | `Promise<Solicitud>` | Implementada para solicitante, coordinación y supervisión; aplica alcance por solicitante y devuelve `404` si no existe o no es visible. |
| `listarSolicitudes` | `async listarSolicitudes(contexto)` | `Promise<Solicitud[]>` | Implementada para solicitante, coordinación y supervisión; el alcance no depende de filtros libres del cliente. |
| `validarSolicitud` | `async validarSolicitud(conn, id, datos, actor)` con `{ urgenciaValidada, versionVista }` | `Promise<{ id, estado, urgenciaValidada, version, versionPolitica }>` | Implementada: exige `EN_REVISION`, versión vigente, nivel permitido por la política versionada y registra el cambio, auditoría y notificación en la misma transacción. |
| `rechazarSolicitud` | `async rechazarSolicitud(conn, id, datos, actor)` con `{ motivo, versionVista }` | `Promise<{ id, estado, motivo, version }>` | Implementada: exige motivo de catálogo, `EN_REVISION` y versión vigente; registra el cambio, auditoría y notificación en la misma transacción. |

## Órdenes de trabajo

### `ordenes-trabajo`

| Función | Firma propuesta | Retorno | Errores / reglas |
|---|---|---|---|
| `solicitarTransicion` | `async solicitarTransicion(conn, { ordenId, hacia, actor, versionVista, evidenciaId?, motivo? })` | `Promise<{ ordenId, estado, version, cerradaEn \| null }>` | Fuente única de verdad del estado. Verifica transición, versión y precondiciones; actualiza la orden y registra auditoría. Para cambios que disparan avisos/plazos, llama los contratos de notificaciones dentro de la misma transacción. |
| `obtenerOrden` | `async obtenerOrden(ordenId, contexto)` | `Promise<Orden \| null>` | Devuelve solo campos autorizados. |
| `listarOrdenes` | `async listarOrdenes(filtros, contexto)` | `Promise<Orden[]>` | Filtra según alcance del contexto. |

`versionVista` es la versión que observó el cliente; una actualización condicional sin fila afectada se traduce en `409 CONFLICTO_VERSION`. Transiciones inválidas usan `422 TRANSICION_INVALIDA`; ausencia de recurso usa `404 NO_ENCONTRADO`.

## Ejecución y evidencia

### `ejecucion-evidencia`

| Función | Firma propuesta | Retorno | Errores / reglas |
|---|---|---|---|
| `registrarEvidencia` | `async registrarEvidencia(conn, { ordenId, actor, tipo, descripcion, archivo, versionVista })` | `Promise<{ evidenciaId, ordenId, creadaEn }>` | Verifica acceso, formato y límites del archivo; la evidencia que habilita una transición se entrega a `solicitarTransicion` en la misma transacción. No modifica el estado directamente. |
| `listarEvidencias` | `async listarEvidencias(ordenId, contexto)` | `Promise<Evidencia[]>` | Aplica autorización por recurso y no expone rutas internas del almacenamiento. |

La definición de qué transiciones exigen evidencia y qué evidencia se considera suficiente sigue BR-05/BR-06 y debe reflejarse también en pruebas.

## Notificaciones y plazos

### `notificaciones-plazos`

| Función | Firma propuesta | Retorno | Errores / reglas |
|---|---|---|---|
| `encolarNotificacion` | `async encolarNotificacion(conn, { destinatario, plantilla, carga })` | `Promise<{ notificacionId }>` | Implementada: inserta en `entrega_notificacion` usando la conexión transaccional; no llama al proveedor externo durante la transacción. |
| `programarPlazos` | `async programarPlazos(conn, ordenId)` | `Promise<void>` | Programa una sola vez los vencimientos y recordatorios definidos para la orden; idempotente para el mismo evento/orden. |
| `cancelarPlazos` | `async cancelarPlazos(conn, ordenId)` | `Promise<void>` | Cancela plazos pendientes cuando la orden deja de requerirlos; conserva historial según diseño. |
| `procesarCola` | `async procesarCola(limite)` | `Promise<{ procesadas, fallidas }>` | Reclama mensajes pendientes, intenta entrega y actualiza reintentos/estado. No forma parte de la transacción de negocio que los encoló. |

## Auditoría

### `auditoria`

| Función | Firma implementada | Retorno | Errores / reglas |
|---|---|---|---|
| `registrarAuditoria` | `async registrarAuditoria(conn, { entidad, entidadId, accion, actor, estadoDesde = null, estadoHasta = null, detalle = null })` | `Promise<void>` | Inserta una entrada inmutable usando la conexión recibida. Se ejecuta dentro de la transacción del cambio que audita. |
| `consultarAuditoria` | `async consultarAuditoria({ entidad, entidadId, desde, hasta, limite }, contexto)` | `Promise<Auditoria[]>` | Solo lectura; acceso sujeto a política de autorización. |

La primera función ya está implementada y exportada por `modulos/auditoria/index.js`; la segunda queda pendiente.

## Reglas y políticas

### `reglas-politicas`

| Función | Firma implementada | Retorno | Errores / reglas |
|---|---|---|---|
| `obtenerRegla` | `obtenerRegla(clave)` | valor de regla o `null` | Lectura de configuración vigente; no escribe ni abre transacciones. |
| `listarReglas` | `async listarReglas()` | `Promise<Regla[]>` | Lectura para vistas autorizadas de coordinación/supervisión. |
| `actualizarRegla` | `async actualizarRegla(conn, { clave, valor, actor, versionVista })` | `Promise<Regla>` | Escritura transaccional, control de versión y registro de auditoría. |

`obtenerRegla` ya se exporta desde `modulos/reglas-politicas/index.js`.

## Errores compartidos

| HTTP | Código | Uso |
|---:|---|---|
| 400 | `VALIDACION` | Entrada inválida. |
| 401 | `NO_AUTENTICADO` | Identidad ausente o desconocida. |
| 403 | `PROHIBIDO` | Acción no permitida para el contexto. |
| 404 | `NO_ENCONTRADO` | Recurso inexistente o no visible. |
| 409 | `CONFLICTO_VERSION` | El recurso cambió desde su lectura. |
| 422 | `TRANSICION_INVALIDA` | Transición de estado no permitida. |
| 501 | `NO_IMPLEMENTADO` | Ruta o capacidad aún pendiente durante el esqueleto. |

## Aprobación pendiente

- [ ] Hernán revisó firmas, transacciones y uso del contrato.
- [ ] David revisó firmas, transacciones y uso del contrato.
- [ ] Mike revisó firmas, transacciones y uso del contrato.
- [ ] Se resolvió en particular la relación entre `registrarEvidencia` y `solicitarTransicion` (quién llama a quién y en qué punto se valida la evidencia).

Al acordarse, actualicen esta propuesta si difiere de la API elegida y enlacen el commit/PR que la aprueba.
