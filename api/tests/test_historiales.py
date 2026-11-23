"""Subida, validación y borrado de historiales, y reentrenamiento automático (sin FastAPI)."""
import io
import json
import time
import zipfile

import pytest

from api import historiales
from api.preparacion import Preparacion
from api.servicio import Servicio


def _zip(ficheros: dict) -> bytes:
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        for nombre, contenido in ficheros.items():
            z.writestr(nombre, contenido if isinstance(contenido, str) else json.dumps(contenido))
    return b.getvalue()


def _escuchas_de(carpeta_historial, persona):
    filas = []
    for f in sorted((carpeta_historial / persona).glob("*.json")):
        filas += json.loads(f.read_text(encoding="utf-8"))
    return filas


@pytest.fixture()
def historial(tmp_path, carpeta_datos):
    import shutil
    origen = carpeta_datos.parent / "historial"
    shutil.copytree(origen, tmp_path / "historial")
    return tmp_path / "historial"


def test_subida_guarda_solo_campos_permitidos(historial):
    filas = _escuchas_de(historial, "ana")[:300]
    for r in filas:
        r["ip_addr"] = "1.2.3.4"; r["conn_country"] = "ES"
    contenido = _zip({"Spotify Extended Streaming History/Streaming_History_Audio_2024.json": filas,
                      "Spotify Extended Streaming History/Streaming_History_Video_2024.json": [],
                      "../../fuera/Streaming_History_Audio_2025.json": filas[:10]})          # intento de salir de la carpeta
    r = historiales.guardar_zip(contenido, "Carla", historial)
    assert r["persona"] == "carla" and r["ficheros"] == 2 and r["escuchas"] == 310
    guardadas = _escuchas_de(historial, "carla")
    assert "ip_addr" not in guardadas[0] and "conn_country" not in guardadas[0]
    assert not (historial.parent / "fuera").exists()                    # nada se escribe fuera de historial/carla
    assert sorted(p.name for p in (historial / "carla").iterdir()) == ["Streaming_History_Audio_2024.json", "Streaming_History_Audio_2025.json"]


@pytest.mark.parametrize("contenido,mensaje", [
    (b"esto no es un zip", "zip válido"),
    (_zip({"Userdata.json": {"a": 1}}), "Streaming_History_Audio"),
    (_zip({"Streaming_History_Audio_2024.json": "{no es json"}), "JSON válido"),
    (_zip({"Streaming_History_Audio_2024.json": [{"x": 1}]}), "formato"),
])
def test_zip_no_valido(historial, contenido, mensaje):
    with pytest.raises(historiales.ErrorHistorial, match=mensaje):
        historiales.guardar_zip(contenido, "carla", historial)
    assert not (historial / "carla").exists()


@pytest.mark.parametrize("nombre", ["a", "../etc", "José", "x" * 40, ""])
def test_nombre_no_valido(historial, nombre):
    with pytest.raises(historiales.ErrorHistorial):
        historiales.normalizar_persona(nombre)


def test_subir_y_borrar_reentrena(historial, tmp_path):
    nuevos = []
    prep = Preparacion(historial, tmp_path / "datos", nuevos.append)
    filas = _escuchas_de(historial, "ana")
    historiales.guardar_zip(_zip({"Streaming_History_Audio_2024.json": filas}), "carla", historial)
    prep.lanzar("prueba"); time.sleep(0.2); estado = prep.esperar()
    assert estado["estado"] == "lista", estado
    assert set(nuevos[-1].personas.index) == {"ana", "beñat", "carla"}
    playlist = nuevos[-1].playlist(["ana", "carla"], 3, "laborable", n=5)
    assert playlist["n_canciones"] == 5

    assert historiales.borrar("carla", historial)
    prep.lanzar("borrado"); time.sleep(0.2); prep.esperar()
    s = Servicio.desde_carpeta(tmp_path / "datos", usar_mlflow=False)
    assert "carla" not in s.personas.index and not (historial / "carla").exists()
    assert not (tmp_path / "datos.nuevo").exists() and not (tmp_path / "datos.anterior").exists()


def test_pocos_datos_da_error_claro(tmp_path):
    (tmp_path / "h").mkdir()
    pocas = [{"ts": "2025-01-01T10:00:00Z", "ms_played": 200000, "spotify_track_uri": "spotify:track:t1",
              "master_metadata_track_name": "x", "master_metadata_album_artist_name": "y", "reason_end": "trackdone"}] * 3
    historiales.guardar_zip(_zip({"Streaming_History_Audio_2025.json": pocas}), "solo", tmp_path / "h")
    prep = Preparacion(tmp_path / "h", tmp_path / "d", lambda s: None)
    prep.lanzar("prueba"); time.sleep(0.2); estado = prep.esperar()
    assert estado["estado"] == "error" and "pocos datos" in estado["error"]


def test_carpeta_por_defecto_y_salida_del_pipeline(tmp_path):
    from api.caracteristicas import _es_persona, carpeta_historial_por_defecto
    assert carpeta_historial_por_defecto(tmp_path) == tmp_path / "data" / "raw"
    antigua = tmp_path / "data" / "entrada" / "historial"
    (antigua / "persona=1a2b3c4d").mkdir(parents=True)                  # salida de bigdata/preparar.py
    assert carpeta_historial_por_defecto(tmp_path) == tmp_path / "data" / "raw"
    (antigua / "ander").mkdir()
    assert carpeta_historial_por_defecto(tmp_path) == antigua           # instalación antigua
    (tmp_path / "data" / "raw").mkdir()
    assert carpeta_historial_por_defecto(tmp_path) == tmp_path / "data" / "raw"
    assert not _es_persona(antigua / "persona=1a2b3c4d") and _es_persona(antigua / "ander")
    assert [h["persona"] for h in historiales.listar(antigua)] == ["ander"]
