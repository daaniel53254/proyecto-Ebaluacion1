# Guía de instalación del entorno

**Proyecto:** Ebaluacion1 · Big Data + IA
**Para:** cualquier miembro del equipo que quiera tener el mismo entorno en su equipo
**Repositorio:** https://github.com/daaniel53254/proyecto-Ebaluacion1

Esta guía deja tu equipo exactamente igual que el entorno de referencia: HDFS, YARN y Hive en Docker, con las mismas versiones, puertos y configuración, y **MLflow instalado en local** (en un entorno virtual de Python, fuera de Docker).

---

## Índice

1. [Qué vas a tener](#1-qué-vas-a-tener)
2. [Requisitos](#2-requisitos)
3. [Instalar las herramientas según tu sistema](#3-instalar-las-herramientas-según-tu-sistema)
4. [Instalación rápida con el script](#4-instalación-rápida-con-el-script)
5. [Instalación paso a paso (sin script)](#5-instalación-paso-a-paso-sin-script)
6. [Comprobar que todo funciona](#6-comprobar-que-todo-funciona)
7. [Uso diario](#7-uso-diario)
8. [Trabajar juntos con Git](#8-trabajar-juntos-con-git)
9. [Problemas frecuentes](#9-problemas-frecuentes)

---

## 1. Qué vas a tener

Siete contenedores Docker, todos con las mismas imágenes y versiones, y el servidor de MLflow en local:

| Servicio | Contenedor | Imagen | Puerto en tu equipo |
|---|---|---|---|
| HDFS NameNode | `namenode` | `bde2020/hadoop-namenode:2.0.0-hadoop3.2.1-java8` | 9870 (web), 9000 (RPC) |
| HDFS DataNode | `datanode` | `bde2020/hadoop-datanode:2.0.0-hadoop3.2.1-java8` | — |
| YARN ResourceManager | `resourcemanager` | `bde2020/hadoop-resourcemanager:2.0.0-hadoop3.2.1-java8` | 8088 |
| YARN NodeManager | `nodemanager` | `bde2020/hadoop-nodemanager:2.0.0-hadoop3.2.1-java8` | — |
| PostgreSQL del metastore | `hive-metastore-postgresql` | `bde2020/hive-metastore-postgresql:2.3.0` | — |
| Hive Metastore | `hive-metastore` | `bde2020/hive:2.3.2-postgresql-metastore` | — |
| HiveServer2 | `hiveserver2` | `bde2020/hive:2.3.2-postgresql-metastore` | 10000 |
| MLflow (**local, sin Docker**) | — | paquete `mlflow` 3.x en `.venv-mlflow/` | 5000 |

Los datos de HDFS y del metastore de Hive se guardan en volúmenes de Docker y no se pierden al apagar el equipo. Los de MLflow están en la carpeta `mlruns/` del repositorio (`mlruns/mlflow.db` para experimentos, ejecuciones y registro de modelos; el resto de `mlruns/` para los artefactos).

> **Importante:** los datos **no** se comparten por Git. Cada uno tiene su propio HDFS y su propio Hive. Lo que se comparte es el código: compose, scripts y consultas `.hql`. Los JSON de entrada os los tenéis que pasar aparte (Drive, USB…) y dejarlos en `data/entrada/`.

## 2. Requisitos

| Requisito | Mínimo |
|---|---|
| RAM asignada a Docker | 6 GB (recomendado 8 GB) |
| Espacio libre en disco | 15 GB |
| Puertos libres | 5000, 8088, 9000, 9870, 10000 |
| Software | Git, Docker Desktop (o Docker Engine en Linux) y Python 3.9 o superior (python.org o Anaconda) |
| Terminal | Bash: en Windows, **Git Bash**, que se instala con Git |

## 3. Instalar las herramientas según tu sistema

### Windows 10/11

1. Instala **Git for Windows**: https://git-scm.com/download/win. Deja las opciones por defecto: incluye Git Bash.
2. Instala **Docker Desktop**: https://www.docker.com/products/docker-desktop/
   - Durante la instalación, marca **Use WSL 2** si te lo pregunta.
   - Si pide activar WSL, abre PowerShell como administrador, ejecuta `wsl --install` y reinicia.
3. Abre Docker Desktop y espera a que ponga **Engine running**.
4. En Docker Desktop > *Settings* > *Resources*, comprueba que tenga al menos 6 GB de memoria. Con WSL 2 lo gestiona Windows y suele bastar.
5. Usa **Git Bash** (menú Inicio > *Git Bash*) para los comandos de esta guía.

### macOS

1. Instala Git. Si no lo tienes, al escribir `git` en la Terminal el sistema te ofrece instalarlo.
2. Instala **Docker Desktop** para tu chip (Intel o Apple): https://www.docker.com/products/docker-desktop/
3. **Mac con chip M (M1, M2, M3…):** en Docker Desktop > *Settings* > *General*, activa **Use Rosetta for x86_64/amd64 emulation on Apple Silicon**. Las imágenes de Hadoop y Hive solo existen para Intel y se ejecutan emuladas. Funciona, aunque más lento.
4. Asigna 8 GB en *Settings* > *Resources*.
5. Desactiva el **Receptor AirPlay**, que ocupa el puerto 5000: *Ajustes del Sistema* > *General* > *AirDrop y Handoff*.
6. Usa la app **Terminal**.

### Linux (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install -y git curl
```

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker $USER
```

Cierra la sesión y vuelve a entrar para poder usar `docker` sin `sudo`.

## 4. Instalación rápida con el script

Con las herramientas instaladas y Docker arrancado, abre la terminal (Git Bash en Windows) y ejecuta:

```bash
git clone https://github.com/daaniel53254/proyecto-Ebaluacion1.git
```

```bash
cd proyecto-Ebaluacion1
```

```bash
bash instalar.sh
```

El script hace todo esto por ti:

1. Detecta tu sistema operativo y procesador.
2. Comprueba que tienes Git, Docker y Docker Compose.
3. Arranca Docker si está parado y comprueba la memoria disponible.
4. Comprueba que los puertos están libres.
5. Descarga las imágenes (unos 12 GB la primera vez: ten paciencia) y arranca los 7 servicios de Docker.
6. Instala MLflow en local (crea el entorno virtual `.venv-mlflow`) y arranca su servidor en http://localhost:5000.
7. Ejecuta la validación completa del entorno.

Si todo va bien, al final verás **«Entorno validado correctamente.»** y la lista de URLs.

> Para arrancar sin repetir la validación: `bash instalar.sh --rapido`.

## 5. Instalación paso a paso (sin script)

Si prefieres hacerlo a mano, o el script falla en algún punto:

```bash
git clone https://github.com/daaniel53254/proyecto-Ebaluacion1.git
```

```bash
cd proyecto-Ebaluacion1/docker
```

```bash
docker compose pull
```

```bash
docker compose up -d --wait
```

```bash
docker compose ps
```

Los 7 servicios tienen que aparecer como `healthy`. Después, desde la raíz del repositorio, arranca MLflow en local y valida:

```bash
cd .. && bash servidor_mlflow.sh arrancar
```

En Windows con Anaconda también puedes hacer doble clic en `servidor_mlflow.bat` (deja una ventana abierta con el servidor).

```bash
bash bigdata/validar_entorno.sh
```

## 6. Comprobar que todo funciona

La validación (`bigdata/validar_entorno.sh`) comprueba:

1. Que los 7 contenedores están en estado `healthy`.
2. Que existen en HDFS las carpetas `/bronze`, `/silver` y `/gold`, y las crea si no están.
3. Que se puede subir un archivo a HDFS desde `data/entrada/`.
4. Que Hive crea una tabla externa, cuenta sus filas (3) con un trabajo de YARN y la borra.
5. Que el servidor local de MLflow responde en http://localhost:5000.

También puedes abrir en el navegador:

| Qué | URL | Qué deberías ver |
|---|---|---|
| HDFS | http://localhost:9870 | *Overview 'namenode:9000' (active)* y 1 nodo vivo en *Datanodes* |
| YARN | http://localhost:8088 | *All Applications* y 1 nodo en *Active Nodes* |
| MLflow | http://localhost:5000 | La página de experimentos de MLflow |

## 7. Uso diario

Todos los comandos de `docker compose` se lanzan desde la carpeta `docker/`.

| Qué quieres hacer | Comando |
|---|---|
| Arrancar | `docker compose up -d` |
| Ver el estado | `docker compose ps` |
| Ver registros de un servicio | `docker compose logs -f hiveserver2` |
| Parar conservando los datos | `docker compose down` |
| Borrar **todo**, incluidos los datos de HDFS y Hive | `docker compose down -v` |
| Arrancar / parar MLflow (desde la raíz) | `bash servidor_mlflow.sh arrancar` / `bash servidor_mlflow.sh parar` |

Subir un JSON a HDFS (antes déjalo en `data/entrada/`):

```bash
docker exec namenode hdfs dfs -put /entrada/canciones.json /bronze/
```

Abrir una consola de Hive:

```bash
docker exec -it hiveserver2 beeline -u jdbc:hive2://localhost:10000 -n root
```

> **Nombres de fichero:** no empieces ningún fichero de datos por `_` o por `.`, porque Hive los ignora y las tablas salen vacías.

> **Git Bash:** si escribes a mano un comando con rutas que empiezan por `/` y falla con una ruta rara del tipo `C:/Program Files/Git/...`, ejecuta antes `export MSYS_NO_PATHCONV=1`.

### MLflow en local

MLflow no está en Docker: se instala con Python en `.venv-mlflow/` (lo hace `instalar.sh`, o `bash servidor_mlflow.sh instalar`) y guarda todo en `mlruns/`. Los notebooks y la API usan `http://localhost:5000` si el servidor está en marcha:

```bash
export MLFLOW_TRACKING_URI=http://localhost:5000
```

Si ya tenías el MLflow antiguo de Docker con experimentos, cópialos antes de actualizar: `docker cp mlflow:/mlflow/db/mlflow.db mlruns/mlflow.db` (los artefactos ya estaban en `mlruns/`). Después, `cd docker && docker compose up -d --remove-orphans` retira el contenedor viejo.

## 8. Trabajar juntos con Git

Para **subir** cambios necesitas que el dueño del repositorio te invite como colaborador (GitHub > *Settings* > *Collaborators*). Acepta la invitación que te llegará por correo.

Antes de empezar a trabajar, trae lo último:

```bash
git pull
```

Trabaja en una rama propia para no pisaros:

```bash
git switch -c mi-tarea
```

Cuando termines, guarda y sube tu rama:

```bash
git add . && git commit -m "Describe lo que has hecho"
```

```bash
git push -u origin mi-tarea
```

Después abre un *Pull Request* en GitHub para unirlo a `main`.

Lo que **no** se sube (ya lo filtra el `.gitignore`): los datos de `data/entrada/`, `data/raw/`, los datos de MLflow (`mlruns/`) y su entorno virtual (`.venv-mlflow/`).

## 9. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `open //./pipe/dockerDesktopLinuxEngine` o `Cannot connect to the Docker daemon` | Docker no está arrancado | Abre Docker Desktop y espera a *Engine running* |
| `port is already allocated` | Otro programa usa ese puerto | Ciérralo o cambia el número de la izquierda en `ports:` de `docker/docker-compose.yml` |
| El puerto 5000 está ocupado en Mac | Receptor AirPlay | Desactívalo (ver apartado 3) |
| `$'\r': command not found` | El script tiene saltos de línea de Windows | `sed -i 's/\r$//' instalar.sh bigdata/validar_entorno.sh` |
| Un servicio se queda en `starting` o `unhealthy` | Poca memoria o arranque lento | Sube la RAM de Docker y espera; mira `docker compose logs <servicio>` |
| Muy lento en Mac con chip M | Emulación amd64 | Normal. Activa Rosetta (apartado 3) para mejorar |
| `SELECT COUNT(*)` devuelve 0 | El fichero empieza por `_` o `.` | Renómbralo |
| `El puerto 5000 está ocupado` al arrancar MLflow | Sigue el contenedor `mlflow` antiguo, u otro programa | `cd docker && docker compose up -d --remove-orphans`; en Mac, desactiva el receptor AirPlay |
| `Falta Python 3.9 o superior` | No hay Python en el PATH | Instala Python (python.org, marcando *Add to PATH*) o Anaconda |
| Quiero empezar de cero | — | `cd docker && docker compose down -v`, borra `mlruns/` y `.venv-mlflow/`, y luego `bash instalar.sh` |
