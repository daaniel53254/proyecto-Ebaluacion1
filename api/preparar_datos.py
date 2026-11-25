"""Prepara lo que necesita la API: modelo del objetivo 1 y tablas de variables.

Uso (desde la raíz del repositorio):
    python -m api.preparar_datos                       # últimos 18 meses de los historiales subidos
    python -m api.preparar_datos --hasta 2025-07-01    # mismo periodo que la versión registrada en MLflow

Lee los historiales de data/raw/<persona>/ (o, si no existe, de data/entrada/historial/<persona>/) y escribe en api/datos/:
    modelo.joblib     modelo de producción entrenado aquí con la configuración registrada en MLflow
    recuentos.csv.gz  escuchas y no saltos por persona × canción × contexto del periodo
    catalogo.csv.gz   canciones candidatas (nombre, artista, álbum, duración estimada)
    recuentos_completo.csv.gz, catalogo_completo.csv.gz
                      lo mismo con todo el historial (opción historial="completo" del recomendador)
    personas.csv      miembros, % de modo aleatorio y tasa de no salto del periodo
    novedades.joblib  modelo de canciones nuevas del notebook 08 (POST /objetivo2/entraria), con todo el historial
    info.json         periodo, hiperparámetros y métricas de la preparación

Se entrena aquí, con la configuración de la versión de producción del registro de MLflow
(playlist_tasa_no_salto@produccion), por dos motivos: cada vez que alguien sube o borra su historial
cambian las personas y sus datos, y un .joblib solo se puede cargar con la misma versión de scikit-learn
con la que se guardó. La API lo ejecuta sola después de cada subida o borrado.
"""
import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import GroupKFold

from api import novedades
from api.caracteristicas import MIN_ESCUCHAS, ZONA, carpeta_historial_por_defecto, leer_historiales, recuentos, tabla, variables_oof

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = Path(__file__).resolve().parent / "datos"

# Configuración de la versión de producción del notebook 05 (registrada en MLflow como playlist_tasa_no_salto@produccion)
HIPERPARAMETROS = {"learning_rate": 0.05, "max_iter": 150, "max_leaf_nodes": 7, "min_samples_leaf": 80, "l2_regularization": 1.0}
PESOS_SQRT_N = False
SEMILLA = 42


MIN_FILAS = 50


def _catalogo(d: pd.DataFrame) -> pd.DataFrame:
    """Canciones de las escuchas d: nombre, artista, álbum, escuchas del grupo y duración estimada."""
    terminadas = d[d["reason_end"] == "trackdone"].groupby("track_id")["ms_played"].median()
    cat = (d.groupby("track_id")
           .agg(cancion=("cancion", "first"), artista=("artista", "first"), album=("album", "first"),
                escuchas_grupo=("no_salto", "size"))
           .join((terminadas / 1000).round().rename("duracion_s")))
    cat["duracion_s"] = cat["duracion_s"].fillna(d.groupby("track_id")["ms_played"].max() / 1000).round()
    return cat


