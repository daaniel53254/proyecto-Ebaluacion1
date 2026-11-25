"""Lógica de la API, sin nada de HTTP: carga del modelo y de las tablas, objetivo 1 y objetivo 2.

Se puede usar y probar sin FastAPI:
    from api.servicio import Servicio
    s = Servicio.desde_carpeta("api/datos")
    s.predecir([{"persona": "ander", "track_id": "...", "franja": 3, "tipo_dia": "laborable"}])
"""
import json
import os
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from api.caracteristicas import MIN_ESCUCHAS, NOMBRES_FRANJA, codificar, matriz

NOMBRE_REGISTRO = "playlist_tasa_no_salto"
TIPOS_DIA = ("laborable", "fin_semana")
SIN_HORARIO = "cualquiera"
HISTORIALES = ("18_meses", "completo")
MIN_ESCUCHAS_CANDIDATA = 3   # historial completo: candidatas con 3 o más escuchas del grupo (sin las que sonaron de pasada)
K_SUAVIZADO = 5              # historial completo: escuchas reales que pesan lo mismo que la predicción
FRACCION_REPARTO = 1 / 3     # historial completo: cada miembro conoce al menos 1/3 de cualquier tramo inicial de la lista


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
    recuentos_completo: pd.DataFrame | None = None
    catalogo_completo: pd.DataFrame | None = None

    # ------------------------------------------------------------------ carga
    @classmethod
    def desde_carpeta(cls, carpeta, usar_mlflow: bool | None = None) -> "Servicio":
        carpeta = Path(carpeta)
        faltan = [f for f in ("modelo.joblib", "recuentos.csv.gz", "catalogo.csv.gz", "personas.csv") if not (carpeta / f).exists()]
        if faltan:
            raise FileNotFoundError(f"Faltan {', '.join(faltan)} en {carpeta}: ejecuta antes «python -m api.preparar_datos»")
        paquete = joblib.load(carpeta / "modelo.joblib")
        ruta = (carpeta / "modelo.joblib").resolve()
        try:
            ruta = ruta.relative_to(Path.cwd().resolve())
        except ValueError:                              # fuera de la carpeta actual: ruta completa
            pass
        modelo, origen = paquete["modelo"], f"joblib ({ruta.as_posix()})"
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
        rec_c = cat_c = None
        if (carpeta / "recuentos_completo.csv.gz").exists() and (carpeta / "catalogo_completo.csv.gz").exists():
            rec_c = pd.read_csv(carpeta / "recuentos_completo.csv.gz",
                                dtype={"track_id": str, "persona": str, "artista": str, "album": str}, keep_default_na=False)
            cat_c = pd.read_csv(carpeta / "catalogo_completo.csv.gz",
                                dtype={"track_id": str, "cancion": str, "artista": str, "album": str},
                                keep_default_na=False, na_values={"duracion_s": [""]}).set_index("track_id")
        return cls(modelo, paquete["columnas"], recuentos, catalogo, personas, info, origen, rec_c, cat_c)

    def __post_init__(self):
        r = self.recuentos
        por_cancion = r.groupby(["persona", "track_id"])[["n_escuchas", "n_no_salto"]].sum()
        self._propio = por_cancion
        self._grupo = por_cancion.groupby("track_id").sum()
        self._ctx = r.set_index(["persona", "track_id", "franja", "tipo_dia"])[["n_escuchas", "n_no_salto"]]
        if self.recuentos_completo is not None:
            rc = self.recuentos_completo
            self._propio_completo = rc.groupby(["persona", "track_id"])[["n_escuchas", "n_no_salto"]].sum()
            self._ctx_completo = rc.set_index(["persona", "track_id", "franja", "tipo_dia"])[["n_escuchas", "n_no_salto"]]

    def _tablas(self, historial: str):
        """(catálogo de candidatas, escuchas por contexto, escuchas por canción) del historial pedido."""
        if historial not in HISTORIALES:
            raise ErrorEntrada(f"«historial» tiene que ser uno de: {', '.join(HISTORIALES)}")
        if historial == "18_meses":
            return self.catalogo, self._ctx, self._propio
        if self.recuentos_completo is None:
            raise ErrorEntrada("Los datos de la API no incluyen el historial completo: vuelve a ejecutar "
                               "«python -m api.preparar_datos» (o POST /preparacion)", 409)
        cat = self.catalogo_completo[self.catalogo_completo["escuchas_grupo"] >= MIN_ESCUCHAS_CANDIDATA]
        return cat, self._ctx_completo, self._propio_completo

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
    def gustos(self, personas: list[str], franja: int | list[int] | None, tipo_dia: str | None,
               historial: str = "18_meses") -> pd.DataFrame:
        """Gusto de cada miembro por cada canción candidata en el contexto.

        historial="18_meses" (regla del notebook 03): candidatas de los últimos 18 meses; gusto = tasa real si la
        persona tiene 5 o más escuchas en el contexto, si no, la prevista por el modelo.
        historial="completo": candidatas de todo el historial (3 o más escuchas del grupo) y gusto suavizado,
        (no saltos reales + 5 × prevista) / (escuchas reales + 5), con las escuchas de toda la vida.

        Con franja y tipo_dia a None se ignora el horario: el gusto real sale de todas las escuchas de la
        persona con la canción y la predicción es la media de los 12 contextos. Con una lista de franjas (p. ej.
        [1, 2] para la mañana) se suman las escuchas de esas franjas en ese tipo de día y la predicción es su media."""
        self.comprobar_personas(personas)
        if (franja is None) != (tipo_dia is None):
            raise ErrorEntrada("Indica franja y tipo_dia, o ninguno de los dos para ignorar el horario")
        catalogo, ctx, propio = self._tablas(historial)
        cat = catalogo.reset_index()
        base = pd.concat([cat.assign(persona=p) for p in personas], ignore_index=True)
        columnas = ["persona", "track_id", "artista", "album", "franja", "tipo_dia"]
        franjas = _lista_franjas(franja)
        if franja is None:
            contextos = pd.DataFrame([(fr, t) for t in TIPOS_DIA for fr in range(len(NOMBRES_FRANJA))], columns=["franja", "tipo_dia"])
            todas = self._filas(base.merge(contextos, how="cross")[columnas])
            todas["prevista"] = self._predecir_filas(todas)
            f = todas.groupby(["persona", "track_id"], sort=False, as_index=False).agg(
                artista=("artista", "first"), album=("album", "first"), prevista=("prevista", "mean"))
            r = propio.reindex(pd.MultiIndex.from_frame(f[["persona", "track_id"]])).fillna(0)
        elif len(franjas) > 1:
            contextos = pd.DataFrame([(fr, tipo_dia) for fr in franjas], columns=["franja", "tipo_dia"])
            todas = self._filas(base.merge(contextos, how="cross")[columnas])
            todas["prevista"] = self._predecir_filas(todas)
            reales = ctx.reindex(pd.MultiIndex.from_frame(todas[["persona", "track_id", "franja", "tipo_dia"]])).fillna(0)
            todas["n_escuchas"], todas["n_no_salto"] = reales["n_escuchas"].to_numpy(), reales["n_no_salto"].to_numpy()
            agregado = todas.groupby(["persona", "track_id"], sort=False, as_index=False).agg(
                artista=("artista", "first"), album=("album", "first"), prevista=("prevista", "mean"),
                n_escuchas=("n_escuchas", "sum"), n_no_salto=("n_no_salto", "sum"))
            f = agregado.drop(columns=["n_escuchas", "n_no_salto"])
            r = agregado[["n_escuchas", "n_no_salto"]]
        else:
            franja = franjas[0]
            base["franja"], base["tipo_dia"] = int(franja), tipo_dia
            f = self._filas(base[columnas])
            f["prevista"] = self._predecir_filas(f)
            r = ctx.reindex(pd.MultiIndex.from_frame(f[["persona", "track_id", "franja", "tipo_dia"]])).fillna(0)
        n, ns = r["n_escuchas"].to_numpy(), r["n_no_salto"].to_numpy()
        f["escuchas_contexto"] = n
        f["tasa_real"] = np.where(n > 0, ns / np.maximum(n, 1), np.nan)
        fiable = n >= MIN_ESCUCHAS
        if historial == "completo":
            f["gusto"] = (ns + K_SUAVIZADO * f["prevista"].to_numpy()) / (n + K_SUAVIZADO)
            f["origen"] = np.where(fiable, "real", np.where(n > 0, "mezcla", "prevista"))
        else:
            f["gusto"] = np.where(fiable, f["tasa_real"], f["prevista"])          # real si hay 5 o más escuchas
            f["origen"] = np.where(fiable, "real", "prevista")
        conoce = self._propio_completo if historial == "completo" else self._propio
        f["conoce"] = conoce.reindex(pd.MultiIndex.from_frame(f[["persona", "track_id"]]))["n_escuchas"].fillna(0).to_numpy() > 0
        f["percentil"] = f.groupby("persona")["gusto"].rank(pct=True)
        return f

    @staticmethod
    def _reparto(g: pd.DataFrame, conoce: pd.DataFrame, limite: int | None = None,
                 fraccion: float = FRACCION_REPARTO) -> pd.DataFrame:
        """Reordena la lista (ya ordenada) para que en cualquier tramo inicial de longitud L cada miembro conozca
        al menos floor(fraccion × L) canciones, si quedan canciones suyas. Evita que la playlist sea de un solo miembro."""
        orden = list(g.index)
        limite = len(orden) if limite is None else min(limite, len(orden))
        sabe = {p: set(conoce.index[conoce[p].to_numpy(dtype=bool)]) for p in conoce.columns}
        conocidas = {p: [t for t in orden if t in sabe[p]] for p in conoce.columns}
        puntero = {p: 0 for p in conocidas}
        cuenta = {p: 0 for p in conocidas}
        usadas, final, i = set(), [], 0
        while len(final) < limite:
            elegida = None
            for p in conocidas:
                if cuenta[p] < int(fraccion * (len(final) + 1)):
                    while puntero[p] < len(conocidas[p]) and conocidas[p][puntero[p]] in usadas:
                        puntero[p] += 1
                    if puntero[p] < len(conocidas[p]):
                        elegida = conocidas[p][puntero[p]]
                        break
            if elegida is None:
                while orden[i] in usadas:
                    i += 1
                elegida = orden[i]
            usadas.add(elegida); final.append(elegida)
            for p in conocidas:
                cuenta[p] += elegida in sabe[p]
        return g.loc[final]

    def _ranking(self, personas, franja, tipo_dia, n, duracion_min, excluir_artistas, historial, desempate,
                 excluir_canciones=()):
        """(gustos por miembro, todas las candidatas en el orden de la playlist, sin cortar)."""
        if desempate not in ("media", "media_y_escuchas"):
            raise ErrorEntrada("desempate debe ser «media» o «media_y_escuchas»")
        if len(set(personas)) != len(personas):
            raise ErrorEntrada("Hay personas repetidas en el grupo")
        sin_horario = franja is None
        f = self.gustos(personas, franja, tipo_dia, historial)
        catalogo = self._tablas(historial)[0]
        f["es_real"] = f["origen"].eq("real")
        g = (f.groupby("track_id")
              .agg(gusto_grupo=("percentil", "min"), desempate=("percentil", "mean"), conocida_por_todos=("es_real", "all"))
              .join(catalogo[["cancion", "artista", "duracion_s", "escuchas_grupo"]]))
        if excluir_artistas:
            fuera = {a.casefold() for a in excluir_artistas}
            g = g[~g["artista"].str.casefold().isin(fuera)]
        if excluir_canciones:
            g = g[~g.index.isin(list(excluir_canciones))]
        orden = (["conocida_por_todos"] if sin_horario else []) + ["gusto_grupo", "desempate"]
        if desempate == "media_y_escuchas":
            orden.append("escuchas_grupo")
        g = g.sort_values(orden, ascending=False)
        if historial == "completo" and len(personas) > 1:
            g = self._reparto(g, f.pivot(index="track_id", columns="persona", values="conoce").reindex(g.index).fillna(False),
                              None if duracion_min else n)
        return f, g

    @staticmethod
    def _cortar(g: pd.DataFrame, n: int | None, duracion_min: float | None) -> pd.DataFrame:
        """La playlist: el principio del ranking hasta la duración del viaje o el número de canciones."""
        if duracion_min:
            acumulado = g["duracion_s"].fillna(g["duracion_s"].median()).cumsum()
            g = g[acumulado.shift(fill_value=0) < duracion_min * 60]
        if n:
            g = g.head(n)
        return g

    def playlist(self, personas: list[str], franja: int | None, tipo_dia: str | None, n: int | None = 50,
                 duracion_min: float | None = None, excluir_artistas=(), historial: str = "18_meses",
                 detalle_miembros: bool = True, desempate: str = "media", excluir_canciones=()) -> dict:
        """Playlist del grupo: mínimo de los percentiles de los miembros, desempate por la media.

        Sin horario (franja y tipo_dia a None) van primero las canciones con gusto real de todos los
        miembros y después las que dependen de alguna predicción.

        Con historial="completo" se usa todo el historial (ver gustos) y, además, un reparto mínimo: cada miembro
        conoce al menos un tercio de las canciones de cualquier tramo inicial de la lista.

        detalle_miembros=False quita de la respuesta el gusto de cada miembro. desempate="media_y_escuchas" deshace los
        empates que queden tras la media con las escuchas del grupo (no está evaluado: el valor por defecto es «media»)."""
        sin_horario = franja is None
        f, g = self._ranking(personas, franja, tipo_dia, n, duracion_min, excluir_artistas, historial, desempate,
                             excluir_canciones)
        g = self._cortar(g, n, duracion_min)
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
                              "conocida_por_todos": bool(r["conocida_por_todos"])})
            if detalle_miembros:
                canciones[-1]["miembros"] = miembros
        total = sum(c["duracion_s"] or 0 for c in canciones)
        regla = "percentil del gusto de cada miembro; gusto del grupo = mínimo; empates por la media"
        if historial == "completo":
            regla = ("historial completo: gusto suavizado (no saltos reales + 5 × prevista) / (escuchas + 5); " + regla +
                     "; cada miembro conoce al menos 1/3 de la lista")
        if sin_horario:
            regla = "sin horario: primero las canciones con gusto real de todos; después, " + regla
        return {"personas": personas, "franja": None if sin_horario else _lista_franjas(franja)[0],
                "franja_horas": SIN_HORARIO if sin_horario else _texto_franjas(franja),
                "tipo_dia": SIN_HORARIO if sin_horario else tipo_dia, "historial": historial, "regla": regla,
                "n_canciones": len(canciones), "duracion_total_min": round(total / 60, 1), "canciones": canciones}

    def cancion_en_playlist(self, track_id: str, personas: list[str], franja: int | None, tipo_dia: str | None,
                            n: int | None = 50, duracion_min: float | None = None, excluir_artistas=(),
                            historial: str = "18_meses", desempate: str = "media", excluir_canciones=()) -> dict:
        """¿Entraría esta canción en la playlist del grupo con estos filtros? Su puesto en el mismo ranking que usa
        playlist(), el tamaño de la lista y la tasa de no salto de cada miembro (real con 5 o más escuchas, si no prevista)."""
        catalogo = self._tablas(historial)[0]
        if track_id not in catalogo.index:
            raise ErrorEntrada("La canción no está entre las candidatas del grupo", 404, {"track_id": track_id})
        f, g = self._ranking(personas, franja, tipo_dia, n, duracion_min, excluir_artistas, historial, desempate,
                             excluir_canciones)
        lista = self._cortar(g, n, duracion_min)
        c = catalogo.loc[track_id]
        posicion = int(g.index.get_loc(track_id)) + 1 if track_id in g.index else None
        por = f.set_index(["track_id", "persona"])
        miembros = {p: {"tasa_no_salto": round(float(por.loc[(track_id, p), "gusto"]), 4),
                        "percentil": round(float(por.loc[(track_id, p), "percentil"]), 4),
                        "origen": str(por.loc[(track_id, p), "origen"]),
                        "escuchas": int(por.loc[(track_id, p), "escuchas_contexto"])} for p in personas}
        fila = g.loc[track_id] if posicion is not None else None
        sin_horario = franja is None
        return {"track_id": track_id, "cancion": str(c["cancion"]), "artista": str(c["artista"]),
                "personas": personas, "franja": None if sin_horario else _lista_franjas(franja)[0],
                "franja_horas": SIN_HORARIO if sin_horario else _texto_franjas(franja),
                "tipo_dia": SIN_HORARIO if sin_horario else tipo_dia,
                "entra": posicion is not None and posicion <= len(lista),
                "artista_excluido": posicion is None and track_id not in set(excluir_canciones),
                "cancion_excluida": track_id in set(excluir_canciones),
                "posicion": posicion, "n_candidatas": int(len(g)), "n_canciones_playlist": int(len(lista)),
                "gusto_grupo": None if fila is None else round(float(fila["gusto_grupo"]), 4),
                "conocida_por_todos": bool(all(m["origen"] == "real" for m in miembros.values())),
                "miembros": miembros}

    def buscar_canciones(self, texto: str, limite: int = 20) -> list[dict]:
        """Canciones del catálogo que alguien del modelo ha escuchado y cuyo título o artista contiene el texto (sin
        tildes ni mayúsculas), las más escuchadas primero, con las escuchas de cada persona."""
        buscado = _sin_tildes(texto.strip())
        if not buscado:
            return []
        escuchas = self._propio["n_escuchas"]
        conocidas = escuchas[escuchas > 0].index.get_level_values("track_id").unique()
        cat = self.catalogo[self.catalogo.index.isin(conocidas)]
        coincide = (cat["cancion"].astype(str).map(_sin_tildes).str.contains(buscado, regex=False)
                    | cat["artista"].astype(str).map(_sin_tildes).str.contains(buscado, regex=False))
        encontradas = cat[coincide].sort_values("escuchas_grupo", ascending=False).head(limite)
        por = escuchas[escuchas > 0]
        resultado = []
        for tid, r in encontradas.iterrows():
            de_quien = por.xs(tid, level="track_id").sort_values(ascending=False)
            resultado.append({"track_id": str(tid), "cancion": str(r["cancion"]), "artista": str(r["artista"]),
                              "duracion_s": None if pd.isna(r["duracion_s"]) else int(r["duracion_s"]),
                              "personas": {str(p): int(n) for p, n in de_quien.items()}})
        return resultado

    # ------------------------------------------------------------- información
    def artistas_por_persona(self) -> list[dict]:
        """Artistas del catálogo que alguien del modelo ha escuchado en el periodo, con las escuchas de cada persona
        (las personas de más a menos escuchas). Mismas grafías y orden que artistas()."""
        r = self.recuentos[self.recuentos["n_escuchas"] > 0]
        clave = r["artista"].astype(str).str.strip().str.casefold()
        por = r.assign(clave=clave).groupby(["clave", "persona"])["n_escuchas"].sum()
        resultado = []
        for nombre in self.artistas():
            k = nombre.casefold()
            if k not in por.index.get_level_values(0):
                continue
            escuchas = por.loc[k].sort_values(ascending=False)
            resultado.append({"artista": nombre, "personas": {str(p): int(n) for p, n in escuchas.items()}})
        return resultado

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


