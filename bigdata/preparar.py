"""Prepara los historiales de Spotify para subirlos a la capa bronze de HDFS.

Qué hace, por cada persona (una carpeta en data/raw/<persona>/):
  1. Lee los JSON del historial ampliado (Streaming_History_Audio_*.json o endsong_*.json).
  2. Elimina los campos personales (IP, país de conexión, usuario, user agent...).
  3. Sustituye el nombre de la persona por un seudónimo estable (persona_<hash>).
  4. Escribe cada fichero en JSON Lines (un objeto por línea, lo que lee Hive) en
     data/entrada/historial/persona=<seudonimo>/, sin tocar el resto de campos: es dato en bruto.
  5. Deja un manifiesto (data/entrada/manifiesto.json) con filas y bytes medidos, que
     pipeline.sh usa para comprobar que HDFS y Hive tienen exactamente lo mismo.

Uso (desde la raíz del repo):  python -I bigdata/preparar.py [--raw data/raw] [--salida data/entrada]
Solo usa la biblioteca estándar.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Campos personales: se eliminan todos los que aparezcan (los nombres cambian entre exportaciones)
CAMPOS_PERSONALES = {
    "ip_addr", "ip_addr_decrypted", "conn_country", "username",
    "user_agent_decrypted", "city", "region", "user_agent",
}
PATRONES = ("Streaming_History_Audio_*.json", "endsong_*.json")
SAL = "npd-playlist-2026"  # fija: el mismo nombre da siempre el mismo seudónimo


def seudonimo(nombre: str) -> str:
    return "persona_" + hashlib.sha256(f"{SAL}:{nombre.lower()}".encode()).hexdigest()[:8]


def preparar_persona(carpeta: Path, salida: Path) -> dict:
    alias = seudonimo(carpeta.name)
    destino = salida / "historial" / f"persona={alias}"
    destino.mkdir(parents=True, exist_ok=True)
    for viejo in destino.glob("*.jsonl"):
        viejo.unlink()  # idempotente: cada ejecución rehace la carpeta

    ficheros = sorted({f for p in PATRONES for f in carpeta.glob(p)})
    if not ficheros:
        raise SystemExit(f"[ERROR] {carpeta} no tiene ficheros {' ni '.join(PATRONES)}")

    resumen = {"persona": alias, "ficheros": [], "filas": 0, "bytes_origen": 0,
               "bytes_salida": 0, "filas_musica": 0, "campos_eliminados": set(),
               "ts_min": None, "ts_max": None}
    for f in ficheros:
        filas = json.loads(f.read_text(encoding="utf-8"))
        if not isinstance(filas, list):
            raise SystemExit(f"[ERROR] {f.name} no es un array JSON")
        # Hive ignora ficheros que empiezan por "_" o "."; los nombres de Spotify no lo hacen
        out = destino / (f.stem + ".jsonl")
        with out.open("w", encoding="utf-8", newline="\n") as w:
            for r in filas:
                quitados = CAMPOS_PERSONALES.intersection(r)
                resumen["campos_eliminados"].update(quitados)
                for c in quitados:
                    del r[c]
                w.write(json.dumps(r, ensure_ascii=False) + "\n")
                if r.get("spotify_track_uri"):
                    resumen["filas_musica"] += 1
                ts = r.get("ts")
                if ts:
                    resumen["ts_min"] = min(resumen["ts_min"] or ts, ts)
                    resumen["ts_max"] = max(resumen["ts_max"] or ts, ts)
        info = {"origen": f.name, "salida": out.name, "filas": len(filas),
                "bytes_origen": f.stat().st_size, "bytes_salida": out.stat().st_size}
        resumen["ficheros"].append(info)
        for k in ("filas", "bytes_origen", "bytes_salida"):
            resumen[k] += info[k]
        print(f"  {f.name}: {info['filas']:>7} filas, {info['bytes_origen'] / 1e6:6.2f} MB")

    resumen["campos_eliminados"] = sorted(resumen["campos_eliminados"])
    return resumen


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    raiz = Path(__file__).resolve().parent.parent
    ap.add_argument("--raw", type=Path, default=raiz / "data" / "raw")
    ap.add_argument("--salida", type=Path, default=raiz / "data" / "entrada")
    a = ap.parse_args()

    personas = sorted(p for p in a.raw.iterdir() if p.is_dir()) if a.raw.is_dir() else []
    if not personas:
        print(f"[ERROR] No hay carpetas de personas en {a.raw} (ej. data/raw/ander/)", file=sys.stderr)
        return 1

    manifiesto = {"generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                  "personas": []}
    for p in personas:
        print(f"Persona {p.name} -> {seudonimo(p.name)}")
        manifiesto["personas"].append(preparar_persona(p, a.salida))
    manifiesto["filas_total"] = sum(p["filas"] for p in manifiesto["personas"])
    manifiesto["bytes_origen_total"] = sum(p["bytes_origen"] for p in manifiesto["personas"])
    manifiesto["bytes_salida_total"] = sum(p["bytes_salida"] for p in manifiesto["personas"])

    (a.salida / "manifiesto.json").write_text(
        json.dumps(manifiesto, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Total: {manifiesto['filas_total']} filas, "
          f"{manifiesto['bytes_origen_total'] / 1e6:.1f} MB de origen, "
          f"{manifiesto['bytes_salida_total'] / 1e6:.1f} MB preparados")
    return 0


if __name__ == "__main__":
    sys.exit(main())
