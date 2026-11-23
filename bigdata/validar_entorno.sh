#!/usr/bin/env bash
# Valida el entorno local: contenedores, HDFS, Hive y MLflow (este último en local, fuera de Docker).
# Uso (desde la raíz del repo):  bash bigdata/validar_entorno.sh
# Funciona en Linux, macOS y Windows (Git Bash o WSL).
set -euo pipefail

# En Git Bash (Windows) evita que rutas como /bronze se conviertan en C:/Program Files/Git/bronze
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTENEDORES=(namenode datanode resourcemanager nodemanager hive-metastore-postgresql hive-metastore hiveserver2)
ESPERA_MAX=300          # segundos que se espera a que todo esté healthy
ARCHIVO=prueba_validacion.csv   # sin "_" ni "." delante: Hive ignora esos ficheros
JDBC="jdbc:hive2://localhost:10000"

paso()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }
ok()    { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

limpiar() {
  rm -f "$RAIZ/data/entrada/$ARCHIVO"
  docker exec namenode hdfs dfs -rm -r -f -skipTrash /bronze/test >/dev/null 2>&1 || true
}
trap limpiar EXIT

command -v docker >/dev/null || error "Docker no está instalado o no está en el PATH."
docker info >/dev/null 2>&1   || error "El motor de Docker no responde. ¿Está arrancado Docker Desktop?"

# ---------------------------------------------------------------- 1
paso "1/5 Contenedores en estado healthy"
inicio=$SECONDS
while :; do
  pendientes=()
  for c in "${CONTENEDORES[@]}"; do
    estado="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo "no existe")"
    [ "$estado" = "healthy" ] || pendientes+=("$c=$estado")
  done
  [ ${#pendientes[@]} -eq 0 ] && break
  if [ $((SECONDS - inicio)) -ge $ESPERA_MAX ]; then
    error "Tras ${ESPERA_MAX}s siguen sin estar healthy: ${pendientes[*]}"
  fi
  echo "  esperando... ${pendientes[*]}"
  sleep 10
done
for c in "${CONTENEDORES[@]}"; do ok "$c healthy"; done

# ---------------------------------------------------------------- 2
paso "2/5 Capas /bronze, /silver y /gold en HDFS"
docker exec namenode hdfs dfsadmin -safemode wait >/dev/null
docker exec namenode hdfs dfs -mkdir -p /bronze /silver /gold
docker exec namenode hdfs dfs -ls /
for d in bronze silver gold; do
  docker exec namenode hdfs dfs -test -d "/$d" || error "No existe /$d en HDFS"
done
ok "Directorios creados"

# ---------------------------------------------------------------- 3
paso "3/5 Subida de un archivo de prueba a /bronze/test/"
printf '1,rock\n2,pop\n3,jazz\n' > "$RAIZ/data/entrada/$ARCHIVO"
docker exec namenode test -f "/entrada/$ARCHIVO" \
  || error "El namenode no ve /entrada/$ARCHIVO: revisa el montaje de data/entrada"
docker exec namenode hdfs dfs -mkdir -p /bronze/test
docker exec namenode hdfs dfs -put -f "/entrada/$ARCHIVO" /bronze/test/
docker exec namenode hdfs dfs -du -h /bronze/test
ok "Archivo subido desde /entrada"

# ---------------------------------------------------------------- 4
paso "4/5 Hive: base de datos bronze, tabla externa, COUNT(*) y borrado"
beeline() { docker exec hiveserver2 beeline -u "$JDBC" -n root --silent=true --showHeader=false --outputformat=tsv2 "$@"; }

# HiveServer2 puede tardar unos segundos en aceptar sesiones aunque el puerto esté abierto
for intento in $(seq 1 12); do
  beeline -e "SELECT 1;" >/dev/null 2>&1 && break
  [ "$intento" -eq 12 ] && error "HiveServer2 no acepta conexiones en $JDBC"
  sleep 10
done

beeline -e "
CREATE DATABASE IF NOT EXISTS bronze;
DROP TABLE IF EXISTS bronze.prueba_validacion;
CREATE EXTERNAL TABLE bronze.prueba_validacion (id INT, genero STRING)
  ROW FORMAT DELIMITED FIELDS TERMINATED BY ','
  STORED AS TEXTFILE
  LOCATION 'hdfs://namenode:9000/bronze/test';
"
filas="$(beeline -e "SELECT COUNT(*) FROM bronze.prueba_validacion;" 2>/dev/null | tr -d '[:space:]')"
echo "  SELECT COUNT(*) -> $filas"
beeline -e "DROP TABLE bronze.prueba_validacion;"
[ "$filas" = "3" ] || error "Se esperaban 3 filas y Hive devolvió '$filas'"
quedan="$(beeline -e "SHOW TABLES IN bronze LIKE 'prueba_validacion';" 2>/dev/null | tr -d '[:space:]')"
[ -z "$quedan" ] || error "La tabla de prueba no se ha borrado"
ok "Tabla externa creada, consultada (3 filas) y borrada"

# ---------------------------------------------------------------- 5
paso "5/5 MLflow local en http://localhost:5000"
codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:5000/health || true)"
[ "$codigo" = "200" ] || error "MLflow no responde (HTTP '$codigo'). Arráncalo con: bash servidor_mlflow.sh arrancar"
ok "MLflow responde (HTTP 200)"

printf '\n\033[1;32mEntorno validado correctamente.\033[0m\n'
