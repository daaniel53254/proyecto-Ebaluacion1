"""Carga de datos y cálculos del panel v1.

Lee los CSV que exporta `bigdata/pipeline.sh` en `data/dataset/` y el último log del pipeline
en `docs/evidencias/`. No depende de Streamlit, así que se puede probar desde un notebook o
con `python -m panel.datos`.
"""

from __future__ import annotations

import re
from pathlib import Path

import numpy as np
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


# ------------------------------------------------------------------------- recomendador
#
# Sigue la sección 4 del notebook 03 de Ander (celdas 16 y 17):
#   gusto de cada miembro = tasa real del lote 1 si tiene 5 o más escuchas en ese contexto;
#   si no, la que predice el mejor modelo del objetivo 1. Se pasa a percentil dentro de las
#   candidatas de esa persona en ese contexto. Gusto del grupo = mínimo de los percentiles;
#   empates por la media. Referencia = las más escuchadas del grupo en el lote 1.
# El notebook guarda los gustos en data/dataset/recomendador_gustos.csv; el panel no entrena nada.

ARCHIVO_GUSTOS = "recomendador_gustos.csv"
COLS_GUSTOS = ["persona", "track_id", "franja", "tipo_dia", "gusto", "origen", "percentil"]
CONTEXTO = ["franja", "tipo_dia"]


def cargar_gustos() -> pd.DataFrame | None:
    """Gustos del recomendador que guarda el notebook 03, o None si todavía no está el CSV."""
    ruta = DIR_DATOS / ARCHIVO_GUSTOS
    if not ruta.exists():
        return None
    g = pd.read_csv(ruta, encoding="utf-8-sig")
    faltan = set(COLS_GUSTOS) - set(g.columns)
    if faltan:
        raise ValueError(f"A {ARCHIVO_GUSTOS} le faltan columnas: {sorted(faltan)}")
    return g[COLS_GUSTOS]


def gustos_aproximados(candidatas: pd.DataFrame) -> pd.DataFrame:
    """Sustituto mientras no esté el CSV del notebook 03: misma regla, pero sin modelo.

    Donde el notebook usa la predicción de Ridge, aquí va la tasa de la persona en ese contexto,
    que es igual para todas sus canciones sin dato (empatan en el percentil)."""
    c = candidatas[["persona", "track_id", "franja", "tipo_dia", "tasa_real_lote1",
                    "per_tasa_no_salto_ctx"]].copy()
    c["gusto"] = c["tasa_real_lote1"].fillna(c["per_tasa_no_salto_ctx"])
    c["origen"] = np.where(c["tasa_real_lote1"].notna(), "real", "aproximada")
    c["percentil"] = c.groupby(["persona", *CONTEXTO])["gusto"].rank(pct=True)
    return c[COLS_GUSTOS]


