"""Opción historial="completo" del recomendador (todo el historial, gusto suavizado y reparto mínimo)."""
import shutil

import numpy as np
import pytest

from api.servicio import K_SUAVIZADO, ErrorEntrada, Servicio


def test_por_defecto_sigue_siendo_18_meses(servicio):
    a = servicio.playlist(["ana", "beñat"], 2, "laborable", n=20)
    b = servicio.playlist(["ana", "beñat"], 2, "laborable", n=20, historial="18_meses")
    assert a == b and a["historial"] == "18_meses"
    assert all(m["origen"] in ("real", "prevista") for c in a["canciones"] for m in c["miembros"].values())


def test_completo_incluye_canciones_antiguas(servicio_con_antiguas):
    s = servicio_con_antiguas
    assert "tOLD" not in s.gustos(["ana"], 1, "laborable")["track_id"].values
    g = s.gustos(["ana"], None, None, historial="completo").set_index("track_id")
    assert "tOLD" in g.index and g.loc["tOLD", "escuchas_contexto"] == 10 and g.loc["tOLD", "origen"] == "real"


def test_gusto_suavizado(servicio):
    g = servicio.gustos(["ana", "beñat"], 3, "fin_semana", historial="completo")
    real_ns = np.nan_to_num(g["tasa_real"]) * g["escuchas_contexto"]
    esperado = (real_ns + K_SUAVIZADO * g["prevista"]) / (g["escuchas_contexto"] + K_SUAVIZADO)
    assert np.allclose(g["gusto"], esperado)
    assert set(g["origen"]) <= {"real", "mezcla", "prevista"}


@pytest.mark.parametrize("franja,tipo", [(2, "laborable"), (None, None)])
def test_reparto_minimo(servicio_con_antiguas, franja, tipo):
    s = servicio_con_antiguas
    r = s.playlist(["ana", "beñat"], franja, tipo, n=40, historial="completo")
    assert r["historial"] == "completo" and r["n_canciones"] == 40
    conoce = s._propio_completo
    for p in ("ana", "beñat"):
        cuenta = 0
        for largo, c in enumerate(r["canciones"], start=1):
            cuenta += (p, c["track_id"]) in conoce.index
            assert cuenta >= int(largo / 3)


def test_reparto_reordena():
    import pandas as pd
    g = pd.DataFrame({"gusto_grupo": [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]}, index=list("abcdef"))
    conoce = pd.DataFrame({"x": [True] * 6, "y": [False, False, False, False, True, True]}, index=list("abcdef"))
    assert list(Servicio._reparto(g, conoce, 6).index) == ["a", "b", "e", "c", "d", "f"]
    assert list(Servicio._reparto(g, conoce, 3).index) == ["a", "b", "e"]


def test_historial_desconocido(servicio):
    with pytest.raises(ErrorEntrada):
        servicio.playlist(["ana"], 1, "laborable", historial="todo")


def test_sin_datos_completos_da_409(carpeta_datos, tmp_path):
    copia = tmp_path / "datos"
    shutil.copytree(carpeta_datos, copia)
    (copia / "recuentos_completo.csv.gz").unlink()
    s = Servicio.desde_carpeta(copia, usar_mlflow=False)
    assert s.playlist(["ana"], 1, "laborable", n=5)["n_canciones"] == 5
    with pytest.raises(ErrorEntrada) as e:
        s.playlist(["ana"], 1, "laborable", historial="completo")
    assert e.value.codigo == 409
