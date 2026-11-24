# Resumen de la sesión con Claude Code (23 y 24 de noviembre de 2026)

Proyecto «Playlist perfecta para viajes en grupo» · repositorio `daaniel53254/proyecto-Ebaluacion1`.
Python usado en todo momento: el de Anaconda (`%USERPROFILE%\anaconda3\python.exe`), porque no hay `.venv`.

---

## 1. Puesta en marcha y prueba de la API (rama `ander/mlflow-local`)

**Contexto.** La API FastAPI de `api/` nunca se había ejecutado de verdad.

**Rama.** Al empezar estaba en `ander/kaggle-revision`. `ander/mlflow-local` solo apareció tras un `git fetch`, así que la saqué de `origin/ander/mlflow-local` y repetí todo en ella.

| Paso | Resultado |
|---|---|
| `pip install -r api/requirements.txt` | Instalado (FastAPI 0.165, Pydantic 2.14). Efecto secundario: pytest del entorno base subió de 7.4.4 a 9.2.0 |
| `pytest api -q` | **33 pasadas** a la primera. No hubo que tocar `api/main.py` ni `api/esquemas.py` |
| `python -m api.preparar_datos` | Historiales de ander y daniel (desde `data/entrada/historial`, porque no existe `data/raw`): 9.777 filas, MAE de validación 0,161, 11.891 canciones |
| `uvicorn api.main:app --port 8000` | `/salud` ok, `/objetivo1/prediccion` (con franja + tipo_dia y con fecha_hora), `/objetivo2/playlist` 200; errores 404 y 422 claros |
| `POST /historiales` con un zip | Zip de prueba (copia del historial de daniel con el nombre `prueba`): reentrena en unos 12 s, la persona entra en el modelo; sin consentimiento da 422. Después `DELETE /historiales/prueba` y el modelo volvió a ander + daniel (9.777 filas, MAE 0,1606) |
| `bash servidor_mlflow.sh arrancar` | Instala MLflow 3.18 en `.venv-mlflow` (unos 6 min la primera vez); `/health` = 200 |
| `bash servidor_mlflow.sh parar` | **Fallaba en Windows** («No se pudo parar MLflow») |

### Cambios hechos (commit `a5fabbc`, con push a `origin/ander/mlflow-local`)

1. **`servidor_mlflow.sh` → `parar()`**. En Windows el proceso que figura como dueño del puerto 5000 ya ha terminado y sus 4 workers de uvicorn siguen sirviendo con el socket heredado, así que `Stop-Process` sobre ese PID no hacía nada. Ahora se para el árbol de procesos entero (huérfanos incluidos) partiendo del PID del puerto y de `mlruns/servidor.pid`. Probado sobre el servidor atascado y en un ciclo limpio arrancar → `/health` → parar → estado.
2. **`.gitignore`**: añadido `api/datos/` (modelo y recuentos generados con los historiales personales).

Después alguien unió la rama en `main` (`cb56c8d`), así que el arreglo ya está en `main`. Actualicé el `main` local con `git pull`.

### Detalles menores que quedaron sin tocar

- Aviso de joblib «Could not find the number of physical cores»: se quita con `LOKY_MAX_CPU_COUNT`.
- Durante un reentrenamiento, `GET /preparacion` muestra el `resumen` de la ejecución anterior.
- `servidor_mlflow.sh` creó `.venv-mlflow` con el Python 3.13 del sistema (va antes que Anaconda en el PATH). Funciona igual.

### Cómo probarlo a mano

```powershell
& "$env:USERPROFILE\anaconda3\python.exe" -m pytest api -q
& "$env:USERPROFILE\anaconda3\python.exe" -m api.preparar_datos
& "$env:USERPROFILE\anaconda3\python.exe" -m uvicorn api.main:app --port 8000   # y abrir http://localhost:8000/docs
& "C:\Program Files\Git\bin\bash.exe" servidor_mlflow.sh arrancar              # http://localhost:5000/health
& "C:\Program Files\Git\bin\bash.exe" servidor_mlflow.sh parar
```

