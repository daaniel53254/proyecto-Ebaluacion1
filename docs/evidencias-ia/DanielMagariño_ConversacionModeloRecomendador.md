# Playlist perfecta para viajes en grupo

## Registro de trabajo con IA: panel, modelo y recomendador

**Proyecto:** Playlist perfecta para viajes en grupo
**Curso:** Big Data e Inteligencia Artificial · CEBANC · 1.ª evaluación
**Autores:** Daniel Magariño y Ander
**Herramienta de IA:** Claude Code (Claude Opus 5.5)
**Fecha:** 24/11/2026

---

## Índice

1. [Objetivo del documento](#1-objetivo-del-documento)
2. [Integración de ramas y revisión de commits](#2-integración-de-ramas-y-revisión-de-commits)
3. [Panel de Streamlit con el modelo de la API](#3-panel-de-streamlit-con-el-modelo-de-la-api)
4. [El modelo: algoritmo y variables](#4-el-modelo-algoritmo-y-variables)
5. [Problema detectado: el GB con error absoluto](#5-problema-detectado-el-gb-con-error-absoluto)
6. [Prueba 1: opción A (error cuadrático)](#6-prueba-1-opción-a-error-cuadrático)
7. [Prueba 2: filtro de canciones escuchadas por todos](#7-prueba-2-filtro-de-canciones-escuchadas-por-todos)
8. [Prueba 3: historial completo con más peso a lo reciente](#8-prueba-3-historial-completo-con-más-peso-a-lo-reciente)
9. [Lote 1, lote 2 y el historial completo](#9-lote-1-lote-2-y-el-historial-completo)
10. [Hallazgo clave: la evaluación del recomendador es inestable](#10-hallazgo-clave-la-evaluación-del-recomendador-es-inestable)
11. [Conclusiones y tareas pendientes](#11-conclusiones-y-tareas-pendientes)

---

## 1. Objetivo del documento

Este documento resume una sesión de trabajo con un asistente de IA (Claude Code) durante la preparación de la entrega final (24-26/11/2026). Sirve como evidencia del uso de IA en el proyecto y recoge las decisiones técnicas, las pruebas realizadas y sus resultados.

Criterios que se siguieron durante toda la sesión:

- Ningún dato personal (historiales de Spotify, CSV derivados ni modelos entrenados con ellos) se sube a Git.
- Las personas aparecen con seudónimo (`persona_358ed916`, `persona_744b89e7`), generado con `seudonimo()` de `bigdata/preparar.py`.
- La carpeta `api/` y el notebook 05 son responsabilidad de Ander. Las pruebas de este documento se hicieron con scripts aparte, sin modificarlos.
- Antes de cada commit, push o merge, la IA pidió confirmación.

## 2. Integración de ramas y revisión de commits

- Se revisaron los commits nuevos de Ander, en Kaggle y en GitHub.
- Se unieron a `main` las ramas `ander/kaggle-revision` y `ander/mlflow-local`.
- Con esto, MLflow pasa de Docker a un servidor local (`servidor_mlflow.sh` / `servidor_mlflow.bat`, entorno `.venv-mlflow`).
- **Notebook 04 (deriva):**
  - Ander salta cada vez más canciones con el tiempo.
  - Daniel tuvo un episodio de cambio de hábitos en agosto-septiembre de 2026.
  - Usar una ventana de 18 meses baja el MAE de 2026 de 0,225 a 0,207.
  - Regla de seguimiento: reentrenar si la calibración se sale de ±0,05 dos meses seguidos.
- **Notebook 05:**
  - Pasa a producción el GB con error absoluto y ventana de 18 meses.
  - En el lote 2 su MAE es 0,190, frente a 0,207 de Ridge y 0,184 de usar la mediana de cada persona.
  - Se registra en MLflow como `playlist_tasa_no_salto@produccion`.

## 3. Panel de Streamlit con el modelo de la API

Se actualizó el panel (`panel/app.py`, `panel/datos.py`) para usar el modelo de la API. El trabajo se subió en la PR 3 (`daniel/panel-modelo-api`), Ander la revisó y se unió a `main`.

- **Nueva pestaña «Playlist del grupo»:**
  - Filtros:
    - franja horaria;
    - tipo de día;
    - duración de la playlist, por número de canciones o por minutos;
    - artistas que se quieren quitar.
  - Métricas:
    - número de canciones;
    - duración;
    - artistas distintos;
    - canciones con gusto real de todos.
  - Tabla con una barra de gusto por persona y para el grupo, y enlace directo a Spotify.
  - Gráficos:
    - cuánto le gusta la playlist a cada persona;
    - artistas que más se repiten.
- **Selector de modelo en el recomendador:** Ridge del notebook 03 o GB de la API.
- **Arranque sin datos:** si no está el dataset pero sí el modelo de la API, el panel muestra solo la pestaña de la playlist.
- **Animación de carga musical:** un ecualizador sustituye al icono por defecto de Streamlit.
- **Modelos generados para el panel (fuera de Git):**
  - `api/datos/` (producción): de 2025-05-18 a 2026-11-17, 9.777 filas, MAE de validación cruzada 0,159.
  - `data/dataset/modelo_api_lote1/`: entrenado solo hasta el 30/06/2025, para poder evaluarlo en el lote 2.

## 4. El modelo: algoritmo y variables

### 4.1 Algoritmo

`HistGradientBoostingRegressor` de scikit-learn. Construye árboles de decisión pequeños uno tras otro, y cada árbol corrige los errores de los anteriores. Predice la **tasa de no salto** de una canción para una persona en un contexto (franja de 4 horas × laborable o fin de semana).

| Hiperparámetro | Valor | Significado |
|---|---|---|
| `loss` | `absolute_error` | Aprende la mediana |
| `max_iter` | 150 | Número de árboles |
| `learning_rate` | 0,05 | Corrección pequeña en cada árbol |
| `max_leaf_nodes` | 7 | Árboles pequeños, para no memorizar |
| `min_samples_leaf` | 80 | Mínimo de filas por hoja |
| `l2_regularization` | 1,0 | Freno contra el sobreajuste |

Se entrena con las filas que tienen al menos 5 escuchas (`MIN_ESCUCHAS = 5`).

### 4.2 Variables (19, en `api/caracteristicas.py`)

| Grupo | Variables | Qué miden |
|---|---|---|
| Persona | `per_tasa`, `per_pct_shuffle`, `ctx_tasa` | Tasa general de no salto, uso del modo aleatorio y tasa en ese contexto |
| Artista | `art_tasa`, `art_n`, `art_conocido` | Cómo trata la persona a ese artista, sin contar la canción |
| Álbum | `alb_tasa`, `alb_n`, `alb_conocido` | Lo mismo para el álbum |
| Grupo | `grp_tasa`, `grp_n`, `grp_conocido` | Cómo la tratan los demás miembros |
| Contexto | `fin_semana`, `franja_0` … `franja_5` | Momento de la escucha |

Detalles importantes:

- **El modelo no ve la tasa propia de la canción**, porque es justo lo que predice. Por eso puede puntuar canciones que una persona nunca ha escuchado.
- Las tasas de artista y álbum se **suavizan** hacia la tasa general de la persona: `(no_saltos + 5·tasa_general) / (escuchas + 5)`.
- Las variables se calculan **fuera del pliegue** (`GroupKFold` por canción), para que la respuesta no se cuele en las variables durante el entrenamiento.

### 4.3 Regla del recomendador

1. El gusto de cada persona por una canción es su tasa real si tiene al menos 5 escuchas en ese contexto. Si no, se usa la predicción del modelo.
2. El gusto se pasa a percentil dentro de cada persona.
3. La nota del grupo es el **mínimo** de los percentiles, para no dejar a nadie descontento. Los empates se deshacen con la media.
4. La lista de referencia son las canciones más escuchadas por el grupo.

## 5. Problema detectado: el GB con error absoluto

Con `absolute_error` el modelo aprende la mediana. Como el 89,5 % de las filas de Daniel valen 1 (casi no salta canciones), el modelo le predice 1 a cerca del 95 % de sus canciones.

Consecuencia: las canciones de Daniel empatan (34 percentiles distintos, frente a 1.245 de Ander), así que en la práctica **la playlist la decide el gusto de Ander**. Ander lo confirmó en su revisión de la PR 3 y propuso dos salidas:

- **Opción A:** usar error cuadrático.
- **Opción B:** usar un modelo distinto para el objetivo 2.

## 6. Prueba 1: opción A (error cuadrático)

Se reentrenó el mismo GB con `loss="squared_error"` (script aparte, sin tocar `api/`).

- Percentiles distintos de Daniel: de 846 a 5.168.
- Predicciones iguales a 1: del 81,9 % al 0 %.
- MAE de validación: de 0,159 a 0,165 (ligeramente peor).

Tasa de salto de la playlist en el lote 2 (menos es mejor):

| Lista | N = 20 | N = 50 | N = 100 |
|---|---|---|---|
| GB absoluto (actual) | 33,1 % | 33,4 % | 33,7 % |
| GB cuadrático (opción A) | 31,3 % | 32,9 % | 32,1 % |
| Ridge (notebook 03) | 34,0 % | 33,3 % | 31,6 % |
| Más escuchadas (referencia) | 31,9 % | 29,7 % | 30,2 % |

La opción A arregla los empates, pero ninguna lista del modelo gana con claridad a «más escuchadas».

## 7. Prueba 2: filtro de canciones escuchadas por todos

**Idea de Daniel:** antes de ordenar, quedarse con las canciones que todos los miembros han escuchado al menos *k* veces. *k* es un hiperparámetro: si no llegan suficientes canciones, se baja a 4, 3… Después se ordena como siempre. Objetivo: asegurar que la canción gusta a la mayoría.

- Se probaron dos variantes: contar las escuchas en el mismo contexto o en cualquier contexto.
- Canciones en común con 5 o más escuchas de todos (lote 1): 23 por contexto de media (mínimo 0, máximo 91), 406 en total.
- Mejor resultado: 27,7 % de salto con N = 20 (Ridge, filtro por contexto, k = 1). Con N = 50 y N = 100 el filtro empeoró.

**Limitación:** la evaluación solo cuenta canciones que se vuelven a escuchar 5 o más veces en el lote 2. Esto favorece a algunas listas frente a otras, así que la comparación no es justa (ver apartado 10).

## 8. Prueba 3: historial completo con más peso a lo reciente

Se probó a usar todo el historial, dando a cada escucha un peso `0,5^(antigüedad en meses / vida media)`, en lugar de la ventana de 18 meses.

**Validación** (entrenando hasta el 31/12/2024 y probando con enero-junio de 2025, MAE con error absoluto):

| Política | MAE |
|---|---|
| Ventana de 18 meses | 0,205 |
| Vida media de 12 meses | 0,196 |
| Vida media de 36 meses | 0,188 |
| Todo, sin peso | 0,182 |

**Prueba final en el lote 2:**

| Política | MAE | Spearman |
|---|---|---|
| Ventana de 18 meses | 0,190 | 0,204 |
| Vida media de 36 meses | 0,195 | 0,142 |
| Todo, sin peso | 0,199 | 0,146 |

En validación gana usar más historial, pero en el lote 2 gana la ventana de 18 meses. **No hay una mejora clara.** Esto encaja con la deriva del notebook 04: los hábitos cambian, y lo antiguo puede confundir al modelo.

## 9. Lote 1, lote 2 y el historial completo

- **Lote 1:** escuchas hasta el 30/06/2025. Se usa para entrenar.
- **Lote 2:** escuchas desde el 01/07/2025. Se usa para probar, como si fuera el futuro.

| Persona | Escuchas lote 1 | Escuchas lote 2 | No salto lote 1 | No salto lote 2 |
|---|---|---|---|---|
| Ander | 147.210 | 108.564 | 0,552 | 0,435 |
| Daniel | 45.612 | 39.229 | 0,936 | 0,923 |

Canciones que todos han escuchado 5 o más veces:

| Periodo | Mismo contexto (media) | Cualquier contexto |
|---|---|---|
| Solo lote 1 | 23 | 406 |
| Solo lote 2 | 10 | 296 |
| Historial completo | 50,5 | 651 |

Con el historial completo hay más del doble de canciones en común. En la tabla solo aparecen canciones que alguien escuchó en el lote 1, así que en realidad hay más. Aun así, algún contexto sigue teniendo 0 canciones, por lo que hace falta poder bajar *k*.

**Conclusión:**

- En la playlist real (producto y web), el filtro debe contar las escuchas de todo el historial.
- En la evaluación no se puede usar el lote 2 para filtrar. Sería hacer trampa (fuga de datos), porque el lote 2 es precisamente lo que se intenta predecir.

## 10. Hallazgo clave: la evaluación del recomendador es inestable

Se reconstruyó el modelo de la ventana de 18 meses con un script propio:

- Es casi idéntico al de la API: unas 90 escuchas de diferencia sobre 118.000, y una diferencia media de gusto de 0,014.
- Aun así, la tasa de salto con N = 50 pasa de 33,4 % a 27,9 %.

Por tanto, **diferencias de pocos puntos en la tasa de salto son ruido**. No se puede decidir entre ideas (opción A, filtro, decaimiento) hasta tener una evaluación más estable.

## 11. Conclusiones y tareas pendientes

**Conclusiones:**

- El panel ya usa el modelo de producción de la API y genera la playlist del grupo.
- El GB con error absoluto da al miembro que casi no salta canciones un peso injusto: sus canciones empatan y decide el otro. El error cuadrático lo corrige.
- La idea del filtro tiene sentido para el producto final, sobre todo con el historial completo.
- Ninguna mejora se puede confirmar todavía, porque la métrica del recomendador es inestable.

**Pendiente para la entrega final:**

1. Arreglar la evaluación del recomendador, decidiéndolo entre Daniel y Ander.
2. Decidir el modelo del objetivo 2 (opción A u opción B).
3. Actualizar el informe con MLflow fuera de Docker, los notebooks 04 y 05 y los cambios del panel.
4. Que Ander añada a `api/` un método público para los gustos, y así el panel no use funciones internas.

**Después de la entrega:**

- Prueba con un grupo de 3 personas.
- Web donde cada persona sube su `.zip` de Spotify y recibe la playlist del grupo.
