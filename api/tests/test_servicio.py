"""Pruebas de la lógica (no necesitan FastAPI)."""
import json

import pytest

from api.servicio import ErrorEntrada, contexto_de_fecha


def test_preparacion_genera_ficheros(carpeta_datos):
    for f in ("modelo.joblib", "recuentos.csv.gz", "catalogo.csv.gz", "personas.csv", "info.json"):
        assert (carpeta_datos / f).exists()
    info = json.loads((carpeta_datos / "info.json").read_text(encoding="utf-8"))
    assert info["personas"] == ["ana", "beñat"] and 0 < info["cv_mae"] < 0.5


def test_prediccion_en_rango_y_con_contexto(servicio):
    r = servicio.predecir([{"persona": "ana", "track_id": "t003", "franja": 3, "tipo_dia": "laborable"},
                           {"persona": "beñat", "track_id": "t003", "franja": 3, "tipo_dia": "laborable"}])
    assert len(r) == 2 and all(0 <= x["tasa_no_salto_prevista"] <= 1 for x in r)
    assert r[0]["tasa_no_salto_prevista"] < r[1]["tasa_no_salto_prevista"]     # ana salta más que beñat


def test_nombres_raros_no_se_pierden(servicio):
    r = servicio.predecir([{"persona": "ana", "track_id": "tNA", "franja": 1, "tipo_dia": "fin_semana"}])
    assert r[0]["cancion"] == "NA" and r[0]["artista"] == "null"


def test_cancion_nueva_necesita_artista(servicio):
    with pytest.raises(ErrorEntrada) as e:
        servicio.predecir([{"persona": "ana", "track_id": "nueva", "franja": 1, "tipo_dia": "laborable"}])
    assert e.value.codigo == 404
    r = servicio.predecir([{"persona": "ana", "track_id": "nueva", "franja": 1, "tipo_dia": "laborable", "artista": "Artista 3"}])
    assert r[0]["en_catalogo"] is False


def test_persona_desconocida(servicio):
    with pytest.raises(ErrorEntrada) as e:
        servicio.playlist(["ana", "pepe"], 2, "laborable")
    assert e.value.codigo == 404 and "pepe" in e.value.mensaje


def test_playlist_regla_minimo_y_media(servicio):
    r = servicio.playlist(["ana", "beñat"], 4, "laborable", n=15)
    c = r["canciones"]
    assert r["n_canciones"] == 15 and [x["posicion"] for x in c] == list(range(1, 16))
    for x in c:
        p = [m["percentil"] for m in x["miembros"].values()]
        assert x["gusto_grupo"] == pytest.approx(min(p), abs=1e-3)
        assert x["desempate"] == pytest.approx(sum(p) / len(p), abs=1e-3)
    claves = [(x["gusto_grupo"], x["desempate"]) for x in c]
    assert claves == sorted(claves, reverse=True)


def test_playlist_por_duracion_y_exclusion(servicio):
    r = servicio.playlist(["ana"], 5, "fin_semana", n=None, duracion_min=20, excluir_artistas=["artista 1"])
    assert 20 <= r["duracion_total_min"] <= 25
    assert all(x["artista"] != "Artista 1" for x in r["canciones"])


def test_playlist_sin_horario(servicio):
    r = servicio.playlist(["ana", "beñat"], None, None, n=30)
    c = r["canciones"]
    assert r["franja"] is None and r["tipo_dia"] == "cualquiera" and r["n_canciones"] == 30
    for x in c:
        assert x["conocida_por_todos"] == all(m["origen"] == "real" for m in x["miembros"].values())
    claves = [(x["conocida_por_todos"], x["gusto_grupo"], x["desempate"]) for x in c]
    assert claves == sorted(claves, reverse=True)                      # primero las que conoce todo el grupo


def test_sin_horario_usa_todas_las_escuchas(servicio):
    g = servicio.gustos(["ana"], None, None)
    assert len(g) == len(servicio.catalogo)                             # una fila por canción, no por contexto
    total = servicio.recuentos[servicio.recuentos["persona"] == "ana"].groupby("track_id")["n_escuchas"].sum()
    assert g.set_index("track_id")["escuchas_contexto"].reindex(total.index).tolist() == total.tolist()


def test_horario_a_medias(servicio):
    with pytest.raises(ErrorEntrada):
        servicio.playlist(["ana"], 2, None)


def test_personas_repetidas(servicio):
    with pytest.raises(ErrorEntrada):
        servicio.playlist(["ana", "ana"], 1, "laborable")


def test_contexto_de_fecha():
    assert contexto_de_fecha("2026-11-28T22:30") == (5, "fin_semana")       # sábado
    assert contexto_de_fecha("2026-11-27T13:00:00Z") == (3, "laborable")     # 14:00 en Madrid


