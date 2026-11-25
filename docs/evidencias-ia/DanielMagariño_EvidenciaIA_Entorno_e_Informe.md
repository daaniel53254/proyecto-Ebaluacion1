# Evidencia de uso de IA · Entorno Big Data e informe de la Entrega 1

| | |
|---|---|
| **Proyecto** | Playlist perfecta para viajes en grupo (proyecto 1er trimestre Big Data + IA, CEBANC) |
| **Equipo** | Daniel Magariño y Ander Ameztoy |
| **Herramienta** | Claude Code (aplicación de escritorio, Windows 11) |
| **Quién la usó** | Daniel |
| **Fechas** | 16 a 24 de noviembre de 2026 |
| **Nivel de uso de IA** | Generación de código, ejecución de comandos y redacción de apartados del informe, siempre con revisión de Daniel |

## Índice

1. [Resumen](#1-resumen)
2. [Cronología de la conversación](#2-cronología-de-la-conversación)
3. [Problemas encontrados y cómo se resolvieron](#3-problemas-encontrados-y-cómo-se-resolvieron)
4. [Decisiones que tomó Daniel](#4-decisiones-que-tomó-daniel)
5. [Ficheros generados o modificados](#5-ficheros-generados-o-modificados)
6. [Qué no hizo la IA](#6-qué-no-hizo-la-ia)
7. [Revisión humana](#7-revisión-humana)
8. [Filas para la tabla «Evidencias del uso de IA» del informe](#8-filas-para-la-tabla-evidencias-del-uso-de-ia-del-informe)

---

## 1. Resumen

En una sola conversación con Claude Code se montó y validó el entorno Big Data en Docker (tarea B1). El entorno tiene HDFS, YARN, Hive y MLflow, sin PySpark, como pide el enunciado.

En la misma conversación se hicieron además estas tareas:
- Se publicó el repositorio en GitHub.
- Se escribieron una guía y un script de instalación para que Ander tuviera el mismo entorno.
- Se comparó el informe con el enunciado de la Entrega 1.
- Se llevaron al informe la sección del entorno, el estado de la entrega y el índice.

Todo lo que se cuenta aquí se ejecutó y comprobó en el portátil de Daniel. Las cifras salen de la salida real de los comandos y del log del pipeline.

## 2. Cronología de la conversación

### 16 nov · Entorno Docker (tarea B1)

**Prompt de Daniel (resumido).** Crear el repositorio con este contenido:
- `docker-compose.yml` con namenode, datanode, resourcemanager, nodemanager, metastore de Hive con PostgreSQL, HiveServer2 y MLflow, usando imágenes de Big Data Europe (bde2020).
- Volúmenes con nombre para que los datos persistan.
- La carpeta `data/entrada` montada en el namenode.
- Healthchecks y `depends_on` para que Hive no arranque antes que HDFS.
- Un script `validar_entorno.sh` que la IA debía **ejecutar**, no solo escribir.

Condiciones:
- Comprobar con `docker pull` que cada imagen existe, sin inventar versiones.
- No hacer commit.

Nombre del repositorio: `proyecto-Ebaluacion1`.

**Qué hizo la IA:**
1. Detectó que Docker Desktop estaba parado y lo arrancó.
2. Descargó las 7 imágenes antes de escribir el compose y comprobó que existían:
   - las cuatro de Hadoop, `bde2020/hadoop-*:2.0.0-hadoop3.2.1-java8`;
   - `bde2020/hive:2.3.2-postgresql-metastore`;
   - `bde2020/hive-metastore-postgresql:2.3.0`;
   - `ghcr.io/mlflow/mlflow:v2.19.0`.
3. Escribió los ficheros del repositorio: `docker-compose.yml`, `hadoop.env`, `validar_entorno.sh`, `README.md`, `.gitignore` y `.gitattributes`.
4. Arrancó los 8 contenedores y ejecutó la validación. El primer intento falló en el paso de Hive (ver apartado 3). Corrigió el error y la validación pasó las 5 comprobaciones.
5. Comprobó además dos cosas:
   - Que Hive lanza la consulta como trabajo de YARN: la aplicación MapReduce terminó con estado `SUCCEEDED`.
   - Que los datos sobreviven a un `docker compose down` seguido de `up`.

**Pregunta de Daniel durante el trabajo:** «¿Por qué tengo 4 hadoops? Hazme limpieza».
- La IA explicó que eran los cuatro servicios pedidos y que comparten capas de imagen.
- Le propuso opciones de limpieza.
- Daniel eligió borrar solo un contenedor y una imagen antiguos de otro proyecto (`suhothayan/hadoop-spark-pig-hive`, 4,16 GB). No se tocó nada más.

### 17 nov · Repositorio y documentación para el equipo

**«No encuentro el repo».** El repositorio estaba en una carpeta temporal de la sesión.
- Se movió a `Escritorio\IA\proyecto-Ebaluacion1`.
- Se volvió a arrancar el entorno desde la nueva ruta y se validó otra vez: 5 de 5 comprobaciones.

**«No me sale el repo en GitHub para compartir al compañero».**
- La IA preguntó por la visibilidad del repositorio. Daniel eligió **público**.
- La IA hizo el primer commit (`72c84ca`), creó el repositorio con `gh` y lo subió.
- Avisó de que `hadoop.env` lleva la contraseña por defecto del PostgreSQL local del metastore.

**«¿Ahora qué tendría que hacer?»** La IA propuso el orden de trabajo:
1. preparar los JSON;
2. capa bronze;
3. capa silver;
4. capa gold;
5. modelo con MLflow;
6. reparto de tareas con Git.

**«Prepárame un documento para que mi compañero tenga lo mismo».**
- La IA escribió `INSTALACION.md` (guía para Windows, macOS y Linux) e `instalar.sh`. El script hace esto:
  - detecta el sistema;
  - comprueba Git, Docker y Compose;
  - arranca Docker si está parado;
  - revisa la memoria y los puertos;
  - levanta los servicios y lanza la validación.
- Al comprobar las imágenes vio que las de bde2020 solo existen para amd64. Por eso fijó `platform: linux/amd64` en el compose, para que también funcionen en un Mac con chip M.
- Probó el script completo en el portátil de Daniel.
- Ofreció subirlo a GitHub y Daniel respondió «todavía no».

### 18 nov · Revisión de Ander y estado de la Entrega 1

**Daniel pegó la revisión de Ander:** el nivel 3 pide automatizar el flujo, y el hito pide más de 2 MB ingeridos en bruto en HDFS, pero solo había 20 bytes de prueba.

Antes de responder, la IA revisó el disco y HDFS:
- `pipeline.sh` y `preparar.py` existían. Se habían hecho en **otra sesión**, no en esta conversación.
- El pipeline se había ejecutado a las 09:18, después de la revisión de Ander de las 9:13.
- Resultados:
  - 20 ficheros, 167.734.985 bytes en `/bronze/spotify/historial`;
  - 263.001 filas en `bronze.historial`, que coinciden con el manifiesto;
  - 255.774 filas en `silver.reproducciones`, en Parquet.

La IA concluyó que la crítica de Ander era correcta para lo que él podía ver: el informe oficial seguía diciendo «siguiente paso» y GitHub solo tenía el primer commit.

**«Dime qué falta de lo que hay que entregar hoy y ponlo en el informe».**
1. La IA leyó el enunciado y la rúbrica (`Proyecto_1er_Trimestre.pdf`) y comparó cada requisito de la Entrega 1 con el informe y el repositorio.
2. Comprobó que las cifras del borrador cuadraban con el manifiesto y que el dataset de Kaggle no estaba descargado.
3. Añadió al informe v1 el apartado **«Estado de la Entrega 1»**:
   - una tabla de Hecho / Parcial con la evidencia de cada punto;
   - la lista de pendientes para ese día: subir el código, descargar Kaggle, confirmar la idea 14 y los consentimientos;
   - lo que no bloqueaba la entrega;
   - lo adelantado respecto al enunciado.
4. Sustituyó el informe v1 por la versión con la ingesta real y guardó una copia del anterior.
5. Revisó en imagen el índice y las páginas cambiadas.

**Preguntas de concepto:**
- «¿Con qué salida entrena el modelo?» La IA explicó la columna `clase` de silver y su reparto. Avisó de que `reason_end`, `ms_played` y `skipped` no pueden ser variables de entrada, porque definen la etiqueta (fuga de datos). También recomendó dividir los datos por fecha.
- «Entonces no es modelo supervisado». La IA aclaró que el objetivo de clasificación sí es supervisado, aunque la etiqueta salga sola del historial, y que el de clustering no lo es.

### 18 a 20 nov · Informe v1.4

**«Mete aquí lo mismo que en el anterior»** (`Informe_v1_4.docx`, exportado de Google Docs).

La IA detectó dos problemas en la v1.4:
- Había cambiado los objetivos a R5 (regresión) y S1 (recomendador).
- Había perdido la sección del entorno Docker y de la ingesta, que es la evidencia de Big Data de la Entrega 1. Además no tenía índice.

Para resolverlo:
- Añadió el índice tras la portada, con los números de página medidos en el PDF.
- Recuperó la sección como **12. Entorno Big Data en Docker**, adaptada al formato de la v1.4, con sus 6 capturas.
- Reescribió la única frase que dependía del objetivo antiguo, la del F1 macro y las cinco clases. Ahora dice que el 50,2 % de las reproducciones no acaba en salto rápido, como primera referencia para R5.
- Renumeró las secciones 12 y 13 a 13 y 14, y corrigió la referencia de la portada.
- Añadió el apartado «Estado de la Entrega 1» con la numeración y los objetivos nuevos.
- Añadió dos referencias: imágenes de Big Data Europe y el repositorio.
- Añadió una fila en la tabla de evidencias de IA.
- Generó el PDF y revisó en imagen las páginas cambiadas. Hubo una interrupción de Daniel a mitad del proceso; al reanudar se regeneró el documento y se comprobó que el índice coincidía con el PDF.

El original de Descargas no se modificó.

## 3. Problemas encontrados y cómo se resolvieron

| Problema | Causa | Solución |
|---|---|---|
| `docker` no respondía | Docker Desktop estaba parado | La IA lo arrancó; `instalar.sh` ya lo hace solo |
| `SELECT COUNT(*)` devolvía 0 en Hive | El fichero de prueba empezaba por `_`, y Hive ignora esos ficheros | Se renombró a `prueba_validacion.csv`; la regla quedó en el README y en el informe |
| Rutas como `/bronze` convertidas en `C:/Program Files/Git/bronze` | Git Bash traduce las rutas que empiezan por `/` | `export MSYS_NO_PATHCONV=1` en los scripts |
| Consultas de Hive sin configuración de MapReduce sobre YARN | La configuración solo estaba en los servicios de Hadoop | Se movió a `hadoop.env`; la consulta de prueba terminó en YARN con `SUCCEEDED` |
| Imágenes bde2020 solo para amd64 | No hay versión ARM | `platform: linux/amd64` en el compose y un aviso para Mac con chip M |
| El informe oficial decía «siguiente paso» aunque la ingesta ya estaba hecha | La versión con la ingesta estaba en un borrador | Se sustituyó el informe v1 y se guardó copia del anterior |
| La v1.4 no tenía la sección del entorno ni índice | Se rehízo a partir de una versión anterior | Se recuperó la sección y se añadió el índice |

## 4. Decisiones que tomó Daniel

- El nombre del repositorio: `proyecto-Ebaluacion1`.
- Qué limpiar en Docker: solo la imagen antigua de otro proyecto.
- La carpeta definitiva del repositorio: `Escritorio\IA`.
- La visibilidad del repositorio en GitHub: público.
- No subir todavía la guía de instalación cuando se le propuso.
- Qué versión del informe usar como base en cada momento: v1 y luego v1.4.

## 5. Ficheros generados o modificados

**Repositorio:**
- `docker/docker-compose.yml`
- `docker/hadoop.env`
- `bigdata/validar_entorno.sh`
- `instalar.sh`
- `INSTALACION.md`
- `README.md`
- `.gitignore`
- `.gitattributes`
- `data/entrada/.gitkeep`

**Informe:**
- `Informe_v1/DanielMagariño_Informe_v1_Playlist_perfecta.docx` y `.pdf`
- `Informe_v1/DanielMagariño_Informe_v1_4_Playlist_perfecta.docx` y `.pdf`
- Copia del v1 anterior: `borrador_lunes/..._antes_ingesta`

**Scripts de edición del informe**, guardados en `Informe_v1/borrador_lunes/` para que el proceso se pueda repetir:
- `estado_entrega1.py`
- `fusionar_v14.py`
- `medir.py`

## 6. Qué no hizo la IA

- No escribió `pipeline.sh` ni `preparar.py`, ni ejecutó la ingesta del historial. Eso se hizo en otra sesión.
- No inventó cifras: todas salen de la salida de comandos, del manifiesto o del log del pipeline.
- No hizo commit ni subida sin que Daniel lo pidiera. En esta conversación solo hubo un commit, el primero, que Daniel pidió para compartir el repositorio.
- No borró nada sin preguntar: la limpieza de Docker la eligió Daniel.
- No modificó el informe original que Ander dejó en Descargas.

## 7. Revisión humana

- Daniel probó el entorno en su portátil y vio la salida de cada validación.
- Daniel contrastó el apartado «Estado de la Entrega 1» con el enunciado y con el log del pipeline.
- Daniel y Ander revisan el PDF maquetado antes de entregarlo.
- La IA comprobó cada PDF generado renderizando las páginas cambiadas, pero esa comprobación no sustituye la revisión del equipo.

## 8. Filas para la tabla «Evidencias del uso de IA» del informe

| Fecha | Herramienta | Para qué | Quién | Revisión humana |
|---|---|---|---|---|
| 16 nov | Claude Code | Montar y validar el entorno Docker (HDFS, YARN, Hive y MLflow), con imágenes comprobadas con `docker pull` y la validación ejecutada | Daniel | Daniel prueba el entorno y revisa la salida de cada comprobación |
| 17 nov | Claude Code | Publicar el repositorio en GitHub y escribir `INSTALACION.md` e `instalar.sh` para el equipo | Daniel | Daniel decide la visibilidad y cuándo se sube cada cambio |
| 18 nov | Claude Code | Comparar el informe con el enunciado de la Entrega 1 y redactar el apartado «Estado de la Entrega 1» | Daniel | Daniel contrasta cada punto con el enunciado y con el log del pipeline |
| 20 nov | Claude Code | Pasar a la versión 1.4 la sección del entorno y la ingesta, el estado de la entrega y el índice | Daniel | Daniel y Ander revisan el PDF antes de entregarlo |
