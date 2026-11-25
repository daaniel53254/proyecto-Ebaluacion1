# Apartado 13.2 del informe final: Kaggle y metadatos del Parquet

Decisión de Daniel del 25/11/2026: no se cargan los CSV de Kaggle en HDFS y no se añade la salida de los comandos de metadatos del Parquet. Este texto sustituye al «[PENDIENTE]» del 13.2 (página 29) y a la frase sobre Kaggle del párrafo «Formato».

---

## Texto para el 13.2

**Sustituir la última frase del párrafo «Formato»** («En la ejecución del 20 de noviembre los CSV de Kaggle no estaban en el equipo de Daniel…») por:

> Los CSV de Kaggle no se cargan en HDFS. Tras medir la cobertura (sección 8.2), solo el 8,39 % de las canciones del historial aparece en Kaggle, y las características de audio salieron de los objetivos el 19 de noviembre. Cargarlos solo como copia en bronze habría añadido unos 187 MB que ningún paso posterior usa. La ingesta sigue preparada en el pipeline (paso 4 y `bigdata/kaggle_ddl.py`): si se copian los CSV a `data/entrada/kaggle/`, `pipeline.sh` crea `/bronze/kaggle/` y las tablas `bronze.kaggle_*` sin cambiar nada más.

**Sustituir el párrafo «Comprobación de la transformación con metadatos» y el «[PENDIENTE]»** por:

> **Comprobación del formato.** Que silver y gold están en Parquet se comprueba en la ejecución del 20 de noviembre con el tamaño de cada capa: las 330.166 filas de silver ocupan 12,5 MB, frente a los 219 MB de los JSON de bronze, y gold.objetivo1 y gold.candidatas ocupan 1,9 MB y 1,7 MB (tabla anterior, pasos 6 y 7). Las tablas se crean con `STORED AS PARQUET` en `bigdata/sql/silver.sql` y `bigdata/sql/gold.sql`. Si hace falta verlo en los metadatos, basta con `DESCRIBE FORMATTED silver.reproducciones;` en Hive (debe mostrar ParquetHiveSerDe y MapredParquetInputFormat) o con leer el pie de un fichero de `/silver/reproducciones` con `pyarrow.parquet.ParquetFile(...).metadata`.

**Datos que conviene comprobar antes de pegarlo:**

- La cobertura del 8,39 % sale del Anexo B (página 64); en el 8.2 aparece como «8 %».
- Los 187 MB son la suma de los dos CSV de la tabla del 8.2: 19,2 MB + 167,7 MB.

---

## Otras partes del informe que dicen que Kaggle va a HDFS

Para que el informe no se contradiga, hay que retocar estas frases. Las páginas son las del `Informe_final.pdf` del 25/11.

| Página | Qué dice ahora | Cambio propuesto |
|---|---|---|
| 4 (1. Elección del sector) | «vienen de más de una fuente (historiales + Kaggle), lo que pide la rúbrica» | «vienen de más de una fuente: el historial de cada persona es una exportación distinta (Daniel, Ander y, en la prueba, Aitor), y los datasets de Kaggle se revisaron como fuente externa (sección 8.2)» |
| 13 (fuentes de datos) | «Kaggle queda como fuente documentada en la capa bronze y para el análisis descriptivo» | «Kaggle queda como fuente revisada (notebook 01) y para el análisis descriptivo, fuera del pipeline» |
| 17 (8.2, «Qué se hace con Kaggle») | «Los dos CSV se cargan en /bronze/kaggle (tablas bronze.kaggle_…) como fuente documentada» | «Los dos CSV no se cargan en HDFS (apartado 13.2); la ingesta queda preparada en el pipeline» |
| 20 (plan de ensuciado) | «Kaggle queda solo en bronze como fuente documentada» | «Kaggle no entra en el pipeline» |
| 27-28 (13.1 y paso 4 del pipeline) | «/bronze/kaggle», «bronze.kaggle_*» | Indicar que es opcional y que en la entrega no se cargó |
| 64 (Anexo B) | «☐ Ingerir los CSV de Kaggle en HDFS y comprobar el Parquet con metadatos (apartado 13.2)» | Quitar la línea o marcarla como descartada |
| 70 (pendientes de Daniel) | «☐ Kaggle en HDFS: copiar los dos CSV…» | Quitar la línea |

**Aviso para Ander:** su nota decía que sin Kaggle en HDFS no se cumple «más de una fuente» en *Cantidad de datos* (nivel 3). El cambio de la página 4 defiende las varias fuentes con los historiales de personas distintas y la revisión de Kaggle, pero es él quien conoce mejor esa parte de la rúbrica.
