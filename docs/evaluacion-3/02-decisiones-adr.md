# Evaluación 3 · Decisiones: diseño previsto vs. diseño real

Estado de los 10 ADR de la Evaluación 2 después de construir el primer incremento, y las decisiones nuevas o refinadas que aparecieron al implementar.

## 1. Estado vigente de los ADR de la Evaluación 2

| ADR | Decisión | Estado en E3 | Consecuencia real / evidencia |
|---|---|---|---|
| E2-ADR-001 | Monolito modular con una base relacional | **Aceptada** | Un proceso Node.js, 10 módulos, MySQL. `deps:check`: 0 violaciones de frontera. |
| E2-ADR-002 | Máquina de estados centralizada | **Aceptada** | `transiciones.js` (dominio puro). Pruebas: `test/transiciones.test.js` + E2E. |
| E2-ADR-003 | Concurrencia optimista por versión | **Aceptada y refinada** → E3-ADR-001 | Prueba QS-01: una reasignación gana, la otra `409`. |
| E2-ADR-004 | Historial inmutable en la misma transacción | **Aceptada y reforzada** | Además de la transacción, triggers de BD impiden `UPDATE`/`DELETE`. Prueba BR-12. |
| E2-ADR-005 | Plazos y notificaciones persistidos + planificador | **Aceptada y refinada** → E3-ADR-003 | Prueba QS-02 (carrera de cierre) y QS-07 (proveedor caído). |
| E2-ADR-006 | Reglas configurables y versionadas | **Modificada** → E3-ADR-002 | Tabla `regla_politica` por clave en vez de un documento único. Prueba QS-05. |
| E2-ADR-007 | Autenticación delegada; autorización propia | **Aceptada** (autenticación SIMULADA) | Encabezado `x-subject`; roles leídos de `asignacion_rol`, nunca del navegador. Prueba QS-04. |
| E2-ADR-008 | Adaptadores para servicios simulados | **Aceptada** | `adaptadores/identidad.js`, `ubicaciones.js`, `notificacion.js`, `categorias.js`. |
| E2-ADR-009 | React + Node.js + MySQL | **Aceptada** | Pila en uso. Pendiente confirmación formal del profesor (ver riesgos). |
| E2-ADR-010 | Adopción parcial del starter del profesor | **Modificada** → E3-ADR-004 | No se usa ningún código del starter; el pack se lee directo desde `data/dh02-release1/`. |

## 2. Decisiones refinadas al implementar

### E3-ADR-001 · El comando atómico incluye bloqueo de fila además de la versión

- **Decisión inicial (E2-ADR-003):** `UPDATE … WHERE id = ? AND version = ?`; si no afecta filas → `409`.
- **Hallazgo al implementar:** varios comandos leen la orden, validan reglas (responsable, evidencia, alcance) y escriben en varias tablas (orden, asignación, auditoría, notificación, plazos). Validar con datos leídos sin bloqueo abre una ventana entre la lectura y la escritura.
- **Decisión refinada:** cada comando corre dentro de `conComando` (`compartido/idempotencia.js`): **una transacción** que hace `SELECT … FOR UPDATE` de la orden, compara `version` con `versionVista`, aplica la regla y escribe todo junto. La condición de versión sigue en el `UPDATE` como segunda barrera.
- **Consecuencia:** la frontera transaccional es el comando HTTP completo. Los módulos reciben `conn` y nunca abren ni confirman transacciones (regla escrita en `docs/contratos.md`).
- **Evidencia:** prueba *QS-01* (dos reasignaciones simultáneas: `[200, 409]`, un único responsable, `version + 1`).

### E3-ADR-002 · Reglas versionadas como filas por clave (`regla_politica`)

- **Decisión inicial (E2-ADR-006):** una tabla `VERSION_POLITICA` con un documento JSON de reglas por versión.
- **Hallazgo:** cada regla cambia a ritmo distinto (categorías vs. plazo de cierre) y debe validarse con un esquema propio. Un documento único obligaba a versionar todo para cambiar una sola regla.
- **Decisión refinada:** una fila por `(clave, version)` con bandera `vigente`. Solo supervisión cambia reglas (`PUT /api/politicas/:clave`), con control de versión y auditoría. Las versiones viejas no se borran.
- **Consecuencia:** el valor que usó un comando queda trazable (`versionPolitica` en la respuesta de validación). Se pierde la “foto” única de todas las reglas en un instante; se acepta porque ningún caso de uso la necesita.
- **Evidencia:** prueba *QS-05*: al cambiar la matriz de evidencia a `opcional`, iniciar sin evidencia pasa a `200`; al restaurarla, vuelve a `422 EVIDENCIA_REQUERIDA`. Coordinación recibe `403` al intentar cambiarla.

### E3-ADR-003 · Planificador en el mismo proceso, idempotente sobre estado persistido

