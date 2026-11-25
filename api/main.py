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

from fastapi import FastAPI, File, Form, Header, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from api.esquemas import (Error, PeticionEntraria, PeticionPlaylist, PeticionPrediccion, RespuestaEntraria, RespuestaPlaylist,
                          RespuestaPrediccion)
from api import historiales, privacidad
from api.caracteristicas import carpeta_historial_por_defecto
from api.preparacion import Preparacion
from api.servicio import NOMBRES_FRANJA, ErrorEntrada, Servicio

log = logging.getLogger("api")
RAIZ = Path(__file__).resolve().parent.parent
CARPETA_DATOS = Path(os.environ.get("API_DATOS", Path(__file__).resolve().parent / "datos"))
CARPETA_HISTORIAL = Path(os.environ.get("API_HISTORIAL", carpeta_historial_por_defecto(RAIZ)))
MAX_SUBIDA = 400 * 1024 * 1024
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
        "el mínimo de los percentiles y los empates se deshacen con la media. Con `\"historial\": \"completo\"` las "
        "candidatas salen de todo el historial (3 o más escuchas del grupo), el gusto mezcla lo real con lo previsto "
        "((no saltos + 5 × prevista) / (escuchas + 5)) y cada miembro conoce al menos un tercio de la lista; por defecto, "
        "`\"18_meses\"`. Con `\"ignorar_horario\": true` no se filtra por franja ni tipo de día.\n"
        "- **Objetivo 2 · canciones nuevas** · `POST /objetivo2/entraria`: ¿entraría en la playlist una canción que nadie "
        "ha escuchado? Probabilidad de que cada miembro la adopte (notebook 08), en percentil frente a sus novedades; "
        "entra si el mínimo del grupo es 0,80 o más.\n\n"
        "**Privacidad** · `GET /privacidad`: texto que acepta cada persona al subir su historial. Hace falta tener 16 años "
        "o más. Al subir un historial nuevo se devuelve un token (una sola vez): hay que enviarlo en la cabecera `X-Token` "
        "para borrar o sustituir ese historial.\n\n"
        "Los errores devuelven siempre `{\"error\": ..., \"detalle\": ...}`."),
    lifespan=ciclo_de_vida,
    openapi_tags=[{"name": "historiales"}, {"name": "privacidad"}, {"name": "información"}, {"name": "objetivo 1"},
                  {"name": "objetivo 2"}],
)

RESPUESTAS_ERROR = {403: {"model": Error, "description": "falta el token X-Token de esa persona o no coincide"},
                    404: {"model": Error, "description": "persona o canción desconocidas"},
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
            "endpoints": ["/historiales", "/privacidad", "/preparacion", "/salud", "/modelo", "/personas", "/contextos",
                          "/objetivo1/prediccion", "/objetivo2/playlist", "/objetivo2/entraria"]}


@app.get("/salud", tags=["información"])
def salud():
    s = ESTADO["servicio"]
    return {"estado": "ok" if s else "sin modelo", "modelo": s.origen_modelo if s else None,
            "preparacion": ESTADO["preparacion"].estado if ESTADO["preparacion"] else None}


@app.get("/privacidad", tags=["privacidad"])
def ver_privacidad():
    """Texto completo que acepta cada persona al subir su historial (versión, finalidad, datos, derechos y edad mínima)."""
    return {"version": privacidad.VERSION_TEXTO, "texto": privacidad.TEXTO_CONSENTIMIENTO,
            "edad_minima": privacidad.EDAD_MINIMA}


def _comprobar_token(carpeta: Path, x_token: str | None):
    if not privacidad.token_valido(carpeta, x_token):
        raise ErrorEntrada("Hace falta el token de esa persona en la cabecera X-Token (se dio al subir el historial)", 403)


