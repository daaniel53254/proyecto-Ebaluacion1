"""Pruebas de los endpoints (necesitan fastapi y httpx: pip install -r api/requirements.txt)."""
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
from fastapi.testclient import TestClient  # noqa: E402

import api.main as main  # noqa: E402


@pytest.fixture(scope="module")
def cliente(carpeta_datos):
    main.CARPETA_DATOS = carpeta_datos
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


def test_errores_playlist(cliente):
    assert cliente.post("/objetivo2/playlist", json={"personas": [], "franja": 1, "tipo_dia": "laborable"}).status_code == 422
    assert cliente.post("/objetivo2/playlist", json={"personas": ["ana"], "franja": 1, "tipo_dia": "laborable", "n": 0}).status_code == 422
    assert cliente.post("/objetivo2/playlist", json={"personas": ["ana", "ana"], "franja": 1, "tipo_dia": "laborable"}).status_code == 422
    assert cliente.post("/objetivo2/playlist", json={"personas": ["x"], "franja": 1, "tipo_dia": "laborable"}).status_code == 404
