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


def _historial_con_novedades(carpeta: Path, semilla=1):
    """Historial con canciones nuevas: cada persona descubre canciones y vuelve a escuchar a menudo las de sus
    artistas preferidos (A00 a A04 para los dos; A05 a A09 solo para «ana») y casi nunca las de los demás."""
    rng = np.random.default_rng(semilla)
    preferidos = {"ana": set(range(10)), "beñat": set(range(5))}
    inicio = pd.Timestamp("2024-01-01", tz="UTC")
    for persona, gusta in preferidos.items():
        filas = []
        def escucha(t, i, artista, salta=False, prefijo="n"):
            filas.append({"ts": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "ms_played": 10_000 if salta else 180_000,
                          "spotify_track_uri": f"spotify:track:{prefijo}{i:04d}", "master_metadata_track_name": f"Canción {i}",
                          "master_metadata_album_artist_name": f"{'A' if prefijo == 'n' else 'F'}{artista:02d}",
                          "master_metadata_album_album_name": f"Álbum {i % 40}",
                          "reason_end": "fwdbtn" if salta else "trackdone", "shuffle": bool(rng.random() < 0.5)})
        for _ in range(3000):                    # canciones de fondo (artistas F00 a F04) que se repiten mucho
            i = int(rng.integers(30))
            escucha(inicio + pd.Timedelta(minutes=int(rng.integers(0, 60 * 24 * 600))), i, i % 5,
                    salta=rng.random() < 0.3, prefijo="f")
        for i in rng.permutation(900)[:600]:
            artista = int(i % 30)
            t = inicio + pd.Timedelta(minutes=int(rng.integers(0, 60 * 24 * 600)))
            le_gusta = artista in gusta
            escucha(t, i, artista, salta=rng.random() < (0.1 if le_gusta else 0.5))
            if rng.random() < (0.8 if le_gusta else 0.1):                 # adopción: vuelve a escucharla
                for _ in range(int(rng.integers(1, 4))):
                    escucha(t + pd.Timedelta(days=float(rng.uniform(1, 60))), i, artista)
        (carpeta / persona).mkdir(parents=True)
        with open(carpeta / persona / "Streaming_History_Audio_2024.json", "w", encoding="utf-8") as f:
            json.dump(filas, f, ensure_ascii=False)


@pytest.fixture(scope="session")
def carpeta_novedades(tmp_path_factory):
    base = tmp_path_factory.mktemp("api_novedades")
    _historial_con_novedades(base / "historial")
    preparar(base / "historial", hasta="auto", meses=18, salida=base / "datos")
    return base / "datos"


@pytest.fixture(scope="session")
def servicio_novedades(carpeta_novedades):
    return Servicio.desde_carpeta(carpeta_novedades, usar_mlflow=False)


@pytest.fixture(scope="session")
def carpeta_datos(tmp_path_factory):
    base = tmp_path_factory.mktemp("api")
    _historial_sintetico(base / "historial")
    preparar(base / "historial", hasta="2025-07-01", meses=18, salida=base / "datos")
    return base / "datos"


@pytest.fixture(scope="session")
def servicio(carpeta_datos):
    return Servicio.desde_carpeta(carpeta_datos, usar_mlflow=False)


@pytest.fixture(scope="session")
def servicio_con_antiguas(tmp_path_factory):
    """Como el sintético, más una canción que solo «ana» escuchó en 2022 (fuera de los últimos 18 meses)."""
    base = tmp_path_factory.mktemp("api_antiguas")
    _historial_sintetico(base / "historial")
    viejas = [{"ts": f"2022-03-{d:02d}T10:00:00Z", "ms_played": 180_000, "spotify_track_uri": "spotify:track:tOLD",
               "master_metadata_track_name": "Canción antigua", "master_metadata_album_artist_name": "Artista antiguo",
               "master_metadata_album_album_name": "Álbum antiguo", "reason_end": "trackdone", "shuffle": False}
              for d in range(1, 11)]
    with open(base / "historial" / "ana" / "Streaming_History_Audio_2022.json", "w", encoding="utf-8") as f:
        json.dump(viejas, f, ensure_ascii=False)
    preparar(base / "historial", hasta="2025-07-01", meses=18, salida=base / "datos")
    return Servicio.desde_carpeta(base / "datos", usar_mlflow=False)
