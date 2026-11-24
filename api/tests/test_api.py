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
    sin_permiso = cliente.post("/historiales", data={"persona": "carla", "consentimiento": "false"},
                               files={"archivo": ("my_spotify_data.zip", b.getvalue(), "application/zip")})
    assert sin_permiso.status_code == 422
    r = cliente.post("/historiales", data={"persona": "Carla", "consentimiento": "true"},
                     files={"archivo": ("my_spotify_data.zip", b.getvalue(), "application/zip")})
    assert r.status_code == 202, r.text
    for _ in range(120):
        estado = cliente.get("/preparacion").json()
        if estado["estado"] != "en_curso":
            break
        time.sleep(0.5)
    assert estado["estado"] == "lista", estado
    assert {"persona": "carla", "en_el_modelo": True}.items() <= next(h for h in cliente.get("/historiales").json() if h["persona"] == "carla").items()
    r = cliente.post("/objetivo2/playlist", json={"personas": ["ana", "carla"], "franja": 2, "tipo_dia": "laborable", "n": 5})
    assert r.status_code == 200 and r.json()["n_canciones"] == 5
    assert cliente.post("/historiales", data={"persona": "x", "consentimiento": "true"},
                        files={"archivo": ("a.zip", b"no es un zip", "application/zip")}).status_code == 422
    assert cliente.delete("/historiales/carla").status_code == 202
    assert cliente.delete("/historiales/carla").status_code == 404
