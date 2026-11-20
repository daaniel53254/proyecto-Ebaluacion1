-- silver.reproducciones: limpieza de bronze.historial (una fila por reproducción de música).
-- Resuelve los problemas 1 a 8 del plan de ensuciado (sección 10 del informe) y añade las
-- columnas que usan los dos objetivos: hora local, franja, tipo de día, lote y no_salto.
-- Lo ejecuta pipeline.sh; el fichero tiene que leerse en UTF-8 (lleva tildes en literales).

ADD JAR /opt/hive/hcatalog/share/hcatalog/hive-hcatalog-core-2.3.2.jar;
-- Memoria de cada map y reduce: el valor por defecto de Hadoop (unos 200 MB de heap) se queda corto
SET mapreduce.map.memory.mb=1536;
SET mapreduce.map.java.opts=-Xmx1228m;
SET mapreduce.reduce.memory.mb=1536;
SET mapreduce.reduce.java.opts=-Xmx1228m;
SET hive.exec.dynamic.partition=true;
SET hive.exec.dynamic.partition.mode=nonstrict;

CREATE DATABASE IF NOT EXISTS silver;
DROP TABLE IF EXISTS silver.reproducciones;
CREATE EXTERNAL TABLE silver.reproducciones (
  ts_utc TIMESTAMP, ts_local TIMESTAMP, fecha STRING, hora INT, dia_semana INT, tipo_dia STRING,
  franja INT, lote INT,
  track_id STRING, cancion STRING, artista STRING, album STRING,
  ms_played BIGINT, duracion_ms BIGINT, plataforma STRING, shuffle BOOLEAN, offline BOOLEAN,
  reason_start STRING, reason_end STRING, clase STRING, no_salto INT)
PARTITIONED BY (persona STRING)
STORED AS PARQUET
LOCATION 'hdfs://namenode:9000/silver/reproducciones';

