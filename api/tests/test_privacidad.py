"""Consentimiento, tokens y opciones nuevas de la playlist, sin FastAPI (anexo A.2, A.3, A.4 y A.9)."""
import io
import json
import zipfile
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from api import historiales, privacidad
from api.caracteristicas import leer_historiales
from api.servicio import ErrorEntrada


def _zip(filas) -> bytes:
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("Spotify Extended Streaming History/Streaming_History_Audio_2024.json", json.dumps(filas))
    return b.getvalue()


@pytest.fixture()
def historial(tmp_path, carpeta_datos):
    import shutil
    shutil.copytree(carpeta_datos.parent / "historial", tmp_path / "historial")
    return tmp_path / "historial"


def test_documento_de_consentimiento_sin_datos_del_navegador():
    d = privacidad.documento_consentimiento("carla", True, datetime(2026, 11, 25, 10, 0, tzinfo=ZoneInfo("Europe/Madrid")))
    assert d == {"persona": "carla", "fecha": "2026-11-25T10:00:00+01:00", "version_texto": "2026-11-23",
                 "finalidad": privacidad.FINALIDAD, "mayor_de_16": True}
    for texto in ("6.1.a", "16 años", "18 meses", "DELETE /historiales", "IP"):
        assert texto in privacidad.TEXTO_CONSENTIMIENTO


def test_guardar_con_consentimiento_y_token(historial):
    filas = json.loads((historial / "ana" / "Streaming_History_Audio_2024.json").read_text(encoding="utf-8"))[:300]
    token, h = privacidad.nuevo_token()
    historiales.guardar_zip(_zip(filas), "carla", historial, extras=privacidad.ficheros_extra("carla", True, h))
    carpeta = historial / "carla"
    assert json.loads((carpeta / "consentimiento.json").read_text(encoding="utf-8"))["version_texto"] == privacidad.VERSION_TEXTO
    assert (carpeta / ".token").read_text(encoding="utf-8") == h and token not in h
    # listar, el modelo y el pipeline solo leen Streaming_History_Audio_*.json
    assert next(x for x in historiales.listar(historial) if x["persona"] == "carla")["ficheros"] == 1
    assert len(leer_historiales(historial).query("persona == 'carla'")) == 300
    from bigdata.preparar import PATRONES
    assert all(f.name.startswith("Streaming_History_Audio_") for p in PATRONES for f in carpeta.glob(p))
    # un zip no válido no deja ni consentimiento ni token
    with pytest.raises(historiales.ErrorHistorial):
        historiales.guardar_zip(b"no es un zip", "dani", historial, extras=privacidad.ficheros_extra("dani", True, h))
    assert not (historial / "dani").exists()
    assert historiales.borrar("carla", historial) and not carpeta.exists()


def test_token(historial, monkeypatch):
    monkeypatch.delenv("API_TOKEN_ADMIN", raising=False)
    token, h = privacidad.nuevo_token()
    (historial / "ana" / ".token").write_text(h, encoding="utf-8")
    assert privacidad.token_valido(historial / "ana", token)
    assert not privacidad.token_valido(historial / "ana", token + "x")
    assert not privacidad.token_valido(historial / "ana", None)
    assert not privacidad.token_valido(historial / "beñat", "lo-que-sea")       # sin .token y sin administración
    monkeypatch.setenv("API_TOKEN_ADMIN", "admin-prueba")
    assert privacidad.token_valido(historial / "beñat", "admin-prueba")
    assert not privacidad.token_valido(historial / "beñat", "otro")


def test_playlist_sin_detalle_de_miembros(servicio):
    con = servicio.playlist(["ana", "beñat"], 2, "laborable", n=10)["canciones"]
    sin = servicio.playlist(["ana", "beñat"], 2, "laborable", n=10, detalle_miembros=False)["canciones"]
    assert all("miembros" in c for c in con) and not any("miembros" in c for c in sin)
    assert [c["track_id"] for c in con] == [c["track_id"] for c in sin]


def test_desempate_por_escuchas(servicio):
    defecto = servicio.playlist(["ana", "beñat"], 2, "laborable", n=30)["canciones"]
    media = servicio.playlist(["ana", "beñat"], 2, "laborable", n=30, desempate="media")["canciones"]
    assert [c["track_id"] for c in defecto] == [c["track_id"] for c in media]      # el valor por defecto no cambia nada
    esc = servicio.playlist(["ana", "beñat"], 2, "laborable", n=30, desempate="media_y_escuchas")["canciones"]
    clave = [(c["gusto_grupo"], c["desempate"]) for c in esc]
    assert clave == sorted(clave, reverse=True)                                    # el orden principal se mantiene
    with pytest.raises(ErrorEntrada):
        servicio.playlist(["ana"], 2, "laborable", desempate="otro")
