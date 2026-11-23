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

Se abre en <http://localhost:8501>. Antes tienen que estar en `data/dataset/` los tres CSV
(`spotify_reproducciones.csv`, `gold_objetivo1.csv` y `gold_candidatas.csv`): salen del pipeline o de
la carpeta compartida de Drive. Si falta alguno, el panel avisa y se para.

## 2. Qué muestra

| Pestaña | Contenido |
|---|---|
| Hábitos por persona | Escuchas, horas, canciones, artistas, tasa de no salto y % en aleatorio; reparto por hora, día de la semana, plataforma y forma de terminar; artistas más escuchados y canciones en común |
| Calidad de datos | Filas en origen, bronze, silver y gold; los 8 problemas del ensuciado contados en bronze y en silver; comprobaciones sobre silver |
| No salto por contexto | Tasa de no salto por franja de 4 horas y tipo de día, por persona y lote |
| Recomendador | Lista del sistema frente a la de las más escuchadas en un contexto, cortadas por número de canciones o por duración del viaje; evaluación de las dos en el lote 2 (tasa de salto y NDCG) en ese contexto y en los 12 |

En la barra lateral se eligen las personas y los años (estos solo filtran los hábitos).

## 3. De dónde sale cada cosa

| Pestaña | Fuente |
|---|---|
| Hábitos | `spotify_reproducciones.csv` (silver): hace falta la hora, la plataforma y el motivo de fin de cada escucha, que gold ya no tiene |
| Calidad de datos | El último `docs/evidencias/pipeline_*.log` que termina en «Pipeline completado», y `spotify_reproducciones.csv` para las comprobaciones |
| No salto por contexto | `gold_objetivo1.csv`: suma de `n_no_salto` ÷ suma de `n_escuchas` (no la media de tasas) |
| Recomendador | `recomendador_gustos.csv` (lo guarda el notebook 03 de Ander) y `gold_candidatas.csv` |

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

## 4. Limitaciones

- La evaluación con el lote 2 se apoya en pocas canciones (las que la persona volvió a escuchar al
  menos 5 veces en ese contexto), así que es orientativa.
- Con la aproximación (sin el CSV del notebook) las canciones sin dato real empatan en el percentil
  de esa persona; con la predicción del modelo ya no pasa.
- El `percentil` del CSV vale para el grupo completo. Si en la barra lateral se eligen solo algunas
  personas, las candidatas pasan a ser las canciones que escucharon ellas en el lote 1 y el percentil
  se recalcula con `gusto` sobre ese conjunto (como propone el notebook 03).
- Las personas aparecen con su seudónimo, igual que en HDFS.
