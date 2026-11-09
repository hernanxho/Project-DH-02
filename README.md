# DH-02 · Sistema de Mantenimiento y Órdenes de Trabajo — Evaluación 3

Software Design II · Horizon University · Digital Horizon Initiative

| | |
|---|---|
| **Equipo** | Hernán Mundell, David Gutierrez, Mike Buelvas |
| **Proyecto** | DH-02 · Campus Facilities & Operations |
| **Versión** | `v0.3.0` · Evaluación 3 · 8 de noviembre de 2026 |
| **Caso de uso implementado** | Reporte → triage → orden con responsable explícito → ejecución con evidencia → bloqueo → resolución → cierre confirmado por el afectado o automático a las 72 h |
| **Arquitectura** | Monolito modular: React (Vite) + Node.js (Express) + MySQL 8 (E2-ADR-001, E2-ADR-009) |
| **Video** | ver [`video-link.txt`](video-link.txt) |

## Índice de la entrega

| Qué buscas | Dónde está |
|---|---|
| Arquitectura actualizada (vistas, componentes, secuencia, estados, datos, despliegue) | [`docs/evaluacion-3/01-arquitectura-actualizada.md`](docs/evaluacion-3/01-arquitectura-actualizada.md) |
| ADRs: estado vigente y diseño previsto vs. real | [`docs/evaluacion-3/02-decisiones-adr.md`](docs/evaluacion-3/02-decisiones-adr.md) |
| Trazabilidad requisito → decisión → componente → código → prueba | [`docs/evaluacion-3/03-trazabilidad.md`](docs/evaluacion-3/03-trazabilidad.md) |
| Pruebas, resultados, simulado vs. real, riesgos y pendientes | [`docs/evaluacion-3/04-pruebas-y-limitaciones.md`](docs/evaluacion-3/04-pruebas-y-limitaciones.md) |
| Guion del video | [`docs/evaluacion-3/05-guion-video.md`](docs/evaluacion-3/05-guion-video.md) |
| Diseño de la Evaluación 2 (base) | [`docs/eva2final.md`](docs/eva2final.md) |
| Contratos entre módulos | [`docs/contratos.md`](docs/contratos.md) |
| Código del backend / frontend | [`backend/src/`](backend/src/) · [`frontend/src/`](frontend/src/) |
| Pruebas unitarias / de integración | [`backend/test/`](backend/test/) · [`backend/integracion/`](backend/integracion/) |
| Evidencia de ejecución (salidas y capturas) | [`evidence/`](evidence/) |
| Datos sintéticos del pack DH-02 | [`data/dh02-release1/`](data/dh02-release1/) |

## 1. Requisitos

- Node.js **22.12 o superior** (Vite 8 lo exige) y npm.
- Docker Desktop (para MySQL 8.0). Alternativa sin Docker: un MySQL 8.0.16+ local con la base `dh02` y el usuario `dh02`/`dh02`.
- Git Bash (Windows) o cualquier terminal bash.

## 2. Preparación (datos sintéticos, sin credenciales reales)

```bash
# Base de datos: crea tablas (backend/db/schema.sql) y carga roles, técnicos y reglas (backend/db/seed.sql)
docker compose up -d

# Backend
cd backend
cp .env.example .env
npm ci

# Frontend (otra terminal)
cd frontend
npm ci
```

Los catálogos (12 ubicaciones activas, 14 categorías, identidades y técnicos) se leen del pack del profesor en `data/dh02-release1/`; no requieren carga manual.

Sin Docker, desde la raíz: `mysql -u dh02 -p dh02 < backend/db/schema.sql` y luego `seed.sql`.

## 3. Ejecución

```bash
cd backend && npm run dev     # API en http://localhost:3000  (salud: /api/salud)
cd frontend && npm run dev    # Interfaz en http://localhost:5173
```

**Usuarios de prueba** (identidad simulada: se elige en la pantalla de inicio, sin contraseña):