WITH
-- Paso 1. Tipos y vocabulario: fechas (problema 2), reason_end (6) y booleanos (8)
tipos AS (
  SELECT persona,
         CASE
           WHEN ts RLIKE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
             THEN CAST(regexp_replace(regexp_replace(ts, 'T', ' '), 'Z', '') AS TIMESTAMP)
           WHEN ts RLIKE '^[0-9]{9,11}$'                      -- marca Unix en segundos
             THEN CAST(from_unixtime(CAST(ts AS BIGINT)) AS TIMESTAMP)
           WHEN ts RLIKE '^[0-9]{2}/[0-9]{2}/[0-9]{4} '       -- dd/MM/yyyy sin zona: es UTC
             THEN CAST(from_unixtime(unix_timestamp(ts, 'dd/MM/yyyy HH:mm:ss')) AS TIMESTAMP)
         END AS ts_utc,
         regexp_extract(spotify_track_uri, '^spotify:track:(.+)$', 1) AS track_id,
         master_metadata_track_name AS cancion,
         master_metadata_album_artist_name AS artista,
         master_metadata_album_album_name AS album,
         ms_played, platform, offline, reason_start,
         CASE regexp_replace(lower(trim(reason_end)), '[ _-]', '')
           WHEN 'trackdone' THEN 'trackdone'
           WHEN 'fwdbtn' THEN 'fwdbtn'      WHEN 'forward' THEN 'fwdbtn'
           WHEN 'backbtn' THEN 'backbtn'    WHEN 'back' THEN 'backbtn'
           WHEN 'endplay' THEN 'endplay'
           WHEN 'logout' THEN 'logout'
           WHEN 'remote' THEN 'remote'
           WHEN 'trackerror' THEN 'trackerror'
           WHEN 'switchedtovideo' THEN 'switched-to-video'
           WHEN 'unexpectedexit' THEN 'unexpected-exit'
           WHEN 'unexpectedexitwhilepaused' THEN 'unexpected-exit-while-paused'
           WHEN 'unknown' THEN 'unknown'
         END AS reason_end,                -- un valor fuera de la tabla queda NULL y la validación falla
         CASE
           WHEN lower(trim(shuffle)) IN ('true', '1', 'sí', 'si', 'yes', 't') THEN true
           WHEN lower(trim(shuffle)) IN ('false', '0', 'no', 'f') THEN false
         END AS shuffle
  FROM bronze.historial
  WHERE spotify_track_uri IS NOT NULL
),
-- Paso 2. Fuera reproducciones sin fecha, de 0 ms o negativas (problemas 4 y 7) y duplicados (1)
unicas AS (
  SELECT * FROM (
    SELECT t.*, ROW_NUMBER() OVER (PARTITION BY persona, ts_utc, track_id ORDER BY ms_played DESC) AS rn
    FROM tipos t
    WHERE ts_utc IS NOT NULL AND track_id <> '' AND ms_played > 0
  ) x WHERE rn = 1
),
-- Paso 3. Metadatos recuperados desde la misma canción (problema 3) y clave normalizada del artista (5)
metadatos AS (
  SELECT u.*,
         COALESCE(cancion, MAX(cancion) OVER (PARTITION BY track_id)) AS cancion_r,
         COALESCE(album, MAX(album) OVER (PARTITION BY track_id)) AS album_r,
         COALESCE(trim(artista), MAX(trim(artista)) OVER (PARTITION BY track_id)) AS artista_r
  FROM unicas u
),
-- Grafía sin «feat.» ni espacios dobles, y clave sin mayúsculas ni tildes
limpio AS (
  SELECT m.*,
         trim(regexp_replace(regexp_replace(artista_r, '(?i)\\s+(feat\\.?|ft\\.?|featuring)\\s.*$', ''),
                             '\\s+', ' ')) AS art_limpio
  FROM metadatos m
),
con_clave AS (
  SELECT l.*,
         translate(lower(art_limpio), 'áéíóúàèìòùäëïöüâêîôûãõåøýÿñç', 'aeiouaeiouaeiouaeiouaoaoyync') AS art_clave
  FROM limpio l
),
-- Grafía oficial de cada artista: la más frecuente entre las que comparten clave
grafias AS (
  SELECT art_clave, art_limpio AS artista_oficial FROM (
    SELECT art_clave, art_limpio,
           ROW_NUMBER() OVER (PARTITION BY art_clave ORDER BY n DESC, art_limpio) AS r
    FROM (SELECT art_clave, art_limpio, COUNT(*) AS n FROM con_clave
          WHERE art_limpio IS NOT NULL GROUP BY art_clave, art_limpio) c
  ) g WHERE r = 1
),
-- Una canción tiene un solo artista: el oficial más frecuente entre sus reproducciones
artista_cancion AS (
  SELECT track_id, artista_oficial AS artista FROM (
    SELECT track_id, artista_oficial,
           ROW_NUMBER() OVER (PARTITION BY track_id ORDER BY n DESC, artista_oficial) AS r
    FROM (SELECT c.track_id, g.artista_oficial, COUNT(*) AS n
          FROM con_clave c JOIN grafias g ON g.art_clave = c.art_clave
          GROUP BY c.track_id, g.artista_oficial) x
  ) y WHERE r = 1
),
-- Duración de referencia: mediana de las escuchas completas de la canción (problema 4)
duraciones AS (
  SELECT track_id, CAST(percentile_approx(ms_played, 0.5) AS BIGINT) AS duracion_ms
  FROM unicas WHERE reason_end = 'trackdone' GROUP BY track_id
),
-- Paso 4. ms_played recortado a la duración y filas sin metadatos recuperables fuera
limpias AS (
  SELECT c.persona, c.ts_utc, c.track_id, c.cancion_r AS cancion, a.artista,
         c.album_r AS album, d.duracion_ms,
         CASE WHEN d.duracion_ms IS NOT NULL AND c.ms_played > d.duracion_ms + 5000
              THEN d.duracion_ms ELSE c.ms_played END AS ms_played,
         c.platform, c.shuffle, c.offline, c.reason_start, c.reason_end
  FROM metadatos c
  JOIN artista_cancion a ON a.track_id = c.track_id
  LEFT JOIN duraciones d ON d.track_id = c.track_id
  WHERE c.cancion_r IS NOT NULL AND c.album_r IS NOT NULL
    AND (d.duracion_ms IS NOT NULL OR c.ms_played <= 1200000)  -- sin duración, más de 20 min es imposible
),
-- Paso 5. Columnas derivadas
derivadas AS (
  SELECT l.*, from_utc_timestamp(ts_utc, 'Europe/Madrid') AS ts_local
  FROM limpias l
)
INSERT OVERWRITE TABLE silver.reproducciones PARTITION (persona)
SELECT ts_utc, ts_local, CAST(to_date(ts_local) AS STRING), hour(ts_local),
       CAST(date_format(ts_local, 'u') AS INT),
       CASE WHEN CAST(date_format(ts_local, 'u') AS INT) >= 6 THEN 'fin_semana' ELSE 'laborable' END,
       CAST(floor(hour(ts_local) / 4) AS INT),
       CASE WHEN to_date(ts_local) < '2025-07-01' THEN 1 ELSE 2 END,
       track_id, cancion, artista, album, ms_played, duracion_ms,
       CASE
         WHEN lower(platform) RLIKE 'android|ios|iphone' THEN 'movil'
         WHEN lower(platform) RLIKE 'windows|os x|osx|mac|linux|web|desktop' THEN 'ordenador'
         WHEN lower(platform) RLIKE 'car|auto' THEN 'coche'
         WHEN lower(platform) RLIKE 'cast|speaker|sonos|echo|alexa|google_home|partner|tv' THEN 'altavoz'
         ELSE 'otros' END,
       shuffle, offline, reason_start, reason_end,
       CASE
         WHEN reason_end = 'trackdone' THEN 'completa'
         WHEN reason_end = 'fwdbtn' AND ms_played < 30000 THEN 'salto_rapido'
         WHEN reason_end = 'fwdbtn' THEN 'salto_tardio'
         WHEN reason_end = 'backbtn' THEN 'vuelve_atras'
         ELSE 'interrumpida' END,
       CASE WHEN reason_end = 'fwdbtn' AND ms_played < 30000 THEN 0 ELSE 1 END,
       persona
FROM derivadas;
