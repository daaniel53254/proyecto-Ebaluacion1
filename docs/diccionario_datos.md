# Diccionario de datos

Proyecto «Playlist perfecta para viajes en grupo» · NPD Entertainment · CEBANC
Capas de datos que genera `bigdata/pipeline.sh` (Entrega 2). Las cifras son de la ejecución del 20 de noviembre de 2026 con los historiales de dos personas; el log completo está en `docs/evidencias/`.

## Índice

1. [Recorrido de los datos](#1-recorrido-de-los-datos)
2. [Bronze](#2-bronze)
3. [Plan de ensuciado y limpieza](#3-plan-de-ensuciado-y-limpieza)
4. [Silver: silver.reproducciones](#4-silver-silverreproducciones)
5. [Gold: gold.objetivo1](#5-gold-goldobjetivo1)
6. [Gold: gold.candidatas](#6-gold-goldcandidatas)
7. [Ficheros exportados para los notebooks](#7-ficheros-exportados-para-los-notebooks)
8. [Limitaciones conocidas](#8-limitaciones-conocidas)

## 1. Recorrido de los datos

| Paso | Script | Entrada | Salida |
|---|---|---|---|
| Preparación | `bigdata/preparar.py` | `data/raw/<persona>/Streaming_History_Audio_*.json` | JSON Lines sin datos personales en `data/entrada/historial/persona=<seudónimo>/` y `manifiesto.json` |
| Ensuciado | `bigdata/ensuciar.py` (semilla 42) | Los JSON Lines anteriores | Los mismos ficheros con los problemas 1 a 8, `manifiesto.json` actualizado y `ensuciado.json` con las filas tocadas |
| Bronze | `pipeline.sh` (pasos 4 y 5) | `data/entrada/` | HDFS `/bronze/spotify/historial/` y `/bronze/kaggle/`; tablas `bronze.historial` y `bronze.kaggle_*` |
| Silver | `bigdata/sql/silver.sql` | `bronze.historial` | `silver.reproducciones` (Parquet, `/silver/reproducciones/`) |
| Gold | `bigdata/sql/gold.sql` | `silver.reproducciones` | `gold.objetivo1` y `gold.candidatas` (Parquet, `/gold/spotify/`) |
| Validación | `bigdata/sql/validar_limpieza.sql` | bronze y silver | Cada problema contado antes y después; el pipeline falla si alguno sigue en silver |
| Exportación | `bigdata/exportar.py` | silver y gold | CSV en `data/dataset/` (no se suben a Git) |

Seudónimos: `preparar.py` cambia el nombre de cada persona por `persona_<hash>`. Los campos
`ip_addr`, `conn_country`, `username`, `user_agent`, `city` y `region` se eliminan antes de salir
del equipo de cada persona y nunca llegan a HDFS.

## 2. Bronze

### bronze.historial

Tabla externa JSON (JsonSerDe) particionada por `persona`, con los campos del historial ampliado
de Spotify tal como llegan, ya sin datos personales y con el ensuciado aplicado. Todas las
columnas son las de la exportación de Spotify; las que cambian de tipo respecto a Spotify:

| Columna | Tipo | Por qué |
|---|---|---|
| `ts` | STRING | Llega en tres formatos tras el ensuciado (ISO 8601 con Z, `dd/MM/yyyy HH:mm:ss`, marca Unix) |
| `shuffle` | STRING | Llega como booleano JSON o como texto (`"1"`, `"sí"`, `"no"`...) |
| `ms_played` | BIGINT | Puede ser 0 o negativo tras el ensuciado |

Filas: 359.070 (persona_744b89e7: 270.886; persona_358ed916: 88.184).

### bronze.kaggle_spotify_tracks y bronze.kaggle_spotify_1m_tracks

Tablas externas CSV (OpenCSVSerde) con todas las columnas como STRING, incluida la sobrante
`Unnamed: 0` (columna `unnamed_0`). Kaggle **no** entra en los objetivos: solo tiene audio para el
8,4 % de las reproducciones (19,3 % con el respaldo) porque los datasets son de 2022-2023 y el
73 % de las canciones se escucharon por primera vez de 2024 en adelante. Se conserva en bronze como
fuente documentada. La ingesta se hace si los CSV están en `data/entrada/kaggle/`.

## 3. Plan de ensuciado y limpieza

`ensuciar.py` toca un porcentaje fijo de las reproducciones de música de cada persona con
`random.Random(42)`. El registro de filas tocadas (fichero y línea) queda en
`data/entrada/ensuciado.json` y se sube a `/bronze/spotify/meta/`.

| # | Problema | % | Filas tocadas | Cómo se limpia en silver | Bronze | Silver |
|---|---|---|---|---|---|---|
| 1 | Filas duplicadas | 3 % | 10.449 | Se queda una fila por persona + `ts_utc` + `track_id` (la de más `ms_played`) | 12.044 | 0 |
| 2 | Fechas en otros formatos y sin zona | 5 % | 17.416 | Se reconocen ISO 8601, `dd/MM/yyyy HH:mm:ss` y marca Unix, y todo pasa a UTC | 17.950 | 0 |
| 3 | Canciones sin metadatos | 4 % | 13.932 | Se recuperan nombre, artista y álbum desde otra reproducción del mismo `track_id`; si no hay, se elimina la fila | 14.357 | 0 |
| 4 | `ms_played` imposible | 2 % | 6.843 | Negativos fuera; excesos recortados a `duracion_ms` + 5 s; sin duración, fuera si pasa de 20 min | 3.441 | 0 |
| 5 | Nombres de artista inconsistentes | 5 % | 17.416 | Clave sin mayúsculas, tildes, espacios dobles ni «feat.»; grafía oficial = la más frecuente; un solo artista por canción | 42.538 filas · 4.614 canciones con varias grafías | 0 · 0 |
| 6 | `reason_end` con variantes | 3 % | 9.982 | Tabla de mapeo al vocabulario oficial de Spotify (11 valores) | 10.258 | 0 |
| 7 | Reproducciones de 0 ms | 2 % | 6.966 | Se eliminan: no son una escucha | 13.427 | 0 |
| 8 | Booleanos como texto | 3 % | 10.449 | `true`/`1`/`sí` → true; `false`/`0`/`no` → false | 8.091 | 0 |

Los problemas 9 y 10 (atípicos y duplicados de Kaggle) y el 12 (canciones sin Kaggle) dejan de
aplicar al quitar Kaggle del objetivo 1. El 11 (combinaciones con pocas escuchas) ya ocurre de forma
natural: lo resuelve la columna `fiable` de gold (al menos 5 escuchas).

Cómo leer la columna «Bronze»: cuenta lo que detecta la regla de validación, no solo lo ensuciado.
Por ejemplo, en el problema 5 también cuenta artistas reales escritos en mayúsculas (como «BTS»), y
en el 1 los duplicados que ya traía la exportación de Spotify.

## 4. Silver: silver.reproducciones

Una fila por reproducción de **música** (sin pódcast ni audiolibros), sin duplicados y limpia.
Parquet particionado por `persona`. Filas: 330.166.

| Columna | Tipo | Descripción |
|---|---|---|
| `ts_utc` | TIMESTAMP | Fin de la reproducción en UTC (Spotify guarda el momento en que termina) |
| `ts_local` | TIMESTAMP | `ts_utc` en hora de Europe/Madrid (con horario de verano) |
| `fecha` | STRING | Fecha local, `yyyy-MM-dd` |
| `hora` | INT | Hora local, 0 a 23 |
| `dia_semana` | INT | 1 = lunes … 7 = domingo |
| `tipo_dia` | STRING | `laborable` (lunes a viernes) o `fin_semana` |
| `franja` | INT | Franja de 4 horas: 0 = 00-04, 1 = 04-08, 2 = 08-12, 3 = 12-16, 4 = 16-20, 5 = 20-24 |
| `lote` | INT | 1 si la fecha local es anterior al 1 de julio de 2025 (entrenamiento); 2 si no (prueba) |
| `track_id` | STRING | Identificador de Spotify de la canción (`spotify:track:<track_id>`) |
| `cancion`, `album` | STRING | Recuperados desde otra reproducción de la misma canción si venían vacíos |
| `artista` | STRING | Grafía oficial: la más frecuente entre las que comparten clave normalizada |
| `ms_played` | BIGINT | Milisegundos escuchados, recortados a `duracion_ms` + 5 s |
| `duracion_ms` | BIGINT | Duración estimada: mediana de `ms_played` de las escuchas completas de la canción. Nula si nadie la ha escuchado entera |
| `plataforma` | STRING | `movil`, `ordenador`, `coche`, `altavoz` u `otros` |
| `shuffle`, `offline` | BOOLEAN | Modo aleatorio y escucha sin conexión |
| `reason_start`, `reason_end` | STRING | Motivo de inicio y de fin; `reason_end` ya en el vocabulario oficial de Spotify |
| `clase` | STRING | `completa`, `salto_rapido`, `salto_tardio`, `vuelve_atras` o `interrumpida` (objetivo antiguo de cinco clases; se mantiene para el EDA) |
| `no_salto` | INT | 0 si es salto rápido (`reason_end = fwdbtn` y `ms_played` < 30.000), 1 si no. Es la base de la etiqueta del objetivo 1 |
| `persona` | STRING | Seudónimo (partición) |

## 5. Gold: gold.objetivo1

Una fila por **persona × canción × contexto × lote**, donde contexto = `franja` × `tipo_dia`
(12 contextos). Es la tabla de entrenamiento y prueba del objetivo 1. Filas: 85.105;
con al menos 5 escuchas: 19.927 (lote 1: 11.319, lote 2: 8.608).

**Regla clave:** ninguna variable sale de las escuchas de esa canción por esa misma persona. Todas
se calculan con el lote 1 (el pasado), así que sirven igual para las filas del lote 2 y para
canciones nuevas.

**Sin tasas que resten la propia canción.** Hasta el 20 de noviembre, las tasas de persona, contexto,
artista y álbum restaban las escuchas de la canción a un total fijo (leave-one-out). Dentro de una
persona lo único que movía esas variables era la propia canción, así que llevaban escondida la
etiqueta: `per_tasa_no_salto` solo variaba en la tercera cifra decimal y tenía una correlación de -0,6
con `tasa_no_salto` en el lote 1. Ahora las tasas de persona y contexto son totales (constantes) y del
artista y el álbum solo hay recuentos: su tasa la calcula la etapa de IA fuera de pliegue, a partir de
`n_escuchas` y `n_no_salto`.

| Columna | Tipo | Bloque | Descripción |
|---|---|---|---|
| `persona`, `track_id`, `cancion`, `artista`, `album` | STRING | Clave | Quién y qué canción |
| `franja`, `tipo_dia` | INT, STRING | Contexto | Cuándo suena |
| `lote` | INT | Clave | 1 = entrenamiento (GroupKFold), 2 = prueba final |
| `n_escuchas` | BIGINT | Etiqueta | Reproducciones de la canción por la persona en ese contexto y lote |
| `n_no_salto` | BIGINT | Etiqueta | Cuántas no fueron salto rápido |
| `tasa_no_salto` | DOUBLE | **Etiqueta** | `n_no_salto / n_escuchas`, de 0 a 1 |
| `fiable` | INT | Filtro | 1 si `n_escuchas` ≥ 5. Entrenar y evaluar solo con `fiable = 1` |
| `art_n_escuchas` | BIGINT | B | Escuchas de la persona a ese artista, sin contar esta canción |
| `art_n_canciones` | BIGINT | B | Otras canciones del artista que ha escuchado la persona |
| `art_conocido` | INT | B | 1 si la persona ha escuchado otras canciones del artista |
| `alb_n_escuchas` | BIGINT | B' (nuevo) | Escuchas de la persona a ese álbum, sin contar esta canción |
| `per_tasa_no_salto` | DOUBLE | E | Tasa de no salto total de la persona en el lote 1 (constante por persona) |
| `per_pct_shuffle` | DOUBLE | E | Proporción de escuchas en aleatorio de la persona |
| `per_tasa_no_salto_ctx` | DOUBLE | E' | Tasa total de la persona en ese contexto en el lote 1 (constante por persona y contexto) |
| `grp_n_escuchas`, `grp_tasa_no_salto` | BIGINT, DOUBLE | G (nuevo) | Escuchas y tasa de la canción en el resto del grupo (sin la propia persona) |

Sin Kaggle desaparecen los bloques A (contenido de la canción), C (género, que venía de Kaggle) y
D (distancia al gusto). Los bloques B' y G los sustituyen en parte con información del propio
historial.

## 6. Gold: gold.candidatas

Entrada del recomendador (objetivo 2): **cada persona × cada canción que alguien del grupo escuchó
en el lote 1 × cada contexto**. Filas: 249.072 (10.378 canciones × personas × contextos).

Tiene las mismas variables que `gold.objetivo1` (columnas `art_*`, `alb_n_escuchas`, `per_*`, `grp_*`), así
que el modelo del objetivo 1 puede predecir directamente sobre ella, y además:

| Columna | Tipo | Descripción |
|---|---|---|
| `duracion_ms` | BIGINT | Duración estimada de la canción, para cortar la lista por la duración del viaje |
| `conocida` | INT | 1 si la persona escuchó la canción en el lote 1 (en cualquier contexto) |
| `n_lote1`, `tasa_real_lote1` | BIGINT, DOUBLE | Escuchas y tasa real en ese contexto en el lote 1. La tasa solo si hay ≥ 5 escuchas; si no, se usa la predicción |
| `n_lote2`, `tasa_real_lote2` | BIGINT, DOUBLE | Lo mismo en el lote 2: solo para evaluar la playlist, nunca para construirla |
| `per_tasa_media` | DOUBLE | Tasa media de la persona en el lote 1, para normalizar el gusto antes de tomar el mínimo |

**Normalización antes del mínimo.** Las tasas medias de las dos personas son muy distintas
(en el lote 1, 0,553 para persona_744b89e7 y 0,936 para persona_358ed916). Si se toma el mínimo de las tasas sin normalizar, casi siempre gana la persona
que más salta y la playlist es solo suya. El recomendador debe normalizar el gusto de cada persona
(percentil dentro de la persona, o tasa ÷ `per_tasa_media`) antes de aplicar el mínimo y el umbral
de compatibilidad.

## 7. Ficheros exportados para los notebooks

En `data/dataset/` (no se suben a Git; se comparten por Drive). Leer en pandas con
`pd.read_csv(ruta, encoding="utf-8-sig")`.

| Fichero | Tabla | Orden |
|---|---|---|
| `spotify_reproducciones.csv` | `silver.reproducciones` | persona, ts_utc |
| `gold_objetivo1.csv` | `gold.objetivo1` | persona, lote, track_id, franja, tipo_dia |
| `gold_candidatas.csv` | `gold.candidatas` | persona, track_id, franja, tipo_dia |

## 8. Limitaciones conocidas

- **ms_played multiplicado por 10 sin duración conocida.** Si nadie escuchó la canción entera no
  hay `duracion_ms` y el exceso solo se detecta por encima de 20 minutos. Un salto de 2 s que pasa
  a 20 s no se detecta; uno de 5 s que pasa a 50 s cambiaría de salto rápido a no salto.
- **Fechas sin zona.** Las fechas `dd/MM/yyyy` y las marcas Unix se interpretan como UTC (así las
  genera el ensuciado). Con datos reales en hora local habría que saber la zona de origen.
- **Artistas que solo difieren en mayúsculas o tildes** se unen en uno (por ejemplo, dos grupos
  distintos llamados «Rosa» y «Rosá»). Es poco probable con dos personas.
- **Canciones sin duración:** 4.350 de las 10.378 candidatas no tienen `duracion_ms` porque nadie
  las escuchó enteras. Para cortar la playlist por la duración del viaje hay que imputarlas (por
  ejemplo, con la mediana de las demás, unos 3 minutos).
- **`grp_tasa_no_salto` mezcla personas.** Con dos personas, el «resto del grupo» de una es la otra,
  así que la variable arrastra la diferencia de tasas medias entre ellas (correlación de -0,45 con la
  etiqueta). Conviene usarla normalizada por la media de la otra persona o comprobar que aporta
  dentro de cada persona.
- **Filas eliminadas en silver:** las reproducciones de 0 ms y las de ms negativos (problemas 7 y 4)
  se descartan, como dice el plan; por eso silver tiene unas 10.000 filas menos que sin ensuciar.
