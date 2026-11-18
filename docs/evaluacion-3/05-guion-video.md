# Guion del video · Evaluación 3 (5:30 aprox.)

Regla del profe: **no** es un paseo por pantallas ni lectura de diapositivas. Cada bloque conecta **driver → ADR → componente → demo/prueba**.

**Preparación antes de grabar**
1. `docker compose down -v && docker compose up -d` (base limpia).
2. `cd backend && npm run dev` y `cd frontend && npm run dev`.
3. Abrir: el navegador en `localhost:5173`, VS Code con `transiciones.js` y `01-arquitectura-actualizada.md` (vista previa Markdown con Mermaid), y una terminal en `backend/`.
4. Ensayar una vez con cronómetro.

Reparto sugerido: **Hernán** bloques 1 y 2 · **David** bloque 3 · **Mike** bloque 4.

---

## Bloque 1 · Contexto (0:00–0:45)

> “Somos el equipo DH-02: Hernán, David y Mike. El cliente es Facilities de Horizon University: cientos de reportes al mes que llegan por WhatsApp, correo y papel, sin responsable claro y con cierres falsos.
> Para esta entrega construimos el flujo central completo: un daño se reporta, coordinación lo valida, se crea una orden con un técnico responsable, el técnico la ejecuta con evidencia, puede bloquearla, la resuelve, y **solo el afectado** la cierra — o el sistema la cierra solo a las 72 horas.
> Identidad, ubicaciones y notificaciones están simulados con los datos del pack del profesor. Duplicados, reapertura y tablero funcionan pero aún sin pruebas automáticas.”

**Pantalla:** README (tabla de identidad) y la tabla de estado de la sección 1 de `01-arquitectura-actualizada.md`.

## Bloque 2 · Arquitectura (0:45–2:00)

> “Mantuvimos el monolito modular del ADR-001: una API Node.js, MySQL y React. [**Vista de contenedores**] Lo nuevo frente a la Evaluación 2 es el almacén de adjuntos y que el planificador corre dentro de la API cada 30 segundos.
> [**Vista de componentes**] Cada módulo solo expone su `index.js`; lo comprobamos con `deps:check`: cero violaciones.
> Las reglas viven en el dominio: [abrir **`transiciones.js`**] esta tabla define qué estado puede pasar a cuál y quién puede hacerlo. La interfaz solo valida formularios; las reglas de negocio las decide la API.
> Al implementar refinamos tres decisiones [**`02-decisiones-adr.md`**]: primero, cada comando HTTP es una transacción que bloquea la fila y compara la versión — eso responde al riesgo RSK-02 de concurrencia. Segundo, las reglas pasaron a una tabla versionada por clave — responde a RSK-01. Tercero, la idempotencia guarda una huella del cuerpo para detectar una clave reutilizada con otro contenido.”

## Bloque 3 · Demostración (2:00–4:45)

1. **Samuel Rios** → “Reportar un problema”: `MAIN-B01-101`, Electrical, “Tomacorriente quemado”, urgencia Alta → aparece en “Mis solicitudes” como **EN_REVISION**.
   > “La ubicación se valida contra el directorio simulado y se guarda una foto de cómo era.”
2. **Luis Herrera** (Coordinación) → “Cola de triage”: confirmar urgencia Alta → **Validar** → crear orden asignando a **Jorge Salcedo**.
   > “No se puede crear una orden sin validar ni sin responsable: la base tiene `responsable_subject NOT NULL`.”
3. **Jorge Salcedo** (Técnico) → “Mis órdenes”:
   - Intentar iniciar **sin observación** → la pantalla pide la observación. *(caso de error)*
     > “Esto es solo validación de formulario; la regla real está en la API: si alguien llama sin evidencia responde 422 EVIDENCIA_REQUERIDA, y lo cubre la prueba E2E.”
   - Escribir una observación → **Iniciar** → EN_PROGRESO.
   - **Registrar bloqueo** de materiales con parte responsable y fecha de seguimiento → BLOQUEADA_MATERIALES.
   - **Reanudar** → escribir observación → **Resolver** → RESUELTA.
4. **Mariana Ibarra** (otro técnico): su bandeja no muestra la orden de Jorge.
   > “La API filtra por el usuario autenticado; si intentara actuar sobre ella recibe 403, y la prueba QS-04 lo verifica.”
5. **Samuel Rios** → “Pendientes de confirmar” → **Confirmar cierre** → CERRADA (tipo CONFIRMADO).
6. Abrir **Notificaciones** de Samuel: cada cambio de estado le llegó. El historial completo con actor se muestra en la prueba E2E (paso 11) o con `GET /api/ordenes/{id}/historial`.

## Bloque 4 · Evidencia (4:45–6:00)

En la terminal: `npm run test:integracion` (tarda ~2 s).

> “Estas 9 pruebas corren contra la API y MySQL reales. Las más importantes:
> - **QS-01**: dos supervisores reasignan la misma orden al mismo tiempo: una gana, la otra recibe 409, y queda un solo responsable.
> - **QS-02**: el afectado confirma justo cuando vence el plazo y el planificador cierra: hay un solo cierre y una sola entrada de auditoría.
> - **QS-06**: el técnico reenvía tres veces el mismo comando por mala señal: un solo cambio.
> - **QS-07**: con el servicio de notificaciones caído, el cambio de estado se guarda igual y la notificación se entrega después, una sola vez.
> - **QS-05**: cambiamos la regla de evidencia por configuración y el comportamiento cambia sin tocar código.
>
> Divergencias con el diseño: renombramos tablas, la ubicación se guarda como snapshot en vez de una caché, y no usamos el código del starter Python, solo sus datos.
> Pendiente para la Evaluación 4: confirmar con el profesor la pila Node/MySQL y los roles inferidos del pack, importar el historial del pack con reglas de normalización, el escalamiento automático y pruebas automáticas de duplicados, reapertura y tablero. Gracias.”

---

### Preguntas probables y respuesta corta

| Pregunta | Respuesta |
|---|---|
| ¿Por qué no microservicios? | ~250–400 reportes/mes y 3 personas: la sobrecarga operativa no se justifica (E2-ADR-001). Las fronteras se garantizan con `deps:check`. |
| ¿Dónde está la regla de transición? | `ordenes-trabajo/transiciones.js` (dominio puro) + matriz de evidencia en `regla_politica`. |
| ¿Cómo evitan dobles cierres? | Planificador y confirmación bloquean la misma fila (`FOR UPDATE`) y validan el estado; la confirmación vencida responde 409. Prueba QS-02. |
| ¿Qué pasa si se cae la notificación? | Se guarda en `entrega_notificacion` en la misma transacción; el planificador reintenta. Prueba QS-07. |
| ¿La auditoría se puede alterar? | No: triggers de MySQL rechazan `UPDATE` y `DELETE`. Prueba BR-12. |
| ¿Qué es simulado? | Identidad (`x-subject`), directorio de ubicaciones y proveedor de notificaciones. |
