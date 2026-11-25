"""Canciones nuevas (notebook 08): modelo de adopción y POST /objetivo2/entraria, con datos sintéticos."""
import dataclasses

import numpy as np
import pandas as pd
import pytest

from api import novedades
from api.caracteristicas import leer_historiales
from api.servicio import ErrorEntrada

GRUPO = ["ana", "beñat"]


@pytest.fixture(scope="module")
def historia(carpeta_novedades):
    h, nuevas = novedades.primeras_escuchas(leer_historiales(carpeta_novedades.parent / "historial"))
    return h, nuevas, novedades.tablas(h, nuevas)


def test_se_entrena_y_se_carga(servicio_novedades):
    info = servicio_novedades.info["novedades"]
    assert "error" not in info and info["filas_entrenamiento"] >= novedades.MIN_FILAS
    assert set(servicio_novedades.novedades["referencias"]) == set(GRUPO)
    assert "novedades" in servicio_novedades.descripcion()


def test_variables_solo_con_el_pasado(historia):
    """Las variables de una primera escucha cuentan solo escuchas anteriores, nunca la propia."""
    h, nuevas, T = historia
    muestra = nuevas.sample(40, random_state=0)
    f = novedades.variables(muestra[novedades.COLS_CONSULTA], T)
    for (_, q), (_, v) in zip(muestra.iterrows(), f.iterrows()):
        antes = h[(h["hora_local"] < q["hora_local"])]
        assert v["art_n"] == ((antes["persona"] == q["persona"]) & (antes["artista"] == q["artista"])).sum()
        assert v["trk_n"] == (antes["track_id"] == q["track_id"]).sum()          # la canción es nueva: solo los demás
        cerradas = nuevas[(nuevas["cierre"] < q["hora_local"]) & (nuevas["persona"] == q["persona"]) &
                          (nuevas["artista"] == q["artista"])]
        assert v["art_cerradas"] == len(cerradas) and v["art_adoptadas"] == cerradas["adopta"].sum()


def test_tablas_compactas_dan_lo_mismo(historia):
    """La API guarda solo la última fila de cada clave: para consultas posteriores a los datos da lo mismo."""
    h, nuevas, T = historia
    momento = h["hora_local"].max() + pd.Timedelta(seconds=1)
    q = pd.DataFrame({"persona": ["ana", "beñat", "ana", "beñat"], "track_id": ["x1", "x2", "n0001", "x3"],
                      "artista": ["A00", "A07", "A12", "Nadie"], "album": ["Álbum 1", "?", "Álbum 2", "?"],
                      "hora_local": momento})
    completo, compacto = novedades.variables(q, T), novedades.variables(q, novedades.compactar(T))
    pd.testing.assert_frame_equal(completo, compacto)


def test_artista_preferido_puntua_mas(servicio_novedades):
    r = servicio_novedades.entraria(GRUPO, [{"artista": "A01"}, {"artista": "A07"}, {"artista": "A20"},
                                            {"artista": "Artista que nadie conoce"}])
    pct = [x["percentil_grupo"] for x in r["resultados"]]
    prob = {p: [x["miembros"][p]["probabilidad_adopcion"] for x in r["resultados"]] for p in GRUPO}
    assert pct[0] > pct[2] and pct[0] > pct[3]                 # A01 gusta a los dos; A20 a ninguno
    assert prob["ana"][1] > prob["ana"][2]                     # A07 solo gusta a «ana»...
    assert prob["beñat"][1] < prob["beñat"][0]                 # ...y a «beñat» menos que A01
    assert pct[1] < pct[0]                                     # por eso para el grupo A07 queda por debajo de A01
    for x in r["resultados"]:
        assert x["entra"] == (x["percentil_grupo"] >= novedades.UMBRAL_PCT)
        assert x["percentil_grupo"] == min(m["percentil"] for m in x["miembros"].values())
        assert not x["en_catalogo"] and x["track_id"].startswith("nueva_")
    assert novedades.HUECOS_MIN <= r["huecos_novedades"] <= novedades.HUECOS_MAX
    assert r["franja"] is None and "12 contextos" in r["regla"]


def test_da_igual_como_se_escriba_el_artista(servicio_novedades):
    """«a07», « A07 » y «A07» son el mismo artista: mismas escuchas y misma probabilidad."""
    r = servicio_novedades.entraria(GRUPO, [{"artista": "A07"}, {"artista": "a07"}, {"artista": "  A07 "}])
    for p in GRUPO:
        prob = {x["miembros"][p]["probabilidad_adopcion"] for x in r["resultados"]}
        escuchas = {x["miembros"][p]["escuchas_artista"] for x in r["resultados"]}
        assert len(prob) == 1 and len(escuchas) == 1
    assert r["resultados"][0]["miembros"]["ana"]["escuchas_artista"] > 0


