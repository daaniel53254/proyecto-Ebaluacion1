# Proyecto Ebaluacion1

Entorno local en Docker para la parte de Big Data del proyecto (especialidad de IA y Big Data).
Solo se usa Hadoop y su ecosistema: **HDFS, YARN y Hive**, en Docker. No se usa PySpark. El seguimiento de experimentos y el registro de modelos se hacen con **MLflow instalado en local** (fuera de Docker): `bash servidor_mlflow.sh arrancar`.

Repositorio: <https://github.com/daaniel53254/proyecto-Ebaluacion1> · Proyecto del 1er trimestre de Big Data + IA de CEBANC, «Playlist perfecta para viajes en grupo» (NPD Entertainment), de Daniel Magariño y Ander Ameztoy.

> **¿Primera vez?** Sigue la [guía de instalación](INSTALACION.md) o ejecuta directamente `bash instalar.sh` desde la raíz del repositorio: comprueba requisitos, arranca todo y lo valida.

## Índice

1. [Requisitos](#requisitos)
2. [Estructura del repositorio](#estructura-del-repositorio)
3. [Arrancar el entorno](#arrancar-el-entorno)
4. [Validar el entorno](#validar-el-entorno)
5. [Flujo de datos automatizado](#flujo-de-datos-automatizado)
6. [Notebooks de IA](#notebooks-de-ia)
7. [API (FastAPI)](#api-fastapi)
8. [Panel (Streamlit)](#panel-streamlit)
9. [Parar el entorno](#parar-el-entorno)
10. [Puertos y URLs](#puertos-y-urls)
11. [Uso básico](#uso-básico)
12. [Problemas frecuentes](#problemas-frecuentes)

## Requisitos

- **Docker Desktop** (Windows o macOS) o **Docker Engine** con el plugin Compose v2 (Linux). El motor tiene que estar arrancado antes de lanzar ningún comando.
- **Bash** para el script de validación: en Windows vale **Git Bash** (viene con Git for Windows) o WSL; en macOS y Linux ya está instalado.
- **Python 3.9 o superior** (python.org o Anaconda) para el servidor local de MLflow, los notebooks y la API.
- Unos **8 GB de RAM** asignados a Docker y unos **12 GB de disco** para las imágenes.
- Puertos libres en el equipo: 5000, 8088, 9000, 9870 y 10000.

El entorno se ha preparado y probado en Windows 11 con Docker Desktop y Git Bash. Los comandos son los mismos en macOS y Linux.

## Estructura del repositorio

```
proyecto-Ebaluacion1/
├── README.md
├── .gitignore
├── .gitattributes          fuerza saltos de línea LF en .sh, .env y .yml
├── docker/
│   ├── docker-compose.yml  definición de los servicios
│   └── hadoop.env          configuración de Hadoop y Hive
├── bigdata/
│   ├── validar_entorno.sh  comprobación de todo el entorno
│   ├── preparar.py         quita datos personales y pasa los historiales a JSON Lines
│   ├── ensuciar.py         introduce los problemas 1 a 8 del plan de ensuciado (semilla 42)
│   ├── kaggle_ddl.py       genera las tablas bronze de Kaggle a partir de la cabecera de cada CSV
│   ├── exportar.py         pasa la salida de beeline a CSV con comillas para los notebooks
│   ├── pipeline.sh         flujo automatizado: preparar -> ensuciar -> bronze -> silver -> gold -> CSV
│   └── sql/
│       ├── silver.sql            limpieza de los 8 problemas y columnas derivadas
│       ├── gold.sql              gold.objetivo1 y gold.candidatas
│       └── validar_limpieza.sql  cada problema contado en bronze y en silver
├── api/                    API con FastAPI: subida de historiales, reentrenamiento, objetivos 1 y 2 (ver «API (FastAPI)»)
│   └── tests/              pruebas con datos sintéticos (python -m pytest api -q)
├── panel/                  panel en Streamlit (app.py, datos.py, tema NPD; ver panel/README.md)
├── web/                    web de usuario en Next.js (ver web/README.md)
├── arrancar_web.bat        arranca la API y la web con una carpeta de demo (data/demo)
├── notebooks/              notebooks de la etapa de IA (01 revisión, 02 EDA, 03 modelos base, 04 drift, 05 modelos finales, 06 objetivo 2 final, 07 mejoras temporales)
├── scripts/
│   └── probar_tercer_historial.py  prueba de la API con el historial de una tercera persona
├── requirements-ia.txt     versiones exactas de las librerías de los notebooks (las escribe el notebook 07)
├── servidor_mlflow.sh/.bat servidor local de MLflow (puerto 5000)
├── docs/
│   ├── diccionario_datos.md  columnas, tipos y cifras de cada capa
│   └── evidencias/           log de cada ejecución del pipeline
└── data/
    ├── raw/<persona>/      historiales de Spotify tal como llegan (no se suben a Git)
    ├── entrada/            JSON preparados y CSV de Kaggle que ve el namenode como /entrada (no se suben a Git)
    └── dataset/            CSV de silver y gold exportados para los notebooks (no se suben a Git)
```

La carpeta `mlruns/` guarda los datos del servidor local de MLflow (`mlruns/mlflow.db` y los artefactos) y `.venv-mlflow/` su entorno virtual de Python. Las dos están excluidas de Git.

## Arrancar el entorno

Desde la raíz del repositorio:

```bash
cd docker
docker compose up -d
```

La primera vez se descargan las imágenes y tarda varios minutos. Después, el arranque completo lleva entre uno y dos minutos, porque Hive espera a que HDFS y el metastore estén sanos. Para ver el estado:

```bash
docker compose ps
```

Todos los servicios deben aparecer como `healthy`.

### Web de usuario

Para probar la web de playlists para viajes en grupo (sin Docker), ejecuta `arrancar_web.bat` desde la raíz: levanta la API y la web sobre una carpeta de demo (`data/demo`) y abre `http://127.0.0.1:3000`. Instrucciones, variables y cómo dar de alta la app de Spotify en [`web/README.md`](web/README.md).

## Validar el entorno

Desde la raíz del repositorio (en Windows, dentro de Git Bash):

```bash
bash bigdata/validar_entorno.sh
```

El script hace cinco comprobaciones y se detiene en la primera que falle:

1. Espera a que los siete contenedores estén en estado `healthy`.
2. Crea `/bronze`, `/silver` y `/gold` en HDFS y las lista.
3. Sube un archivo de prueba a `/bronze/test/` desde la carpeta montada `/entrada` y muestra su tamaño.
4. Con beeline crea la base de datos `bronze` y una tabla externa sobre ese archivo, hace un `SELECT COUNT(*)` y borra la tabla.
5. Comprueba que el servidor local de MLflow responde en `http://localhost:5000` (si no está arrancado: `bash servidor_mlflow.sh arrancar`, o doble clic en `servidor_mlflow.bat` en Windows con Anaconda).

Al terminar borra el archivo de prueba, tanto en `data/entrada` como en HDFS. Las carpetas `/bronze`, `/silver`, `/gold` y la base de datos `bronze` se conservan.

## Flujo de datos automatizado

1. Cada miembro descomprime su ZIP del historial ampliado de Spotify y copia los `Streaming_History_Audio_*.json` en `data/raw/<su_nombre>/`. Esa carpeta no se sube a Git.
2. Opcional: los CSV de Kaggle (`spotify_tracks.csv`, `spotify_1m_tracks.csv`) en `data/entrada/kaggle/`. Si no están, el pipeline se salta su ingesta.
3. Con el entorno arrancado, desde la raíz del repositorio:

```bash
bash bigdata/pipeline.sh
```

El script hace nueve pasos y se detiene en el primero que falle (unos 20 minutos):

1. Comprueba que HDFS, YARN y Hive están sanos.
2. `preparar.py` elimina los campos personales (`ip_addr`, `conn_country`, `username`...), sustituye el nombre por un seudónimo estable (`persona_<hash>`) y escribe cada fichero en JSON Lines en `data/entrada/historial/persona=<seudonimo>/`, junto a un `manifiesto.json` con filas y bytes medidos.
3. `ensuciar.py` introduce los problemas 1 a 8 del plan de ensuciado con semilla 42 y deja el registro de filas tocadas en `data/entrada/ensuciado.json`.
4. Sube los ficheros en bruto a `/bronze/spotify/historial/` y, si están, los CSV de Kaggle a `/bronze/kaggle/`.
5. Crea las tablas externas `bronze.historial` (JsonSerDe, una partición por persona) y `bronze.kaggle_*` (CSV).
6. `sql/silver.sql` crea `silver.reproducciones` en Parquet: limpia los 8 problemas y añade hora local (Europe/Madrid), franja de 4 h, tipo de día, lote (corte el 1 de julio de 2025) y `no_salto`.
7. `sql/gold.sql` crea `gold.objetivo1` (persona × canción × contexto × lote, con la tasa de no salto y las variables sin fuga) y `gold.candidatas` (entrada del recomendador).
8. Comprueba que bronze ocupa más de 2 MB, que Hive cuenta las mismas filas que el manifiesto, que cada persona tiene al menos 3.000 y que los 8 problemas del ensuciado quedan a 0 en silver.
9. Exporta silver y gold a CSV en `data/dataset/` para los notebooks.

Las columnas de cada tabla están en [docs/diccionario_datos.md](docs/diccionario_datos.md).

Es idempotente: al añadir el historial de otra persona basta con volver a lanzarlo. La salida completa queda en `docs/evidencias/pipeline_<fecha>.log`.

## Notebooks de IA

Los notebooks leen los CSV que deja el pipeline en `data/dataset/` (silver y gold) y los CSV de Kaggle. Se ejecutan en orden:

| Notebook | Qué hace |
| --- | --- |
| `notebooks/01_revision_datos.ipynb` | Revisión de calidad del dataset de Kaggle, cobertura del cruce con los historiales y prueba de si el audio predice el gusto (Ridge). |
| `notebooks/02_eda.ipynb` | Análisis exploratorio de silver y gold: hábitos por persona, franja y tipo de día, distribución de la tasa de no salto y diferencias entre lotes. |
| `notebooks/03_modelos_base.ipynb` | Modelos base de los dos objetivos con MLflow: objetivo 1 (regresión de la tasa de no salto: dos modelos base, Ridge y Gradient Boosting, validación con `GroupKFold` por canción y test en el lote 2) y objetivo 2 (recomendador de grupo frente a "las más escuchadas", N = 20, 50 y 100). Guarda `recomendador_gustos.csv` para el panel. |
| `notebooks/04_drift.ipynb` | Data drift y model drift con el lote 2 (PSI, calibración mensual, error por trimestre), comparación de políticas de reentrenamiento y estrategia de monitorización. Experimento `drift` en MLflow. |
| `notebooks/05_modelos_finales.ipynb` | Modelos finales del objetivo 1: búsqueda de hiperparámetros, análisis de errores y registro de modelos en MLflow (`playlist_tasa_no_salto`, alias `produccion` y `anterior`). |
| `notebooks/06_objetivo2_final.ipynb` | Objetivo 2 con los modelos finales: qué modelo ordena la playlist (GB absoluto frente a GB cuadrático y el empate de percentiles de Daniel), evaluación frente a «las más escuchadas» en el lote 2 con diferencia emparejada e intervalo bootstrap, y quién marca el mínimo del grupo. |
| `notebooks/07_mejoras_temporal.ipynb` | Mejoras del modelo con validación temporal: variables con escuchas anteriores a cada corte y etiqueta de los 6 meses siguientes (historial propio de la canción, cansancio, tasa reciente), elección con la validación de 2025-H1 y prueba única en el lote 2 (MAE 0,190 → 0,160 frente al notebook 05); el recomendador con el modelo nuevo no mejora y se mantiene el del notebook 06. Guarda `modelos/07_modelo_temporal.joblib`. La sección 8 evalúa la opción «todo el historial» de la API (con reparto mínimo entre miembros) y la 9 escribe `requirements-ia.txt`. |
| `notebooks/08_canciones_nuevas.ipynb` | Canciones que nadie ha escuchado: apertura de cada persona a lo nuevo, modelo de adopción (la vuelve a escuchar sin saltarla en 90 días) con variables anteriores a cada primera escucha, validación temporal (2025-01 a 03) y prueba única en el lote 2 (AUC 0,637; el 20 % mejor se adopta una vez y media más). Regla «¿entraría?» con huecos para novedades, la de `POST /objetivo2/entraria`. Guarda `modelos/08_modelo_novedades.joblib`. |

**En local (Anaconda o venv):** `pip install -r requirements-ia.txt` (las mismas versiones exactas con las que se ejecutaron los notebooks en Colab, para que local y Colab den las mismas cifras) y abre los notebooks desde la raíz del repositorio con el pipeline ya ejecutado.

**En Google Colab:** los notebooks descargan los CSV de gold desde la carpeta compartida `Proyecto_Ebal1/datasets` de Drive (hace falta tener el acceso directo en "Mi unidad").

**MLflow:** el notebook 03 registra los experimentos `objetivo1_tasa_no_salto` y `objetivo2_recomendador` en una base SQLite (`mlflow.db`). Para verlos:

```bash
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5055
```

y abre `http://localhost:5055`. Si el servidor local de MLflow está en marcha (`bash servidor_mlflow.sh arrancar`), los notebooks registran directamente en `http://localhost:5000`.

## API (FastAPI)

La carpeta `api/` es el servicio completo: **cada persona sube el .zip de su historial de Spotify y, con todos los historiales subidos, la API genera el resto** (variables, modelo del objetivo 1, catálogo y playlists del objetivo 2).

**Instalar y arrancar** (desde la raíz del repositorio):

```bash
pip install -r api/requirements.txt
python -m api.preparar_datos          # opcional: prepara el modelo con los historiales de data/raw/ (unos 9 s)
uvicorn api.main:app --port 8000
```

En Windows con Anaconda basta con hacer doble clic en `api/arrancar_api.bat`. Si al arrancar hay historiales en `data/raw/` y no hay modelo, la API lo prepara sola. La documentación interactiva, desde donde también se puede subir el zip, está en <http://localhost:8000/docs>.

| Endpoint | Qué hace |
| --- | --- |
| `POST /historiales` | Sube el .zip del «Extended streaming history» (formulario con `persona`, `consentimiento`, `mayor_de_16` y `archivo`). Guarda solo los `Streaming_History_Audio_*.json` y, de ellos, 12 campos de escucha (sin IP ni país) en `data/raw/<persona>/`, la carpeta de entrada de `pipeline.sh`, junto a la prueba del consentimiento (`consentimiento.json`). Si la persona es nueva, devuelve **una sola vez** su token. Después reentrena en segundo plano. |
| `GET /privacidad` | Texto completo que acepta cada persona (versión, finalidad, datos, conservación, derechos y edad mínima de 16 años). |
| `GET /preparacion` | Estado del reentrenamiento: `en_curso`, `lista` o `error` (con el motivo). |
| `GET /historiales`, `DELETE /historiales/{persona}` | Personas subidas; borrar los datos de una persona (derecho de supresión del RGPD) y reentrenar sin ellos. Borrar o volver a subir una persona que ya existe exige su token en la cabecera `X-Token`. |
| `POST /objetivo1/prediccion` | Tasa de no salto prevista para persona × canción × contexto (hasta 1.000 filas). El contexto se da con `franja` (0-5) y `tipo_dia`, o con `fecha_hora`. |
| `POST /objetivo2/playlist` | Playlist del grupo en un contexto: percentil del gusto de cada miembro, mínimo del grupo y desempate por la media. Admite `n`, `duracion_min`, `excluir_artistas` y las opciones de abajo. |
| `POST /objetivo2/cancion` | ¿Entraría una canción que **el grupo ya conoce** en esa playlist? Recibe el `track_id` y los mismos filtros que `/objetivo2/playlist`; devuelve si entra, su puesto, cuántas candidatas hay y la tasa de no salto de cada miembro (real con 5 o más escuchas, si no prevista). Es el paso 4 de la web. Para canciones que nadie ha escuchado, `/objetivo2/entraria`. |
| `GET /canciones?buscar=...` | Buscador: canciones que alguien del grupo ha escuchado y cuyo título o artista contiene el texto (sin tildes ni mayúsculas), las más escuchadas primero, con las escuchas de cada persona. |
| `GET /artistas` | Artistas del grupo; con `?por_persona=true`, cada uno con las escuchas de cada persona que lo tiene en su historial. |
| `POST /objetivo2/entraria` | ¿Entraría en la playlist una canción que **nadie ha escuchado**? Basta con el `artista` (y si puedes el `album`). Para cada miembro, probabilidad de que la adopte (la vuelva a escuchar sin saltarla en 90 días) según su apertura a lo nuevo y lo que conoce del artista, en percentil frente a sus novedades de los últimos 12 meses; entra si el mínimo del grupo es 0,80 o más. Devuelve también los `huecos_novedades` de una playlist de 50. Modelo del notebook 08 (`api/novedades.py`). |
| `GET /salud`, `/modelo`, `/personas`, `/contextos` | Estado, modelo cargado, miembros y contextos válidos. |

Opciones de `POST /objetivo2/playlist`:

| Campo | Valores | Qué hace |
| --- | --- | --- |
| `historial` | `"18_meses"` (por defecto) o `"completo"` | Con `"completo"`, las candidatas salen de todo el historial (3 o más escuchas del grupo), el gusto mezcla lo real con lo previsto, `(no saltos + 5 × prevista) / (escuchas + 5)`, y cada miembro conoce al menos un tercio de la lista. Se evalúa en la sección 8 del notebook 07. |
| `ignorar_horario` | `false` (por defecto) o `true` | No filtra por franja ni tipo de día. Ordena primero las canciones que nadie tiene por debajo del percentil 0,20; dentro, las de gusto real de todos (3 o más escuchas) antes que las previstas, y de mayor a menor media de los percentiles menos su dispersión entre miembros. |
| `detalle_miembros` | `true` (por defecto) o `false` | Con `false` la respuesta no trae el gusto de cada miembro por cada canción. |
| `desempate` | `"media"` (por defecto) o `"media_y_escuchas"` | Cómo se deshacen los empates; la segunda opción no está evaluada. |
| `franjas` | lista de franjas seguidas, p. ej. `[5, 0]` | Varias franjas en lugar de una (con `tipo_dia`); la web las usa para «mañana», «tarde» y «noche». |
| `excluir_canciones` | lista de `track_id` | Quita canciones concretas de la playlist (hasta 200). |

```json
POST /objetivo2/playlist
{"personas": ["ander", "daniel"], "franja": 3, "tipo_dia": "fin_semana", "n": 30, "historial": "completo"}
```

```json
POST /objetivo2/entraria
{"personas": ["ander", "daniel"], "canciones": [{"artista": "Nombre del artista", "album": "Nombre del álbum"}]}
```

Los errores devuelven siempre `{"error": ..., "detalle": ...}`: 403 si falta el token o no coincide, 404 si la persona o la canción no existen, 413 si el fichero es demasiado grande, 422 si la entrada no es válida (también sin consentimiento o con menos de 16 años) y 503 si el modelo no está listo.

**Tokens.** Solo se guarda el hash SHA-256 del token (`data/raw/<persona>/.token`). Las carpetas que ya existían sin token (las del equipo) solo se pueden borrar o sustituir con el token de administración de la variable de entorno `API_TOKEN_ADMIN`; si no está definida, no se pueden borrar por la API.

**Qué modelo usa.** Cada preparación entrena la configuración de la versión de producción del registro de MLflow (`playlist_tasa_no_salto@produccion`: Gradient Boosting con pérdida absoluta, notebook 05) con los **últimos 18 meses** de los historiales subidos, que es la política de reentrenamiento del notebook 04. Se entrena en el mismo entorno que la API porque cambian las personas con cada subida y porque un modelo guardado solo se puede cargar con la misma versión de scikit-learn. Si `MLFLOW_TRACKING_URI` apunta a un servidor con el registro, se carga desde él. Para reproducir exactamente el periodo de la versión registrada: `python -m api.preparar_datos --hasta 2025-07-01`.

**Pruebas:** `python -m pytest api -q` (datos sintéticos: no necesitan los historiales reales ni MLflow).

**Prueba con un tercer historial** (con la API arrancada; no subas a Git ni el zip ni la salida):

```bash
python scripts/probar_tercer_historial.py --zip ruta/al/my_spotify_data.zip --persona carla --franja 3 --tipo-dia fin_semana --n 30
```

## Panel (Streamlit)

El panel cuenta la historia de los datos hasta la playlist (hábitos de cada persona, calidad de los datos, no salto por contexto y recomendador) con la identidad de NPD Entertainment. Lee los CSV de `data/dataset/` y, en la pestaña de la playlist, usa el mismo modelo que la API (`api/datos/`).

```bash
pip install -r panel/requirements.txt
python -m streamlit run panel/app.py
```

Se abre en <http://localhost:8501>. En la pestaña de la playlist se puede elegir «Últimos 18 meses» o «Todo el historial» y una franja o «Sin importar». Más detalle en [panel/README.md](panel/README.md).

## Parar el entorno

Desde la carpeta `docker/`:

| Qué quieres hacer | Comando |
|---|---|
| Parar y conservar los datos | `docker compose down` |
| Parar sin eliminar los contenedores | `docker compose stop` |
| Parar y **borrar todos los datos** de HDFS y del metastore | `docker compose down -v` |
| Arrancar / parar MLflow (local, desde la raíz) | `bash servidor_mlflow.sh arrancar` / `bash servidor_mlflow.sh parar` |

Los datos de HDFS y del metastore de Hive están en volúmenes con nombre, así que sobreviven a `down` y a reiniciar el equipo. Solo se pierden con `down -v`. Los de MLflow están en `mlruns/` y no dependen de Docker.

## Puertos y URLs

| Servicio | Contenedor | Puerto | URL o cadena de conexión |
|---|---|---|---|
| HDFS, interfaz web | `namenode` | 9870 | http://localhost:9870 |
| HDFS, RPC | `namenode` | 9000 | `hdfs://localhost:9000` |
| YARN, interfaz web | `resourcemanager` | 8088 | http://localhost:8088 |
| HiveServer2 | `hiveserver2` | 10000 | `jdbc:hive2://localhost:10000` |
| MLflow (local, sin Docker) | — | 5000 | http://localhost:5000 |

Sin puerto publicado en el equipo: `datanode`, `nodemanager`, `hive-metastore` (9083) y `hive-metastore-postgresql` (5432).

## Uso básico

Subir a HDFS un JSON que hayas dejado en `data/entrada/` (dentro del namenode esa carpeta es `/entrada`):

```bash
docker exec namenode hdfs dfs -put /entrada/mi_archivo.json /bronze/
```

Abrir una sesión de Hive con beeline:

```bash
docker exec -it hiveserver2 beeline -u jdbc:hive2://localhost:10000 -n root
```

Apuntar un cliente de MLflow al servidor:

```bash
export MLFLOW_TRACKING_URI=http://localhost:5000
```

En PowerShell: `$env:MLFLOW_TRACKING_URI = "http://localhost:5000"`.

> **Git Bash en Windows:** si escribes a mano un comando con rutas que empiezan por `/` (por ejemplo `/bronze`), Git Bash las convierte en rutas de Windows. Para evitarlo, ejecuta antes `export MSYS_NO_PATHCONV=1`. El script de validación ya lo hace. En PowerShell no ocurre.

## Problemas frecuentes

- **`open //./pipe/dockerDesktopLinuxEngine`**: Docker Desktop no está arrancado. Ábrelo y espera a que el icono indique que está en marcha.
- **Un puerto ya está en uso**: cierra el programa que lo ocupa o cambia el número de la izquierda en `ports:` del `docker-compose.yml`. En macOS el puerto 5000 lo suele ocupar el receptor de AirPlay.
- **Un contenedor no pasa a `healthy`**: mira sus registros con `docker compose logs -f <servicio>`.
- **`Ya hay un pipeline en marcha`**: solo puede ejecutarse uno a la vez. Si se apagó el equipo a mitad, borra la carpeta `data/.pipeline_en_marcha` y vuelve a lanzarlo.
- **`GC overhead limit exceeded` en un trabajo de Hive**: cada map y reduce necesita más memoria que la que da Hadoop por defecto; los ficheros de `bigdata/sql/` ya la suben a 1,5 GB con `SET mapreduce.*.memory.mb`.
- **`$'\r': command not found` al ejecutar el script**: el fichero tiene saltos de línea de Windows. El `.gitattributes` lo evita al clonar; si aun así ocurre, conviértelo con `sed -i 's/\r$//' bigdata/validar_entorno.sh`.
