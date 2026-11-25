# Evidencia de uso de IA · Sección Docker del informe (Entrega 1)

| Campo | Valor |
| --- | --- |
| Fechas | 18 al 23 de noviembre de 2026 |
| Herramienta | Claude Code (aplicación de escritorio, modelo Claude Opus 5.5) |
| Quién | Daniel |
| Tareas del plan | B1 (entorno Docker) e informe v1 |
| Revisión humana | Daniel revisa la sección, las capturas y el PDF final antes de entregarlo |
| Resultado entregado | `Entrega_1.pdf` (informe v1.4 con la sección 12 de Docker, 24 páginas) |

## 1. Qué se pidió

Peticiones de Daniel, en orden y con sus palabras:

1. «Rellena el informe con lo hecho en Docker y usa la skill», adjuntando el informe v1 en PDF y la skill `estilo-npd-cebanc`.
2. «Pon capturas en el informe sobre Docker».
3. «Ajusta la memoria: un objetivo va a ser que al meter una nueva canción [prediga] si le va a gustar al usuario o no». La IA preguntó si sustituía a C1, a K1 o era un tercer objetivo, y Daniel lo dejó en espera.
4. «Vuelve a añadirlo aquí», adjuntando `Informe_v1_4.docx` (la versión 1.4 de Ander).
5. «Asegúrate de que esté hecho el cambio de objetivos».
6. «Descárgame el PDF en Descargas con nombre Entrega_1».
7. Consulta sobre qué skill sirve para páginas web.
8. «Saca un .md de esta conversación para el informe» (este documento).

## 2. Qué hizo la IA

### 2.1 Revisar lo hecho en Docker

- Leyó el repositorio `proyecto-Ebaluacion1`: `docker-compose.yml`, `hadoop.env`, `instalar.sh`, `bigdata/validar_entorno.sh`, `README.md` e `INSTALACION.md`, y el commit del 17 de noviembre.
- Arrancó Docker Desktop, levantó el entorno con `docker compose up -d` y ejecutó `bash bigdata/validar_entorno.sh` el 18 de noviembre. Resultado real:

| # | Comprobación | Resultado |
| --- | --- | --- |
| 1 | 8 contenedores en estado `healthy` | OK: 8 de 8 |
| 2 | `/bronze`, `/silver` y `/gold` en HDFS | OK |
| 3 | Subida de un CSV de prueba a `/bronze/test/` | OK: 20 bytes |
| 4 | Tabla externa en Hive, `COUNT(*)` y borrado | OK: 3 filas |
| 5 | MLflow en `http://localhost:5000` | OK: HTTP 200 |

### 2.2 Redactar la sección del informe

Escribió la sección «Entorno Big Data en Docker (tarea B1)» a partir del código del repositorio, sin inventar datos:

- Qué se ha hecho (compose, configuración, scripts, documentación y capas del lago de datos).
- Tabla de los 8 servicios: contenedor, imagen, puerto y función en el proyecto.
- Decisiones de configuración y su motivo (replicación 1, metastore en PostgreSQL, *healthchecks*, volúmenes con nombre, carpeta `/entrada` montada, `platform: linux/amd64`, etc.).
- Validación del entorno con los resultados de la tabla anterior.
- Problemas encontrados y cómo se resolvieron (rutas de Git Bash, saltos de línea CRLF, ficheros ignorados por Hive, reintentos de HiveServer2, Docker Desktop parado).
- Cómo usa el entorno el resto del proyecto (ingesta, silver y gold, MLflow, trabajo en equipo).

### 2.3 Capturas

Todas se tomaron sobre el entorno real en marcha el 18 de noviembre:

| Captura | Cómo se obtuvo |
| --- | --- |
| `docker compose ps` con los 8 contenedores `healthy` | Salida real del terminal convertida a imagen |
| Salida de `validar_entorno.sh` | Salida real del terminal (sin los avisos de SLF4J de Hive) convertida a imagen |
| HDFS, resumen (puerto 9870) | Captura del navegador (Edge sin interfaz) |
| Explorador de HDFS con `/bronze`, `/silver` y `/gold` | Captura del navegador |
| YARN, nodos del clúster (puerto 8088) | Captura del navegador |
| MLflow (puerto 5000) | Captura del navegador; todavía sin experimentos |

### 2.4 Maquetación con la skill `estilo-npd-cebanc`

- Primera versión: el informe v1 completo rehecho como documento de Claude Docs, exportado a Word y maquetado con el script `aplicar_marca.py` de la skill (logos en el encabezado, paleta NPD, portada y pie con «Página X de Y»). Se añadió un índice con páginas.
- Los logos y el diagrama del ciclo de vida se extrajeron del PDF original, porque el Kit de marca no era accesible desde la cuenta de Daniel. No se redibujó ningún logo.

### 2.5 Paso a la versión 1.4 de Ander

- La sección se insertó en `Informe_v1_4.docx` como **sección 12**, con el formato del documento de Ander, mediante el script `Informe_v1/scripts/anadir_docker_v14.py`.
- Planificación pasa a ser la sección 13 y Decisiones abiertas la 14. Se actualizaron las referencias cruzadas, la fase 3 del CRISP-DM, el Gantt (Docker marcado como hecho), la tabla de evidencias de IA y las referencias.
- El PDF final pasó de 19 a 24 páginas y se guardó como `Downloads/Entrega_1.pdf`.

### 2.6 Comprobación del cambio de objetivos

La IA revisó todas las secciones de la versión 1.4 y confirmó que el cambio ya estaba hecho y era coherente:

- **Objetivo 1 (R5, regresión):** tasa de no salto por persona, canción y contexto, leída como la probabilidad de que a la persona le guste la canción. Funciona con canciones que la persona no ha escuchado (usa el audio de la canción y el gusto por artista y género), y con un umbral de 0,6 da el sí o no de «¿le va a gustar?».
- **Objetivo 2 (S1):** sistema recomendador de playlist conjunta, que combina las predicciones del objetivo 1 con el mínimo del grupo.
- C1 (clasificación en cinco clases) y K1 (clustering por momento del día) solo aparecen ya como descartes justificados.

## 3. Control humano y límites

- La IA no decidió el contenido técnico: describió lo que ya estaba en el repositorio y los resultados de ejecutarlo.
- Las cifras y los objetivos de la versión 1.4 son de Ander; la IA no los cambió, solo comprobó su coherencia.
- La pregunta sobre dónde encajaba el nuevo objetivo la dejó Daniel en espera; la IA no tomó esa decisión por su cuenta.
- Daniel revisa el PDF final antes de entregarlo.
- Esta conversación no se ha subido a GitHub; queda guardada en `docs/evidencias-ia/`.
