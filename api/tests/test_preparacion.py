"""La preparación pendiente no deja ver «lista» hasta que acaba la última pasada."""
import threading

from api import preparacion as modulo
from api.preparacion import Preparacion

INFO = {"personas": ["ana"], "periodo": "x", "filas_entrenamiento": 1, "cv_mae": 0.1, "canciones_catalogo": 1}


def test_pendiente_sigue_en_curso_hasta_la_ultima_pasada(tmp_path, monkeypatch):
    soltar = [threading.Event(), threading.Event()]
    empezada = [threading.Event(), threading.Event()]
    pasadas = []

    def preparar_falso(*_args):
        n = len(pasadas)
        pasadas.append(n)
        empezada[n].set()
        assert soltar[n].wait(5)
        return INFO

    monkeypatch.setattr(modulo, "preparar", preparar_falso)
    monkeypatch.setattr(modulo.Servicio, "desde_carpeta", staticmethod(lambda _c: None))
    prep = Preparacion(tmp_path / "h", tmp_path / "d", lambda _s: None)

    prep.lanzar("primera")
    assert empezada[0].wait(5)
    assert prep.lanzar("subida de aitor")["estado"] == "en_curso"

    soltar[0].set()                                  # acaba la primera pasada; queda una pendiente
    assert empezada[1].wait(5)
    assert prep.estado["estado"] == "en_curso", prep.estado

    soltar[1].set()
    estado = prep.esperar(5)
    assert estado["estado"] == "lista" and len(pasadas) == 2
    assert "subida de aitor" in estado["motivo"]