@app.post("/historiales", tags=["historiales"], status_code=202, responses=RESPUESTAS_ERROR)
async def subir_historial(
        persona: str = Form(..., description="nombre con el que aparecerá en el grupo (p. ej. «ander»)"),
        consentimiento: bool = Form(..., description="acepto que se use mi historial para generar las playlists del "
                                                     "grupo (texto completo en GET /privacidad)"),
        mayor_de_16: bool = Form(..., description="confirmo que tengo 16 años o más"),
        archivo: UploadFile = File(..., description="el .zip que envía Spotify (Extended streaming history)"),
        x_token: str | None = Header(None, alias="X-Token", description="solo para sustituir un historial que ya existe")):
    """Sube el historial de una persona y reentrena el modelo con todos los historiales en segundo plano.

    Tu historial solo se usa para generar las playlists del grupo y se guarda sin IP ni país. Puedes borrarlo cuando
    quieras. Más información en GET /privacidad.

    Solo se guardan los ficheros Streaming_History_Audio_*.json y, de ellos, los campos de escucha (canción,
    artista, álbum, fecha, duración escuchada, cómo terminó y modo aleatorio), más la prueba del consentimiento.
    Si la persona es nueva, la respuesta trae su token una sola vez. Una nueva subida de la misma persona
    sustituye a la anterior y exige su token en la cabecera X-Token."""
    if not mayor_de_16:
        raise ErrorEntrada("Hace falta tener 16 años o más para usar el servicio", 422)
    if not consentimiento:
        raise ErrorEntrada("Hace falta el consentimiento para usar el historial", 422)
    if archivo.filename and not archivo.filename.lower().endswith(".zip"):
        raise ErrorEntrada("Sube el .zip tal como lo envía Spotify", 422)
    nombre = historiales.normalizar_persona(persona)
    carpeta = historiales.carpeta_de(nombre, CARPETA_HISTORIAL)
    token = None
    if carpeta.is_dir():
        _comprobar_token(carpeta, x_token)
        hash_token = privacidad.hash_guardado(carpeta)
    else:
        hash_token = None
    if hash_token is None:                          # persona nueva, o carpeta antigua sustituida con el token de administración
        token, hash_token = privacidad.nuevo_token()
    contenido = await archivo.read(MAX_SUBIDA + 1)
    if len(contenido) > MAX_SUBIDA:
        raise ErrorEntrada("El fichero supera los 400 MB", 413)
    resumen = historiales.guardar_zip(contenido, nombre, CARPETA_HISTORIAL,
                                      extras=privacidad.ficheros_extra(nombre, mayor_de_16, hash_token))
    prep = ESTADO["preparacion"].lanzar(f"subida de {resumen['persona']}")
    respuesta = {"historial": resumen, "preparacion": prep,
                 "siguiente": "consulta GET /preparacion; cuando diga «lista», la persona ya está en el modelo"}
    if token:
        respuesta["token"] = token
        respuesta["aviso_token"] = ("Guarda este token: solo se muestra ahora y hace falta (cabecera X-Token) para "
                                    "borrar o sustituir tu historial")
    return respuesta


@app.get("/historiales", tags=["historiales"])
def ver_historiales():
    """Personas con historial subido (estén ya o no en el modelo)."""
    en_modelo = set(ESTADO["servicio"].personas.index) if ESTADO["servicio"] else set()
    return [{**h, "en_el_modelo": h["persona"] in en_modelo} for h in historiales.listar(CARPETA_HISTORIAL)]


@app.delete("/historiales/{persona}", tags=["historiales"], status_code=202, responses=RESPUESTAS_ERROR)
def borrar_historial(persona: str, x_token: str | None = Header(None, alias="X-Token",
                                                                 description="token que se dio al subir el historial")):
    """Borra el historial de una persona (derecho de supresión, art. 17 del RGPD) y reentrena sin sus datos.

    Exige el token de esa persona en la cabecera X-Token (o el de administración, API_TOKEN_ADMIN)."""
    carpeta = historiales.carpeta_de(persona, CARPETA_HISTORIAL)
    if not carpeta.is_dir():
        raise ErrorEntrada(f"No hay historial de «{persona}»", 404)
    _comprobar_token(carpeta, x_token)
    historiales.borrar(persona, CARPETA_HISTORIAL)
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


@app.get("/contextos", tags=["información"])
def contextos():
    return [{"franja": i, "horas": h, "tipo_dia": t} for t in ("laborable", "fin_semana") for i, h in enumerate(NOMBRES_FRANJA)]


@app.post("/objetivo1/prediccion", tags=["objetivo 1"], response_model=RespuestaPrediccion, responses=RESPUESTAS_ERROR)
def prediccion(peticion: PeticionPrediccion):
    """Tasa de no salto prevista (0 a 1) por persona × canción × contexto. Hasta 1.000 filas por petición."""
    s = servicio()
    filas = [f.model_dump() for f in peticion.filas]
    return {"modelo": s.origen_modelo, "predicciones": s.predecir(filas)}


@app.post("/objetivo2/playlist", tags=["objetivo 2"], response_model=RespuestaPlaylist, responses=RESPUESTAS_ERROR,
          response_model_exclude_unset=True)
def playlist(peticion: PeticionPlaylist):
    """Playlist para el grupo en un contexto, ordenada por el gusto del grupo (mínimo de percentiles)."""
    return servicio().playlist(peticion.personas, peticion.franja, peticion.tipo_dia, peticion.n,
                               peticion.duracion_min, peticion.excluir_artistas, peticion.historial,
                               detalle_miembros=peticion.detalle_miembros, desempate=peticion.desempate)


@app.post("/objetivo2/entraria", tags=["objetivo 2"], response_model=RespuestaEntraria,
          responses=RESPUESTAS_ERROR | {409: {"model": Error, "description": "el modelo de canciones nuevas no está preparado"}})
def entraria(peticion: PeticionEntraria):
    """¿Entraría en la playlist del grupo una canción que nadie ha escuchado? (notebook 08)

    Basta con el artista (y si puedes el álbum). Para cada miembro se calcula la probabilidad de que la **adopte**
    (la vuelva a escuchar sin saltarla en 90 días) según lo abierto que es a lo nuevo, cuánto conoce al artista y al
    álbum y si el resto del grupo los conoce. Esa probabilidad se compara con sus canciones nuevas de los últimos
    12 meses (percentil); el gusto del grupo es el mínimo y **entra si es 0,80 o más**. Las novedades ocupan como
    mucho `huecos_novedades` puestos en una playlist de 50."""
    return servicio().entraria(peticion.personas, [c.model_dump() for c in peticion.canciones],
                               peticion.franja, peticion.tipo_dia)
