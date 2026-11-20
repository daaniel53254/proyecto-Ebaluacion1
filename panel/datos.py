"""Carga de datos y cálculos del panel v1.

Lee los CSV que exporta `bigdata/pipeline.sh` en `data/dataset/` y el último log del pipeline
en `docs/evidencias/`. No depende de Streamlit, así que se puede probar desde un notebook o
con `python -m panel.datos`.
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
DIR_DATOS = RAIZ / "data" / "dataset"
DIR_EVIDENCIAS = RAIZ / "docs" / "evidencias"

FRANJAS = {0: "00-04", 1: "04-08", 2: "08-12", 3: "12-16", 4: "16-20", 5: "20-24"}
TIPOS_DIA = {"laborable": "Laborable", "fin_semana": "Fin de semana"}
DIAS = {1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom"}
CLASES = ["completa", "interrumpida", "salto_tardio", "vuelve_atras", "salto_rapido"]
DURACION_DEFECTO_MS = 180_000  # unos 3 minutos si no hay ninguna duración conocida

COLS_SILVER = [
    "fecha", "hora", "dia_semana", "franja", "tipo_dia", "lote", "track_id", "cancion",
    "artista", "ms_played", "plataforma", "shuffle", "clase", "no_salto", "persona",
]


def leer_csv(nombre: str, **kwargs) -> pd.DataFrame:
    ruta = DIR_DATOS / nombre
    if not ruta.exists():
        raise FileNotFoundError(
            f"No encuentro {ruta}. Ejecuta `bash bigdata/pipeline.sh` o copia los CSV de Drive "
            "en data/dataset/."
        )
    return pd.read_csv(ruta, encoding="utf-8-sig", **kwargs)


def cargar_silver() -> pd.DataFrame:
    df = leer_csv(
        "spotify_reproducciones.csv",
        usecols=COLS_SILVER,
        dtype={"persona": "category", "plataforma": "category", "tipo_dia": "category",
               "clase": "category"},
    )
    df["fecha"] = pd.to_datetime(df["fecha"])
    df["anio"] = df["fecha"].dt.year
    df["shuffle"] = df["shuffle"].astype(str).str.lower().eq("true")
    return df


def cargar_objetivo1() -> pd.DataFrame:
    return leer_csv("gold_objetivo1.csv")


def cargar_candidatas() -> pd.DataFrame:
    return leer_csv("gold_candidatas.csv")


# --------------------------------------------------------------------------- hábitos


def resumen_persona(silver: pd.DataFrame) -> pd.DataFrame:
    """Una fila por persona con las cifras de cabecera."""
    g = silver.groupby("persona", observed=True)
    return pd.DataFrame({
        "escuchas": g.size(),
        "horas": g["ms_played"].sum() / 3_600_000,
        "canciones": g["track_id"].nunique(),
        "artistas": g["artista"].nunique(),
        "tasa_no_salto": g["no_salto"].mean(),
        "pct_shuffle": g["shuffle"].mean(),
        "desde": g["fecha"].min(),
        "hasta": g["fecha"].max(),
    }).reset_index()


def reparto(silver: pd.DataFrame, columna: str) -> pd.DataFrame:
    """Proporción de escuchas de cada persona según `columna` (suma 1 por persona)."""
    t = silver.groupby(["persona", columna], observed=True).size().rename("escuchas").reset_index()
    t["proporcion"] = t["escuchas"] / t.groupby("persona", observed=True)["escuchas"].transform("sum")
    return t


def top_artistas(silver: pd.DataFrame, persona: str, n: int = 10) -> pd.DataFrame:
    d = silver[silver["persona"] == persona]
    t = (d.groupby("artista")
         .agg(escuchas=("track_id", "size"), horas=("ms_played", "sum"),
              tasa_no_salto=("no_salto", "mean"))
         .sort_values("escuchas", ascending=False).head(n).reset_index())
    t["horas"] = t["horas"] / 3_600_000
    return t


# --------------------------------------------------------------------- calidad de datos


def ultimo_log() -> Path | None:
    logs = sorted(DIR_EVIDENCIAS.glob("pipeline_*.log"))
    # El nombre lleva la fecha y hora, así que el orden alfabético es el cronológico.
    for ruta in reversed(logs):
        if "Pipeline completado" in ruta.read_text(encoding="utf-8", errors="replace"):
            return ruta
    return None


_RE_PROBLEMA = re.compile(r"^\s+(\d+)_(\S+)\s+(\d+)\s+->\s+(\d+)\s*$")
_RE_ENSUCIADO = re.compile(r"^\s*(\d+) (.+?)\s+(\d+)%\s+(\d+)\s+(\d+)\s*$")


def calidad_desde_log(ruta: Path) -> dict:
    """Saca del log del pipeline las cifras de ensuciado, bronze y silver."""
    texto = ruta.read_text(encoding="utf-8", errors="replace")
    lineas = texto.splitlines()

    ensuciado = []
    for linea in lineas:
        m = _RE_ENSUCIADO.match(linea)
        if m:
            ensuciado.append({"n": int(m[1]), "problema": m[2].strip(), "pct": int(m[3]),
                              "tocadas": int(m[4]) + int(m[5])})

    problemas, dentro = [], False
    for linea in lineas:
        if linea.startswith("Problemas del ensuciado"):
            dentro = True
            continue
        if dentro:
            m = _RE_PROBLEMA.match(linea)
            if not m:
                break
            problemas.append({"n": int(m[1]), "regla": m[2].replace("_", " "),
                              "bronze": int(m[3]), "silver": int(m[4])})

    def numero(patron: str) -> int | None:
        m = re.search(patron, texto)
        return int(m[1]) if m else None

    return {
        "log": ruta.name,
        "filas_origen": numero(r"Total: (\d+) filas"),
        "filas_bronze": numero(r"\[OK\] bronze\.historial: (\d+) filas"),
        "filas_silver": numero(r"\[OK\] silver\.reproducciones: (\d+) filas"),
        "filas_gold": numero(r"gold\.objetivo1:\s+(\d+) filas"),
        "filas_candidatas": numero(r"gold\.candidatas: (\d+) filas"),
        "ensuciado": pd.DataFrame(ensuciado),
        "problemas": pd.DataFrame(problemas),
    }


# ------------------------------------------------------------- no salto por contexto


def tasa_por_contexto(objetivo1: pd.DataFrame, lote: int | None = 1) -> pd.DataFrame:
    """Tasa de no salto por persona, franja y tipo de día, sumando escuchas (no promediando tasas)."""
    d = objetivo1 if lote is None else objetivo1[objetivo1["lote"] == lote]
    t = (d.groupby(["persona", "franja", "tipo_dia"])[["n_escuchas", "n_no_salto"]]
         .sum().reset_index())
    t["tasa_no_salto"] = t["n_no_salto"] / t["n_escuchas"]
    return t


# ------------------------------------------------------------------ playlist de ejemplo


def playlist_ejemplo(
    candidatas: pd.DataFrame,
    franja: int,
    tipo_dia: str,
    minutos: int = 60,
    umbral: float = 0.9,
    max_por_artista: int = 2,
    solo_con_dato: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """Regla de ejemplo para el recomendador (no es el modelo de IA).

    Gusto de cada persona por una canción en el contexto elegido:
      - la tasa real del lote 1 si la escuchó ahí al menos 5 veces;
      - si no, su tasa total en ese contexto (`per_tasa_no_salto_ctx`), es decir, «lo normal en ella».
    Se normaliza dividiendo por `per_tasa_media` (ver diccionario, sección 6) y la canción vale
    el mínimo entre personas: entra si nadie la va a saltar más de lo que suele.
    """
    d = candidatas[(candidatas["franja"] == franja) & (candidatas["tipo_dia"] == tipo_dia)].copy()
    d["con_dato"] = d["tasa_real_lote1"].notna()
    d["gusto"] = d["tasa_real_lote1"].fillna(d["per_tasa_no_salto_ctx"])
    d["gusto_norm"] = d["gusto"] / d["per_tasa_media"]

    personas = sorted(d["persona"].unique())
    ancho = d.pivot_table(index="track_id", columns="persona", values="gusto_norm", aggfunc="first")
    ancho = ancho.reindex(columns=personas)
    info = (d.groupby("track_id")
            .agg(cancion=("cancion", "first"), artista=("artista", "first"),
                 duracion_ms=("duracion_ms", "first"), con_dato=("con_dato", "sum"),
                 escuchas_lote1=("n_lote1", "sum"), conocida=("conocida", "sum")))
    ancho.columns = [f"gusto_{p}" for p in ancho.columns]
    t = info.join(ancho)
    gustos = t[[f"gusto_{p}" for p in personas]]
    t["puntuacion"] = gustos.min(axis=1)
    # Desempate: si a alguien le falta dato su gusto es una constante y muchas canciones empatan
    # en el mínimo; entonces manda la media del grupo.
    t["media_grupo"] = gustos.mean(axis=1)

    if solo_con_dato:
        t = t[t["con_dato"] > 0]
    t = t[t["puntuacion"] >= umbral]
    t = t.sort_values(["puntuacion", "media_grupo", "escuchas_lote1"], ascending=False)
    if max_por_artista:
        t = t[t.groupby("artista").cumcount() < max_por_artista]

    mediana = candidatas.drop_duplicates("track_id")["duracion_ms"].median()
    t["duracion_imputada"] = t["duracion_ms"].isna()
    t["duracion_ms"] = t["duracion_ms"].fillna(mediana if pd.notna(mediana) else DURACION_DEFECTO_MS)
    acumulado = t["duracion_ms"].cumsum()
    lista = t[acumulado <= minutos * 60_000].reset_index()

    # Evaluación con el lote 2: solo se mira, nunca se usa para elegir.
    ev = d[d["track_id"].isin(lista["track_id"])]
    ev2 = ev[ev["tasa_real_lote2"].notna()]
    evaluacion = {
        "canciones": len(lista),
        "minutos": lista["duracion_ms"].sum() / 60_000,
        "candidatas_contexto": d["track_id"].nunique(),
        "pasan_umbral": len(t),
        "por_persona": {
            p: {
                "con_lote2": int((ev2["persona"] == p).sum()),
                "tasa_lote2": ev2.loc[ev2["persona"] == p, "tasa_real_lote2"].mean(),
                "media_persona": d.loc[d["persona"] == p, "per_tasa_media"].iloc[0],
            }
            for p in personas
        },
    }
    return lista, evaluacion


if __name__ == "__main__":
    log = ultimo_log()
    print("Último log:", log)
    if log:
        c = calidad_desde_log(log)
        print({k: v for k, v in c.items() if not isinstance(v, pd.DataFrame)})
        print(c["problemas"])
    cand = cargar_candidatas()
    lista, ev = playlist_ejemplo(cand, franja=4, tipo_dia="fin_semana", minutos=90)
    print(lista[["cancion", "artista", "puntuacion"]].head(15))
    print(ev)
