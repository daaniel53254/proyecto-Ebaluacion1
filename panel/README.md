# Panel v1 (Streamlit)

Panel de la Entrega 2 del proyecto «Playlist perfecta para viajes en grupo». Lee los CSV que deja
`bigdata/pipeline.sh` en `data/dataset/` y el último log completo de `docs/evidencias/`. No necesita
Docker encendido.

## Índice

1. [Cómo lanzarlo](#1-cómo-lanzarlo)
2. [Qué muestra](#2-qué-muestra)
3. [De dónde sale cada cosa](#3-de-dónde-sale-cada-cosa)
4. [Limitaciones](#4-limitaciones)

## 1. Cómo lanzarlo

Desde la raíz del repositorio, la primera vez:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r panel/requirements.txt   # Windows (Git Bash)
# .venv/bin/python -m pip install -r panel/requirements.txt     # macOS y Linux
```

Después, cada vez:

```bash
.venv/Scripts/python -m streamlit run panel/app.py
```

Se abre en <http://localhost:8501>. Hay que lanzarlo desde la raíz del repositorio para que Streamlit lea
el tema de `.streamlit/config.toml` (colores del logo de NPD Entertainment; los gráficos usan una paleta validada para daltonismo que empieza por su naranja y su verde); los mismos
colores están en `panel/tema.py` (gráficos) y `panel/estilo.css` (tipografía, pestañas y foco). Antes tienen que estar en `data/dataset/` los tres CSV
(`spotify_reproducciones.csv`, `gold_objetivo1.csv` y `gold_candidatas.csv`): salen del pipeline o de
la carpeta compartida de Drive. Si falta alguno, el panel avisa y se para.

## 2. Qué muestra

| Pestaña | Contenido |
|---|---|
| Hábitos por persona | Escuchas, horas, canciones, artistas, tasa de no salto y % en aleatorio; reparto por hora, día de la semana, plataforma y forma de terminar; artistas más escuchados y canciones en común |
| Calidad de datos | Filas en origen, bronze, silver y gold; los 8 problemas del ensuciado contados en bronze y en silver; comprobaciones sobre silver |
| No salto por contexto | Tasa de no salto por franja de 4 horas y tipo de día, por persona y lote |
| Recomendador | Lista del sistema frente a la de las más escuchadas en un contexto, cortadas por número de canciones o por duración del viaje; evaluación de las dos en el lote 2 (tasa de salto y NDCG) en ese contexto y en los 12. Se elige el modelo que predice el gusto: la Ridge del notebook 03 o el GB absoluto de la API |
| Playlist del grupo | La playlist que daría la API (`POST /objetivo2/playlist`) con el modelo de producción (GB absoluto, últimos 18 meses): por contexto, por número de canciones o minutos, quitando artistas |

En la barra lateral se eligen las personas y los años (estos solo filtran los hábitos).

## 3. De dónde sale cada cosa

| Pestaña | Fuente |
|---|---|
| Hábitos | `spotify_reproducciones.csv` (silver): hace falta la hora, la plataforma y el motivo de fin de cada escucha, que gold ya no tiene |
| Calidad de datos | El último `docs/evidencias/pipeline_*.log` que termina en «Pipeline completado», y `spotify_reproducciones.csv` para las comprobaciones |
| No salto por contexto | `gold_objetivo1.csv`: suma de `n_no_salto` ÷ suma de `n_escuchas` (no la media de tasas) |
| Recomendador | `gold_candidatas.csv` y, según el modelo elegido, `recomendador_gustos.csv` (notebook 03) o `data/dataset/modelo_api_lote1/` (modelo de la API entrenado hasta el 30/06/2025) |
| Playlist del grupo | `api/datos/` (modelo de producción y tablas que genera `python -m api.preparar_datos`) |

**Recomendador.** El panel no entrena nada: sigue la sección 4 del notebook 03.

- `recomendador_gustos.csv` tiene una fila por persona × candidata × contexto con `persona`,
  `track_id`, `franja`, `tipo_dia`, `gusto`, `origen` (`real` o `prevista`) y `percentil`. El gusto es
  la tasa real del lote 1 si hay 5 o más escuchas en ese contexto y, si no, la predicción del mejor
  modelo del objetivo 1. El percentil se calcula dentro de cada persona y contexto.
- **Sistema:** gusto del grupo = mínimo de los percentiles; los empates se resuelven con la media.
- **Referencia:** las canciones con más escuchas del grupo en el lote 1.
- **Evaluación (solo lote 2):** para cada persona, la tasa de salto real de las canciones de la lista
  que escuchó 5 o más veces en ese contexto (ponderada por escuchas) y el NDCG. En «Los 12
  contextos» se hace la media de cada persona sobre los contextos y después la de las personas, como
  en el notebook. Con N = 20, 50 y 100 el panel da las mismas cifras que el notebook.
- Si falta `recomendador_gustos.csv`, el panel avisa y usa una aproximación: donde iría la predicción
  del modelo pone la tasa habitual de la persona en ese contexto. La lista de referencia no cambia.

Para regenerar el CSV, ejecutar el notebook 03 entero con el gold actual.

**Modelo de la API.** El panel carga el modelo con la misma clase que la API (`api.servicio.Servicio`),
así que da lo mismo que sus rutas sin tener que arrancar el servidor. Se preparan dos carpetas, las dos
fuera de Git porque salen de los historiales:

```bash
.venv/Scripts/python -m api.preparar_datos                       # api/datos/: producción, últimos 18 meses
.venv/Scripts/python -m api.preparar_datos --hasta 2025-07-01 --salida data/dataset/modelo_api_lote1
```

- La primera alimenta la pestaña **Playlist del grupo**. Como incluye el lote 2, esa lista no se evalúa.
- La segunda es el mismo modelo entrenado del 01/01/2024 al 30/06/2025 (la versión registrada en
  MLflow). En **Recomendador** sustituye a la Ridge solo donde no hay tasa real del lote 1, con la misma
  regla, y así se puede evaluar con el lote 2. Con N = 50 da 33,4 % de salto (la Ridge 33,3 % y las más
  escuchadas 29,7 %): cambiar de modelo no basta para ganar a la referencia.
- Las personas de la API van con su nombre de carpeta; el panel las pasa a seudónimo con la función de
  `bigdata/preparar.py`.
- Si el modelo se regenera (por ejemplo, porque alguien sube su zip), el panel lo recarga solo.

## 4. Limitaciones

- La evaluación con el lote 2 se apoya en pocas canciones (las que la persona volvió a escuchar al
  menos 5 veces en ese contexto), así que es orientativa.
- Con la aproximación (sin el CSV del notebook) las canciones sin dato real empatan en el percentil
  de esa persona; con la predicción del modelo ya no pasa.
- El `percentil` del CSV vale para el grupo completo. Si en la barra lateral se eligen solo algunas
  personas, las candidatas pasan a ser las canciones que escucharon ellas en el lote 1 y el percentil
  se recalcula con `gusto` sobre ese conjunto (como propone el notebook 03).
- Las personas aparecen con su seudónimo, igual que en HDFS.
- El modelo de la API usa sus propias tablas (las escuchas del periodo leídas de `data/raw/`), no el gold
  de Hive: sus cifras pueden diferir un 3 % de las del pipeline por los filtros de silver.