---

## 2. Revisión de la PR 3 de Daniel (panel conectado a la API)

Solo cambia `panel/` (README, `app.py`, `datos.py`, `requirements.txt`) y está basada en `main`. **No toca `api/`.**

**Comprobado:**
- Los dos modelos se generan: producción (18 meses, 9.777 filas, MAE 0,161) y hasta el 30/06/2025 con `--salida data/dataset/modelo_api_lote1` (7.753 filas, MAE 0,158).
- `playlist_api` (por canciones y por minutos, quitando artistas), `mapa_gustos_api` y `seudonimos` funcionan con los dos modelos.
- No hay fuga: las variables del modelo «lote 1» salen de los recuentos de su propio periodo.
- **No se pudo** abrir el panel ni comprobar las cifras del recomendador (33,4 / 33,3 / 29,7 %): falta `data/dataset/` y Docker Desktop no estaba arrancado.

**Lo del GB que predice 1: confirmado.**

| | Daniel | Ander |
|---|---|---|
| Filas con tasa = 1 | 89,5 % | 17,5 % |
| Mediana de su tasa | 1,0 | 0,25 |
| Predicciones = 1 | 95,6 % | 0 % |
| Percentiles distintos (de 11.891) | 34 | 1.245 |

`loss="absolute_error"` aprende la mediana; la de Daniel es 1, sus canciones empatan y la playlist la decide el gusto de Ander. Propuestas: probar `squared_error` en el notebook 05, o mantener el GB absoluto para el objetivo 1 y ordenar el objetivo 2 con un modelo que aprenda la media.

**Detalles menores:** `gustos_desde_api` usa métodos internos de `Servicio` (`_filas`, `_predecir_filas`); el panel se paraba entero sin `data/dataset/` (luego se arregló en la propia rama); el README usa `.venv/Scripts/python`.

Veredicto: se puede unir. Nada publicado en GitHub (no está instalado `gh`); se dejó un texto de comentario listo para pegar. La PR se unió después (`8e57c36`).

---

## 3. Prueba de la rama `ander/historial-completo`

Añade al recomendador la opción «Últimos 18 meses» / «Todo el historial».

| Comprobación | Resultado |
|---|---|
| Paquetes | `api/requirements.txt` y `panel/requirements.txt` instalados (Streamlit 1.67) |
| `python -m api.preparar_datos` | Aparecen `recuentos_completo.csv.gz` y `catalogo_completo.csv.gz`; `info.json` tiene `historial_completo` (desde 2019-05-10, 17.662 canciones) |
| `pytest api/tests -q` | **46 pasadas** (incluidas `test_api.py` y `test_historial_completo.py`) |

**Playlists de 50 canciones con datos reales (ander y daniel, sin servidor):**

| Caso | Historial | Tiempo | Conoce (ander / daniel) | Fuera del catálogo de 18 meses | Origen ander | Origen daniel | Conocidas por todos |
|---|---|---|---|---|---|---|---|
| Franja 3 · fin de semana | 18 meses | 0,38 s | 37 / 27 | 0 | 29 real, 21 prevista | 22 real, 28 prevista | 1 |
| Franja 3 · fin de semana | completo | 0,27 s | 47 / 50 | 1 | 26 real, 8 mezcla, 16 prevista | 10 real, 40 mezcla | 5 |
| Sin horario | 18 meses | 1,47 s | 50 / 50 | 0 | 50 real | 50 real | 50 |
| Sin horario | completo | 0,97 s | 50 / 50 | 6 | 50 real | 50 real | 50 |

`historial="18_meses"` da exactamente lo mismo que no pasar el parámetro, con y sin horario.

**API:** `"historial": "completo"` → 200 en 0,45 s (30 canciones, 101,4 min); `"historial": "todo"` → 422 («Input should be '18_meses' or 'completo'»).

