# Proyecto Ebaluacion1

Entorno local en Docker para la parte de Big Data del proyecto (especialidad de IA y Big Data).
Solo se usa Hadoop y su ecosistema: **HDFS, YARN y Hive**. No se usa PySpark. Se incluye además un servidor de **MLflow** para el seguimiento de experimentos.

> **¿Primera vez?** Sigue la [guía de instalación](INSTALACION.md) o ejecuta directamente `bash instalar.sh` desde la raíz del repositorio: comprueba requisitos, arranca todo y lo valida.

## Índice

1. [Requisitos](#requisitos)
2. [Estructura del repositorio](#estructura-del-repositorio)
3. [Arrancar el entorno](#arrancar-el-entorno)
4. [Validar el entorno](#validar-el-entorno)
5. [Flujo de datos automatizado](#flujo-de-datos-automatizado)
6. [Parar el entorno](#parar-el-entorno)
7. [Puertos y URLs](#puertos-y-urls)
8. [Uso básico](#uso-básico)
9. [Problemas frecuentes](#problemas-frecuentes)

## Requisitos

- **Docker Desktop** (Windows o macOS) o **Docker Engine** con el plugin Compose v2 (Linux). El motor tiene que estar arrancado antes de lanzar ningún comando.
- **Bash** para el script de validación: en Windows vale **Git Bash** (viene con Git for Windows) o WSL; en macOS y Linux ya está instalado.
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
├── panel/                  panel v1 en Streamlit (app.py, datos.py; ver panel/README.md)
├── notebooks/              notebooks de la etapa de IA
├── docs/
│   ├── diccionario_datos.md  columnas, tipos y cifras de cada capa
│   └── evidencias/           log de cada ejecución del pipeline
└── data/
    ├── raw/<persona>/      historiales de Spotify tal como llegan (no se suben a Git)
    ├── entrada/            JSON preparados y CSV de Kaggle que ve el namenode como /entrada (no se suben a Git)
    └── dataset/            CSV de silver y gold exportados para los notebooks (no se suben a Git)
```

La carpeta `mlruns/` la crea Docker al arrancar y guarda los artefactos de MLflow. Está excluida de Git.

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

## Validar el entorno

Desde la raíz del repositorio (en Windows, dentro de Git Bash):

```bash
bash bigdata/validar_entorno.sh
```

El script hace cinco comprobaciones y se detiene en la primera que falle:

1. Espera a que los ocho contenedores estén en estado `healthy`.
2. Crea `/bronze`, `/silver` y `/gold` en HDFS y las lista.
3. Sube un archivo de prueba a `/bronze/test/` desde la carpeta montada `/entrada` y muestra su tamaño.
4. Con beeline crea la base de datos `bronze` y una tabla externa sobre ese archivo, hace un `SELECT COUNT(*)` y borra la tabla.
5. Comprueba que MLflow responde en `http://localhost:5000`.

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

## Parar el entorno

Desde la carpeta `docker/`:

| Qué quieres hacer | Comando |
|---|---|
| Parar y conservar los datos | `docker compose down` |
| Parar sin eliminar los contenedores | `docker compose stop` |
| Parar y **borrar todos los datos** (HDFS, metastore y MLflow) | `docker compose down -v` |

Los datos de HDFS, del metastore de Hive y de MLflow están en volúmenes con nombre, así que sobreviven a `down` y a reiniciar el equipo. Solo se pierden con `down -v`.

## Puertos y URLs

| Servicio | Contenedor | Puerto | URL o cadena de conexión |
|---|---|---|---|
| HDFS, interfaz web | `namenode` | 9870 | http://localhost:9870 |
| HDFS, RPC | `namenode` | 9000 | `hdfs://localhost:9000` |
| YARN, interfaz web | `resourcemanager` | 8088 | http://localhost:8088 |
| HiveServer2 | `hiveserver2` | 10000 | `jdbc:hive2://localhost:10000` |
| MLflow | `mlflow` | 5000 | http://localhost:5000 |

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
