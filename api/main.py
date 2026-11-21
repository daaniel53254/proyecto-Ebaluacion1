"""API de «Playlist perfecta para viajes en grupo» (NPD Entertainment · CEBANC).

Arranque (desde la raíz del repositorio, después de «python -m api.preparar_datos»):
    uvicorn api.main:app --reload --port 8000
Documentación interactiva: http://localhost:8000/docs
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from api.esquemas import Error, PeticionPlaylist, PeticionPrediccion, RespuestaPlaylist, RespuestaPrediccion
from api.servicio import NOMBRES_FRANJA, ErrorEntrada, Servicio

log = logging.getLogger("api")
CARPETA_DATOS = Path(os.environ.get("API_DATOS", Path(__file__).resolve().parent / "datos"))
ESTADO: dict = {"servicio": None, "error_carga": None}


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    try:
        ESTADO["servicio"] = Servicio.desde_carpeta(CARPETA_DATOS)
        log.info("Modelo cargado: %s", ESTADO["servicio"].origen_modelo)
    except Exception as e:                                   # la API arranca igual y lo dice en /salud
        ESTADO["error_carga"] = f"{type(e).__name__}: {e}"
        log.error("No se pudo cargar el servicio: %s", ESTADO["error_carga"])
    yield


app = FastAPI(
    title="Playlist perfecta para viajes en grupo",
    version="1.0.0",
    description=(
        "API del proyecto del 1er trimestre de Big Data + IA (CEBANC) · NPD Entertainment.\n\n"
        "- **Objetivo 1** · `POST /objetivo1/prediccion`: tasa de no salto prevista para una persona, una canción y un "
        "contexto (franja de 4 horas × tipo de día). Modelo: `playlist_tasa_no_salto@produccion` del registro de MLflow.\n"
        "- **Objetivo 2** · `POST /objetivo2/playlist`: playlist para el grupo en un contexto. Gusto de cada miembro = su "
        "tasa real si tiene 5 o más escuchas en ese contexto, si no la prevista; se pasa a percentil, el gusto del grupo es "
        "el mínimo de los percentiles y los empates se deshacen con la media.\n\n"
        "Los errores devuelven siempre `{\"error\": ..., \"detalle\": ...}`."),
    lifespan=ciclo_de_vida,
    openapi_tags=[{"name": "información"}, {"name": "objetivo 1"}, {"name": "objetivo 2"}],
)

RESPUESTAS_ERROR = {404: {"model": Error, "description": "persona o canción desconocidas"},
                    422: {"model": Error, "description": "entrada no válida"},
                    503: {"model": Error, "description": "el modelo no está cargado"}}


def servicio() -> Servicio:
    if ESTADO["servicio"] is None:
        raise ErrorEntrada("El modelo no está cargado", 503, ESTADO["error_carga"])
    return ESTADO["servicio"]


@app.exception_handler(ErrorEntrada)
async def _error_entrada(request: Request, e: ErrorEntrada):
    return JSONResponse(status_code=e.codigo, content={"error": e.mensaje, "detalle": e.detalle})


@app.exception_handler(RequestValidationError)
async def _error_validacion(request: Request, e: RequestValidationError):
    detalle = [{"campo": ".".join(str(x) for x in err["loc"][1:]), "problema": err["msg"]} for err in e.errors()]
    return JSONResponse(status_code=422, content={"error": "Entrada no válida", "detalle": detalle})


@app.exception_handler(Exception)
async def _error_interno(request: Request, e: Exception):
    log.exception("Error no controlado")
    return JSONResponse(status_code=500, content={"error": "Error interno", "detalle": type(e).__name__})


@app.get("/", tags=["información"])
def inicio():
    return {"proyecto": "Playlist perfecta para viajes en grupo", "documentacion": "/docs",
            "endpoints": ["/salud", "/modelo", "/personas", "/contextos", "/objetivo1/prediccion", "/objetivo2/playlist"]}


@app.get("/salud", tags=["información"])
def salud():
    s = ESTADO["servicio"]
    return {"estado": "ok" if s else "sin modelo", "modelo": s.origen_modelo if s else None, "error": ESTADO["error_carga"]}


@app.get("/modelo", tags=["información"], responses=RESPUESTAS_ERROR)
def modelo():
    return servicio().descripcion()


@app.get("/personas", tags=["información"], responses=RESPUESTAS_ERROR)
def personas():
    p = servicio().personas
    return [{"persona": i, "escuchas_periodo": int(r.escuchas), "tasa_no_salto": round(float(r.tasa_no_salto), 4)}
            for i, r in p.iterrows()]


@app.get("/contextos", tags=["información"])
def contextos():
    return [{"franja": i, "horas": h, "tipo_dia": t} for t in ("laborable", "fin_semana") for i, h in enumerate(NOMBRES_FRANJA)]


@app.post("/objetivo1/prediccion", tags=["objetivo 1"], response_model=RespuestaPrediccion, responses=RESPUESTAS_ERROR)
def prediccion(peticion: PeticionPrediccion):
    """Tasa de no salto prevista (0 a 1) por persona × canción × contexto. Hasta 1.000 filas por petición."""
    s = servicio()
    filas = [f.model_dump() for f in peticion.filas]
    return {"modelo": s.origen_modelo, "predicciones": s.predecir(filas)}


@app.post("/objetivo2/playlist", tags=["objetivo 2"], response_model=RespuestaPlaylist, responses=RESPUESTAS_ERROR)
def playlist(peticion: PeticionPlaylist):
    """Playlist para el grupo en un contexto, ordenada por el gusto del grupo (mínimo de percentiles)."""
    return servicio().playlist(peticion.personas, peticion.franja, peticion.tipo_dia, peticion.n,
                               peticion.duracion_min, peticion.excluir_artistas)
