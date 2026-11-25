"""Regenera modelo y tablas en segundo plano cuando cambian los historiales, sin parar la API."""
import threading
import traceback
from datetime import datetime
from pathlib import Path

from api.preparar_datos import preparar
from api.servicio import Servicio


class Preparacion:
    def __init__(self, carpeta_historial: Path, carpeta_datos: Path, al_terminar):
        self.carpeta_historial, self.carpeta_datos = Path(carpeta_historial), Path(carpeta_datos)
        self.al_terminar = al_terminar                    # recibe el Servicio nuevo
        self._cerrojo = threading.Lock()
        self._cerrojo_estado = threading.Lock()     # lo pendiente y el estado publicado cambian juntos
        self._pendiente = False
        self.estado = {"estado": "sin_preparar", "motivo": None, "inicio": None, "fin": None, "error": None, "resumen": None}

    def lanzar(self, motivo: str) -> dict:
        """Pide una preparación. Si ya hay una en marcha, se hará otra al terminar (con los datos más nuevos)."""
        if not self._cerrojo.acquire(blocking=False):
            with self._cerrojo_estado:
                self._pendiente = True
                self.estado.update(estado="en_curso", motivo=f"{self.estado['motivo']} + {motivo}")
            return self.estado
        self.estado.update(estado="en_curso", motivo=motivo, inicio=_ahora(), fin=None, error=None)
        threading.Thread(target=self._ejecutar, daemon=True).start()
        return self.estado

    def _ejecutar(self):
        try:
            primera = True
            while True:
                if not primera:
                    self.estado.update(inicio=_ahora(), fin=None)
                primera = False
                self._pendiente = False
                final = self._pasada()
                # «lista» o «error» solo se publican si no queda nada pendiente; si no, sigue en_curso. Se comprueba
                # y se escribe a la vez que lanzar() marca lo pendiente, para que no se cuele una «lista» vieja.
                with self._cerrojo_estado:
                    if self._pendiente:
                        continue
                    self.estado.update(final)
                    break
        finally:
            self.estado["fin"] = _ahora()
            self._cerrojo.release()
        if self._pendiente:                       # llegó otra petición justo al terminar
            self.lanzar("cambios pendientes")

    def _pasada(self) -> dict:
        """Una preparación completa. Devuelve lo que hay que publicar en el estado al terminar."""
        try:
            info = preparar(self.carpeta_historial, "auto", 18, self.carpeta_datos)
            self.al_terminar(Servicio.desde_carpeta(self.carpeta_datos))
            return {"estado": "lista", "error": None, "resumen": {
                "personas": info["personas"], "periodo": info["periodo"], "filas_entrenamiento": info["filas_entrenamiento"],
                "cv_mae": round(info["cv_mae"], 4), "canciones_catalogo": info["canciones_catalogo"]}}
        except Exception as e:
            traceback.print_exc()
            return {"estado": "error", "error": f"{type(e).__name__}: {e}"}

    def esperar(self, segundos: float = 120) -> dict:
        """Espera a que termine la preparación en curso (útil en las pruebas y en scripts)."""
        if self._cerrojo.acquire(timeout=segundos):
            self._cerrojo.release()
        return self.estado


def _ahora():
    return datetime.now().isoformat(timespec="seconds")