| Usuario | Rol | Para qué en la demo |
|---|---|---|
| Samuel Rios (`HU-STU-2001`) | Solicitante / afectado | Reporta y confirma o rechaza el cierre |
| Luis Herrera (`HU-EMP-2201`) | Coordinación | Triage, duplicados, crea la orden |
| Jorge Salcedo (`TECH-001`) | Técnico electricidad | Ejecuta, evidencia, bloquea, resuelve |
| Mariana Ibarra (`TECH-002`) | Técnico plomería | Caso de acceso denegado (no es responsable) |
| Ricardo Torres (`HU-EMP-2202`) | Supervisión | Reasigna, tablero, reglas |
| Ana Sofia Ramirez (`HU-EMP-2203`) | Representante de `MAIN-B03` | Desbloquea órdenes por acceso |

**Recorrido sugerido:** Samuel reporta un daño en `MAIN-B01-101` → Luis lo valida y crea la orden para Jorge → Jorge la inicia con una observación, registra un bloqueo de materiales, la reanuda y la resuelve → Samuel la ve en “Pendientes de confirmar” y confirma el cierre. Caso de error: Mariana no ve la orden; si intenta actuar sobre ella la API responde `403`.

## 4. Verificación

```bash
cd backend
npm test                  # 11 pruebas unitarias (sin BD)
npm run test:integracion  # 9 pruebas contra la API y MySQL reales (requiere la BD en marcha)
npm run deps:check        # ningún módulo importa archivos internos de otro
```

Resultado esperado: `# pass 11`, `# pass 9` y `no dependency violations found`. Las salidas del 8 de noviembre de 2026 están en `evidence/`. Las pruebas de integración crean datos propios; para volver a una base limpia antes de la demo: `docker compose down -v && docker compose up -d`.

Si ya tenías el volumen de MySQL de una versión anterior del esqueleto, aplica una vez las migraciones `backend/db/migrations/001` a `004` (o recrea el volumen).

## 5. Limitaciones conocidas

- Identidad, directorio de ubicaciones y notificaciones son **simulados** (adaptadores).
- Duplicados, reapertura y tablero funcionan pero solo se verificaron a mano.
- No se importan las órdenes históricas del pack (tienen anomalías intencionales sin regla de normalización acordada).
- Detalle completo y riesgos abiertos: [`docs/evaluacion-3/04-pruebas-y-limitaciones.md`](docs/evaluacion-3/04-pruebas-y-limitaciones.md).

## 6. Estructura

```
├── README.md              este archivo (índice y pasos)
├── video-link.txt         enlace al video de 5–6 min
├── docs/                  E2 (eva2final.md), contratos, fases y evaluacion-3/
├── backend/               API Node.js: src/modulos (un módulo por responsabilidad), adaptadores, planificador
│   ├── db/                schema.sql, seed.sql, migrations/
│   ├── test/              pruebas unitarias
│   └── integracion/       pruebas de integración (Fase 2/3)
├── frontend/              React + Vite: páginas por rol
├── data/dh02-release1/    pack de datos del profesor (sin modificar)
├── evidence/              salidas de pruebas y capturas
└── docker-compose.yml     MySQL para desarrollo
```

## Reglas del equipo

- Cada módulo expone solo su `index.js`; las reglas de dominio (`transiciones.js`) no importan BD ni adaptadores.
- Todo comando HTTP lleva `Idempotency-Key` y se ejecuta en una sola transacción (`compartido/idempotencia.js`).
- Ramas `feature/...` + Pull Request revisado antes de unir a `main`.

| Persona | Módulos |
|---|---|
| Entrada y control | identidad-acceso, solicitudes-triage, adaptadores |
| Núcleo de órdenes | ordenes-trabajo, ejecucion-evidencia, auditoria |
| Cierre y vigilancia | notificaciones-plazos, reglas-politicas, reportes-tablero, planificador |
