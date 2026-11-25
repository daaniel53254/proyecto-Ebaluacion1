"""Subida y borrado de historiales de Spotify (el .zip del «Extended Streaming History»).

Cada persona sube su zip; se guardan solo los ficheros Streaming_History_Audio_*.json y, dentro de ellos,
solo los campos que usa el proyecto (sin IP, país ni identificadores del dispositivo). Se escriben en
data/raw/<persona>/, la carpeta de entrada de pipeline.sh, así que lo subido por la API también entra
en HDFS (bronze, silver y gold) en la siguiente ejecución del pipeline.
"""
import io
import json
import re
import shutil
import zipfile
from pathlib import Path, PurePosixPath

CAMPOS_GUARDADOS = ["ts", "ms_played", "spotify_track_uri", "master_metadata_track_name", "master_metadata_album_artist_name",
                    "master_metadata_album_album_name", "reason_start", "reason_end", "shuffle", "skipped", "offline", "platform"]
PATRON_FICHERO = re.compile(r"^Streaming_History_Audio_[\w\-]+\.json$", re.IGNORECASE)
PATRON_PERSONA = re.compile(r"^[a-z0-9][a-z0-9_\-]{1,29}$")
MAX_DESCOMPRIMIDO = 1_500 * 1024 * 1024        # 1,5 GB: evita las «bombas zip»
MAX_FICHEROS = 200


class ErrorHistorial(ValueError):
    pass


def normalizar_persona(nombre: str) -> str:
    p = (nombre or "").strip().lower().replace(" ", "_")
    if not PATRON_PERSONA.match(p):
        raise ErrorHistorial("El nombre debe tener de 2 a 30 caracteres: letras sin tilde, números, «_» o «-»")
    return p


def guardar_zip(contenido: bytes, persona: str, carpeta_historial: Path, extras: dict[str, str] | None = None) -> dict:
    """Valida el zip, extrae los ficheros de audio con los campos permitidos y sustituye los anteriores de esa persona.

    extras: otros ficheros de texto que se guardan en la misma carpeta (la prueba del consentimiento y el hash del
    token, ver api/privacidad.py). Se escriben antes de mover la carpeta, así que entran o no entran todos a la vez."""
    persona = normalizar_persona(persona)
    try:
        z = zipfile.ZipFile(io.BytesIO(contenido))
    except zipfile.BadZipFile:
        raise ErrorHistorial("El fichero no es un .zip válido")
    audio = [i for i in z.infolist() if not i.is_dir() and PATRON_FICHERO.match(PurePosixPath(i.filename).name)]
    if not audio:
        raise ErrorHistorial("El zip no tiene ficheros Streaming_History_Audio_*.json. "
                             "Hay que pedir a Spotify el «Historial ampliado de reproducción» (Extended streaming history).")
    if len(audio) > MAX_FICHEROS or sum(i.file_size for i in audio) > MAX_DESCOMPRIMIDO:
        raise ErrorHistorial("El zip es demasiado grande")

    temporal = Path(carpeta_historial) / f".subida_{persona}"
    shutil.rmtree(temporal, ignore_errors=True)
    temporal.mkdir(parents=True)
    escuchas, fechas, nombres = 0, [], set()
    try:
        for i in audio:
            nombre = PurePosixPath(i.filename).name            # solo el nombre: nada de rutas del zip
            if nombre.lower() in nombres:                       # dos ficheros con el mismo nombre en carpetas distintas
                nombre = f"{Path(nombre).stem}_{len(nombres)}.json"
            nombres.add(nombre.lower())
            try:
                filas = json.loads(z.read(i).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise ErrorHistorial(f"{nombre} no es un JSON válido")
            if not isinstance(filas, list) or (filas and not isinstance(filas[0], dict)) or (filas and "ts" not in filas[0]):
                raise ErrorHistorial(f"{nombre} no tiene el formato del historial de Spotify")
            limpias = [{k: r.get(k) for k in CAMPOS_GUARDADOS} for r in filas if isinstance(r, dict)]
            escuchas += len(limpias)
            fechas += [r["ts"] for r in limpias if r.get("ts")]
            with open(temporal / nombre, "w", encoding="utf-8") as f:
                json.dump(limpias, f, ensure_ascii=False)
        if escuchas == 0:
            raise ErrorHistorial("El historial está vacío")
        for nombre, texto in (extras or {}).items():
            (temporal / nombre).write_text(texto, encoding="utf-8")
        destino = Path(carpeta_historial) / persona
        shutil.rmtree(destino, ignore_errors=True)               # una nueva subida sustituye a la anterior
        temporal.rename(destino)
    finally:
        shutil.rmtree(temporal, ignore_errors=True)
    return {"persona": persona, "ficheros": len(audio), "escuchas": escuchas,
            "desde": min(fechas)[:10] if fechas else None, "hasta": max(fechas)[:10] if fechas else None}


def listar(carpeta_historial: Path) -> list[dict]:
    carpeta = Path(carpeta_historial)
    if not carpeta.exists():
        return []
    return [{"persona": p.name, "ficheros": len(list(p.glob("**/Streaming_History_Audio_*.json")))}
            for p in sorted(carpeta.iterdir()) if p.is_dir() and not p.name.startswith((".", "persona="))]


def carpeta_de(persona: str, carpeta_historial: Path) -> Path:
    """Carpeta del historial de una persona (exista o no)."""
    return Path(carpeta_historial) / normalizar_persona(persona)


def borrar(persona: str, carpeta_historial: Path) -> bool:
    destino = Path(carpeta_historial) / normalizar_persona(persona)
    if not destino.exists():
        return False
    shutil.rmtree(destino)
    return True
