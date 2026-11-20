-- Capa gold: lo que consume la etapa de IA (Parquet en /gold/spotify/).
--
--   gold.objetivo1   Una fila por persona × canción × contexto (franja × tipo de día) × lote, con la
--                    tasa de no salto real (etiqueta) y las variables de entrada del objetivo 1.
--   gold.candidatas  Para el recomendador (objetivo 2): cada persona × cada canción que alguien del
--                    grupo escuchó en el lote 1 × cada contexto, con las mismas variables, la tasa
--                    real del lote 1 y la del lote 2 (para evaluar) y la duración de la canción.
--
-- Regla clave (sección 6 del informe): ninguna variable sale de las escuchas de esa misma canción
-- por esa misma persona. Todas se calculan con el lote 1 (antes del 1 de julio de 2025) y restan
-- las escuchas de la propia canción, así que sirven igual para filas del lote 1 y del lote 2.
-- Sin Kaggle, los bloques A (contenido) y D (distancia al gusto) no existen, y el C (género)
-- tampoco, porque el género venía de Kaggle.

-- Memoria de cada map y reduce: el valor por defecto de Hadoop (unos 200 MB de heap) se queda corto
SET mapreduce.map.memory.mb=1536;
SET mapreduce.map.java.opts=-Xmx1228m;
SET mapreduce.reduce.memory.mb=1536;
SET mapreduce.reduce.java.opts=-Xmx1228m;
SET hive.strict.checks.cartesian.product=false;
SET hive.mapred.mode=nonstrict;
SET hive.auto.convert.join=true;

CREATE DATABASE IF NOT EXISTS gold LOCATION 'hdfs://namenode:9000/gold/spotify';
DROP DATABASE IF EXISTS gold_tmp CASCADE;
CREATE DATABASE gold_tmp;

-- Una fila por canción
CREATE TABLE gold_tmp.canciones STORED AS PARQUET AS
SELECT track_id, MAX(cancion) AS cancion, MAX(artista) AS artista, MAX(album) AS album,
       MAX(duracion_ms) AS duracion_ms
FROM silver.reproducciones GROUP BY track_id;

-- Etiqueta: escuchas y no saltos por persona × canción × contexto × lote
CREATE TABLE gold_tmp.etiquetas STORED AS PARQUET AS
SELECT persona, track_id, franja, tipo_dia, lote,
       COUNT(*) AS n_escuchas, SUM(no_salto) AS n_no_salto
FROM silver.reproducciones GROUP BY persona, track_id, franja, tipo_dia, lote;

-- Agregados del lote 1 de los que salen las variables
CREATE TABLE gold_tmp.pt STORED AS PARQUET AS          -- persona × canción
SELECT persona, track_id, COUNT(*) AS n, SUM(no_salto) AS ns
FROM silver.reproducciones WHERE lote = 1 GROUP BY persona, track_id;

CREATE TABLE gold_tmp.ptc STORED AS PARQUET AS         -- persona × canción × contexto
SELECT persona, track_id, franja, tipo_dia, COUNT(*) AS n, SUM(no_salto) AS ns
FROM silver.reproducciones WHERE lote = 1 GROUP BY persona, track_id, franja, tipo_dia;

CREATE TABLE gold_tmp.pa STORED AS PARQUET AS          -- persona × artista
SELECT persona, artista, COUNT(*) AS n, SUM(no_salto) AS ns, COUNT(DISTINCT track_id) AS nc
FROM silver.reproducciones WHERE lote = 1 GROUP BY persona, artista;

CREATE TABLE gold_tmp.palb STORED AS PARQUET AS        -- persona × álbum
SELECT persona, artista, album, COUNT(*) AS n, SUM(no_salto) AS ns
FROM silver.reproducciones WHERE lote = 1 GROUP BY persona, artista, album;

CREATE TABLE gold_tmp.p STORED AS PARQUET AS           -- persona
SELECT persona, COUNT(*) AS n, SUM(no_salto) AS ns,
       AVG(CASE WHEN shuffle THEN 1.0 ELSE 0.0 END) AS pct_shuffle