def listas_contexto(gustos: pd.DataFrame, candidatas: pd.DataFrame, franja: int, tipo_dia: str,
                    personas: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Lista del sistema y lista de referencia (más escuchadas), completas y ordenadas."""
    g = gustos[(gustos["franja"] == franja) & (gustos["tipo_dia"] == tipo_dia)
               & gustos["persona"].isin(personas)]
    c = candidatas[(candidatas["franja"] == franja) & (candidatas["tipo_dia"] == tipo_dia)
                   & candidatas["persona"].isin(personas)]

    # «percentil» del CSV vale para el grupo completo: las candidatas son las canciones que
    # escuchó alguien del grupo en el lote 1. Con solo algunos miembros, las candidatas son las que
    # escucharon ellos y el percentil se recalcula con «gusto» sobre ese conjunto (nota de Ander).
    if set(personas) != set(gustos["persona"].unique()):
        oidas = candidatas.loc[candidatas["persona"].isin(personas) & (candidatas["conocida"] == 1),
                               "track_id"].unique()
        g = g[g["track_id"].isin(oidas)].copy()
        g["percentil"] = g.groupby("persona")["gusto"].rank(pct=True)
        c = c[c["track_id"].isin(oidas)]

    grupo = g.groupby("track_id").agg(gusto_grupo=("percentil", "min"),
                                      desempate=("percentil", "mean"))
    info = c.groupby("track_id").agg(cancion=("cancion", "first"), artista=("artista", "first"),
                                     duracion_ms=("duracion_ms", "first"),
                                     escuchas_grupo_l1=("n_lote1", "sum"))
    pct = g.pivot_table(index="track_id", columns="persona", values="percentil", aggfunc="first")
    pct.columns = [f"percentil_{p}" for p in pct.columns]
    org = g.pivot_table(index="track_id", columns="persona", values="origen", aggfunc="first")
    org.columns = [f"origen_{p}" for p in org.columns]
    t = info.join(grupo, how="inner").join(pct).join(org)   # índice ordenado por track_id

    mediana = candidatas.drop_duplicates("track_id")["duracion_ms"].median()
    t["duracion_imputada"] = t["duracion_ms"].isna()
    t["duracion_ms"] = t["duracion_ms"].fillna(mediana if pd.notna(mediana) else DURACION_DEFECTO_MS)

    # Orden estable, como el sort_values de varias columnas del notebook: los empates quedan
    # por track_id.
    sistema = t.sort_values(["gusto_grupo", "desempate"], ascending=False, kind="stable")
    referencia = t.sort_values("escuchas_grupo_l1", ascending=False, kind="stable")
    return sistema.reset_index(), referencia.reset_index()


def cortar(lista: pd.DataFrame, n: int | None = None, minutos: int | None = None) -> pd.DataFrame:
    """Primeras N canciones, o las que caben en la duración del viaje."""
    if minutos is not None:
        return lista[lista["duracion_ms"].cumsum() <= minutos * 60_000]
    return lista.head(n)


def ndcg(relevancias) -> float:
    """NDCG de una lista ya ordenada; relevancia = tasa real de no salto (0-1). Igual que el 03."""
    rel = np.asarray(relevancias, dtype=float)
    if len(rel) == 0 or rel.max() == 0:
        return np.nan
    desc = 1 / np.log2(np.arange(2, len(rel) + 2))
    return float((rel * desc).sum() / (np.sort(rel)[::-1] * desc).sum())


def evaluar(lista: pd.DataFrame, candidatas: pd.DataFrame, franja: int, tipo_dia: str,
            personas: list[str]) -> pd.DataFrame:
    """Una fila por persona: tasa de salto real en el lote 2 (ponderada por escuchas), NDCG y
    cuántas canciones de la lista se pudieron evaluar (5 o más escuchas en el lote 2)."""
    real2 = candidatas[(candidatas["franja"] == franja) & (candidatas["tipo_dia"] == tipo_dia)
                       & candidatas["persona"].isin(personas) & candidatas["tasa_real_lote2"].notna()]
    top = lista[["track_id"]].assign(posicion=np.arange(len(lista)))
    ev = top.merge(real2[["persona", "track_id", "n_lote2", "tasa_real_lote2"]], on="track_id")
    filas = []
    for p in personas:
        e = ev[ev["persona"] == p].sort_values("posicion")
        filas.append({
            "persona": p, "canciones_evaluadas": len(e),
            "tasa_salto": (1 - np.average(e["tasa_real_lote2"], weights=e["n_lote2"])) if len(e) else np.nan,
            "ndcg": ndcg(e["tasa_real_lote2"]) if len(e) else np.nan,
        })
    return pd.DataFrame(filas)


def evaluar_todos(gustos: pd.DataFrame, candidatas: pd.DataFrame, personas: list[str],
                  n: int | None = None, minutos: int | None = None) -> pd.DataFrame:
    """Las dos listas en los 12 contextos, agregadas como en el notebook 03: media de cada persona
    sobre los contextos en los que tiene canciones evaluadas y después media de las personas."""
    filas = []
    for (f, t) in candidatas[CONTEXTO].drop_duplicates().itertuples(index=False):
        sistema, referencia = listas_contexto(gustos, candidatas, f, t, personas)
        for nombre, lista in [("Sistema", sistema), ("Más escuchadas", referencia)]:
            r = evaluar(cortar(lista, n, minutos), candidatas, f, t, personas)
            filas.append(r[r["canciones_evaluadas"] > 0].assign(lista=nombre, franja=f, tipo_dia=t))
    r = pd.concat(filas, ignore_index=True)
    por_persona = r.groupby(["lista", "persona"])[["tasa_salto", "ndcg", "canciones_evaluadas"]].mean()
    resumen = por_persona.groupby("lista").mean()
    resumen = resumen.join(por_persona["tasa_salto"].unstack("persona").add_prefix("tasa_salto_"))
    return resumen.loc[["Sistema", "Más escuchadas"]]


# ------------------------------------------------------------------- modelo de la API
#
# La API de Ander (`api/`) entrena el modelo de producción del notebook 05 (GB absoluto con los
# últimos 18 meses) con `python -m api.preparar_datos` y lo deja con sus tablas en una carpeta.
# El panel carga esa carpeta con la misma clase `Servicio` que usa la API, así que da lo mismo que
# `POST /objetivo2/playlist` sin tener que arrancar el servidor. Dos carpetas:
#   api/datos/                       producción: últimos 18 meses hasta la última escucha
#   data/dataset/modelo_api_lote1/   mismo modelo entrenado hasta el 30/06/2025 (la versión de
#                                    MLflow), para poder evaluarlo con el lote 2 sin hacer trampa

DIR_API_PRODUCCION = RAIZ / "api" / "datos"
DIR_API_LOTE1 = DIR_DATOS / "modelo_api_lote1"
FICHEROS_API = ("modelo.joblib", "recuentos.csv.gz", "catalogo.csv.gz", "personas.csv")


def hay_modelo_api(carpeta: Path) -> bool:
    return all((carpeta / f).exists() for f in FICHEROS_API)


def cargar_servicio(carpeta: Path):
    """Servicio de la API (modelo + tablas) leído de la carpeta, sin MLflow ni servidor HTTP."""
    import sys
    if str(RAIZ) not in sys.path:
        sys.path.insert(0, str(RAIZ))
    from api.servicio import Servicio
    return Servicio.desde_carpeta(carpeta, usar_mlflow=False)


def seudonimos(nombres) -> dict[str, str]:
    """Nombre de carpeta → seudónimo, con la misma función que usa preparar.py para HDFS."""
    import sys
    if str(RAIZ) not in sys.path:
        sys.path.insert(0, str(RAIZ))
    from bigdata.preparar import seudonimo
    return {n: seudonimo(n) for n in nombres}


def gustos_desde_api(servicio, candidatas: pd.DataFrame) -> pd.DataFrame:
    """Gustos con la regla del notebook 03, cambiando solo el modelo: tasa real del lote 1 si hay
    5 o más escuchas y, si no, la predicción del modelo de la API. Mismo formato que el CSV del 03."""
    nombre = {v: k for k, v in seudonimos(servicio.personas.index).items()}   # seudónimo → nombre
    c = candidatas[candidatas["persona"].isin(nombre)].reset_index(drop=True)
    base = c[["persona", "track_id", "artista", "album", "franja", "tipo_dia"]].copy()
    base["persona"] = base["persona"].map(nombre)
    base[["artista", "album"]] = base[["artista", "album"]].fillna("?")
    prevista = servicio.prever_gusto(base)       # mismo cálculo que la API (variables de persona y grupo)
    g = c[["persona", "track_id", "franja", "tipo_dia"]].copy()
    real = c["tasa_real_lote1"]
    g["gusto"] = real.fillna(pd.Series(prevista, index=c.index))
    g["origen"] = np.where(real.notna(), "real", "prevista")
    g["percentil"] = g.groupby(["persona", *CONTEXTO])["gusto"].rank(pct=True)
    return g[COLS_GUSTOS]


def playlist_api(servicio, personas: list[str], franja: int, tipo_dia: str, n: int | None = None,
                 minutos: int | None = None, excluir_artistas=(), historial: str = "18_meses") -> tuple[pd.DataFrame, dict]:
    """Playlist del grupo con el modelo de la API. `personas` van con seudónimo; la tabla vuelve
    con seudónimos y una columna de percentil y de origen por miembro."""
    a_seud = seudonimos(servicio.personas.index)
    nombre = {v: k for k, v in a_seud.items()}
    r = servicio.playlist([nombre[p] for p in personas], franja, tipo_dia, n=n, duracion_min=minutos,
                          excluir_artistas=list(excluir_artistas), historial=historial)
    filas = []
    for c in r["canciones"]:
        fila = {k: c[k] for k in ("posicion", "track_id", "cancion", "artista", "duracion_s",
                                  "gusto_grupo", "desempate")}
        for nom, m in c["miembros"].items():
            fila[f"percentil_{a_seud[nom]}"] = m["percentil"]
            fila[f"gusto_{a_seud[nom]}"] = m["gusto"]
            fila[f"origen_{a_seud[nom]}"] = m["origen"]
        filas.append(fila)
    return pd.DataFrame(filas), {k: v for k, v in r.items() if k != "canciones"}


def mapa_gustos_api(servicio, personas: list[str], franja: int, tipo_dia: str, historial: str = "18_meses") -> pd.DataFrame:
    """Percentil de cada miembro (con seudónimo) para todas las candidatas del contexto: una fila por
    canción, para dibujar dónde cae la playlist respecto al resto."""
    a_seud = seudonimos(servicio.personas.index)
    nombre = {v: k for k, v in a_seud.items()}
    g = servicio.gustos([nombre[p] for p in personas], franja, tipo_dia, historial)
    t = g.pivot_table(index="track_id", columns="persona", values="percentil", aggfunc="first")
    t.columns = [f"percentil_{a_seud[c]}" for c in t.columns]
    catalogo = servicio.catalogo_completo if historial == "completo" else servicio.catalogo
    return t.join(catalogo[["cancion", "artista"]]).reset_index()


if __name__ == "__main__":
    log = ultimo_log()
    print("Último log:", log)
    cand = cargar_candidatas()
    gustos = cargar_gustos()
    print("Gustos:", "notebook 03" if gustos is not None else "aproximados (falta el CSV)")
    if gustos is None:
        gustos = gustos_aproximados(cand)
    personas = sorted(cand["persona"].unique())
    for n in (20, 50, 100):
        print(f"\nN = {n}")
        print(evaluar_todos(gustos, cand, personas, n=n).round(3).to_string())
