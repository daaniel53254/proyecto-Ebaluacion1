"""Datos sintéticos para las pruebas: no hacen falta los historiales reales ni MLflow."""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from api.preparar_datos import preparar
from api.servicio import Servicio


def _historial_sintetico(carpeta: Path, semilla=0):
    rng = np.random.default_rng(semilla)
    canciones = [(f"t{i:03d}", f"Canción {i}", f"Artista {i % 12}", f"Álbum {i % 25}") for i in range(80)]
    canciones.append(("tNA", "NA", "null", "None"))           # nombres que pandas confundiría con vacíos
    for persona, p_salto in [("ana", 0.4), ("beñat", 0.1)]:
        filas = []
        for _ in range(4000):
            tid, nombre, artista, album = canciones[rng.integers(len(canciones))]
            ts = pd.Timestamp("2024-01-01", tz="UTC") + pd.Timedelta(minutes=int(rng.integers(0, 60 * 24 * 540)))
            salta = rng.random() < p_salto * (1.5 if int(tid[1:] if tid[1:].isdigit() else 0) % 3 == 0 else 0.7)
            filas.append({"ts": ts.strftime("%Y-%m-%dT%H:%M:%SZ"), "ms_played": int(rng.integers(5_000, 20_000)) if salta else 180_000,
                          "spotify_track_uri": f"spotify:track:{tid}", "master_metadata_track_name": nombre,
                          "master_metadata_album_artist_name": artista, "master_metadata_album_album_name": album,
                          "reason_end": "fwdbtn" if salta else "trackdone", "shuffle": bool(rng.random() < 0.6)})
        (carpeta / persona).mkdir(parents=True)
        with open(carpeta / persona / "Streaming_History_Audio_2024.json", "w", encoding="utf-8") as f:
            json.dump(filas, f, ensure_ascii=False)


@pytest.fixture(scope="session")
def carpeta_datos(tmp_path_factory):
    base = tmp_path_factory.mktemp("api")
    _historial_sintetico(base / "historial")
    preparar(base / "historial", hasta="2025-07-01", meses=18, salida=base / "datos")
    return base / "datos"


@pytest.fixture(scope="session")
def servicio(carpeta_datos):
    return Servicio.desde_carpeta(carpeta_datos, usar_mlflow=False)
