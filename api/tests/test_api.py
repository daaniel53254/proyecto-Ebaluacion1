"""Pruebas de los endpoints (necesitan fastapi y httpx: pip install -r api/requirements.txt)."""
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
from fastapi.testclient import TestClient  # noqa: E402

import api.main as main  # noqa: E402


@pytest.fixture(scope="module")
def cliente(carpeta_datos, tmp_path_factory):
    import shutil
    base = tmp_path_factory.mktemp("api_http")
    shutil.copytree(carpeta_datos, base / "datos")
    shutil.copytree(carpeta_datos.parent / "historial", base / "historial")
    main.CARPETA_DATOS, main.CARPETA_HISTORIAL = base / "datos", base / "historial"
    with TestClient(main.app) as c:
        yield c


def test_salud_y_modelo(cliente):
    assert cliente.get("/salud").json()["estado"] == "ok"
    m = cliente.get("/modelo").json()
    assert "variables" in m and m["registro_mlflow"].endswith("@produccion")
    assert len(cliente.get("/contextos").json()) == 12
    assert {p["persona"] for p in cliente.get("/personas").json()} == {"ana", "beñat"}


def test_prediccion(cliente):
    r = cliente.post("/objetivo1/prediccion", json={"filas": [
        {"persona": "ana", "track_id": "t003", "franja": 3, "tipo_dia": "laborable"},
        {"persona": "beñat", "track_id": "t003", "fecha_hora": "2026-11-28T22:00"}]})
    assert r.status_code == 200, r.text
    p = r.json()["predicciones"]
    assert p[1]["franja"] == 5 and p[1]["tipo_dia"] == "fin_semana"


@pytest.mark.parametrize("cuerpo,codigo", [
    ({"filas": []}, 422),                                                                       # lista vacía
    ({"filas": [{"persona": "ana", "track_id": "t003", "franja": 9, "tipo_dia": "laborable"}]}, 422),  # franja fuera de rango
    ({"filas": [{"persona": "ana", "track_id": "t003", "tipo_dia": "laborable"}]}, 422),       # falta el contexto
    ({"filas": [{"persona": "ana", "track_id": "t003", "franja": 1, "tipo_dia": "martes"}]}, 422),
    ({"filas": [{"persona": "pepe", "track_id": "t003", "franja": 1, "tipo_dia": "laborable"}]}, 404),
    ({"filas": [{"persona": "ana", "track_id": "nueva", "franja": 1, "tipo_dia": "laborable"}]}, 404),
])
def test_errores_prediccion(cliente, cuerpo, codigo):
    r = cliente.post("/objetivo1/prediccion", json=cuerpo)
    assert r.status_code == codigo and "error" in r.json()


def test_playlist(cliente):
    r = cliente.post("/objetivo2/playlist", json={"personas": ["ana", "beñat"], "fecha_hora": "2026-11-27T15:30", "n": 10})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["n_canciones"] == 10 and j["franja"] == 3 and set(j["canciones"][0]["miembros"]) == {"ana", "beñat"}


def test_playlist_ignorar_horario(cliente):
    r = cliente.post("/objetivo2/playlist", json={"personas": ["ana", "beñat"], "ignorar_horario": True, "n": 10})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["franja"] is None and j["tipo_dia"] == "cualquiera" and "conocida_por_todos" in j["canciones"][0]


def test_playlist_historial_completo(cliente):
    r = cliente.post("/objetivo2/playlist", json={"personas": ["ana", "beñat"], "franja": 2, "tipo_dia": "laborable",
                                                  "historial": "completo", "n": 15})
    assert r.status_code == 200, r.text
    assert r.json()["historial"] == "completo" and r.json()["n_canciones"] == 15
    r = cliente.post("/objetivo2/playlist", json={"personas": ["ana"], "franja": 2, "tipo_dia": "laborable", "historial": "todo"})
    assert r.status_code == 422


def test_errores_playlist(cliente):
    assert cliente.post("/objetivo2/playlist", json={"personas": [], "franja": 1, "tipo_dia": "laborable"}).status_code == 422
    assert cliente.post("/objetivo2/playlist", json={"personas": ["ana"], "franja": 1, "tipo_dia": "laborable", "n": 0}).status_code == 422
    assert cliente.post("/objetivo2/playlist", json={"personas": ["ana", "ana"], "franja": 1, "tipo_dia": "laborable"}).status_code == 422
    assert cliente.post("/objetivo2/playlist", json={"personas": ["x"], "franja": 1, "tipo_dia": "laborable"}).status_code == 404


