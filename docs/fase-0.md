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

- [ ] Obtener el pack oficial del curso, incluyendo identidades, técnicos, edificios, ubicaciones, solicitudes y órdenes.
- [ ] Mapear los datos a adaptadores y semillas sin inventar catálogos ni relaciones.
- [ ] Revisar los casos de referencia del pack y decidir cómo representar sus excepciones.

El ZIP que está disponible en Descargas contiene únicamente `Evalucion2.html` y `eva2final.md`; no contiene los CSV/JSON del pack. El repositorio todavía usa identidades, ubicaciones y perfiles ficticios, así que esta parte no se puede cerrar con lo disponible.

## Decisiones y confirmaciones externas

- [x] Decisión de implementación del equipo: MySQL con el diseño actual Node.js.
- [ ] Confirmar con el profesor si se permite usar Node.js y MySQL en lugar del starter Python.
- [ ] Confirmar con el equipo que el reparto de módulos del README continúa vigente.