def preparar(historial: Path, hasta: str = "auto", meses: int = 18, salida: Path = SALIDA) -> dict:
    """Genera modelo y tablas a partir de todos los historiales de la carpeta. hasta="auto": hasta la última escucha."""
    h = leer_historiales(historial)
    fin = (h["hora_local"].max().normalize() + pd.Timedelta(days=1)) if hasta in (None, "auto") else pd.Timestamp(hasta, tz=ZONA)
    inicio = fin - pd.DateOffset(months=meses)
    periodo = h[(h["hora_local"] >= inicio) & (h["hora_local"] < fin)]
    if periodo.empty:
        raise ValueError(f"No hay escuchas entre {inicio:%Y-%m-%d} y {fin:%Y-%m-%d}")
    fuera = sorted(set(h["persona"]) - set(periodo["persona"]))

    # Entrenamiento: filas fiables con variables fuera de pliegue, igual que en el notebook 05
    t = tabla(periodo, periodo)
    t = t[t["n_escuchas"] >= MIN_ESCUCHAS].reset_index(drop=True)
    if len(t) < MIN_FILAS or t["track_id"].nunique() < 5:
        raise ValueError(f"Hay pocos datos para entrenar ({len(t)} combinaciones persona × canción × contexto con "
                         f"{MIN_ESCUCHAS} o más escuchas; hacen falta {MIN_FILAS}). Sube historiales más largos.")
    src = recuentos(periodo)
    X = variables_oof(t, src)
    y = t["tasa_no_salto"].to_numpy()
    pesos = np.sqrt(t["n_escuchas"].to_numpy()) if PESOS_SQRT_N else None

    pred = np.zeros(len(t))
    for tr, va in GroupKFold(5).split(X, groups=t["track_id"]):
        m = HistGradientBoostingRegressor(loss="absolute_error", random_state=SEMILLA, **HIPERPARAMETROS)
        m.fit(X.iloc[tr], y[tr], sample_weight=None if pesos is None else pesos[tr])
        pred[va] = np.clip(m.predict(X.iloc[va]), 0, 1)
    modelo = HistGradientBoostingRegressor(loss="absolute_error", random_state=SEMILLA, **HIPERPARAMETROS)
    modelo.fit(X, y, sample_weight=pesos)

    # Tablas para servir: se escriben en una carpeta nueva y se cambia al final, para que la API
    # nunca lea una mezcla de ficheros viejos y nuevos
    final = Path(salida)
    salida = final.parent / (final.name + ".nuevo")
    shutil.rmtree(salida, ignore_errors=True)
    salida.mkdir(parents=True)
    src.to_csv(salida / "recuentos.csv.gz", index=False)
    catalogo = _catalogo(periodo)
    catalogo.reset_index().to_csv(salida / "catalogo.csv.gz", index=False)
    # Todo el historial hasta el fin del periodo, para el recomendador con historial="completo"
    completo = h[h["hora_local"] < fin]
    recuentos(completo).to_csv(salida / "recuentos_completo.csv.gz", index=False)
    catalogo_completo = _catalogo(completo)
    catalogo_completo.reset_index().to_csv(salida / "catalogo_completo.csv.gz", index=False)
    # Modelo de canciones nuevas (notebook 08): si no hay datos suficientes, la API funciona igual sin él
    try:
        paquete_nov = novedades.entrenar(completo)
        joblib.dump(paquete_nov, salida / "novedades.joblib")
        info_nov = paquete_nov["info"]
    except Exception as e:
        info_nov = {"error": f"{type(e).__name__}: {e}"}
    personas = periodo.groupby("persona").agg(escuchas=("no_salto", "size"), tasa_no_salto=("no_salto", "mean"),
                                              per_pct_shuffle=("shuffle", "mean"))
    personas.reset_index().to_csv(salida / "personas.csv", index=False)

    info = {
        "modelo": "GB absoluto (HistGradientBoostingRegressor, loss=absolute_error)",
        "registro_mlflow": "playlist_tasa_no_salto@produccion",
        "hiperparametros": HIPERPARAMETROS, "pesos_sqrt_n": PESOS_SQRT_N,
        "periodo": {"desde": f"{inicio:%Y-%m-%d}", "hasta": f"{fin - pd.Timedelta(days=1):%Y-%m-%d}", "meses": meses},
        "filas_entrenamiento": int(len(t)), "cv_mae": float(mean_absolute_error(y, pred)),
        "columnas": list(X.columns), "personas": personas.index.tolist(), "personas_sin_escuchas_en_el_periodo": fuera, "canciones_catalogo": int(len(catalogo)),
        "historial_completo": {"desde": f"{completo['hora_local'].min():%Y-%m-%d}", "canciones": int(len(catalogo_completo))},
        "novedades": info_nov,
        "preparado": datetime.now().isoformat(timespec="seconds"),
    }
    joblib.dump({"modelo": modelo, "columnas": list(X.columns), "info": info}, salida / "modelo.joblib")
    with open(salida / "info.json", "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=1)
    anterior = final.parent / (final.name + ".anterior")
    shutil.rmtree(anterior, ignore_errors=True)
    if final.exists():
        final.rename(anterior)
    salida.rename(final)
    shutil.rmtree(anterior, ignore_errors=True)
    return info


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--historial", type=Path, default=carpeta_historial_por_defecto(RAIZ))
    ap.add_argument("--hasta", default="auto",
                    help="fin (no incluido) del periodo, AAAA-MM-DD; «auto» = hasta la última escucha. "
                         "2025-07-01 reproduce el periodo de la versión registrada en MLflow")
    ap.add_argument("--meses", type=int, default=18, help="longitud de la ventana (política del notebook 04)")
    ap.add_argument("--salida", type=Path, default=SALIDA)
    a = ap.parse_args()
    try:
        info = preparar(a.historial, a.hasta, a.meses, a.salida)
    except (ValueError, FileNotFoundError) as e:
        raise SystemExit(f"No se pudo preparar: {e}")
    print(f"Periodo {info['periodo']['desde']} a {info['periodo']['hasta']} · {info['filas_entrenamiento']} filas · "
          f"MAE de validación {info['cv_mae']:.3f} · {info['canciones_catalogo']} canciones · personas: {', '.join(info['personas'])}")
    print("Datos de la API en", a.salida)


if __name__ == "__main__":
    main()
