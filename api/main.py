"""API de «Playlist perfecta para viajes en grupo» (NPD Entertainment · CEBANC).

Arranque (desde la raíz del repositorio):
    uvicorn api.main:app --port 8000
Documentación interactiva: http://localhost:8000/docs

Flujo: cada persona sube el .zip de su historial de Spotify (POST /historiales) → la API guarda solo los
campos de escucha en data/raw/<persona>/ (entrada de pipeline.sh) → reentrena en segundo plano con todos los
historiales (unos segundos) → recarga el modelo y ya sirve predicciones y playlists con esa persona.
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from api.esquemas import Error, PeticionPlaylist, PeticionPrediccion, RespuestaPlaylist, RespuestaPrediccion
from api import historiales
from api.caracteristicas import carpeta_historial_por_defecto
from api.preparacion import Preparacion
from api.servicio import NOMBRES_FRANJA, ErrorEntrada, Servicio

log = logging.getLogger("api")
RAIZ = Path(__file__).resolve().parent.parent
CARPETA_DATOS = Path(os.environ.get("API_DATOS", Path(__file__).resolve().parent / "datos"))
CARPETA_HISTORIAL = Path(os.environ.get("API_HISTORIAL", carpeta_historial_por_defecto(RAIZ)))
MAX_SUBIDA = 400 * 1024 * 1024
# Orígenes de la web (Next.js) autorizados a llamar a la API desde el navegador; se cambian con API_ORIGENES (separados por comas)
ORIGENES = [o.strip() for o in os.environ.get("API_ORIGENES", "http://127.0.0.1:3000,http://localhost:3000").split(",") if o.strip()]
ESTADO: dict = {"servicio": None, "error_carga": None, "preparacion": None}


def _nuevo_servicio(s: Servicio):
    ESTADO["servicio"], ESTADO["error_carga"] = s, None
    log.info("Modelo recargado: %s", s.origen_modelo)


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    ESTADO["preparacion"] = Preparacion(CARPETA_HISTORIAL, CARPETA_DATOS, _nuevo_servicio)
    try:
        ESTADO["servicio"] = Servicio.desde_carpeta(CARPETA_DATOS)
        ESTADO["preparacion"].estado.update(estado="lista", motivo="datos ya preparados al arrancar")
        log.info("Modelo cargado: %s", ESTADO["servicio"].origen_modelo)
    except Exception as e:                                   # la API arranca igual y lo dice en /salud
        ESTADO["error_carga"] = f"{type(e).__name__}: {e}"
        if historiales.listar(CARPETA_HISTORIAL):            # hay historiales pero no modelo: se prepara solo
            ESTADO["preparacion"].lanzar("arranque sin modelo")
    yield


app = FastAPI(
    title="Playlist perfecta para viajes en grupo",
    version="1.0.0",
    description=(
        "API del proyecto del 1er trimestre de Big Data + IA (CEBANC) · NPD Entertainment.\n\n"
        "- **Historiales** · `POST /historiales`: cada persona sube el .zip de su historial de Spotify y la API "
        "reentrena sola con todos los historiales subidos (`GET /preparacion` dice cuándo ha terminado). "
        "`DELETE /historiales/{persona}` borra sus datos y vuelve a entrenar sin ellos.\n"
        "- **Objetivo 1** · `POST /objetivo1/prediccion`: tasa de no salto prevista para una persona, una canción y un "
        "contexto (franja de 4 horas × tipo de día). Modelo: `playlist_tasa_no_salto@produccion` del registro de MLflow.\n"
        "- **Objetivo 2** · `POST /objetivo2/playlist`: playlist para el grupo en un contexto. Gusto de cada miembro = su "
        "tasa real si tiene 5 o más escuchas en ese contexto, si no la prevista; se pasa a percentil, el gusto del grupo es "
        "el mínimo de los percentiles y los empates se deshacen con la media.\n\n"
        "Los errores devuelven siempre `{\"error\": ..., \"detalle\": ...}`."),
    lifespan=ciclo_de_vida,
    openapi_tags=[{"name": "historiales"}, {"name": "información"}, {"name": "objetivo 1"}, {"name": "objetivo 2"}],
)

app.add_middleware(CORSMiddleware, allow_origins=ORIGENES, allow_methods=["*"], allow_headers=["*"])

RESPUESTAS_ERROR = {404: {"model": Error, "description": "persona o canción desconocidas"},
                    422: {"model": Error, "description": "entrada no válida"},
                    503: {"model": Error, "description": "el modelo no está cargado"}}


def servicio() -> Servicio:
    if ESTADO["servicio"] is None:
        prep = ESTADO["preparacion"].estado if ESTADO["preparacion"] else None
        if prep and prep["estado"] == "en_curso":
            raise ErrorEntrada("El modelo se está preparando; prueba en unos segundos", 503, prep)
        raise ErrorEntrada("El modelo no está cargado: sube al menos un historial en POST /historiales", 503,
                           {"error_carga": ESTADO["error_carga"], "preparacion": prep})
    return ESTADO["servicio"]


@app.exception_handler(historiales.ErrorHistorial)
async def _error_historial(request: Request, e: historiales.ErrorHistorial):
    return JSONResponse(status_code=422, content={"error": str(e), "detalle": None})


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
            "endpoints": ["/historiales", "/preparacion", "/salud", "/modelo", "/personas", "/artistas", "/contextos",
                          "/objetivo1/prediccion", "/objetivo2/playlist"]}


@app.get("/salud", tags=["información"])
def salud():
    s = ESTADO["servicio"]
    return {"estado": "ok" if s else "sin modelo", "modelo": s.origen_modelo if s else None,
            "preparacion": ESTADO["preparacion"].estado if ESTADO["preparacion"] else None}


@app.post("/historiales", tags=["historiales"], status_code=202, responses=RESPUESTAS_ERROR)
async def subir_historial(
        persona: str = Form(..., description="nombre con el que aparecerá en el grupo (p. ej. «ander»)"),
        consentimiento: bool = Form(..., description="acepto que se use mi historial para generar las playlists del grupo"),
        archivo: UploadFile = File(..., description="el .zip que envía Spotify (Extended streaming history)")):
    """Sube el historial de una persona y reentrena el modelo con todos los historiales en segundo plano.

    Solo se guardan los ficheros Streaming_History_Audio_*.json y, de ellos, los campos de escucha (canción,
    artista, álbum, fecha, duración escuchada, cómo terminó y modo aleatorio). Una nueva subida de la misma
    persona sustituye a la anterior."""
    if not consentimiento:
        raise ErrorEntrada("Hace falta el consentimiento para usar el historial", 422)
    if archivo.filename and not archivo.filename.lower().endswith(".zip"):
        raise ErrorEntrada("Sube el .zip tal como lo envía Spotify", 422)
    contenido = await archivo.read(MAX_SUBIDA + 1)
    if len(contenido) > MAX_SUBIDA:
        raise ErrorEntrada("El fichero supera los 400 MB", 413)
    resumen = historiales.guardar_zip(contenido, persona, CARPETA_HISTORIAL)
    prep = ESTADO["preparacion"].lanzar(f"subida de {resumen['persona']}")
    return {"historial": resumen, "preparacion": prep,
            "siguiente": "consulta GET /preparacion; cuando diga «lista», la persona ya está en el modelo"}


@app.get("/historiales", tags=["historiales"])
def ver_historiales():
    """Personas con historial subido (estén ya o no en el modelo)."""
    en_modelo = set(ESTADO["servicio"].personas.index) if ESTADO["servicio"] else set()
    return [{**h, "en_el_modelo": h["persona"] in en_modelo} for h in historiales.listar(CARPETA_HISTORIAL)]


@app.delete("/historiales/{persona}", tags=["historiales"], status_code=202, responses=RESPUESTAS_ERROR)
def borrar_historial(persona: str):
    """Borra el historial de una persona (derecho de supresión, art. 17 del RGPD) y reentrena sin sus datos."""
    if not historiales.borrar(persona, CARPETA_HISTORIAL):
        raise ErrorEntrada(f"No hay historial de «{persona}»", 404)
    if not historiales.listar(CARPETA_HISTORIAL):
        ESTADO["servicio"] = None
        import shutil
        shutil.rmtree(CARPETA_DATOS, ignore_errors=True)
        return {"borrado": persona, "preparacion": "no quedan historiales: el modelo se ha retirado"}
    return {"borrado": persona, "preparacion": ESTADO["preparacion"].lanzar(f"borrado de {persona}")}


@app.get("/preparacion", tags=["historiales"])
def ver_preparacion():
    """Estado del último reentrenamiento: sin_preparar, en_curso, lista o error."""
    return ESTADO["preparacion"].estado


@app.post("/preparacion", tags=["historiales"], status_code=202)
def lanzar_preparacion():
    """Fuerza un reentrenamiento con los historiales que haya (por ejemplo, tras copiar ficheros a mano)."""
    if not historiales.listar(CARPETA_HISTORIAL):
        raise ErrorEntrada("No hay historiales: sube alguno en POST /historiales", 422)
    return ESTADO["preparacion"].lanzar("petición manual")


@app.get("/modelo", tags=["información"], responses=RESPUESTAS_ERROR)
def modelo():
    return servicio().descripcion()


@app.get("/personas", tags=["información"], responses=RESPUESTAS_ERROR)
def personas():
    p = servicio().personas
    return [{"persona": i, "escuchas_periodo": int(r.escuchas), "tasa_no_salto": round(float(r.tasa_no_salto), 4)}
            for i, r in p.iterrows()]


@app.get("/artistas", tags=["información"], responses=RESPUESTAS_ERROR)
def artistas():
    return servicio().artistas()


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
