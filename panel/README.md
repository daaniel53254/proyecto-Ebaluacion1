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
| Playlist de ejemplo | Lista para el grupo en un contexto y una duración de viaje, con una regla sencilla, y su evaluación con el lote 2 |

En la barra lateral se eligen las personas y los años (estos solo filtran los hábitos).

## 3. De dónde sale cada cosa

| Pestaña | Fuente |
|---|---|
| Hábitos | `spotify_reproducciones.csv` (silver): hace falta la hora, la plataforma y el motivo de fin de cada escucha, que gold ya no tiene |
| Calidad de datos | El último `docs/evidencias/pipeline_*.log` que termina en «Pipeline completado», y `spotify_reproducciones.csv` para las comprobaciones |
| No salto por contexto | `gold_objetivo1.csv`: suma de `n_no_salto` ÷ suma de `n_escuchas` (no la media de tasas) |
| Playlist | `gold_candidatas.csv` |

**Regla de la playlist (provisional).** Gusto de cada persona = su tasa real en ese contexto del
lote 1 si tiene al menos 5 escuchas; si no, su tasa habitual en ese contexto
(`per_tasa_no_salto_ctx`). Se divide por `per_tasa_media`, la canción vale el mínimo entre personas
(desempate: la media) y entra si pasa el umbral. Después se limita el número de canciones por
artista y se corta por la duración del viaje (si una canción no tiene duración, se usa la mediana).
El lote 2 solo se usa para evaluar. Cuando esté el baseline de Ander, la regla se cambia por la
predicción del modelo en `datos.playlist_ejemplo`.

## 4. Limitaciones

- La evaluación con el lote 2 se apoya en pocas canciones (las que la persona volvió a escuchar al
  menos 5 veces en ese contexto), así que es orientativa.
- Si a una persona le falta el dato real de una canción, su gusto es una constante; por eso muchas
  canciones empatan en el mínimo y decide el desempate.
- Las personas aparecen con su seudónimo, igual que en HDFS.
