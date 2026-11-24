"""Lógica de la API, sin nada de HTTP: carga del modelo y de las tablas, objetivo 1 y objetivo 2.

Se puede usar y probar sin FastAPI:
    from api.servicio import Servicio
    s = Servicio.desde_carpeta("api/datos")
    s.predecir([{"persona": "ander", "track_id": "...", "franja": 3, "tipo_dia": "laborable"}])
"""
import json
import os
from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from api.caracteristicas import MIN_ESCUCHAS, NOMBRES_FRANJA, codificar, matriz

NOMBRE_REGISTRO = "playlist_tasa_no_salto"
TIPOS_DIA = ("laborable", "fin_semana")
SIN_HORARIO = "cualquiera"


class ErrorEntrada(ValueError):
    """Petición válida en forma pero imposible de atender (persona o canción desconocidas...)."""
    def __init__(self, mensaje: str, codigo: int = 422, detalle=None):
        super().__init__(mensaje)
        self.mensaje, self.codigo, self.detalle = mensaje, codigo, detalle


@dataclass
class Servicio:
    modelo: object
    columnas: list
    recuentos: pd.DataFrame
    catalogo: pd.DataFrame
    personas: pd.DataFrame
    info: dict = field(default_factory=dict)
    origen_modelo: str = "joblib"

    # ------------------------------------------------------------------ carga
    @classmethod
    def desde_carpeta(cls, carpeta, usar_mlflow: bool | None = None) -> "Servicio":
        carpeta = Path(carpeta)
        faltan = [f for f in ("modelo.joblib", "recuentos.csv.gz", "catalogo.csv.gz", "personas.csv") if not (carpeta / f).exists()]
        if faltan:
            raise FileNotFoundError(f"Faltan {', '.join(faltan)} en {carpeta}: ejecuta antes «python -m api.preparar_datos»")
        paquete = joblib.load(carpeta / "modelo.joblib")
        modelo, origen = paquete["modelo"], "joblib (api/datos/modelo.joblib)"
        info = dict(paquete.get("info", {}))
        if usar_mlflow is None:
            usar_mlflow = bool(os.environ.get("MLFLOW_TRACKING_URI"))
        if usar_mlflow:
            try:
                import mlflow
                modelo = mlflow.pyfunc.load_model(f"models:/{NOMBRE_REGISTRO}@produccion")
                version = mlflow.MlflowClient().get_model_version_by_alias(NOMBRE_REGISTRO, "produccion").version
                origen = f"MLflow ({NOMBRE_REGISTRO}, versión {version}, alias produccion)"
                info["version_mlflow"] = version
            except Exception as e:                      # sin servidor o sin el modelo: se sigue con el joblib
                info["aviso_mlflow"] = f"No se pudo cargar de MLflow ({type(e).__name__}); se usa el joblib."
        # keep_default_na=False: una canción o un artista que se llame «NA» o «null» no debe convertirse en vacío
        recuentos = pd.read_csv(carpeta / "recuentos.csv.gz", dtype={"track_id": str, "persona": str, "artista": str, "album": str},
                                keep_default_na=False)
        catalogo = pd.read_csv(carpeta / "catalogo.csv.gz", dtype={"track_id": str, "cancion": str, "artista": str, "album": str},
                               keep_default_na=False, na_values={"duracion_s": [""]}).set_index("track_id")
        personas = pd.read_csv(carpeta / "personas.csv", dtype={"persona": str}).set_index("persona")
        return cls(modelo, paquete["columnas"], recuentos, catalogo, personas, info, origen)

    def __post_init__(self):
        r = self.recuentos
        por_cancion = r.groupby(["persona", "track_id"])[["n_escuchas", "n_no_salto"]].sum()
        self._propio = por_cancion
        self._grupo = por_cancion.groupby("track_id").sum()
        self._ctx = r.set_index(["persona", "track_id", "franja", "tipo_dia"])[["n_escuchas", "n_no_salto"]]

    # ------------------------------------------------------------- utilidades
    def comprobar_personas(self, personas):
        desconocidas = [p for p in personas if p not in self.personas.index]
        if desconocidas:
            raise ErrorEntrada(f"Persona desconocida: {', '.join(desconocidas)}", 404,
                               {"personas_validas": self.personas.index.tolist()})

    def _filas(self, base: pd.DataFrame) -> pd.DataFrame:
        """Añade a (persona, track_id, artista, album, franja, tipo_dia) las variables de persona y grupo (como gold.sql)."""
        f = base.reset_index(drop=True).copy()
        f["per_pct_shuffle"] = f["persona"].map(self.personas["per_pct_shuffle"])
        own = self._propio.reindex(pd.MultiIndex.from_frame(f[["persona", "track_id"]])).fillna(0).to_numpy()
        tot = self._grupo.reindex(f["track_id"]).fillna(0).to_numpy()
        n, ns = tot[:, 0] - own[:, 0], tot[:, 1] - own[:, 1]
        f["grp_n_escuchas"] = n
        f["grp_tasa_no_salto"] = np.where(n > 0, ns / np.maximum(n, 1), np.nan)
        return f

    def _predecir_filas(self, f: pd.DataFrame) -> np.ndarray:
        X = matriz(f, codificar(f, self.recuentos))[self.columnas]
        return np.clip(np.asarray(self.modelo.predict(X), dtype=float).ravel(), 0, 1)

    def _real(self, f: pd.DataFrame):
        """Escuchas y tasa real de la persona con esa canción en ese contexto durante el periodo."""
        idx = pd.MultiIndex.from_frame(f[["persona", "track_id", "franja", "tipo_dia"]])
        r = self._ctx.reindex(idx).fillna(0)
        n = r["n_escuchas"].to_numpy()
        return n, np.where(n > 0, r["n_no_salto"].to_numpy() / np.maximum(n, 1), np.nan)

    # ------------------------------------------------------------- objetivo 1
    def predecir(self, peticiones: list[dict]) -> list[dict]:
        """Tasa de no salto prevista para cada (persona, canción, franja, tipo de día)."""
        self.comprobar_personas(sorted({p["persona"] for p in peticiones}))
        filas, errores = [], []
        for i, p in enumerate(peticiones):
            if p["track_id"] in self.catalogo.index:
                c = self.catalogo.loc[p["track_id"]]
                artista, album, cancion = c["artista"], c["album"], c["cancion"]
            elif p.get("artista"):
                artista, album, cancion = p["artista"], p.get("album") or "?", p.get("cancion") or "?"
            else:
                errores.append({"posicion": i, "track_id": p["track_id"],
                                "motivo": "canción fuera del catálogo: indica también «artista» (y si puedes «album»)"})
                continue
            filas.append({"posicion": i, "persona": p["persona"], "track_id": p["track_id"], "cancion": cancion,
                          "artista": artista, "album": album, "franja": int(p["franja"]), "tipo_dia": p["tipo_dia"]})
        if errores:
            raise ErrorEntrada("Hay canciones que no se pueden predecir", 404, errores)
        f = self._filas(pd.DataFrame(filas))
        f["prevista"] = self._predecir_filas(f)
        f["escuchas_contexto"], f["tasa_real_contexto"] = self._real(f)
        return [{"persona": str(r.persona), "track_id": str(r.track_id), "cancion": str(r.cancion), "artista": str(r.artista),
                 "franja": int(r.franja), "franja_horas": NOMBRES_FRANJA[int(r.franja)], "tipo_dia": str(r.tipo_dia),
                 "tasa_no_salto_prevista": round(float(r.prevista), 4),
                 "en_catalogo": bool(r.track_id in self.catalogo.index),
                 "escuchas_en_contexto": int(r.escuchas_contexto),
                 "tasa_real_en_contexto": None if np.isnan(r.tasa_real_contexto) else round(float(r.tasa_real_contexto), 4)}
                for r in f.itertuples()]

    # ------------------------------------------------------------- objetivo 2
    def gustos(self, personas: list[str], franja: int | None, tipo_dia: str | None) -> pd.DataFrame:
        """Gusto de cada miembro por cada canción del catálogo en el contexto (regla del notebook 03).

        Con franja y tipo_dia a None se ignora el horario: el gusto real sale de todas las escuchas de la
        persona con la canción y la predicción es la media de los 12 contextos."""
        self.comprobar_personas(personas)
        if (franja is None) != (tipo_dia is None):
            raise ErrorEntrada("Indica franja y tipo_dia, o ninguno de los dos para ignorar el horario")
        cat = self.catalogo.reset_index()
        base = pd.concat([cat.assign(persona=p) for p in personas], ignore_index=True)
        columnas = ["persona", "track_id", "artista", "album", "franja", "tipo_dia"]
        if franja is None:
            return self._gustos_sin_horario(base, columnas)
        base["franja"], base["tipo_dia"] = int(franja), tipo_dia
        f = self._filas(base[columnas])
        f["prevista"] = self._predecir_filas(f)
        f["escuchas_contexto"], f["tasa_real"] = self._real(f)
        return self._completar_gusto(f)

    def _gustos_sin_horario(self, base: pd.DataFrame, columnas: list) -> pd.DataFrame:
        contextos = pd.DataFrame([(fr, t) for t in TIPOS_DIA for fr in range(len(NOMBRES_FRANJA))], columns=["franja", "tipo_dia"])
        todas = self._filas(base.merge(contextos, how="cross")[columnas])
        todas["prevista"] = self._predecir_filas(todas)
        f = todas.groupby(["persona", "track_id"], sort=False, as_index=False).agg(
            artista=("artista", "first"), album=("album", "first"), prevista=("prevista", "mean"))
        r = self._propio.reindex(pd.MultiIndex.from_frame(f[["persona", "track_id"]])).fillna(0)
        n = r["n_escuchas"].to_numpy()
        f["escuchas_contexto"] = n
        f["tasa_real"] = np.where(n > 0, r["n_no_salto"].to_numpy() / np.maximum(n, 1), np.nan)
        return self._completar_gusto(f)

    @staticmethod
    def _completar_gusto(f: pd.DataFrame) -> pd.DataFrame:
        fiable = f["escuchas_contexto"] >= MIN_ESCUCHAS
        f["gusto"] = np.where(fiable, f["tasa_real"], f["prevista"])          # real si hay 5 o más escuchas
        f["origen"] = np.where(fiable, "real", "prevista")
        f["percentil"] = f.groupby("persona")["gusto"].rank(pct=True)
        return f

    def playlist(self, personas: list[str], franja: int | None, tipo_dia: str | None, n: int | None = 50,
                 duracion_min: float | None = None, excluir_artistas=()) -> dict:
        """Playlist del grupo: mínimo de los percentiles de los miembros, desempate por la media.

        Sin horario (franja y tipo_dia a None) van primero las canciones con gusto real de todos los
        miembros y después las que dependen de alguna predicción."""
        if len(set(personas)) != len(personas):
            raise ErrorEntrada("Hay personas repetidas en el grupo")
        sin_horario = franja is None
        f = self.gustos(personas, franja, tipo_dia)
        f["es_real"] = f["origen"].eq("real")
        g = (f.groupby("track_id")
              .agg(gusto_grupo=("percentil", "min"), desempate=("percentil", "mean"), conocida_por_todos=("es_real", "all"))
              .join(self.catalogo[["cancion", "artista", "duracion_s"]]))
        if excluir_artistas:
            fuera = {a.casefold() for a in excluir_artistas}
            g = g[~g["artista"].str.casefold().isin(fuera)]
        orden = (["conocida_por_todos"] if sin_horario else []) + ["gusto_grupo", "desempate"]
        g = g.sort_values(orden, ascending=False)
        if duracion_min:
            acumulado = g["duracion_s"].fillna(g["duracion_s"].median()).cumsum()
            g = g[acumulado.shift(fill_value=0) < duracion_min * 60]
        if n:
            g = g.head(n)
        por = f.set_index(["track_id", "persona"])
        canciones = []
        for pos, (tid, r) in enumerate(g.iterrows(), start=1):
            miembros = {p: {"gusto": round(float(por.loc[(tid, p), "gusto"]), 4),
                            "percentil": round(float(por.loc[(tid, p), "percentil"]), 4),
                            "origen": str(por.loc[(tid, p), "origen"])} for p in personas}
            canciones.append({"posicion": pos, "track_id": str(tid), "cancion": str(r["cancion"]), "artista": str(r["artista"]),
                              "duracion_s": None if pd.isna(r["duracion_s"]) else int(r["duracion_s"]),
                              "gusto_grupo": round(float(r["gusto_grupo"]), 4),
                              "desempate": round(float(r["desempate"]), 4),
                              "conocida_por_todos": bool(r["conocida_por_todos"]), "miembros": miembros})
        total = sum(c["duracion_s"] or 0 for c in canciones)
        regla = "percentil del gusto de cada miembro; gusto del grupo = mínimo; empates por la media"
        if sin_horario:
            regla = "sin horario: primero las canciones con gusto real de todos; después, " + regla
        return {"personas": personas, "franja": None if sin_horario else int(franja),
                "franja_horas": SIN_HORARIO if sin_horario else NOMBRES_FRANJA[int(franja)],
                "tipo_dia": SIN_HORARIO if sin_horario else tipo_dia, "regla": regla,
                "n_canciones": len(canciones), "duracion_total_min": round(total / 60, 1), "canciones": canciones}

    # ------------------------------------------------------------- información
    def artistas(self) -> list[str]:
        """Artistas distintos del catálogo (una sola grafía por nombre, la más frecuente), sin vacíos y ordenados sin distinguir mayúsculas."""
        a = self.catalogo["artista"].dropna().astype(str).str.strip()
        elegidos: dict[str, str] = {}
        for nombre in a[a != ""].value_counts(sort=True).index:  # de más a menos frecuente; en empate, primero en aparecer
            elegidos.setdefault(nombre.casefold(), nombre)
        return sorted(elegidos.values(), key=str.casefold)

    def descripcion(self) -> dict:
        return {"origen_modelo": self.origen_modelo, "registro_mlflow": f"{NOMBRE_REGISTRO}@produccion",
                **{k: v for k, v in self.info.items() if k != "columnas"},
                "variables": self.columnas}


def contexto_de_fecha(fecha) -> tuple[int, str]:
    """Franja (0-5) y tipo de día de una fecha y hora en la zona de Madrid."""
    t = pd.Timestamp(fecha)
    t = t.tz_localize("Europe/Madrid") if t.tzinfo is None else t.tz_convert("Europe/Madrid")
    return t.hour // 4, ("fin_semana" if t.dayofweek >= 5 else "laborable")