**Panel:** arrancado en http://localhost:8501. Sin `data/dataset/` solo se ve la pestaña «Playlist del grupo»; el selector «Últimos 18 meses / Todo el historial» funciona sin errores. Para volver a abrirlo:

```powershell
& "$env:USERPROFILE\anaconda3\python.exe" -m streamlit run panel/app.py
```

Sin merge, sin push y sin cambios en ficheros.

---

## 4. Preguntas sobre el modelo

### ¿Qué modelo usa el recomendador?

No es un modelo aparte: es una **regla** sobre el modelo del objetivo 1.

- **Modelo (producción, notebook 05):** `HistGradientBoostingRegressor` con `loss="absolute_error"` («GB absoluto»): `learning_rate` 0,05, `max_iter` 150, `max_leaf_nodes` 7, `min_samples_leaf` 80, `l2_regularization` 1,0. Ventana de 18 meses. Registrado en MLflow como `playlist_tasa_no_salto@produccion`. En el notebook 03 los modelos base eran Ridge y GB cuadrático.
- **Regla:** gusto de cada miembro = tasa real si tiene 5 o más escuchas en ese contexto, si no la predicción → percentil dentro de cada persona → gusto del grupo = mínimo de los percentiles → empates por la media.
- **Con «Todo el historial»:** gusto suavizado `(no saltos + 5 × prevista) / (escuchas + 5)` y reparto mínimo (cada miembro conoce al menos un tercio de cualquier tramo inicial).

### ¿Qué pasaría si entrenásemos con más datos?

- **Más historial:** peor. Notebook 04, prueba desde enero de 2026:

  | Entrenado con | Filas | MAE | Sesgo |
  |---|---|---|---|
  | Solo lote 1 | 11.595 | 0,225 | 0,080 |
  | Todo hasta dic. 2025 | 14.882 | 0,218 | 0,062 |
  | **Ventana de 18 meses** | 9.748 | **0,207** | **0,025** |

  Motivo: drift (la tasa de Ander baja de 0,552 a 0,435, PSI de plataforma 0,717, un 34 % de canciones nuevas en el lote 2).
- **Más personas:** ayudaría a las variables de grupo (con un tercer historial de prueba el `cv_mae` bajó de 0,161 a 0,142).
- **Modelo más grande:** no arregla lo de Daniel; eso depende de la pérdida, no de la capacidad.

### ¿Hemos entrenado y validado con los mismos datos?

No.

1. **Validación cruzada** `GroupKFold(5)` por canción dentro del periodo de entrenamiento, con variables calculadas fuera de pliegue (`variables_oof`). La búsqueda de hiperparámetros se hizo con esta validación.
2. **Prueba final** en el lote 2 (desde julio de 2025), una sola vez, con la regla de elección fijada antes de mirarlo: GB absoluto 18 meses → CV 0,160, **lote 2 0,190**.

**Matiz:** el modelo que entrena la API (`api.preparar_datos`) usa los últimos 18 meses hasta hoy e incluye el lote 2, así que su `cv_mae` de 0,161 es solo validación interna, no un error de prueba. El error esperable es el del lote 2 (~0,19).

**Para la entrega:** en el lote 2 la mediana de cada persona (MAE 0,184) acierta algo más que el GB (0,190). El GB solo aporta que ordena las canciones (Spearman 0,13), que es lo que necesita el recomendador.

---

## Estado al terminar

- Rama actual: `ander/historial-completo`, igual que el remoto y sin cambios.
- Servidores de la API y de MLflow parados. El del panel (Streamlit) ya no está en marcha.
- Ficheros sin seguimiento en la raíz que no son de esta sesión: `Borrador_legal_etica.pdf` e `Informe_final.docx`.
- Generados en local e ignorados por git: `api/datos/`, `data/dataset/modelo_api_lote1/`, `.venv-mlflow/`, `mlruns/`.
