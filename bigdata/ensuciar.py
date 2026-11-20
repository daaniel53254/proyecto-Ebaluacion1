"""Ensucia de forma reproducible los historiales ya preparados (plan de ensuciado, sección 10 del informe).

Los historiales reales ya traen algunos problemas, pero no todos los que aparecerían con muchos
usuarios. Este script introduce los problemas 1 a 8 del plan en un porcentaje fijo de las
reproducciones de música de cada persona, con semilla fija, y guarda un registro de qué filas tocó.
La capa silver (bigdata/sql/silver.sql) los limpia y pipeline.sh comprueba que desaparecen.

  #  Problema                                   % filas  Cómo se introduce
  1  Filas duplicadas (exportaciones solapadas)  3 %     Copia exacta de la fila, justo detrás
  2  Fechas en otros formatos y sin zona         5 %     ts como dd/MM/yyyy HH:mm:ss o marca Unix
  3  Canciones sin metadatos                     4 %     Vacía nombre, artista o álbum
  4  ms_played imposible                         2 %     Signo negativo o multiplicado por 10
  5  Nombres de artista inconsistentes           5 %     Mayúsculas, espacios dobles, sin tildes, «feat.»
  6  reason_end con variantes                    3 %     FWDBTN, forward, track done...
  7  Reproducciones fantasma de 0 ms             2 %     ms_played = 0
  8  Booleanos escritos como texto               3 %     shuffle como "true", "1", "sí", "no"...

Los problemas 9, 10 y 12 eran del dataset de Kaggle, que ya no entra en el objetivo 1. El 11
(pocas escuchas por combinación) ya ocurre de forma natural y lo resuelve el filtro de 5 escuchas
del gold.

Trabaja sobre data/entrada/historial/persona=*/ *.jsonl (lo que escribe preparar.py), los
reescribe en su sitio, actualiza las filas y bytes de data/entrada/manifiesto.json y deja el
registro en data/entrada/ensuciado.json (no se sube a Git). Como preparar.py rehace los ficheros
en cada ejecución, el ensuciado nunca se acumula.

Uso (desde la raíz del repo):  python -I bigdata/ensuciar.py [--entrada data/entrada] [--semilla 42]
Solo usa la biblioteca estándar.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

PROBLEMAS = {
    1: ("Filas duplicadas", 0.03),
    2: ("Fechas en otros formatos", 0.05),
    3: ("Canciones sin metadatos", 0.04),
    4: ("ms_played imposible", 0.02),
    5: ("Nombres de artista inconsistentes", 0.05),
    6: ("reason_end con variantes", 0.03),
    7: ("Reproducciones de 0 ms", 0.02),
    8: ("Booleanos como texto", 0.03),
}
CAMPOS_METADATOS = ("master_metadata_track_name", "master_metadata_album_artist_name",
                    "master_metadata_album_album_name")
VARIANTES_REASON = {
    "trackdone": ["TRACKDONE", "track done", "Track_Done"],
    "fwdbtn": ["FWDBTN", "forward", "fwd btn"],
    "backbtn": ["BACKBTN", "back", "Back Btn"],
    "endplay": ["ENDPLAY", "end play", "End_Play"],
}
TEXTO_BOOL = {True: ["true", "1", "sí", "TRUE"], False: ["false", "0", "no", "FALSE"]}


def sin_tildes(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def ensuciar_artista(nombre: str, rng: random.Random) -> str:
    tipo = rng.randrange(4)
    if tipo == 0:
        return nombre.upper()
    if tipo == 1:
        return nombre.replace(" ", "  ", 1) if " " in nombre else nombre + "  "
    if tipo == 2:
        quitado = sin_tildes(nombre)
        return quitado if quitado != nombre else nombre.lower()
    return nombre + " feat. Varios"


def formato_fecha(ts: str, rng: random.Random) -> str:
    momento = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    if rng.random() < 0.5:
        return momento.strftime("%d/%m/%Y %H:%M:%S")  # sin zona: es UTC
    return str(int(momento.timestamp()))


def elegir(indices: list[int], pct: float, rng: random.Random) -> list[int]:
    return sorted(rng.sample(indices, round(len(indices) * pct)))


def ensuciar_persona(carpeta: Path, rng: random.Random) -> dict:
    ficheros = sorted(carpeta.glob("*.jsonl"))
    filas: list[dict] = []
    origen: list[tuple[str, int]] = []  # (fichero, línea original) de cada fila
    for f in ficheros:
        with f.open(encoding="utf-8") as fh:
            for n, linea in enumerate(fh):
                filas.append(json.loads(linea))
                origen.append((f.name, n))
    musica = [i for i, r in enumerate(filas) if r.get("spotify_track_uri")]
    tocadas: dict[int, list[int]] = {p: [] for p in PROBLEMAS}

    # El orden importa: los duplicados se crean al final para que sean copias exactas
    for i in elegir([i for i in musica if filas[i].get(CAMPOS_METADATOS[1])], PROBLEMAS[5][1], rng):
        filas[i][CAMPOS_METADATOS[1]] = ensuciar_artista(filas[i][CAMPOS_METADATOS[1]], rng)
        tocadas[5].append(i)
    for i in elegir([i for i in musica if filas[i].get("reason_end") in VARIANTES_REASON], PROBLEMAS[6][1], rng):
        filas[i]["reason_end"] = rng.choice(VARIANTES_REASON[filas[i]["reason_end"]])
        tocadas[6].append(i)
    for i in elegir([i for i in musica if isinstance(filas[i].get("shuffle"), bool)], PROBLEMAS[8][1], rng):
        filas[i]["shuffle"] = rng.choice(TEXTO_BOOL[filas[i]["shuffle"]])
        tocadas[8].append(i)
    for i in elegir([i for i in musica if (filas[i].get("ms_played") or 0) > 0], PROBLEMAS[4][1], rng):
        ms = filas[i]["ms_played"]
        filas[i]["ms_played"] = -ms if rng.random() < 0.5 else ms * 10
        tocadas[4].append(i)
    for i in elegir(musica, PROBLEMAS[7][1], rng):
        filas[i]["ms_played"] = 0
        tocadas[7].append(i)
    for i in elegir(musica, PROBLEMAS[3][1], rng):
        filas[i][rng.choice(CAMPOS_METADATOS)] = None
        tocadas[3].append(i)
    for i in elegir([i for i in musica if filas[i].get("ts", "").endswith("Z")], PROBLEMAS[2][1], rng):
        filas[i]["ts"] = formato_fecha(filas[i]["ts"], rng)
        tocadas[2].append(i)
    duplicar = set(elegir(musica, PROBLEMAS[1][1], rng))
    tocadas[1] = sorted(duplicar)

    # Reescribe cada fichero con los duplicados justo detrás de su original
    por_fichero: dict[str, list[int]] = {}
    for i, (nombre, _) in enumerate(origen):
        por_fichero.setdefault(nombre, []).append(i)
    filas_fichero = {}
    for f in ficheros:
        with f.open("w", encoding="utf-8", newline="\n") as w:
            n = 0
            for i in por_fichero.get(f.name, []):
                linea = json.dumps(filas[i], ensure_ascii=False) + "\n"
                w.write(linea)
                n += 1
                if i in duplicar:
                    w.write(linea)
                    n += 1
        filas_fichero[f.name] = (n, f.stat().st_size)

    return {
        "filas_musica": len(musica),
        "problemas": {p: len(v) for p, v in tocadas.items()},
        "filas_tocadas": {p: [list(origen[i]) for i in v] for p, v in tocadas.items()},
        "ficheros": filas_fichero,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    raiz = Path(__file__).resolve().parent.parent
    ap.add_argument("--entrada", type=Path, default=raiz / "data" / "entrada")
    ap.add_argument("--semilla", type=int, default=42)
    a = ap.parse_args()

    manifiesto_ruta = a.entrada / "manifiesto.json"
    if not manifiesto_ruta.exists():
        print(f"[ERROR] Falta {manifiesto_ruta}: ejecuta antes preparar.py", file=sys.stderr)
        return 1
    manifiesto = json.loads(manifiesto_ruta.read_text(encoding="utf-8"))
    if "ensuciado" in manifiesto:
        print("[ERROR] Estos ficheros ya están ensuciados: vuelve a ejecutar preparar.py antes", file=sys.stderr)
        return 1
    rng = random.Random(a.semilla)
    registro = {"semilla": a.semilla, "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "problemas": {p: {"nombre": n, "pct": pct} for p, (n, pct) in PROBLEMAS.items()},
                "personas": {}}

    print(f"{'Problema':<41}" + "".join(f"{p['persona']:>18}" for p in manifiesto["personas"]))
    resumenes = {}
    for p in manifiesto["personas"]:
        carpeta = a.entrada / "historial" / f"persona={p['persona']}"
        r = ensuciar_persona(carpeta, rng)
        resumenes[p["persona"]] = r
        registro["personas"][p["persona"]] = {"filas_musica": r["filas_musica"],
                                              "filas_tocadas": r["problemas"],
                                              "detalle": r["filas_tocadas"]}
        for f in p["ficheros"]:
            f["filas"], f["bytes_salida"] = r["ficheros"][f["salida"]]
        p["filas"] = sum(f["filas"] for f in p["ficheros"])
        p["bytes_salida"] = sum(f["bytes_salida"] for f in p["ficheros"])
    for num, (nombre, pct) in PROBLEMAS.items():
        print(f"{num:>2} {nombre:<34} {pct:>3.0%}" + "".join(
            f"{resumenes[p['persona']]['problemas'][num]:>18}" for p in manifiesto["personas"]))

    manifiesto["filas_total"] = sum(p["filas"] for p in manifiesto["personas"])
    manifiesto["bytes_salida_total"] = sum(p["bytes_salida"] for p in manifiesto["personas"])
    manifiesto["ensuciado"] = {"semilla": a.semilla,
                               "filas_tocadas": {p: r["problemas"] for p, r in resumenes.items()}}
    manifiesto_ruta.write_text(json.dumps(manifiesto, indent=2, ensure_ascii=False), encoding="utf-8")
    (a.entrada / "ensuciado.json").write_text(json.dumps(registro, ensure_ascii=False), encoding="utf-8")
    print(f"Total tras ensuciar: {manifiesto['filas_total']} filas (registro en ensuciado.json)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