def test_subir_historial_y_reentrenar(cliente):
    import io, json, time, zipfile
    filas = []
    for f in sorted((main.CARPETA_HISTORIAL / "ana").glob("*.json")):
        filas += json.loads(f.read_text(encoding="utf-8"))
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("Spotify Extended Streaming History/Streaming_History_Audio_2024.json", json.dumps(filas))
    sin_permiso = cliente.post("/historiales", data={"persona": "carla", "consentimiento": "false", "mayor_de_16": "true"},
                               files={"archivo": ("my_spotify_data.zip", b.getvalue(), "application/zip")})
    assert sin_permiso.status_code == 422
    r = cliente.post("/historiales", data={"persona": "Carla", "consentimiento": "true", "mayor_de_16": "true"},
                     files={"archivo": ("my_spotify_data.zip", b.getvalue(), "application/zip")})
    assert r.status_code == 202, r.text
    token = r.json()["token"]
    for _ in range(120):
        estado = cliente.get("/preparacion").json()
        if estado["estado"] != "en_curso":
            break
        time.sleep(0.5)
    assert estado["estado"] == "lista", estado
    assert {"persona": "carla", "en_el_modelo": True}.items() <= next(h for h in cliente.get("/historiales").json() if h["persona"] == "carla").items()
    r = cliente.post("/objetivo2/playlist", json={"personas": ["ana", "carla"], "franja": 2, "tipo_dia": "laborable", "n": 5})
    assert r.status_code == 200 and r.json()["n_canciones"] == 5
    assert cliente.post("/historiales", data={"persona": "x", "consentimiento": "true", "mayor_de_16": "true"},
                        files={"archivo": ("a.zip", b"no es un zip", "application/zip")}).status_code == 422
    assert cliente.delete("/historiales/carla", headers={"X-Token": token}).status_code == 202
    assert cliente.delete("/historiales/carla", headers={"X-Token": token}).status_code == 404
    main.ESTADO["preparacion"].esperar()


# ---------------------------------------------------------------- privacidad (anexo A.1 a A.3)
def _zip_de(persona_origen="ana", n=None):
    import io, json, zipfile
    filas = []
    for f in sorted((main.CARPETA_HISTORIAL / persona_origen).glob("Streaming_History_Audio_*.json")):
        filas += json.loads(f.read_text(encoding="utf-8"))
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("Spotify Extended Streaming History/Streaming_History_Audio_2024.json", json.dumps(filas[:n]))
    return {"archivo": ("my_spotify_data.zip", b.getvalue(), "application/zip")}


def test_menor_de_16_no_guarda_nada(cliente):
    r = cliente.post("/historiales", data={"persona": "menor", "consentimiento": "true", "mayor_de_16": "false"},
                     files=_zip_de(n=200))
    assert r.status_code == 422
    assert r.json() == {"error": "Hace falta tener 16 años o más para usar el servicio", "detalle": None}
    assert not (main.CARPETA_HISTORIAL / "menor").exists()
    sin_campo = cliente.post("/historiales", data={"persona": "menor", "consentimiento": "true"}, files=_zip_de(n=200))
    assert sin_campo.status_code == 422 and not (main.CARPETA_HISTORIAL / "menor").exists()


def test_privacidad(cliente):
    from api import privacidad
    r = cliente.get("/privacidad")
    assert r.status_code == 200
    assert r.json()["version"] == privacidad.VERSION_TEXTO and "6.1.a" in r.json()["texto"]
    assert "/privacidad" in cliente.get("/openapi.json").json()["paths"]["/historiales"]["post"]["description"]


def test_consentimiento_y_token(cliente):
    import json
    from api import privacidad
    r = cliente.post("/historiales", data={"persona": "dani", "consentimiento": "true", "mayor_de_16": "true"},
                     files=_zip_de())
    assert r.status_code == 202, r.text
    token = r.json()["token"]
    carpeta = main.CARPETA_HISTORIAL / "dani"
    prueba = json.loads((carpeta / "consentimiento.json").read_text(encoding="utf-8"))
    assert prueba["version_texto"] == privacidad.VERSION_TEXTO and prueba["mayor_de_16"] is True
    assert "+01:00" in prueba["fecha"] or "+02:00" in prueba["fecha"]
    assert (carpeta / ".token").read_text(encoding="utf-8") == privacidad.hash_token(token) != token
    main.ESTADO["preparacion"].esperar()
    assert cliente.get("/preparacion").json()["estado"] == "lista"
    datos = {"persona": "dani", "consentimiento": "true", "mayor_de_16": "true"}
    assert cliente.post("/historiales", data=datos, files=_zip_de()).status_code == 403                 # resubir sin token
    assert cliente.post("/historiales", data=datos, files=_zip_de(), headers={"X-Token": "otro"}).status_code == 403
    r = cliente.post("/historiales", data=datos, files=_zip_de(), headers={"X-Token": token})
    assert r.status_code == 202 and "token" not in r.json()                                           # el token no cambia
    main.ESTADO["preparacion"].esperar()
    assert cliente.delete("/historiales/dani").status_code == 403                                     # borrar sin token
    assert cliente.delete("/historiales/dani", headers={"X-Token": "otro"}).status_code == 403
    assert cliente.delete("/historiales/dani", headers={"X-Token": token}).status_code == 202
    assert not carpeta.exists()                                                                       # consentimiento incluido
    main.ESTADO["preparacion"].esperar()