FROM silver.reproducciones WHERE lote = 1 GROUP BY persona;

CREATE TABLE gold_tmp.pc STORED AS PARQUET AS          -- persona × contexto
SELECT persona, franja, tipo_dia, COUNT(*) AS n, SUM(no_salto) AS ns
FROM silver.reproducciones WHERE lote = 1 GROUP BY persona, franja, tipo_dia;

CREATE TABLE gold_tmp.gt STORED AS PARQUET AS          -- canción en todo el grupo
SELECT track_id, SUM(n) AS n, SUM(ns) AS ns FROM gold_tmp.pt GROUP BY track_id;

-- Claves: las filas con etiqueta y todas las candidatas (persona × canción del lote 1 × contexto)
CREATE TABLE gold_tmp.claves STORED AS PARQUET AS
SELECT DISTINCT persona, track_id, franja, tipo_dia FROM (
  SELECT persona, track_id, franja, tipo_dia FROM gold_tmp.etiquetas
  UNION ALL
  SELECT pe.persona, c.track_id, cx.franja, cx.tipo_dia
  FROM (SELECT DISTINCT persona FROM silver.reproducciones) pe
  CROSS JOIN (SELECT track_id FROM gold_tmp.gt) c
  CROSS JOIN (SELECT DISTINCT franja, tipo_dia FROM silver.reproducciones) cx
) u;

-- Variables de entrada, sin contar las escuchas de la propia canción por la propia persona
CREATE TABLE gold_tmp.variables STORED AS PARQUET AS
SELECT k.persona, k.track_id, k.franja, k.tipo_dia,
       -- B. Persona con el artista
       COALESCE(pa.n, 0) - COALESCE(pt.n, 0) AS art_n_escuchas,
       COALESCE(pa.nc, 0) - CASE WHEN pt.n IS NULL THEN 0 ELSE 1 END AS art_n_canciones,
       CASE WHEN COALESCE(pa.n, 0) - COALESCE(pt.n, 0) > 0
            THEN (pa.ns - COALESCE(pt.ns, 0)) / (pa.n - COALESCE(pt.n, 0)) END AS art_tasa_no_salto,
       CASE WHEN COALESCE(pa.n, 0) - COALESCE(pt.n, 0) > 0 THEN 1 ELSE 0 END AS art_conocido,
       -- B'. Persona con el álbum (nueva, sustituye en parte al contenido de Kaggle)
       COALESCE(palb.n, 0) - COALESCE(pt.n, 0) AS alb_n_escuchas,
       CASE WHEN COALESCE(palb.n, 0) - COALESCE(pt.n, 0) > 0
            THEN (palb.ns - COALESCE(pt.ns, 0)) / (palb.n - COALESCE(pt.n, 0)) END AS alb_tasa_no_salto,
       -- E. Persona en general
       CASE WHEN p.n - COALESCE(pt.n, 0) > 0
            THEN (p.ns - COALESCE(pt.ns, 0)) / (p.n - COALESCE(pt.n, 0)) END AS per_tasa_no_salto,
       p.pct_shuffle AS per_pct_shuffle,
       -- E'. Persona en el contexto
       CASE WHEN pc.n - COALESCE(ptc.n, 0) > 0
            THEN (pc.ns - COALESCE(ptc.ns, 0)) / (pc.n - COALESCE(ptc.n, 0)) END AS per_tasa_no_salto_ctx,
       -- G. La canción en el resto del grupo (nueva)
       COALESCE(gt.n, 0) - COALESCE(pt.n, 0) AS grp_n_escuchas,
       CASE WHEN COALESCE(gt.n, 0) - COALESCE(pt.n, 0) > 0
            THEN (gt.ns - COALESCE(pt.ns, 0)) / (gt.n - COALESCE(pt.n, 0)) END AS grp_tasa_no_salto
FROM gold_tmp.claves k
JOIN gold_tmp.canciones c ON c.track_id = k.track_id
LEFT JOIN gold_tmp.p p ON p.persona = k.persona
LEFT JOIN gold_tmp.pt pt ON pt.persona = k.persona AND pt.track_id = k.track_id
LEFT JOIN gold_tmp.ptc ptc ON ptc.persona = k.persona AND ptc.track_id = k.track_id
                          AND ptc.franja = k.franja AND ptc.tipo_dia = k.tipo_dia
