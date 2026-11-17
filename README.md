# Proyecto Ebaluacion1

Entorno local en Docker para la parte de Big Data del proyecto (especialidad de IA y Big Data).
Solo se usa Hadoop y su ecosistema: **HDFS, YARN y Hive**. No se usa PySpark. Se incluye además un servidor de **MLflow** para el seguimiento de experimentos.

## Índice

1. [Requisitos](#requisitos)
2. [Estructura del repositorio](#estructura-del-repositorio)
3. [Arrancar el entorno](#arrancar-el-entorno)
4. [Validar el entorno](#validar-el-entorno)
5. [Parar el entorno](#parar-el-entorno)
6. [Puertos y URLs](#puertos-y-urls)
7. [Uso básico](#uso-básico)
8. [Problemas frecuentes](#problemas-frecuentes)

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
│   └── validar_entorno.sh  comprobación de todo el entorno
└── data/
    └── entrada/            aquí se dejan los JSON preparados (no se suben a Git)
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
- **`$'\r': command not found` al ejecutar el script**: el fichero tiene saltos de línea de Windows. El `.gitattributes` lo evita al clonar; si aun así ocurre, conviértelo con `sed -i 's/\r$//' bigdata/validar_entorno.sh`.
