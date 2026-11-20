#!/usr/bin/env bash
# Flujo de datos automatizado de la etapa Big Data: historiales de Spotify -> bronze -> silver -> gold.
#
#   1. Comprueba que el entorno Docker está sano.
#   2. preparar.py: quita datos personales y pasa los JSON a JSON Lines en data/entrada/.
#   3. ensuciar.py: introduce los problemas 1 a 8 del plan de ensuciado (semilla 42).
#   4. Sube los ficheros en bruto a HDFS: historial en /bronze/spotify/historial/persona=<seudonimo>/
#      y, si están en data/entrada/kaggle/, los CSV de Kaggle en /bronze/kaggle/<nombre>/.
#   5. Hive: tablas externas bronze.historial (JsonSerDe) y bronze.kaggle_<nombre> (CSV).
#   6. Hive: silver.reproducciones en Parquet (sql/silver.sql): limpia los 8 problemas, solo música,
#      hora local, franja, tipo de día, lote y no_salto.
#   7. Hive: gold.objetivo1 y gold.candidatas en Parquet (sql/gold.sql).
#   8. Comprobaciones medidas: tamaño en HDFS > 2 MB, filas en Hive = filas del manifiesto,
#      >= 3.000 filas por persona y cada problema del ensuciado a 0 en silver.
#   9. Exporta silver y gold a CSV en data/dataset/ para los notebooks (no se sube a Git).
#
# Uso (desde la raíz del repo):  bash bigdata/pipeline.sh
# Es idempotente: cada ejecución rehace bronze, silver y gold con lo que haya en data/raw/.
# Deja la salida completa en docs/evidencias/pipeline_<fecha>.log
set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JDBC="jdbc:hive2://localhost:10000"
SERDE_JAR="/opt/hive/hcatalog/share/hcatalog/hive-hcatalog-core-2.3.2.jar"
BRONZE=/bronze/spotify/historial
MIN_BYTES=$((2 * 1024 * 1024))
MIN_FILAS=3000
# Rutas relativas a la raíz: con MSYS_NO_PATHCONV, Git Bash no traduciría /c/... ni /tmp/...
# para el Python de Windows ni para docker cp
cd "$RAIZ"
# Un solo pipeline a la vez: dos ejecuciones borrarían las tablas y ficheros de la otra
CERROJO=data/.pipeline_en_marcha
if ! mkdir "$CERROJO" 2>/dev/null; then
  echo "[ERROR] Ya hay un pipeline en marcha (existe $CERROJO)."
  echo "        Si no es así (por ejemplo, se apagó el equipo a mitad), borra esa carpeta y vuelve a lanzarlo."
  exit 1
fi
TMP="data/.tmp_pipeline/$$"
mkdir -p "$TMP"
trap 'rm -rf "$TMP" "$CERROJO"' EXIT

mkdir -p "$RAIZ/docs/evidencias"
LOG="$RAIZ/docs/evidencias/pipeline_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee "$LOG") 2>&1

paso()  { printf '\n== %s ==\n' "$*"; }
ok()    { printf '[OK] %s\n' "$*"; }
aviso() { printf '[AVISO] %s\n' "$*"; }
error() { printf '[ERROR] %s\n' "$*" >&2; exit 1; }
# UTF-8 en la JVM de beeline: sin esto las tildes de los literales SQL se estropean
beeline() { docker exec -e HADOOP_CLIENT_OPTS=-Dfile.encoding=UTF-8 hiveserver2 \
              beeline -u "$JDBC" -n root --silent=true --showHeader=false --outputformat=tsv2 "$@" 2>/dev/null; }
# Ejecuta un fichero .sql: se copia al contenedor para que llegue en UTF-8 intacto
sql() { docker cp "$1" "hiveserver2:/tmp/$(basename "$1")" >/dev/null
        docker exec -e HADOOP_CLIENT_OPTS=-Dfile.encoding=UTF-8 hiveserver2 \
          beeline -u "$JDBC" -n root --silent=true --showHeader=false --outputformat=tsv2 \
          -f "/tmp/$(basename "$1")" 2>"$TMP/beeline_err.txt" \
          || { grep -E 'Error|FAILED' "$TMP/beeline_err.txt" | head -5 >&2; error "Falló $(basename "$1")"; }; }
