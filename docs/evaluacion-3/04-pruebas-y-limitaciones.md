# Evaluación 3 · Pruebas, evidencia y límites del incremento

## 1. Cómo ejecutar las pruebas

Requisitos: MySQL en marcha con `schema.sql` + `seed.sql` cargados (`docker compose up -d`) y `backend/.env` creado desde `.env.example`.

```bash
cd backend
npm ci
npm test                  # 11 pruebas unitarias (dominio y autorización, sin BD)
npm run test:integracion  # 9 pruebas de integración: API real + MySQL real
npm run deps:check        # fronteras entre módulos (QS-10)
```

Las pruebas de integración levantan la API en un puerto libre y crean sus propios datos (no borran nada), por lo que pueden repetirse sobre la misma base. Para ver datos limpios en la demo: `docker compose down -v && docker compose up -d`.

## 2. Resultados (8 de noviembre de 2026 · Node 22 · MySQL 8.0)

| Suite | Resultado | Archivo de evidencia |
|---|---|---|
| Unitarias (`npm test`) | 11/11 pasan | `evidence/01-pruebas-unitarias.txt` |
| Integración (`npm run test:integracion`) | 9/9 pasan | `evidence/02-pruebas-integracion.txt` |
| Fronteras (`npm run deps:check`) | 0 violaciones · 49 módulos · 138 dependencias | `evidence/03-fronteras-modulos.txt` |
| Build del frontend (`npm run build`) | Compila sin errores | — |
| Recorrido de pantallas (5 roles, Playwright) | Sin errores de consola | `evidence/capturas/*.png` |

### Pruebas de integración: qué demuestra cada una

| # | Prueba | Tipo | Resultado esperado y obtenido |
|---|---|---|---|
| 1 | E2E reporte → triage → orden → ejecución → bloqueo → resolución → cierre | Caso exitoso + inválidos en el camino | `201/200` en cada paso; `422` al crear orden sin validar; `422 EVIDENCIA_REQUERIDA` al iniciar sin evidencia; `403` si el técnico intenta cerrar; historial con 6 cambios de estado y su actor |
| 2 | El afectado rechaza el cierre | Caso alternativo | Orden vuelve a `EN_PROGRESO`; plazos de cierre automático cancelados |
| 3 | QS-01 reasignaciones simultáneas | Riesgo de dominio | Una `200`, la otra `409 CONFLICTO_VERSION`; un solo responsable |
| 4 | QS-04 acciones no autorizadas | Seguridad | `403` (técnico ajeno, estudiante, técnico en triage), `401` sin identidad; 0 filas nuevas de auditoría |
| 5 | QS-02 carrera confirmación vs. cierre automático | Riesgo de dominio | 1 cierre `AUTOMATICO`; 1 auditoría; reejecutar no duplica |
| 6 | QS-06 tres reenvíos del mismo comando | Fiabilidad | 1 evidencia, 1 cambio de estado, misma respuesta; clave reutilizada → `409` |
| 7 | QS-07 proveedor de notificaciones caído | Fiabilidad | Cambio confirmado; notificación `FALLIDA` en BD; luego `ENTREGADA` una vez |
| 8 | BR-12 auditoría inmutable | Integridad | `UPDATE` y `DELETE` sobre `auditoria` rechazados por la BD |
| 9 | QS-05 regla configurable | Modificabilidad | Con la matriz nueva, iniciar sin evidencia → `200`; restaurada → `422`; coordinación no puede cambiarla (`403`) |

**Cómo se simula el tiempo en QS-02:** la prueba mueve `vence_en` de la confirmación y del plazo al pasado (en vez de esperar 72 h) y ejecuta el planificador al mismo tiempo que la confirmación del afectado.

**Cómo se simula la caída en QS-07:** `adaptadores/notificacion.js` expone `simulacion.caido`; con `true` el envío lanza error. La cola vive en MySQL (`entrega_notificacion`), por eso un reinicio de la API no la pierde.

## 3. Qué es real, qué es simulado y qué falta

| Elemento | Estado |
|---|---|
| Flujo central RF-01…RF-09, RF-11, RF-13 | **VERIFICADO** con pruebas automáticas |
| Duplicados (RF-04), reapertura (RF-10), tablero (RF-12), consulta de solicitudes (RF-02) | **IMPLEMENTADO**, verificado a mano (`docs/fase-1.md`), sin prueba automática |
| Identidad institucional | **SIMULADO**: encabezado `x-subject` + `mock_identities.json`; no hay contraseña ni token |
| Directorio de ubicaciones | **SIMULADO**: mock del pack DH-02 |
| Proveedor de notificaciones | **SIMULADO**: escribe en consola; puede forzarse a fallar |
| Importación de órdenes/solicitudes históricas del pack | **PENDIENTE**: anomalías intencionales sin reglas de normalización acordadas |
| Escalamiento automático de atrasos, habilidades finas de técnicos | **PENDIENTE** |
| Despliegue fuera de la máquina local | **DISEÑADO** |

## 4. Riesgos abiertos y supuestos no validados

| ID | Riesgo / supuesto | Impacto | Próximo paso |
|---|---|---|---|
| R-E3-01 | El profesor no ha confirmado formalmente Node.js + MySQL en vez del starter Python (E2-ADR-009/010) | Penalización por pila | Confirmar en la revisión |
| R-E3-02 | Roles de coordinación, supervisión y representante inferidos de los escenarios del pack (`docs/pack-dh02.md`) | Permisos distintos a los esperados por el cliente | Validar con el profesor/cliente |
| R-E3-03 | Plazo de 72 h en horas corridas, no hábiles (ASM-014) | Cierres automáticos en fin de semana | Regla configurable; decidir con el cliente |
| R-E3-04 | Autenticación simulada sin secreto: cualquiera puede enviar otro `x-subject` | No apto para producción | Reemplazar el adaptador por OIDC institucional (E2-ADR-007) |
| R-E3-05 | Planificador en el mismo proceso: con varias instancias habría trabajo repetido (no dobles cierres) | Rendimiento | Elegir una instancia líder o mover a un worker |
| R-E3-06 | Las pruebas de integración dejan datos en la base usada | Base de demo “sucia” tras correrlas | Usar una base dedicada o recrear el volumen antes de la demo |

## 5. Defectos conocidos

- Las pantallas son funcionales pero sin diseño visual; en la bandeja del técnico cada orden muestra todos sus formularios a la vez, lo que se vuelve largo con muchas órdenes.
- `npm test` sin argumentos ejecuta solo las pruebas unitarias; las de integración requieren BD y van en un comando aparte a propósito.
