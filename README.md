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

Node.js 20 o superior, Docker Desktop (para MySQL) y Git.

## Puesta en marcha

```bash
# 1. Base de datos (crea las tablas y datos semilla la primera vez)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:3000/api/salud

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Si cambias `schema.sql` y quieres recrear la base: `docker compose down -v && docker compose up -d`.

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

Las rutas pendientes responden `501 NO_IMPLEMENTADO` y están marcadas con su RF en cada `rutas.js`.