def _sin_tildes(texto: str) -> str:
    """Minúsculas y sin tildes, para buscar sin que importe cómo se escribe."""
    return "".join(c for c in unicodedata.normalize("NFD", texto.casefold()) if unicodedata.category(c) != "Mn")


def _lista_franjas(franja) -> list[int]:
    """La franja como lista de enteros (una sola o varias seguidas, p. ej. [5, 0] para la noche)."""
    if franja is None:
        return []
    franjas = [int(x) for x in franja] if isinstance(franja, (list, tuple)) else [int(franja)]
    if not franjas or len(set(franjas)) != len(franjas) or any(not 0 <= x < len(NOMBRES_FRANJA) for x in franjas):
        raise ErrorEntrada("«franjas» tiene que ser una lista de franjas distintas entre 0 y 5")
    return franjas


def _texto_franjas(franja) -> str:
    """«12-16h» para una franja; para varias seguidas, de la primera hora a la última («20-4h» para [5, 0])."""
    franjas = _lista_franjas(franja)
    if len(franjas) == 1:
        return NOMBRES_FRANJA[franjas[0]]
    inicio = NOMBRES_FRANJA[franjas[0]].split("-")[0]
    fin = NOMBRES_FRANJA[franjas[-1]].split("-")[1]
    return f"{inicio}-{fin}" if fin != "24h" else f"{inicio}-0h"
