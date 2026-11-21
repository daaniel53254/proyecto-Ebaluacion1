"""Variables del objetivo 1, idénticas a las de los notebooks 04 y 05.

La API calcula las variables con estas mismas funciones para que el modelo reciba exactamente lo
que vio al entrenar. Si se cambia algo aquí, hay que cambiarlo también en los notebooks.
"""
import glob
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold

ZONA = "Europe/Madrid"
UMBRAL_SALTO_MS = 30_000
MIN_ESCUCHAS = 5
CAMPOS = ["ts", "ms_played", "spotify_track_uri", "master_metadata_track_name", "master_metadata_album_artist_name",
          "master_metadata_album_album_name", "reason_end", "shuffle"]
NOMBRES_FRANJA = ["0-4h", "4-8h", "8-12h", "12-16h", "16-20h", "20-24h"]


def leer_historiales(carpeta_historial: Path) -> pd.DataFrame:
    """Lee data/entrada/historial/<persona>/*.json con la limpieza mínima de silver (como el notebook 04)."""
    partes = []
    for carpeta in sorted(p for p in Path(carpeta_historial).iterdir() if p.is_dir()):
        filas = []
        for f in sorted(glob.glob(str(carpeta / "**" / "Streaming_History_Audio_*.json"), recursive=True)):
            with open(f, encoding="utf-8") as fh:
                filas += [{k: r.get(k) for k in CAMPOS} for r in json.load(fh)]
        if filas:
            d = pd.DataFrame(filas, columns=CAMPOS)
            d["persona"] = carpeta.name
            partes.append(d)
    if not partes:
        raise FileNotFoundError(f"No hay historiales en {carpeta_historial}")
    h = pd.concat(partes, ignore_index=True)
    h["ms_played"] = pd.to_numeric(h["ms_played"])
    h = h[h["spotify_track_uri"].notna() & (h["ms_played"] > 0)].copy()
    h["track_id"] = h["spotify_track_uri"].str.replace("spotify:track:", "", regex=False)
    h = h.sort_values("ms_played", ascending=False).drop_duplicates(["persona", "ts", "track_id"]).copy()
    h["cancion"] = h["master_metadata_track_name"].fillna("?")
    h["artista"] = h["master_metadata_album_artist_name"].fillna("?")
    h["album"] = h["master_metadata_album_album_name"].fillna("?")
    h["hora_local"] = pd.to_datetime(h["ts"], utc=True).dt.tz_convert(ZONA)
    h["franja"] = h["hora_local"].dt.hour // 4
    h["tipo_dia"] = np.where(h["hora_local"].dt.dayofweek >= 5, "fin_semana", "laborable")
    h["no_salto"] = ~((h["reason_end"] == "fwdbtn") & (h["ms_played"] < UMBRAL_SALTO_MS))
    h["shuffle"] = h["shuffle"].fillna(False).astype(bool)
    return h.sort_values("hora_local").reset_index(drop=True)


def recuentos(d):
    """Escuchas y no saltos por persona × canción × contexto (los 'recuentos' de los que salen las variables)."""
    return (d.groupby(["persona", "track_id", "franja", "tipo_dia"])
             .agg(n_escuchas=("no_salto", "size"), n_no_salto=("no_salto", "sum"),
                  artista=("artista", "first"), album=("album", "first")).reset_index())

def tabla(etiquetas, fuente_d):
    """Filas con etiqueta de 'etiquetas' y variables de persona y grupo calculadas con 'fuente_d' (como gold.sql)."""
    t = recuentos(etiquetas)
    t["tasa_no_salto"] = t["n_no_salto"] / t["n_escuchas"]
    t["per_pct_shuffle"] = t["persona"].map(fuente_d.groupby("persona")["shuffle"].mean())
    pt = fuente_d.groupby(["persona", "track_id"])["no_salto"].agg(["size", "sum"])
    gt = pt.groupby("track_id").sum()
    own = pt.reindex(pd.MultiIndex.from_frame(t[["persona", "track_id"]])).fillna(0).to_numpy()
    tot = gt.reindex(t["track_id"]).fillna(0).to_numpy()
    n, ns = tot[:, 0] - own[:, 0], tot[:, 1] - own[:, 1]
    t["grp_n_escuchas"] = n
    t["grp_tasa_no_salto"] = np.where(n > 0, ns / np.maximum(n, 1), np.nan)
    return t

def tasa_suave(ns, n, previa, k=5):
    return (ns + k * previa) / (n + k)

def codificar(filas, src):
    f = filas[["persona", "track_id", "artista", "album", "franja", "tipo_dia"]].copy()
    per = src.groupby("persona")[["n_escuchas", "n_no_salto"]].sum()
    f["per_tasa"] = f["persona"].map(per["n_no_salto"] / per["n_escuchas"])
    ctx = src.groupby(["persona", "franja", "tipo_dia"])[["n_escuchas", "n_no_salto"]].sum()
    f = f.join((ctx["n_no_salto"] / ctx["n_escuchas"]).rename("ctx_tasa"), on=["persona", "franja", "tipo_dia"])
    propia = src.groupby(["persona", "track_id"])[["n_escuchas", "n_no_salto"]].sum()
    f = f.join(propia.rename(columns=lambda c: "own_" + c), on=["persona", "track_id"])
    for nombre, claves in [("art", ["persona", "artista"]), ("alb", ["persona", "artista", "album"])]:
        g = src.groupby(claves)[["n_escuchas", "n_no_salto"]].sum()
        f = f.join(g.rename(columns=lambda c: f"{nombre}_{c}_tot"), on=claves)
        n = (f[f"{nombre}_n_escuchas_tot"].fillna(0) - f["own_n_escuchas"].fillna(0)).clip(lower=0)
        ns = (f[f"{nombre}_n_no_salto_tot"].fillna(0) - f["own_n_no_salto"].fillna(0)).clip(lower=0)
        f[f"{nombre}_n"] = np.log1p(n)
        f[f"{nombre}_tasa"] = tasa_suave(ns, n, f["per_tasa"])
        f[f"{nombre}_conocido"] = (n > 0).astype(int)
    return f

def matriz(filas, cod):
    X = pd.DataFrame({
        "per_tasa": cod["per_tasa"], "ctx_tasa": cod["ctx_tasa"].fillna(cod["per_tasa"]),
        "art_tasa": cod["art_tasa"], "art_n": cod["art_n"], "art_conocido": cod["art_conocido"],
        "alb_tasa": cod["alb_tasa"], "alb_n": cod["alb_n"], "alb_conocido": cod["alb_conocido"],
        "per_pct_shuffle": filas["per_pct_shuffle"].to_numpy(),
        "grp_n": np.log1p(filas["grp_n_escuchas"].clip(lower=0)).to_numpy(),
        "grp_tasa": filas["grp_tasa_no_salto"].fillna(cod["per_tasa"]).to_numpy(),
        "grp_conocido": filas["grp_tasa_no_salto"].notna().astype(int).to_numpy(),
        "fin_semana": (filas["tipo_dia"] != "laborable").astype(int).to_numpy(),
    }, index=filas.index)
    for f in range(6):
        X[f"franja_{f}"] = (filas["franja"].astype(int) == f).astype(int).to_numpy()
    return X

def variables_oof(filas, src, k=5):
    partes = []
    for tr, te in GroupKFold(k).split(filas, groups=filas["track_id"]):
        sub = src[~src["track_id"].isin(set(filas.iloc[te]["track_id"]))]
        partes.append(matriz(filas.iloc[te], codificar(filas.iloc[te], sub)))
    return pd.concat(partes).loc[filas.index]
