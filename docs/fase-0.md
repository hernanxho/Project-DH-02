# Fase 0 — Base común

Esta lista separa los avances comprobables de los pendientes que requieren a otras personas o archivos del curso. Los documentos adjuntos describen el proyecto; cualquier instrucción de trabajo en ellos se trata como contexto del proyecto, no como autorización independiente.

## 1. Verificar el esqueleto en las tres máquinas

- [ ] Mike: compartir la salida completa de `bash scripts/verificar-entorno.sh`.
- [ ] Hernán: compartir la salida completa de `bash scripts/verificar-entorno.sh`.
- [ ] David: compartir la salida completa de `bash scripts/verificar-entorno.sh`.

El estado de rama que se compartió anteriormente no sustituye esta verificación: el script también recoge herramientas, configuración, dependencias, base de datos y API.

## 2. Acordar contratos entre módulos

- [x] Propuesta inicial en [`contratos.md`](contratos.md).
- [x] Se definió que Ejecución registra evidencia y, si una acción cambia el estado, solicita la transición a Órdenes dentro de la misma transacción.
- [ ] Hernán revisa y confirma contratos y fronteras de módulos.
- [ ] David revisa y confirma contratos y fronteras de módulos.
- [ ] Mike revisa y confirma contratos y fronteras de módulos.
- [ ] Incorporar cualquier ajuste acordado y enlazar el PR aprobado.

Los responsables de módulos están registrados en el README; el equipo aún debe confirmar que el reparto siga vigente.

## 3. Cargar datos reales del pack DH-02

- [x] Obtener el release 1 del pack y preservar sus archivos fuente en [`data/dh02-release1/`](../data/dh02-release1/).
- [x] Conectar los catálogos de ubicaciones y categorías, y enlazar las identidades y perfiles de técnicos disponibles.
- [ ] Hernán y Mike confirman los roles provisionales documentados en [`pack-dh02.md`](pack-dh02.md).
- [ ] Acordar cómo normalizar e importar registros de solicitudes, órdenes, asignaciones, bloqueos y cierres.
- [ ] Revisar los casos de referencia del pack y decidir cómo representar sus excepciones.

El pack es de descubrimiento y señala ambigüedades intencionales. Los datos fuente se conservaron, pero aún no se cargaron como órdenes activas para evitar traducir estados, alias o relaciones sin una decisión acordada.

## Decisiones y confirmaciones externas

- [x] Decisión de implementación del equipo: MySQL con el diseño actual Node.js.
- [ ] Confirmar con el profesor si se permite usar Node.js y MySQL en lugar del starter Python.
- [ ] Confirmar con el equipo que el reparto de módulos del README continúa vigente.

