-- Cuenta cada problema del plan de ensuciado en bronze (antes) y en silver (después).
-- Salida: una fila por problema con «problema, bronze, silver». pipeline.sh exige silver = 0.

ADD JAR /opt/hive/hcatalog/share/hcatalog/hive-hcatalog-core-2.3.2.jar;
-- Memoria de cada map y reduce: el valor por defecto de Hadoop (unos 200 MB de heap) se queda corto
SET mapreduce.map.memory.mb=1536;
SET mapreduce.map.java.opts=-Xmx1228m;
SET mapreduce.reduce.memory.mb=1536;
SET mapreduce.reduce.java.opts=-Xmx1228m;
SET hive.strict.checks.cartesian.product=false;
SET hive.mapred.mode=nonstrict;

WITH
b AS (
  SELECT
    COUNT(*) - COUNT(DISTINCT persona, ts, spotify_track_uri) AS b1,
    SUM(CASE WHEN ts NOT RLIKE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T.*Z$' THEN 1 ELSE 0 END) AS b2,
    SUM(CASE WHEN master_metadata_track_name IS NULL OR master_metadata_album_artist_name IS NULL
                  OR master_metadata_album_album_name IS NULL THEN 1 ELSE 0 END) AS b3,
    SUM(CASE WHEN ms_played < 0 THEN 1 ELSE 0 END) AS b4,
    SUM(CASE WHEN master_metadata_album_artist_name RLIKE '  |\\sfeat\\.\\s'
                  OR master_metadata_album_artist_name RLIKE '^[^a-z]*[A-Z]{2,}[^a-z]*$' THEN 1 ELSE 0 END) AS b5,
    SUM(CASE WHEN reason_end NOT IN ('trackdone', 'fwdbtn', 'backbtn', 'endplay', 'logout', 'remote',
                  'trackerror', 'switched-to-video', 'unexpected-exit', 'unexpected-exit-while-paused',
                  'unknown') THEN 1 ELSE 0 END) AS b6,
    SUM(CASE WHEN ms_played = 0 THEN 1 ELSE 0 END) AS b7,
    SUM(CASE WHEN shuffle NOT IN ('true', 'false') THEN 1 ELSE 0 END) AS b8
  FROM bronze.historial WHERE spotify_track_uri IS NOT NULL
),
s AS (
  SELECT
    COUNT(*) - COUNT(DISTINCT persona, ts_utc, track_id) AS s1,
    SUM(CASE WHEN ts_utc IS NULL THEN 1 ELSE 0 END) AS s2,
    SUM(CASE WHEN cancion IS NULL OR artista IS NULL OR album IS NULL THEN 1 ELSE 0 END) AS s3,
    SUM(CASE WHEN ms_played < 0 OR (duracion_ms IS NOT NULL AND ms_played > duracion_ms + 5000)
             THEN 1 ELSE 0 END) AS s4,
    SUM(CASE WHEN artista RLIKE '  |\\sfeat\\.\\s' THEN 1 ELSE 0 END) AS s5,
    SUM(CASE WHEN reason_end IS NULL THEN 1 ELSE 0 END) AS s6,
    SUM(CASE WHEN ms_played = 0 THEN 1 ELSE 0 END) AS s7,
    SUM(CASE WHEN shuffle IS NULL THEN 1 ELSE 0 END) AS s8
  FROM silver.reproducciones
),
-- Problema 5 en conjunto: canciones con más de una grafía de artista
art_b AS (SELECT SUM(CASE WHEN g > 1 THEN 1 ELSE 0 END) AS nb FROM (
          SELECT spotify_track_uri, COUNT(DISTINCT master_metadata_album_artist_name) AS g
          FROM bronze.historial WHERE spotify_track_uri IS NOT NULL GROUP BY spotify_track_uri) x),
art_s AS (SELECT SUM(CASE WHEN g > 1 THEN 1 ELSE 0 END) AS ns FROM (
          SELECT track_id, COUNT(DISTINCT artista) AS g FROM silver.reproducciones GROUP BY track_id) x)
-- stack() pasa la única fila de métricas a una fila por problema: bronze y silver se leen una vez
-- (con UNION ALL, Hive recalcularía las subconsultas b y s en cada rama)
SELECT stack(9,
  '1_duplicados', b.b1, s.s1,
  '2_fechas_otro_formato', b.b2, s.s2,
  '3_sin_metadatos', b.b3, s.s3,
  '4_ms_imposible', b.b4, s.s4,
  '5_artista_mal_escrito', b.b5, s.s5,
  '5_canciones_varias_grafias', art_b.nb, art_s.ns,
  '6_reason_end_fuera_vocabulario', b.b6, s.s6,
  '7_ms_cero', b.b7, s.s7,
  '8_booleano_como_texto', b.b8, s.s8
) AS (problema, bronze, silver)
FROM b CROSS JOIN s CROSS JOIN art_b CROSS JOIN art_s;
