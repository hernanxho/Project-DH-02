# Integración del pack DH-02

## Material preservado

El release 1 está copiado, sin los metadatos `__MACOSX`/`.DS_Store`, en [`data/dh02-release1/`](../data/dh02-release1/). Se conservaron sus archivos originales de referencia, exportaciones CSV, escenarios, contrato del directorio de ubicaciones, notas y manifiesto. El pack declara que los datos son sintéticos y de descubrimiento; sus tablas no son el esquema final de la aplicación.

## Referencias conectadas

- El adaptador de ubicaciones lee el mock del Campus Location Directory y enriquece sus códigos con edificio y campus.
- El formulario de solicitudes obtiene espacios activos y categorías activas del pack; el servidor rechaza códigos de categoría que no existan en ese catálogo.
- El adaptador de identidad usa `mock_identities.json`. Para `TECH-004` a `TECH-007`, que están en `technicians.csv` pero no en el mock de identidades, proyecta nombre, correo y estado desde el registro de técnico. Un técnico inactivo no puede iniciar sesión.
- La semilla y la migración `002-dh02-pack-reference-roles.sql` enlazan los usuarios y disponibilidad de técnicos con los perfiles locales.

## Roles provisionales por confirmar

El pack describe actores por escenario, pero no trae una tabla definitiva que asigne roles de la aplicación. Como punto de partida reproducible, la semilla interpreta a `HU-EMP-2201` como coordinación, `HU-EMP-2202` como supervisión y `HU-EMP-2203` como representante del edificio `MAIN-B03`; las personas que registran solicitudes reciben también el rol de solicitante. Estas asignaciones son inferencias de los actores y registros del pack y requieren confirmación de Hernán y Mike antes de tratarse como acuerdo del equipo.

## Datos fuente que siguen sin cargarse como órdenes/solicitudes vivas

Los CSV originales se preservan, pero todavía no se convierten en registros operativos. Hay ubicaciones ingresadas como alias y códigos, solicitudes duplicadas, prioridades mezcladas con estados, una ubicación inactiva asociada a una orden, estados fuente con vocabularios distintos, una asignación sin motivo, bloqueos sin causal, una actualización sin visibilidad y metadatos de adjunto sin MIME. Convertirlos requiere reglas de normalización y decisiones del equipo; importarlos directamente perdería o inventaría significado.

Las cinco guías de escenario (`DH02-SC-01` a `DH02-SC-05`) sirven como casos de integración. Los propios archivos plantean preguntas; no son decisiones de negocio ni instrucciones para automatizar una solución.