def test_carpetas_sin_token_solo_con_administracion(cliente, monkeypatch):
    monkeypatch.delenv("API_TOKEN_ADMIN", raising=False)
    assert cliente.delete("/historiales/ana", headers={"X-Token": "cualquiera"}).status_code == 403
    monkeypatch.setenv("API_TOKEN_ADMIN", "secreto-de-prueba")
    assert cliente.delete("/historiales/ana", headers={"X-Token": "otro"}).status_code == 403
    r = cliente.post("/historiales", data={"persona": "ana", "consentimiento": "true", "mayor_de_16": "true"},
                     files=_zip_de("ana"), headers={"X-Token": "secreto-de-prueba"})
    assert r.status_code == 202 and r.json()["token"]                                                 # ana recibe su token
    assert (main.CARPETA_HISTORIAL / "ana" / ".token").exists()
    main.ESTADO["preparacion"].esperar()
    assert {h["persona"] for h in cliente.get("/historiales").json()} >= {"ana", "beñat"}


# ---------------------------------------------------------------- playlist (anexo A.4 y A.9)
def test_playlist_sin_detalle_de_miembros(cliente):
    cuerpo = {"personas": ["ana", "beñat"], "franja": 2, "tipo_dia": "laborable", "n": 10}
    con = cliente.post("/objetivo2/playlist", json=cuerpo).json()["canciones"]
    sin = cliente.post("/objetivo2/playlist", json={**cuerpo, "detalle_miembros": False}).json()["canciones"]
    assert all("miembros" in c for c in con) and not any("miembros" in c for c in sin)
    assert [c["track_id"] for c in con] == [c["track_id"] for c in sin]
    r = cliente.post("/objetivo2/playlist", json={"personas": ["ana"], "ignorar_horario": True, "detalle_miembros": False})
    assert r.status_code == 200 and r.json()["franja"] is None


def test_playlist_desempate(cliente):
    cuerpo = {"personas": ["ana", "beñat"], "franja": 2, "tipo_dia": "laborable", "n": 10}
    assert cliente.post("/objetivo2/playlist", json={**cuerpo, "desempate": "media_y_escuchas"}).status_code == 200
    assert cliente.post("/objetivo2/playlist", json={**cuerpo, "desempate": "otro"}).status_code == 422


def test_artistas(cliente):
    r = cliente.get("/artistas")
    assert r.status_code == 200
    a = r.json()
    assert a and all(isinstance(x, str) and x for x in a)
    assert a == sorted(a, key=str.casefold) and len(a) == len(set(a))


def test_cors_web(cliente):
    r = cliente.options("/personas", headers={"Origin": "http://127.0.0.1:3000",
                                              "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
    r = cliente.get("/salud", headers={"Origin": "http://otro.com"})
    assert "access-control-allow-origin" not in r.headers


def test_cancion_canciones_y_artistas_por_persona(cliente):
    p = cliente.post("/objetivo2/playlist", json={"personas": ["ana", "beñat"], "franjas": [3, 4], "tipo_dia": "fin_semana",
                                                  "n": 5}).json()
    assert p["franja_horas"] == "12-20h"
    tid = p["canciones"][0]["track_id"]
    r = cliente.post("/objetivo2/cancion", json={"track_id": tid, "personas": ["ana", "beñat"], "franjas": [3, 4],
                                                 "tipo_dia": "fin_semana", "n": 5})
    assert r.status_code == 200 and r.json()["entra"] and r.json()["posicion"] == 1
    assert cliente.post("/objetivo2/cancion", json={"track_id": "x", "personas": ["ana"], "ignorar_horario": True}).status_code == 404
    assert cliente.get("/canciones", params={"buscar": "a"}).status_code == 422
    assert isinstance(cliente.get("/canciones", params={"buscar": "artista"}).json(), list)
    a = cliente.get("/artistas", params={"por_persona": True}).json()
    assert a and isinstance(a[0]["personas"], dict)
