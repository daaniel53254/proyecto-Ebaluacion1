#!/usr/bin/env bash
# =============================================================================
#  Instalación del entorno de Big Data (HDFS + YARN + Hive + MLflow)
#  Proyecto Ebaluacion1
#
#  Uso, desde la raíz del repositorio:
#      bash instalar.sh            instala, arranca y valida
#      bash instalar.sh --rapido   igual, pero sin el script de validación
#
#  Sirve para Windows (Git Bash o WSL), macOS y Linux.
# =============================================================================
set -euo pipefail

export MSYS_NO_PATHCONV=1   # Git Bash: no convertir rutas tipo /bronze
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUERTOS=(9870 9000 8088 10000 5000)
VALIDAR=1
[ "${1:-}" = "--rapido" ] && VALIDAR=0

paso()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m[AVISO]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

# ----------------------------------------------------------------- 1. Sistema
paso "1/6 Sistema operativo"
case "$(uname -s)" in
  Linux*)
    if grep -qi microsoft /proc/version 2>/dev/null; then SO="WSL"; else SO="Linux"; fi ;;
  Darwin*)               SO="macOS" ;;
  MINGW*|MSYS*|CYGWIN*)  SO="Windows" ;;
  *)                     SO="desconocido" ;;
esac
ARQ="$(uname -m)"
ok "Detectado: $SO ($ARQ)"
if [[ "$ARQ" == "arm64" || "$ARQ" == "aarch64" ]]; then
  aviso "Procesador ARM (p. ej. Mac con chip M). Las imágenes de Hadoop y Hive solo"
  aviso "existen para amd64 y se ejecutarán emuladas: irá más lento, pero funciona."
  [ "$SO" = "macOS" ] && aviso "Activa en Docker Desktop: Settings > General > 'Use Rosetta for x86_64/amd64 emulation'."
fi

# ---------------------------------------------------------- 2. Herramientas
paso "2/6 Herramientas necesarias"
command -v git    >/dev/null || error "Falta Git. Instálalo desde https://git-scm.com/downloads"
ok "Git $(git --version | awk '{print $3}')"
command -v docker >/dev/null || error "Falta Docker. Instala Docker Desktop: https://www.docker.com/products/docker-desktop/"
docker compose version >/dev/null 2>&1 || error "Falta Docker Compose v2 (el comando 'docker compose'). Actualiza Docker."
ok "$(docker compose version)"
command -v curl   >/dev/null || error "Falta curl."

# ------------------------------------------------------- 3. Motor de Docker
paso "3/6 Motor de Docker"
if ! docker info >/dev/null 2>&1; then
  aviso "Docker no está arrancado. Intento abrirlo..."
  case "$SO" in
    Windows) "/c/Program Files/Docker/Docker/Docker Desktop.exe" >/dev/null 2>&1 & ;;
    WSL)     "/mnt/c/Program Files/Docker/Docker/Docker Desktop.exe" >/dev/null 2>&1 & ;;
    macOS)   open -a Docker ;;
    Linux)   sudo systemctl start docker || true ;;
  esac
  for _ in $(seq 1 40); do docker info >/dev/null 2>&1 && break; sleep 3; done
  docker info >/dev/null 2>&1 || error "Docker sigue sin responder. Ábrelo a mano, espera a que esté en marcha y repite."
fi
ok "Docker $(docker info --format '{{.ServerVersion}}') en marcha"

MEM_GB=$(( $(docker info --format '{{.MemTotal}}') / 1024 / 1024 / 1024 ))
if [ "$MEM_GB" -lt 6 ]; then
  aviso "Docker solo tiene ${MEM_GB} GB de RAM. Se recomiendan 8 GB (Docker Desktop > Settings > Resources)."
else
  ok "Memoria para Docker: ${MEM_GB} GB"
fi

# -------------------------------------------------------------- 4. Puertos
paso "4/6 Puertos libres"
cd "$RAIZ/docker"
if [ -n "$(docker compose ps -q 2>/dev/null)" ]; then
  ok "El entorno ya estaba creado: se reutiliza"
else
  ocupados=()
  for p in "${PUERTOS[@]}"; do
    (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null && ocupados+=("$p")
  done
  if [ ${#ocupados[@]} -gt 0 ]; then
    msg="Puertos en uso: ${ocupados[*]}. Cierra lo que los ocupa o cámbialos en docker/docker-compose.yml."
    [[ " ${ocupados[*]} " == *" 5000 "* && "$SO" == "macOS" ]] && \
      msg="$msg En Mac el 5000 lo usa AirPlay: desactívalo en Ajustes > General > AirDrop y Handoff > Receptor AirPlay."
    error "$msg"
  fi
  ok "Puertos ${PUERTOS[*]} libres"
fi

# ------------------------------------------------------------- 5. Arranque
paso "5/6 Descarga de imágenes y arranque (la primera vez tarda: ~12 GB)"
mkdir -p "$RAIZ/data/entrada" "$RAIZ/mlruns"
docker compose pull
docker compose up -d --wait --wait-timeout 600 \
  || { docker compose ps; error "Algún servicio no ha arrancado. Mira sus registros con: cd docker && docker compose logs <servicio>"; }
docker compose ps --format 'table {{.Name}}\t{{.Status}}'

# ----------------------------------------------------------- 6. Validación
paso "6/6 Validación"
if [ "$VALIDAR" -eq 1 ]; then
  bash "$RAIZ/bigdata/validar_entorno.sh"
else
  aviso "Validación omitida (--rapido). Puedes lanzarla con: bash bigdata/validar_entorno.sh"
fi

cat <<'EOF'

  Entorno listo:
    HDFS (web)    http://localhost:9870
    YARN          http://localhost:8088
    HiveServer2   jdbc:hive2://localhost:10000
    MLflow        http://localhost:5000

  Para pararlo:   cd docker && docker compose down
EOF