- **Decisión inicial (E2-ADR-005):** plazos y notificaciones en tablas; un planificador interno los procesa.
- **Hallazgo:** la carrera *confirmación del afectado vs. cierre automático* (QS-02) y el reinicio de la API exigen que el planificador no guarde nada en memoria y que procesar dos veces no tenga efecto.
- **Decisión refinada:** `setInterval` de 30 s en el proceso de la API. Cada plazo se procesa en su propia transacción con `FOR UPDATE` sobre orden y plazo; si el plazo ya no está `PENDIENTE`, no hace nada. La confirmación del afectado rechaza con `409 CONFIRMACION_VENCIDA` si el plazo ya venció. Las notificaciones pasan `PENDIENTE → FALLIDA → ENTREGADA` con contador de intentos.
- **Consecuencia:** no se necesita otro proceso ni cola externa (coherente con E2-ADR-001). Si en producción hubiera varias instancias, el `FOR UPDATE` evita dobles cierres, pero habría trabajo repetido; se registra como riesgo.
- **Evidencia:** prueba *QS-02* (un solo cierre `AUTOMATICO`, una sola auditoría, reejecutar el planificador no duplica) y *QS-07* (con el proveedor caído la orden queda `ASIGNADA`; luego se entrega una vez y no se reenvía).

### E3-ADR-004 · El pack DH-02 se lee directamente; el starter Python no se usa

- **Decisión inicial (E2-ADR-010):** adoptar datos y contratos del starter, no su código.
- **Hallazgo:** el starter esperaba `mock_users.json` y una tabla genérica `imported_records`; el pack trae `mock_identities.json`, CSV de referencia y un mock del directorio de ubicaciones. Adaptar el starter costaba más que leer el pack.
- **Decisión refinada:** el pack se copia sin cambios a `data/dh02-release1/` y los adaptadores lo leen en modo solo lectura. Los catálogos (ubicaciones, categorías, técnicos) salen del pack. Los CSV **operacionales** (órdenes y solicitudes históricas) **no** se importan, porque tienen anomalías intencionales (alias de ubicación, estados mezclados, bloqueos sin causal) que requieren reglas de normalización acordadas.
- **Consecuencia:** la demo arranca con catálogos reales y sin historial. Las identidades de `TECH-004`–`TECH-007` (que no están en `mock_identities.json`) se proyectan desde `technicians.csv`; un técnico inactivo no puede iniciar sesión.
- **Evidencia:** `docs/pack-dh02.md`; `GET /api/solicitudes/catalogos` devuelve 14 categorías y 12 ubicaciones activas.

### E3-ADR-005 · Idempotencia con huella del cuerpo

- **Decisión inicial (QS-06, 6.7):** `RECIBO_COMANDO` con clave `(actor, operacion_id)`.
- **Hallazgo:** un cliente con error podría reutilizar la misma clave para un comando **distinto**; con solo la clave, el servidor devolvería una respuesta que no corresponde.
- **Decisión refinada:** `comando_procesado` guarda la clave, el actor, una **huella SHA-256** de método + ruta + cuerpo (normalizado: el orden de las propiedades no importa) y el resultado. Misma clave + misma huella → se devuelve el resultado guardado. Misma clave + otra huella → `409 CLAVE_IDEMPOTENCIA_REUTILIZADA`. Todo comando sin clave → `400`.
- **Evidencia:** prueba *QS-06* (3 reenvíos → 1 evidencia, 1 cambio de estado, misma respuesta; clave reutilizada → `409`) y `test/idempotencia.test.js`.

### E3-ADR-006 · Ubicación como snapshot dentro de la solicitud

- **Decisión inicial:** una tabla `PROYECCION_UBICACION` (caché local del directorio).
- **Decisión refinada:** al crear la solicitud se guarda `ubicacion_snapshot` (JSON con edificio, campus, piso, restricción). Si el directorio no responde, la solicitud se acepta con `ubicacion_verificada = FALSE` y coordinación la verifica después (`POST /solicitudes/:id/verificar-ubicacion`); no se puede crear orden sin ubicación verificada (`422 UBICACION_NO_VERIFICADA`).
- **Consecuencia:** el historial conserva la ubicación tal como era (aunque el pack la marque luego como inactiva) y se evita sincronizar una caché.

## 3. Divergencias entre diseño y código que siguen abiertas

| Diseño E2 | Código hoy | Decisión |
|---|---|---|
| Operación sin conexión limitada: borrador en el dispositivo (QS-06) | Borradores de ejecución en el navegador; el reenvío idempotente sí existe en el servidor | Aceptado como parcial; el servidor es lo que garantiza QS-06. |
| Escalamiento automático de órdenes atrasadas | Tablero muestra órdenes sin atención > 48 h; no hay escalamiento automático | PENDIENTE para la Evaluación 4. |
| Habilidades de técnico (`technician_skills.csv`) | Solo `perfil_tecnico` (unidad, disponible, habilitado restringidas) | Suficiente para asignar; habilidades finas PENDIENTE. |
| Entrega de notificaciones “a lo sumo una vez visible” | Deduplicación por `notificacionId` en el adaptador simulado (memoria) | SIMULADO; un proveedor real debe respetar la clave. |
