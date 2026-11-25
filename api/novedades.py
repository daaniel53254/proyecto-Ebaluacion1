"""Canciones nuevas (notebook 08): ¿entraría en la playlist una canción que el grupo no ha escuchado?

Modelo: probabilidad de que una persona «adopte» una canción que nunca ha escuchado (la vuelve a escuchar sin
saltarla en los 90 días siguientes). Variables, todas con escuchas anteriores al momento de la consulta:
apertura de la persona a lo nuevo, cuánto conoce al artista y al álbum, cuántas novedades de ese artista
adoptó, si el resto del grupo conoce al artista o la canción, y el contexto.

Regla «¿entraría?»: la probabilidad de cada miembro se pasa a percentil frente a las novedades que esa
persona escuchó en los 12 meses anteriores; el gusto del grupo es el mínimo y la canción entra si es 0,80
o más (está en el 20 % de novedades más prometedoras para todos). En una playlist de 50, las novedades
ocupan como mucho round(50 × apertura del miembro menos abierto) huecos, entre 2 y 10.

Las funciones son las del notebook 08: si se cambia algo aquí, hay que cambiarlo también allí.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

VENTANA = pd.Timedelta(days=90)       # «adopta» = la vuelve a escuchar sin saltarla en 90 días
K = 5                                 # suavizado de las tasas
DIAS_APERTURA = 180                   # ventana de las variables de apertura de la persona
MESES_ENTRENAMIENTO = 18              # ventana elegida en la validación del notebook 08
MESES_REFERENCIA = 12                 # novedades con las que se compara a cada persona
UMBRAL_PCT = 0.80
N_LISTA, HUECOS_MIN, HUECOS_MAX = 50, 2, 10
MIN_FILAS = 100
SEMILLA = 42
HIPERPARAMETROS = {"learning_rate": 0.05, "max_iter": 300, "max_leaf_nodes": 15, "min_samples_leaf": 50,
                   "l2_regularization": 1.0}
CONTEXTOS = [(fr, td) for fr in range(6) for td in ("laborable", "fin_semana")]
COLS_CONSULTA = ["persona", "track_id", "artista", "album", "hora_local"]


# ----------------------------------------------------------------- tablas acumuladas
def _rodante(t, valores, dias=DIAS_APERTURA):
    return pd.Series(np.asarray(valores, dtype=float), index=pd.DatetimeIndex(t)).rolling(f"{dias}D").mean().to_numpy()


def primeras_escuchas(h: pd.DataFrame):
    """h ordenado por hora con la marca «primera» y las primeras escuchas con su etiqueta «adopta»."""
    h = h.sort_values("hora_local", kind="stable").reset_index(drop=True)
    h["primera"] = ~h.duplicated(["persona", "track_id"])
    vuelve = h[~h["primera"] & h["no_salto"]].groupby(["persona", "track_id"])["hora_local"].min().rename("t_vuelve")
    nuevas = h[h["primera"]].join(vuelve, on=["persona", "track_id"])
    nuevas["adopta"] = ((nuevas["t_vuelve"] - nuevas["hora_local"]) <= VENTANA).astype(int)
    nuevas["cierre"] = nuevas["hora_local"] + VENTANA                      # desde aquí ya se sabe si la adoptó
    nuevas["evaluable"] = nuevas["cierre"] <= h["hora_local"].max()
    return h, nuevas


def tablas(h: pd.DataFrame, nuevas: pd.DataFrame) -> dict:
    """Tablas acumuladas: cada fila es lo que se sabía justo después de esa escucha (o de ese cierre)."""
    per = h[["hora_local", "persona"]].copy()
    for _, idx in h.groupby("persona").groups.items():
        x = h.loc[idx]
        per.loc[idx, "per_pct_nuevas"] = _rodante(x["hora_local"], x["primera"])
        per.loc[idx, "per_tasa"] = _rodante(x["hora_local"], x["no_salto"])
        per.loc[idx, "per_pct_shuffle"] = _rodante(x["hora_local"], x["shuffle"])
    per_nuevas = nuevas[["hora_local", "persona", "no_salto"]].copy()
    per_adop = nuevas.sort_values("cierre", kind="stable")[["cierre", "persona", "adopta"]].copy()
    for p in nuevas["persona"].unique():
        m = per_nuevas["persona"] == p
        per_nuevas.loc[m, "per_ns_nuevas"] = _rodante(per_nuevas.loc[m, "hora_local"], per_nuevas.loc[m, "no_salto"])
        m = per_adop["persona"] == p
        per_adop.loc[m, "per_adopcion"] = _rodante(per_adop.loc[m, "cierre"], per_adop.loc[m, "adopta"])

    con_artista = h[h["artista"] != "?"]
    pa = con_artista[["hora_local", "persona", "artista"]].copy()
    g = con_artista.groupby(["persona", "artista"])
    pa["art_n"] = g.cumcount() + 1
    pa["art_ns"] = g["no_salto"].cumsum()
    pa["art_canciones"] = g["primera"].cumsum()
    pa["art_ultima"] = pa["hora_local"]
    alb = con_artista[["hora_local", "persona", "artista", "album"]].copy()
    alb["alb_n"] = con_artista.groupby(["persona", "artista", "album"]).cumcount() + 1
    tot = con_artista[["hora_local", "artista"]].copy()
    tot["tot_n"] = con_artista.groupby("artista").cumcount() + 1
    tot["tot_ns"] = con_artista.groupby("artista")["no_salto"].cumsum()
    trk = h[["hora_local", "track_id"]].copy()
    trk["trk_n"] = h.groupby("track_id").cumcount() + 1
    art_adop = nuevas[nuevas["artista"] != "?"].sort_values("cierre", kind="stable")[["cierre", "persona", "artista", "adopta"]].copy()
    ga = art_adop.groupby(["persona", "artista"])
    art_adop["art_cerradas"] = ga.cumcount() + 1
    art_adop["art_adoptadas"] = ga["adopta"].cumsum()
    return {"per": per, "per_nuevas": per_nuevas, "per_adop": per_adop, "pa": pa, "alb": alb, "tot": tot,
            "trk": trk, "art_adop": art_adop}


# Claves de cada tabla y columna de tiempo
_CLAVES = {"per": (["persona"], "hora_local"), "per_nuevas": (["persona"], "hora_local"), "per_adop": (["persona"], "cierre"),
           "pa": (["persona", "artista"], "hora_local"), "alb": (["persona", "artista", "album"], "hora_local"),
           "tot": (["artista"], "hora_local"), "trk": (["track_id"], "hora_local"),
           "art_adop": (["persona", "artista"], "cierre")}


def compactar(T: dict) -> dict:
    """Solo la última fila de cada clave: da las mismas variables para cualquier consulta posterior a la última
    escucha (es lo que necesita la API). Las tablas por cierre se guardan enteras, porque algunos cierres son futuros."""
    out = {}
    for nombre, t in T.items():
        claves, cuando = _CLAVES[nombre]
        out[nombre] = t if cuando == "cierre" else t.groupby(claves, sort=False).tail(1).reset_index(drop=True)
    return out


def _asof(izq, der, cuando, por, columnas):
    der = der[[cuando] + por + columnas].rename(columns={cuando: "_t"}).sort_values("_t", kind="stable")
    r = pd.merge_asof(izq, der, left_on="hora_local", right_on="_t", by=por, allow_exact_matches=False)
    return r.drop(columns="_t")


def variables(consultas: pd.DataFrame, T: dict) -> pd.DataFrame:
    """Variables de cada consulta (persona, track_id, artista, album, hora_local) con lo escuchado antes de hora_local."""
    f = consultas.reset_index(drop=True).copy()
    f["_id"] = np.arange(len(f))
    f["hora_local"] = pd.to_datetime(f["hora_local"]).dt.tz_convert("Europe/Madrid").dt.as_unit("ns")
    for c in ("persona", "track_id", "artista", "album"):
        f[c] = f[c].astype(str)
    f = f.sort_values("hora_local", kind="stable")
    f = _asof(f, T["per"], "hora_local", ["persona"], ["per_pct_nuevas", "per_tasa", "per_pct_shuffle"])
    f = _asof(f, T["per_nuevas"], "hora_local", ["persona"], ["per_ns_nuevas"])
    f = _asof(f, T["per_adop"], "cierre", ["persona"], ["per_adopcion"])
    f = _asof(f, T["pa"], "hora_local", ["persona", "artista"], ["art_n", "art_ns", "art_canciones", "art_ultima"])
    f = _asof(f, T["alb"], "hora_local", ["persona", "artista", "album"], ["alb_n"])
    f = _asof(f, T["tot"], "hora_local", ["artista"], ["tot_n", "tot_ns"])
    f = _asof(f, T["trk"], "hora_local", ["track_id"], ["trk_n"])
    f = _asof(f, T["art_adop"], "cierre", ["persona", "artista"], ["art_cerradas", "art_adoptadas"])
    f = f.sort_values("_id").drop(columns="_id").reset_index(drop=True)
    for c in ["art_n", "art_ns", "art_canciones", "alb_n", "tot_n", "tot_ns", "trk_n", "art_cerradas", "art_adoptadas"]:
        f[c] = f[c].fillna(0)
    return f


def matriz(f: pd.DataFrame) -> pd.DataFrame:
    """Matriz del modelo. franja, tipo_dia y shuffle son los de la escucha (o los del viaje, si es una consulta)."""
    tasa = f["per_tasa"].fillna(0.5)
    adop = f["per_adopcion"].fillna(0.5)
    grp_n, grp_ns = (f["tot_n"] - f["art_n"]).clip(lower=0), (f["tot_ns"] - f["art_ns"]).clip(lower=0)
    dias = (f["hora_local"] - pd.to_datetime(f["art_ultima"])).dt.total_seconds() / 86400
    return pd.DataFrame({
        "per_pct_nuevas": f["per_pct_nuevas"], "per_ns_nuevas": f["per_ns_nuevas"], "per_adopcion": f["per_adopcion"],
        "per_tasa": f["per_tasa"], "per_pct_shuffle": f["per_pct_shuffle"],
        "art_conocido": (f["art_n"] > 0).astype(int), "art_log_n": np.log1p(f["art_n"]),
        "art_tasa": (f["art_ns"] + K * tasa) / (f["art_n"] + K),
        "art_log_canciones": np.log1p(f["art_canciones"]), "art_log_dias": np.log1p(dias.fillna(3650)),
        "art_log_adoptadas": np.log1p(f["art_adoptadas"]),
        "art_adopcion": (f["art_adoptadas"] + K * adop) / (f["art_cerradas"] + K),
        "alb_log_n": np.log1p(f["alb_n"]),
        "grp_art_log_n": np.log1p(grp_n), "grp_art_tasa": (grp_ns + K * tasa) / (grp_n + K),
        "grp_cancion_conocida": (f["trk_n"] > 0).astype(int),
        "franja": f["franja"].astype(int), "finde": (f["tipo_dia"] == "fin_semana").astype(int),
        "shuffle": f["shuffle"].astype(int),
    })


# ----------------------------------------------------------------- entrenamiento
def entrenar(h: pd.DataFrame) -> dict:
    """Entrena el modelo de novedades con todos los historiales y prepara lo que necesita la API.

    Devuelve el paquete para guardar con joblib. Lanza ValueError si no hay datos suficientes."""
    h, nuevas = primeras_escuchas(h)
    T = tablas(h, nuevas)
    fn = variables(nuevas[COLS_CONSULTA].assign(), T)
    fn[["franja", "tipo_dia", "shuffle"]] = nuevas[["franja", "tipo_dia", "shuffle"]].to_numpy()
    X = matriz(fn)
    y = nuevas["adopta"].to_numpy()
    t0 = nuevas["hora_local"].reset_index(drop=True)
    evaluable = nuevas["evaluable"].to_numpy()
    fin_ent = h["hora_local"].max() - VENTANA
    ventana = evaluable & (t0 >= fin_ent - pd.DateOffset(months=MESES_ENTRENAMIENTO)).to_numpy()
    if ventana.sum() < MIN_FILAS or len(np.unique(y[ventana])) < 2:
        raise ValueError(f"Hay pocas canciones nuevas para entrenar ({int(ventana.sum())} primeras escuchas con 90 días "
                         f"de margen en los últimos {MESES_ENTRENAMIENTO} meses; hacen falta {MIN_FILAS} con y sin adopción)")

    # Validación temporal rápida: los 3 últimos meses evaluables, con un modelo entrenado con lo anterior
    auc_val = None
    val = ventana & (t0 >= fin_ent - pd.DateOffset(months=3)).to_numpy()
    ent = ventana & ~val & (t0 < fin_ent - pd.DateOffset(months=3) - VENTANA).to_numpy()
    if ent.sum() >= MIN_FILAS and len(np.unique(y[ent])) == 2 and len(np.unique(y[val])) == 2:
        m = HistGradientBoostingClassifier(random_state=SEMILLA, **HIPERPARAMETROS).fit(X[ent], y[ent])
        auc_val = float(roc_auc_score(y[val], m.predict_proba(X[val])[:, 1]))

    modelo = HistGradientBoostingClassifier(random_state=SEMILLA, **HIPERPARAMETROS).fit(X[ventana], y[ventana])
    fin = h["hora_local"].max()
    prob = modelo.predict_proba(X)[:, 1]
    referencias, apertura = {}, {}
    for p in nuevas["persona"].unique():
        m = (nuevas["persona"] == p).to_numpy()
        rec = m & (t0 >= fin - pd.DateOffset(months=MESES_REFERENCIA)).to_numpy()
        referencias[p] = np.sort(prob[rec if rec.sum() >= 20 else m])
        ult = T["per"][T["per"]["persona"] == p]["per_pct_nuevas"]
        apertura[p] = float(ult.iloc[-1]) if len(ult) else float("nan")
    info = {"modelo": "GB de clasificación (HistGradientBoostingClassifier), notebook 08",
            "objetivo": "adopta: vuelve a escucharla sin saltarla en los 90 días siguientes a la primera escucha",
            "filas_entrenamiento": int(ventana.sum()), "tasa_adopcion_entrenamiento": float(y[ventana].mean()),
            "auc_validacion_ultimos_3_meses": auc_val, "umbral_percentil": UMBRAL_PCT,
            "apertura": {p: round(v, 4) for p, v in apertura.items()},
            "datos_hasta": f"{fin:%Y-%m-%d}"}
    return {"modelo": modelo, "columnas": list(X.columns), "tablas": compactar(T), "referencias": referencias,
            "apertura": apertura, "fin": fin, "info": info}


# ----------------------------------------------------------------- consulta
def huecos(apertura: dict, personas: list[str], n_lista: int = N_LISTA) -> int:
    a = min(apertura.get(p, np.nan) for p in personas)
    return HUECOS_MIN if np.isnan(a) else int(np.clip(round(n_lista * a), HUECOS_MIN, HUECOS_MAX))


def evaluar(paquete: dict, personas: list[str], canciones: pd.DataFrame, franja=None, tipo_dia=None) -> pd.DataFrame:
    """canciones: track_id, artista, album. Probabilidad y percentil por miembro, percentil del grupo y si entra.

    Se pregunta justo después de la última escucha de los datos, con shuffle (lo normal en un viaje) y, sin
    horario, como media de los 12 contextos."""
    momento = paquete["fin"] + pd.Timedelta(seconds=1)
    ctx = CONTEXTOS if franja is None else [(int(franja), tipo_dia)]
    out = canciones.reset_index(drop=True).copy()
    for p in personas:
        q = out[["track_id", "artista", "album"]].assign(persona=p, hora_local=momento)[COLS_CONSULTA]
        f = variables(q, paquete["tablas"]).assign(shuffle=True)
        prob = np.mean([paquete["modelo"].predict_proba(matriz(f.assign(franja=fr, tipo_dia=td))[paquete["columnas"]])[:, 1]
                        for fr, td in ctx], axis=0)
        ref = paquete["referencias"].get(p, np.array([]))
        out[f"prob_{p}"] = prob
        out[f"pct_{p}"] = np.searchsorted(ref, prob, side="right") / max(len(ref), 1)
        out[f"art_n_{p}"] = f["art_n"].to_numpy()
    out["pct_grupo"] = out[[f"pct_{p}" for p in personas]].min(axis=1)
    out["entra"] = out["pct_grupo"] >= UMBRAL_PCT
    return out
