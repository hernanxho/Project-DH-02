# Project DH-02: Sistema de Mantenimiento y Órdenes de Trabajo

Software Design II, Horizon University · Digital Horizon Initiative

**Equipo:** Hernán Mundell, David Gutierrez, Mike Buelvas

Monolito modular (React + Node.js + MySQL) según el documento de diseño de la Evaluación 2 (`docs/`).

## Estructura

```
├── docs/                 documento de diseño (Evaluación 2)
├── backend/              Node.js (API + módulos de negocio + planificador)
│   ├── db/               schema.sql y seed.sql (MySQL)
│   ├── src/modulos/      un módulo por responsabilidad (sección 5.10)
│   ├── src/adaptadores/  servicios simulados: identidad, ubicaciones, notificación
│   ├── src/planificador/ plazos y entregas
│   ├── src/compartido/   config, db, errores, validación
│   └── test/
├── frontend/             React (Vite)
└── docker-compose.yml    MySQL para desarrollo
```

## Requisitos

Node.js 22.12 o superior (Vite 8), Docker Desktop (para MySQL 8.0.16 o superior) y Git.

## Acuerdos y contribución

- Contratos públicos entre módulos: [`docs/contratos.md`](docs/contratos.md) (propuesta pendiente de aprobación del equipo).
- Plantilla de ADR para registrar decisiones y comparar diseño previsto con diseño real: [`docs/adr/0000-plantilla.md`](docs/adr/0000-plantilla.md).
- Plantillas de issues y Pull Requests: [`.github/`](.github/).
- La decisión del equipo para la implementación es Node.js y MySQL, siguiendo el diseño de Evaluación 2. Falta confirmar si el profesor acepta usar esta pila en lugar del starter Python (E2-ADR-010).

## Puesta en marcha

```bash
# 1. Base de datos (crea las tablas y datos semilla la primera vez)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm ci
npm run dev          # http://localhost:3000/api/salud

# 3. Frontend (otra terminal)
cd frontend
npm ci
npm run dev          # http://localhost:5173
```

Si cambias `schema.sql` y quieres recrear la base: `docker compose down -v && docker compose up -d`.

Si ya tenías creado el volumen MySQL con el esqueleto anterior, aplica una sola vez la migración [`backend/db/migrations/001-prototype-workflows.sql`](backend/db/migrations/001-prototype-workflows.sql) desde Git Bash:

```bash
docker exec -i -e MYSQL_PWD=dh02 dh02-mysql mysql -u dh02 dh02 < backend/db/migrations/001-prototype-workflows.sql
```

Después aplica una sola vez las migraciones [`002-dh02-pack-reference-roles.sql`](backend/db/migrations/002-dh02-pack-reference-roles.sql), [`003-fase1-politicas-auditoria.sql`](backend/db/migrations/003-fase1-politicas-auditoria.sql) y [`004-idempotencia-huella.sql`](backend/db/migrations/004-idempotencia-huella.sql) para agregar perfiles, catálogos configurables, protección del historial y verificación de reintentos a ese volumen existente.

## Comandos útiles (backend)

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas (tabla de transiciones de la orden) |
| `npm run deps:check` | Verifica que ningún módulo importe archivos internos de otro (QS-10) |

## Reglas del equipo

- Cada módulo expone **solo** su `index.js`; no se importan archivos internos de otro módulo.
- Las reglas de dominio (`transiciones.js`) no importan base de datos ni adaptadores.
- Ramas `feature/...`, Pull Request y revisión de otro compañero antes de unir a `main`.
- `git pull` antes de empezar a trabajar. Prefijos de commit: `feat:`, `fix:`, `docs:`, `test:`.

## Reparto de módulos

| Persona | Módulos | Requisitos |
|---|---|---|
| 1. Entrada y control | identidad-acceso, solicitudes-triage, adaptadores | RF-13, RF-01 a RF-04 |
| 2. Núcleo de órdenes | ordenes-trabajo, ejecucion-evidencia, auditoria | RF-05 a RF-08, RF-11 |
| 3. Cierre y vigilancia | notificaciones-plazos, reglas-politicas, reportes-tablero, planificador | RF-02, RF-09, RF-10, RF-12 |

El script [`scripts/verificar-entorno.sh`](scripts/verificar-entorno.sh) comprueba herramientas, archivos y dependencias instaladas. Ejecútalo desde Git Bash en la raíz con `bash scripts/verificar-entorno.sh`; cada integrante debe compartir la salida para cerrar la verificación de las tres máquinas.

### Estado del prototipo

La pantalla de solicitante permite crear solicitudes con fotos y consultar las propias; coordinación puede revisar, validar, rechazar, sugerir/vincular duplicados y crear una orden para una solicitud validada. El técnico puede consultar sus órdenes filtradas por ubicación, estado y prioridad, registrar observaciones, evidencias con fotos, materiales y bloqueos, e iniciar o resolver trabajo. Los comandos guardan estado, auditoría y notificaciones en una sola transacción, controlan la versión vista y aceptan claves de idempotencia. Los catálogos de ubicaciones y categorías, e identidades/perfiles técnicos, se proyectan del pack DH-02; los CSV operacionales se conservan como fuente de descubrimiento y no se importan sin acordar su normalización. Las políticas iniciales se cargan desde `backend/db/seed.sql` al crear la base.

El avance y los pendientes de la Fase 0 están en [`docs/fase-0.md`](docs/fase-0.md).
Los datos del release y sus decisiones de integración están documentados en [`docs/pack-dh02.md`](docs/pack-dh02.md).
