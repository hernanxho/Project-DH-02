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

## Verificación y pendientes

- Verificación local del 8 de noviembre de 2026: 11 pruebas de backend pasaron; `deps:check` pasó (49 módulos, 138 dependencias); Vite compiló el frontend; `npm audit` encontró 0 vulnerabilidades en backend y frontend. Se añadieron archivos de bloqueo para instalaciones repetibles.
- Se levantaron MySQL y la API: `/api/salud` devolvió `ok`; los catálogos autenticados devolvieron 14 categorías y 12 ubicaciones activas. El tablero y la bandeja de notificaciones respondieron.
- Se aplicaron las migraciones `001`–`004` a la base local. El trigger rechazó una edición de auditoría y la transacción de verificación no dejó filas.
- En una base de verificación aislada se recorrió: solicitud → triage → duplicado de distinta categoría → orden → ejecución → bloqueo de materiales → resolución → rechazo y confirmación del cierre → reapertura. También se verificó el bloqueo y desbloqueo por representante.
- Dos reasignaciones simultáneas con la misma versión produjeron un ganador y un `409`. La carrera entre confirmación vencida y cierre automático produjo un solo cierre y una auditoría. El plazo demorado más de una hora se reprogramó; una notificación fallida quedó en cola y se entregó tras reiniciar la API.
- El reintento idempotente devolvió el mismo resultado incluso con diferente orden de propiedades JSON. Tres acciones no autorizadas respondieron `403` y no añadieron auditoría; las pruebas unitarias cubren además los límites por rol, relación y edificio.
- Las asignaciones de coordinación, supervisión y representante son una proyección inicial de los escenarios. Los compañeros deben confirmarlas; están señaladas en `docs/pack-dh02.md`.
- La relación entre algunos identificadores de caso y órdenes del paquete (incluidos los pares ambiguos anotados en `docs/pack-dh02.md`) requiere decisión del equipo antes de importar registros como datos operativos.
- Aplicar las migraciones necesarias en las bases de los otros integrantes. Una base nueva toma el esquema y seed actuales.
- Los issues de Fase 2 (integración extremo a extremo y evidencia de PoC) siguen pendientes.

## Criterio de estado

La implementación funcional y la verificación local de los flujos de Fase 1 están completas. Para cerrar formalmente el trabajo compartido, el equipo debe confirmar los roles inferidos y aplicar las migraciones en cada entorno existente. La Fase 2 sigue pendiente.
