#!/usr/bin/env bash
# Verifica que tu máquina puede correr el proyecto DH-02.
# Uso (desde la raíz del repo, en Git Bash):  bash scripts/verificar-entorno.sh
# No modifica nada: solo revisa y reporta.

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fallos=0
ok()    { echo "  [OK]    $1"; }
falla() { echo "  [FALLA] $1"; fallos=$((fallos+1)); }
aviso() { echo "  [AVISO] $1"; }

echo "== 1. Herramientas =="
if command -v git >/dev/null 2>&1; then ok "git $(git --version | awk '{print $3}')"; else falla "git no está instalado"; fi

if command -v node >/dev/null 2>&1; then
  mayor=$(node -v | sed 's/v\([0-9]*\).*/\1/')
  if [ "$mayor" -ge 20 ]; then ok "node $(node -v)"; else falla "node $(node -v): se necesita 20 o superior"; fi
else falla "node no está instalado (https://nodejs.org)"; fi

if command -v npm >/dev/null 2>&1; then ok "npm $(npm -v)"; else falla "npm no está instalado"; fi

if command -v docker >/dev/null 2>&1; then
  ok "docker $(docker --version | awk '{print $3}' | tr -d ',')"
  if docker info >/dev/null 2>&1; then ok "el servicio de Docker está corriendo"
  else falla "Docker está instalado pero no corriendo: abre Docker Desktop"; fi
  if docker compose version >/dev/null 2>&1; then ok "docker compose disponible"; else falla "docker compose no disponible"; fi
else falla "docker no está instalado (Docker Desktop)"; fi

echo "== 2. Configuración de Git =="
[ -n "$(git config --global user.name)" ]  && ok "user.name = $(git config --global user.name)"   || falla "falta git config --global user.name"
[ -n "$(git config --global user.email)" ] && ok "user.email = $(git config --global user.email)" || falla "falta git config --global user.email"
git -C "$RAIZ" remote get-url origin >/dev/null 2>&1 && ok "remoto origin = $(git -C "$RAIZ" remote get-url origin)" || falla "el repo no tiene remoto 'origin'"

echo "== 3. Archivos del proyecto =="
for f in backend/package.json backend/db/schema.sql backend/db/seed.sql docker-compose.yml frontend/package.json; do
  [ -f "$RAIZ/$f" ] && ok "$f" || falla "falta $f"
done
if [ -f "$RAIZ/backend/.env" ]; then ok "backend/.env existe"
else falla "falta backend/.env (copia backend/.env.example a backend/.env)"; fi

echo "== 4. Base de datos =="
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q '^dh02-mysql$'; then ok "contenedor dh02-mysql corriendo"
  else aviso "contenedor dh02-mysql no está corriendo: ejecuta  docker compose up -d"; fi
fi

echo "== 5. Backend =="
if [ -d "$RAIZ/backend/node_modules" ]; then
  ok "dependencias del backend instaladas"
  if (cd "$RAIZ/backend" && npm test >/dev/null 2>&1); then ok "npm test pasa"; else falla "npm test falla (corre 'cd backend && npm test' para ver el error)"; fi
  if (cd "$RAIZ/backend" && npm run deps:check >/dev/null 2>&1); then ok "npm run deps:check pasa"; else falla "deps:check encontró violaciones de fronteras entre módulos"; fi
else aviso "faltan dependencias del backend: ejecuta  cd backend && npm install"; fi

echo "== 6. API en marcha (opcional) =="
if command -v curl >/dev/null 2>&1; then
  resp=$(curl -s --max-time 3 http://localhost:3000/api/salud)
  if echo "$resp" | grep -q '"baseDatos":"ok"'; then ok "GET /api/salud -> $resp"
  else aviso "la API no responde en localhost:3000 (normal si aún no la has iniciado con 'npm run dev')"; fi
fi

echo "== 7. Frontend =="
if [ -d "$RAIZ/frontend/node_modules" ]; then ok "dependencias del frontend instaladas"
else aviso "faltan dependencias del frontend: ejecuta  cd frontend && npm install"; fi

echo
if [ "$fallos" -eq 0 ]; then echo "Resultado: todo en orden ($fallos fallos)."; else echo "Resultado: $fallos fallo(s). Corrígelos y vuelve a ejecutar."; fi
exit $fallos
