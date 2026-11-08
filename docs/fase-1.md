# Fase 1 — estado de implementación

La Fase 1 cubre la entrada y el triage de solicitudes, el núcleo de órdenes, la ejecución, el cierre y el tablero descritos en `issues-dh02.md`.

## Implementado en esta rama

- Solicitudes: validación de datos y catálogos versionados, ubicación con snapshot, adjuntos, notificaciones, cola de triage, verificación de ubicación, validación/rechazo y sugerencia/vínculo de duplicados.
- Acceso: comprobaciones de relación con la solicitud u orden y de alcance en el servidor; acceso a adjuntos e historiales filtrado por recurso.
- Órdenes: creación desde solicitudes validadas, asignación/transferencia/reasignación, transiciones y evidencia, corrección justificada de categoría, bloqueos y confirmación de acceso por representante.
- Cierre: confirmación, rechazo con motivo, vencimiento automático, reapertura como nueva solicitud y recuperación de plazos demorados.
- Operación: notificaciones persistentes, reglas versionadas, tablero de órdenes sin atención/bloqueos/carga/ubicaciones, borradores de ejecución e inbox de notificaciones.
- Integridad: comandos idempotentes con huella del cuerpo, auditoría protegida contra cambios y migraciones para bases existentes.
- Datos: adaptadores locales de solo lectura para el paquete DH-02; los archivos originales y sus anomalías documentadas se conservan en `data/dh02-release1/`.

## Revisión pendiente antes de cerrar Fase 1

- No se ejecutaron pruebas automatizadas ni se levantó MySQL/API/frontend en esta revisión. La aceptación de los issues requiere pruebas por rol, carrera de cierre, concurrencia, reintentos y reinicio.
- Las asignaciones de coordinación, supervisión y representante son una proyección inicial de los escenarios. Los compañeros deben confirmarlas; están señaladas en `docs/pack-dh02.md`.
- La relación entre algunos identificadores de caso y órdenes del paquete (incluidos los pares ambiguos anotados en `docs/pack-dh02.md`) requiere decisión del equipo antes de importar registros como datos operativos.
- Aplicar las migraciones `002`, `003` y `004` en bases ya creadas. Una base nueva toma el esquema y seed actuales.
- Los issues de Fase 2 (integración extremo a extremo y evidencia de PoC) siguen pendientes.

## Criterio de estado

La implementación funcional de los módulos está completada a nivel de código en esta rama. La Fase 1 todavía requiere revisión compartida de roles, ejecución de migraciones en cada entorno y verificación automatizada/manual de los criterios de aceptación antes de marcar los issues como cerrados.