hdfs()    { docker exec -e HADOOP_ROOT_LOGGER=WARN,console namenode hdfs dfs "$@"; }  # sin avisos INFO de SASL
# Exporta una tabla de Hive a CSV (lectura directa del Parquet, sin MapReduce)
exportar() {
  docker exec -e HADOOP_CLIENT_OPTS=-Dfile.encoding=UTF-8 hiveserver2 \
    beeline -u "$JDBC" -n root --silent=true --showHeader=true --outputformat=tsv2 \
    --hiveconf hive.fetch.task.conversion=more --hiveconf hive.resultset.use.unique.column.names=false \
    -e "SELECT * FROM $1;" 2>/dev/null > "$TMP/export.tsv"
  printf '  %-34s ' "$2"
  "$PY" -I bigdata/exportar.py "$TMP/export.tsv" "data/dataset/$2" --orden "$3"
}

echo "Pipeline iniciado: $(date '+%Y-%m-%d %H:%M:%S')"
inicio=$SECONDS

# ---------------------------------------------------------------- 1
paso "1/9 Entorno"
for c in namenode datanode resourcemanager nodemanager hive-metastore hiveserver2; do
  estado="$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "no existe")"
  [ "$estado" = "healthy" ] || error "$c está '$estado'. Arranca el entorno con: docker compose -f docker/docker-compose.yml up -d"
done
docker exec namenode hdfs dfsadmin -safemode wait >/dev/null
for intento in $(seq 1 12); do
  beeline -e "SELECT 1;" >/dev/null && break
  [ "$intento" -eq 12 ] && error "HiveServer2 no acepta conexiones"
  sleep 10
done
ok "HDFS, YARN y Hive responden"

# ---------------------------------------------------------------- 2
paso "2/9 Preparación (preparar.py)"
# En Windows "python3" puede ser el acceso directo de la Store, que no funciona: se prueba antes
PY=""
for candidato in python3 python; do
  if "$candidato" -c 'import sys; sys.exit(sys.version_info < (3, 8))' >/dev/null 2>&1; then PY="$candidato"; break; fi
done
[ -n "$PY" ] || error "Hace falta Python 3.8 o superior"
"$PY" -I bigdata/preparar.py --raw data/raw --salida data/entrada
MANIFIESTO=data/entrada/manifiesto.json
leer() { "$PY" -I -c "import json,sys; m=json.load(open(sys.argv[1],encoding='utf-8')); print($1)" "$MANIFIESTO"; }
ok "Manifiesto: $(leer "m['filas_total']") filas limpias"

# ---------------------------------------------------------------- 3
paso "3/9 Ensuciado reproducible (ensuciar.py, semilla 42)"
"$PY" -I bigdata/ensuciar.py --entrada data/entrada --semilla 42
FILAS_ESPERADAS="$(leer "m['filas_total']")"
ok "Manifiesto actualizado: $FILAS_ESPERADAS filas tras ensuciar"

# ---------------------------------------------------------------- 4
paso "4/9 Ingesta en bruto en HDFS (/bronze)"
docker exec namenode test -d /entrada/historial || error "El namenode no ve /entrada/historial"
hdfs -rm -r -f -skipTrash "$BRONZE" >/dev/null 2>&1 || true
hdfs -mkdir -p /bronze/spotify /bronze/spotify/meta
hdfs -put -f /entrada/historial /bronze/spotify/
hdfs -put -f /entrada/manifiesto.json /entrada/ensuciado.json /bronze/spotify/meta/
BYTES_HDFS="$(hdfs -du -s "$BRONZE" | awk '{print $1}')"
FICHEROS_HDFS="$(hdfs -count "$BRONZE" | awk '{print $2}')"
hdfs -du -h "$BRONZE"
ok "Historial: $FICHEROS_HDFS ficheros, $BYTES_HDFS bytes en $BRONZE"