def test_grafia_del_historial(historia):
    _, _, T = historia
    album = T["alb"].loc[T["alb"]["artista"] == "A00", "album"].iloc[0]
    q = pd.DataFrame({"track_id": ["x", "z"], "artista": [" a00", "Nadie Conocido"], "album": [album.upper(), "?"]})
    out = novedades.con_grafia_del_historial(T, q)
    assert list(out["artista"]) == ["A00", "Nadie Conocido"]            # lo desconocido se deja como viene
    assert out.loc[0, "album"] == album


def test_con_contexto_y_cancion_del_catalogo(servicio_novedades):
    tid = servicio_novedades.catalogo_completo.index[0]
    r = servicio_novedades.entraria(GRUPO, [{"track_id": tid}], franja=3, tipo_dia="fin_semana")
    x = r["resultados"][0]
    assert r["franja"] == 3 and x["en_catalogo"] and x["artista"] != "?"
    assert any(m["ya_la_conoce"] for m in x["miembros"].values()) and "ya la ha escuchado" in x["motivo"]


@pytest.mark.parametrize("personas,canciones,codigo", [
    (["ana", "pepe"], [{"artista": "A01"}], 404),            # persona desconocida
    (GRUPO, [{"track_id": "no_existe"}], 404),               # fuera del catálogo y sin artista
    (["ana", "ana"], [{"artista": "A01"}], 422),             # persona repetida
])
def test_errores(servicio_novedades, personas, canciones, codigo):
    with pytest.raises(ErrorEntrada) as e:
        servicio_novedades.entraria(personas, canciones)
    assert e.value.codigo == codigo


def test_sin_modelo_de_novedades_da_409(servicio_novedades):
    s = dataclasses.replace(servicio_novedades, novedades=None)
    with pytest.raises(ErrorEntrada) as e:
        s.entraria(GRUPO, [{"artista": "A01"}])
    assert e.value.codigo == 409


def test_pocos_datos_no_impide_preparar(carpeta_datos, servicio):
    """Con el historial sintético corto, la preparación termina igual y explica por qué no hay modelo de novedades."""
    info = servicio.info["novedades"]
    assert ("error" in info) == (servicio.novedades is None)


# ------------------------------------------------------------------------- HTTP
# Solo estas pruebas necesitan fastapi y httpx: sin ellos se saltan, y las de arriba se ejecutan igual
@pytest.fixture(scope="module")
def cliente(carpeta_novedades, tmp_path_factory):
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    import shutil
    from fastapi.testclient import TestClient
    import api.main as main
    base = tmp_path_factory.mktemp("api_http_novedades")
    shutil.copytree(carpeta_novedades, base / "datos")
    shutil.copytree(carpeta_novedades.parent / "historial", base / "historial")
    antes = main.CARPETA_DATOS, main.CARPETA_HISTORIAL
    main.CARPETA_DATOS, main.CARPETA_HISTORIAL = base / "datos", base / "historial"
    with TestClient(main.app) as c:
        yield c
    main.CARPETA_DATOS, main.CARPETA_HISTORIAL = antes


def test_endpoint_entraria(cliente):
    r = cliente.post("/objetivo2/entraria", json={"personas": GRUPO, "canciones": [
        {"artista": "A01", "cancion": "Inventada"}, {"artista": "Nadie", "album": "?"}]})
    assert r.status_code == 200, r.text
    j = r.json()
    assert [x["cancion"] for x in j["resultados"]] == ["Inventada", None]
    assert set(j["resultados"][0]["miembros"]) == set(GRUPO) and j["franja"] is None
    r = cliente.post("/objetivo2/entraria", json={"personas": GRUPO, "ignorar_horario": False,
                                                  "fecha_hora": "2026-11-28T22:00", "canciones": [{"artista": "A01"}]})
    assert r.status_code == 200 and r.json()["franja"] == 5 and r.json()["tipo_dia"] == "fin_semana"


@pytest.mark.parametrize("cuerpo,codigo", [
    ({"personas": GRUPO, "canciones": []}, 422),                                          # sin canciones
    ({"personas": GRUPO, "canciones": [{"artista": "A01"}], "ignorar_horario": False}, 422),  # falta el contexto
    ({"personas": GRUPO, "canciones": [{"track_id": "no_existe"}]}, 404),
    ({"personas": ["pepe"], "canciones": [{"artista": "A01"}]}, 404),
])
def test_errores_endpoint(cliente, cuerpo, codigo):
    r = cliente.post("/objetivo2/entraria", json=cuerpo)
    assert r.status_code == codigo and "error" in r.json()