LEFT JOIN gold_tmp.pa pa ON pa.persona = k.persona AND pa.artista = c.artista
LEFT JOIN gold_tmp.palb palb ON palb.persona = k.persona AND palb.artista = c.artista AND palb.album = c.album
LEFT JOIN gold_tmp.pc pc ON pc.persona = k.persona AND pc.franja = k.franja AND pc.tipo_dia = k.tipo_dia
LEFT JOIN gold_tmp.gt gt ON gt.track_id = k.track_id;

-- Objetivo 1: etiqueta + variables
DROP TABLE IF EXISTS gold.objetivo1;
CREATE TABLE gold.objetivo1 STORED AS PARQUET AS
SELECT e.persona, e.track_id, c.cancion, c.artista, c.album, e.franja, e.tipo_dia, e.lote,
       e.n_escuchas, e.n_no_salto, e.n_no_salto / e.n_escuchas AS tasa_no_salto,
       CASE WHEN e.n_escuchas >= 5 THEN 1 ELSE 0 END AS fiable,
       v.art_n_escuchas, v.art_n_canciones, v.art_tasa_no_salto, v.art_conocido,
       v.alb_n_escuchas, v.alb_tasa_no_salto, v.per_tasa_no_salto, v.per_pct_shuffle,
       v.per_tasa_no_salto_ctx, v.grp_n_escuchas, v.grp_tasa_no_salto
FROM gold_tmp.etiquetas e
JOIN gold_tmp.canciones c ON c.track_id = e.track_id
JOIN gold_tmp.variables v ON v.persona = e.persona AND v.track_id = e.track_id
                         AND v.franja = e.franja AND v.tipo_dia = e.tipo_dia;

-- Objetivo 2: candidatas del grupo con las mismas variables
DROP TABLE IF EXISTS gold.candidatas;
CREATE TABLE gold.candidatas STORED AS PARQUET AS
SELECT v.persona, v.track_id, c.cancion, c.artista, c.album, c.duracion_ms, v.franja, v.tipo_dia,
       CASE WHEN pt.n IS NULL THEN 0 ELSE 1 END AS conocida,
       COALESCE(l1.n_escuchas, 0) AS n_lote1,
       CASE WHEN l1.n_escuchas >= 5 THEN l1.n_no_salto / l1.n_escuchas END AS tasa_real_lote1,
       COALESCE(l2.n_escuchas, 0) AS n_lote2,
       CASE WHEN l2.n_escuchas >= 5 THEN l2.n_no_salto / l2.n_escuchas END AS tasa_real_lote2,
       p.ns / p.n AS per_tasa_media,
       v.art_n_escuchas, v.art_n_canciones, v.art_tasa_no_salto, v.art_conocido,
       v.alb_n_escuchas, v.alb_tasa_no_salto, v.per_tasa_no_salto, v.per_pct_shuffle,
       v.per_tasa_no_salto_ctx, v.grp_n_escuchas, v.grp_tasa_no_salto
FROM gold_tmp.variables v
JOIN gold_tmp.gt gt ON gt.track_id = v.track_id
JOIN gold_tmp.canciones c ON c.track_id = v.track_id
LEFT JOIN gold_tmp.p p ON p.persona = v.persona
LEFT JOIN gold_tmp.pt pt ON pt.persona = v.persona AND pt.track_id = v.track_id
LEFT JOIN gold_tmp.etiquetas l1 ON l1.persona = v.persona AND l1.track_id = v.track_id
                               AND l1.franja = v.franja AND l1.tipo_dia = v.tipo_dia AND l1.lote = 1
LEFT JOIN gold_tmp.etiquetas l2 ON l2.persona = v.persona AND l2.track_id = v.track_id
                               AND l2.franja = v.franja AND l2.tipo_dia = v.tipo_dia AND l2.lote = 2;

DROP DATABASE gold_tmp CASCADE;