KAGGLE=0
if ls data/entrada/kaggle/*.csv >/dev/null 2>&1; then
  KAGGLE=1
  hdfs -rm -r -f -skipTrash /bronze/kaggle >/dev/null 2>&1 || true
  for f in data/entrada/kaggle/*.csv; do
    nombre="$(basename "$f" .csv)"
    hdfs -mkdir -p "/bronze/kaggle/$nombre"
    hdfs -put -f "/entrada/kaggle/$nombre.csv" "/bronze/kaggle/$nombre/"
  done
  hdfs -du -h /bronze/kaggle
  ok "Kaggle: $(ls data/entrada/kaggle/*.csv | wc -l) ficheros en /bronze/kaggle"
else
  aviso "No hay CSV en data/entrada/kaggle/: se omite la ingesta de Kaggle"
fi

# ---------------------------------------------------------------- 5
paso "5/9 Hive: tablas bronze"
# shuffle es STRING: bronze guarda el dato tal como llega ("true", "1", "sí"...); silver lo convierte
beeline -e "
ADD JAR $SERDE_JAR;
CREATE DATABASE IF NOT EXISTS bronze;
DROP TABLE IF EXISTS bronze.historial;
CREATE EXTERNAL TABLE bronze.historial (
  ts STRING, platform STRING, ms_played BIGINT,
  master_metadata_track_name STRING, master_metadata_album_artist_name STRING,
  master_metadata_album_album_name STRING, spotify_track_uri STRING,
  episode_name STRING, episode_show_name STRING, spotify_episode_uri STRING,
  audiobook_title STRING, audiobook_uri STRING, audiobook_chapter_uri STRING,
  audiobook_chapter_title STRING, reason_start STRING, reason_end STRING,
  shuffle STRING, skipped BOOLEAN, offline BOOLEAN, offline_timestamp BIGINT,
  incognito_mode BOOLEAN)
PARTITIONED BY (persona STRING)
ROW FORMAT SERDE 'org.apache.hive.hcatalog.data.JsonSerDe'
STORED AS TEXTFILE
LOCATION 'hdfs://namenode:9000$BRONZE';
MSCK REPAIR TABLE bronze.historial;
" >/dev/null
echo "Filas por persona en bronze.historial:"
beeline -e "ADD JAR $SERDE_JAR; SELECT persona, COUNT(*) FROM bronze.historial GROUP BY persona;" \
  | grep persona_ | tee "$TMP/bronze_personas" | sed 's/^/  /'
FILAS_BRONZE="$(awk -F'\t' '{s+=$2} END {print s+0}' "$TMP/bronze_personas")"
ok "bronze.historial: $FILAS_BRONZE filas"

if [ "$KAGGLE" = 1 ]; then
  "$PY" -I bigdata/kaggle_ddl.py data/entrada/kaggle "$TMP/kaggle.sql" > "$TMP/kaggle_filas"
  sql "$TMP/kaggle.sql" >/dev/null
  while IFS=$'\t' read -r nombre filas; do
    en_hive="$(beeline -e "SELECT COUNT(*) FROM bronze.kaggle_$nombre;" | tail -1)"
    if [ "$en_hive" = "$filas" ]; then ok "bronze.kaggle_$nombre: $en_hive filas"
    else aviso "bronze.kaggle_$nombre: Hive cuenta $en_hive filas y el CSV tiene $filas (saltos de línea dentro de comillas)"; fi
  done < "$TMP/kaggle_filas"
fi

# ---------------------------------------------------------------- 6
paso "6/9 Hive: silver.reproducciones (limpieza, Parquet)"
hdfs -rm -r -f -skipTrash /silver/reproducciones >/dev/null 2>&1 || true
sql bigdata/sql/silver.sql >/dev/null
echo "Reparto de clases en silver:"
beeline -e "SELECT clase, COUNT(*) FROM silver.reproducciones GROUP BY clase ORDER BY clase;" \
  | grep -v '^$' | tee "$TMP/silver_clases" | sed 's/^/  /'
FILAS_SILVER="$(awk -F'\t' '{s+=$2} END {print s+0}' "$TMP/silver_clases")"
hdfs -du -s -h /silver/reproducciones
ok "silver.reproducciones: $FILAS_SILVER filas"

# ---------------------------------------------------------------- 7
paso "7/9 Hive: gold.objetivo1 y gold.candidatas (Parquet)"
sql bigdata/sql/gold.sql >/dev/null
beeline -e "SELECT 'objetivo1', COUNT(*), SUM(fiable), SUM(CASE WHEN fiable = 1 AND lote = 1 THEN 1 ELSE 0 END),
                   SUM(CASE WHEN fiable = 1 AND lote = 2 THEN 1 ELSE 0 END) FROM gold.objetivo1;
            SELECT 'candidatas', COUNT(*), COUNT(DISTINCT track_id), SUM(conocida),
                   SUM(CASE WHEN tasa_real_lote1 IS NOT NULL THEN 1 ELSE 0 END) FROM gold.candidatas;" \
  | grep -v '^$' > "$TMP/gold"
read -r _ G1_FILAS G1_FIABLES G1_L1 G1_L2 < <(grep objetivo1 "$TMP/gold")
read -r _ G2_FILAS G2_CANCIONES G2_CONOCIDAS G2_REALES < <(grep candidatas "$TMP/gold")
echo "  gold.objetivo1:  $G1_FILAS filas; con >= 5 escuchas: $G1_FIABLES (lote 1: $G1_L1, lote 2: $G1_L2)"
echo "  gold.candidatas: $G2_FILAS filas ($G2_CANCIONES canciones); conocidas: $G2_CONOCIDAS; con tasa real lote 1: $G2_REALES"
hdfs -du -h /gold/spotify
ok "gold.objetivo1 y gold.candidatas creadas"

# ---------------------------------------------------------------- 8
paso "8/9 Comprobaciones"
[ "$BYTES_HDFS" -gt "$MIN_BYTES" ] || error "bronze ocupa $BYTES_HDFS bytes (mínimo $MIN_BYTES)"
ok "Tamaño en HDFS: $BYTES_HDFS bytes > 2 MB"
[ "$FILAS_BRONZE" = "$FILAS_ESPERADAS" ] || error "Hive ve $FILAS_BRONZE filas y el manifiesto dice $FILAS_ESPERADAS"
ok "Filas en bronze.historial = filas del manifiesto ($FILAS_BRONZE)"
while IFS=$'\t' read -r persona filas; do
  [ "$filas" -ge "$MIN_FILAS" ] || error "$persona solo tiene $filas filas (mínimo $MIN_FILAS)"
  ok "$persona: $filas filas >= $MIN_FILAS"
done < "$TMP/bronze_personas"
echo "Problemas del ensuciado (filas afectadas en bronze -> en silver):"
# -o: beeline imprime la salida de los SET pegada a la primera fila, sin salto de línea
T=$'\t'
sql bigdata/sql/validar_limpieza.sql | grep -oE "[0-9]_[a-z_]+${T}[0-9]+${T}[0-9]+" > "$TMP/limpieza"
fallos=0
while IFS=$'\t' read -r problema antes despues; do
  printf '  %-32s %8s -> %s\n' "$problema" "$antes" "$despues"
  [ "$despues" = "0" ] || fallos=$((fallos + 1))
done < "$TMP/limpieza"
[ "$(wc -l < "$TMP/limpieza")" -eq 9 ] || error "La validación de la limpieza no devolvió los 9 indicadores"
[ "$fallos" = 0 ] || error "$fallos problemas siguen presentes en silver"
ok "Los 8 problemas del ensuciado desaparecen en silver"
ok "silver.reproducciones: $FILAS_SILVER filas ($((FILAS_BRONZE - FILAS_SILVER)) descartadas: no música, 0 ms, negativas, duplicadas o sin metadatos)"
[ "$G1_FIABLES" -gt 0 ] && [ "$G1_L2" -gt 0 ] || error "gold.objetivo1 no tiene filas fiables en los dos lotes"
ok "gold.objetivo1 tiene filas fiables en el lote 1 ($G1_L1) y en el lote 2 ($G1_L2)"

# ---------------------------------------------------------------- 9
paso "9/9 Exportación a CSV (data/dataset/)"
mkdir -p data/dataset
exportar silver.reproducciones spotify_reproducciones.csv persona,ts_utc
exportar gold.objetivo1 gold_objetivo1.csv persona,lote,track_id,franja,tipo_dia
exportar gold.candidatas gold_candidatas.csv persona,track_id,franja,tipo_dia
ok "CSV en data/dataset/ (leer en pandas con encoding=\"utf-8-sig\")"

printf '\nPipeline completado en %d s. Log: %s\n' $((SECONDS - inicio)) "${LOG#$RAIZ/}"
