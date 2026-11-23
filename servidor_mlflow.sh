#!/usr/bin/env bash
# =============================================================================
#  Servidor de MLflow en local (fuera de Docker)
#
#  Uso, desde la raíz del repositorio:
#      bash servidor_mlflow.sh instalar   crea .venv-mlflow e instala MLflow
#      bash servidor_mlflow.sh arrancar   arranca el servidor en http://localhost:5000 (instala si hace falta)
#      bash servidor_mlflow.sh parar      lo para
#      bash servidor_mlflow.sh estado     dice si está en marcha
#
#  Datos: mlruns/mlflow.db (experimentos, ejecuciones y registro de modelos) y mlruns/ (artefactos).
#  Funciona en Windows (Git Bash), macOS y Linux. En Windows con Anaconda también vale servidor_mlflow.bat.
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$RAIZ/.venv-mlflow"
DATOS="$RAIZ/mlruns"
PUERTO="${MLFLOW_PUERTO:-5000}"
VERSION_MLFLOW="${MLFLOW_VERSION:->=3,<4}"
URL="http://localhost:$PUERTO"

ok()    { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m[AVISO]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

es_windows() { case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; *) return 1 ;; esac; }

python_base() {
  # Primer Python 3.9+ disponible: python3, python, py -3 o el de Anaconda
  local c
  for c in python3 python "py -3" "$HOME/anaconda3/python.exe" "$HOME/miniconda3/python.exe" "$HOME/anaconda3/bin/python"; do
    if $c -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then
      echo "$c"; return 0
    fi
  done
  return 1
}

python_venv() {
  if es_windows; then echo "$VENV/Scripts/python.exe"; else echo "$VENV/bin/python"; fi
}

responde() { curl -s -o /dev/null --max-time 3 "$URL/health"; }

instalar() {
  local py vpy
  vpy="$(python_venv)"
  if [ -x "$vpy" ] && "$vpy" -c "import mlflow" >/dev/null 2>&1; then
    ok "MLflow $("$vpy" -c 'import mlflow; print(mlflow.__version__)') ya instalado en .venv-mlflow"
    return
  fi
  py="$(python_base)" || error "Falta Python 3.9 o superior. Instálalo (python.org o Anaconda) y repite."
  ok "Python base: $($py --version 2>&1) ($py)"
  [ -x "$vpy" ] || $py -m venv "$VENV" || error "No se pudo crear el entorno virtual .venv-mlflow"
  echo "Instalando MLflow en .venv-mlflow (la primera vez tarda unos minutos)..."
  "$vpy" -m pip install -q --upgrade pip
  "$vpy" -m pip install -q "mlflow$VERSION_MLFLOW" || error "No se pudo instalar MLflow (¿hay conexión a internet?)"
  ok "MLflow $("$vpy" -c 'import mlflow; print(mlflow.__version__)') instalado"
}

arrancar() {
  if responde; then ok "MLflow ya está en marcha en $URL"; return; fi
  (exec 3<>"/dev/tcp/127.0.0.1/$PUERTO") 2>/dev/null && \
    error "El puerto $PUERTO está ocupado por otro programa. Si es el MLflow antiguo de Docker: cd docker && docker compose up -d --remove-orphans"
  instalar
  mkdir -p "$DATOS"
  cd "$DATOS"
  # Rutas relativas a mlruns/: así funcionan igual en Windows y en Linux/macOS
  nohup "$(python_venv)" -m mlflow server --host 127.0.0.1 --port "$PUERTO" \
    --backend-store-uri sqlite:///mlflow.db --artifacts-destination ./ --serve-artifacts \
    > "$DATOS/servidor.log" 2>&1 &
  echo $! > "$DATOS/servidor.pid"
  for _ in $(seq 1 60); do responde && break; sleep 2; done
  responde || error "MLflow no ha arrancado. Mira el registro: mlruns/servidor.log"
  ok "MLflow en marcha en $URL (registro en mlruns/servidor.log)"
}

parar() {
  if ! responde; then ok "MLflow no estaba en marcha"; rm -f "$DATOS/servidor.pid"; return; fi
  if es_windows; then
    powershell.exe -NoProfile -Command \
      "Get-NetTCPConnection -LocalPort $PUERTO -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }" \
      >/dev/null 2>&1 || true
  fi
  [ -f "$DATOS/servidor.pid" ] && kill "$(cat "$DATOS/servidor.pid")" 2>/dev/null || true
  for _ in $(seq 1 15); do responde || break; sleep 1; done
  responde && error "No se pudo parar MLflow: ciérralo desde el administrador de tareas"
  rm -f "$DATOS/servidor.pid"
  ok "MLflow parado"
}

case "${1:-arrancar}" in
  instalar) instalar ;;
  arrancar) arrancar ;;
  parar)    parar ;;
  estado)   if responde; then ok "MLflow en marcha en $URL"; else aviso "MLflow parado (bash servidor_mlflow.sh arrancar)"; exit 1; fi ;;
  *)        error "Uso: bash servidor_mlflow.sh [instalar|arrancar|parar|estado]" ;;
esac