def test_artistas_una_sola_grafia_por_nombre(servicio, monkeypatch):
    base = servicio.catalogo.iloc[[0, 0, 0, 0]].copy()
    base["artista"] = ["Duko", "duko", "DUKO ", "Duko"]
    monkeypatch.setattr(servicio, "catalogo", base)
    assert servicio.artistas() == ["Duko"]                                      # la grafía más frecuente, sin duplicar por mayúsculas


# ---------------------------------------------------------------- web: franjas juntas, una canción y búsquedas
def test_varias_franjas_suman_escuchas_y_promedian_la_prediccion(servicio):
    una = [servicio.gustos(["ana"], fr, "laborable").set_index("track_id") for fr in (1, 2)]
    juntas = servicio.gustos(["ana"], [1, 2], "laborable").set_index("track_id")
    t = juntas.index[0]
    assert juntas.loc[t, "escuchas_contexto"] == una[0].loc[t, "escuchas_contexto"] + una[1].loc[t, "escuchas_contexto"]
    assert juntas.loc[t, "prevista"] == pytest.approx((una[0].loc[t, "prevista"] + una[1].loc[t, "prevista"]) / 2)
    r = servicio.playlist(["ana", "beñat"], [5, 0], "laborable", n=5)
    assert r["franja"] == 5 and r["franja_horas"] == "20-4h" and r["n_canciones"] == 5


def test_franjas_no_validas(servicio):
    with pytest.raises(ErrorEntrada):
        servicio.playlist(["ana"], [1, 1], "laborable", n=5)
    with pytest.raises(ErrorEntrada):
        servicio.playlist(["ana"], [6], "laborable", n=5)


def test_cancion_en_playlist_coincide_con_la_playlist(servicio):
    p = servicio.playlist(["ana", "beñat"], 4, "laborable", n=10)
    dentro, ultima = p["canciones"][0], p["canciones"][-1]
    r = servicio.cancion_en_playlist(dentro["track_id"], ["ana", "beñat"], 4, "laborable", n=10)
    assert r["entra"] and r["posicion"] == 1 and r["n_canciones_playlist"] == 10
    assert r["gusto_grupo"] == pytest.approx(dentro["gusto_grupo"])
    assert set(r["miembros"]) == {"ana", "beñat"} and all(0 <= m["tasa_no_salto"] <= 1 for m in r["miembros"].values())
    assert servicio.cancion_en_playlist(ultima["track_id"], ["ana", "beñat"], 4, "laborable", n=10)["posicion"] == 10
    completa = servicio.playlist(["ana", "beñat"], 4, "laborable", n=20)["canciones"]
    fuera = servicio.cancion_en_playlist(completa[-1]["track_id"], ["ana", "beñat"], 4, "laborable", n=10)
    assert not fuera["entra"] and fuera["posicion"] == 20


def test_cancion_de_artista_quitado_y_desconocida(servicio):
    c = servicio.playlist(["ana"], 4, "laborable", n=1)["canciones"][0]
    r = servicio.cancion_en_playlist(c["track_id"], ["ana"], 4, "laborable", n=10, excluir_artistas=[c["artista"]])
    assert r["artista_excluido"] and not r["entra"] and r["posicion"] is None
    with pytest.raises(ErrorEntrada) as e:
        servicio.cancion_en_playlist("no-existe", ["ana"], 4, "laborable")
    assert e.value.codigo == 404


def test_buscar_canciones_y_artistas_por_persona(servicio):
    nombre = servicio.catalogo["artista"].iloc[0]
    encontradas = servicio.buscar_canciones(nombre.upper())
    assert encontradas and all(nombre.casefold() in (c["artista"] + c["cancion"]).casefold() for c in encontradas)
    assert servicio.buscar_canciones("   ") == []
    a = servicio.artistas_por_persona()
    assert a and {x["artista"] for x in a} <= set(servicio.artistas())
    assert all(x["personas"] and set(x["personas"]) <= {"ana", "beñat"} and min(x["personas"].values()) > 0 for x in a)


def test_excluir_canciones_concretas(servicio):
    antes = servicio.playlist(["ana", "beñat"], 4, "laborable", n=5)["canciones"]
    fuera = [antes[0]["track_id"], antes[2]["track_id"]]
    despues = servicio.playlist(["ana", "beñat"], 4, "laborable", n=5, excluir_canciones=fuera)["canciones"]
    assert len(despues) == 5 and not {c["track_id"] for c in despues} & set(fuera)
    r = servicio.cancion_en_playlist(fuera[0], ["ana", "beñat"], 4, "laborable", n=5, excluir_canciones=fuera)
    assert r["cancion_excluida"] and not r["artista_excluido"] and not r["entra"] and r["posicion"] is None


def test_buscar_canciones_dice_de_quien_son(servicio):
    nombre = servicio.catalogo["artista"].iloc[0]
    encontradas = servicio.buscar_canciones(nombre)
    assert encontradas and all(c["personas"] and min(c["personas"].values()) > 0 for c in encontradas)
    assert all(set(c["personas"]) <= {"ana", "beñat"} for c in encontradas)
