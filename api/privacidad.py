"""Consentimiento y control de acceso a los historiales (RGPD).

- El texto que acepta cada persona al subir su historial y la prueba de ese consentimiento
  (data/raw/<persona>/consentimiento.json, sin IP ni datos del navegador).
- Un token por persona para borrar o sustituir su historial: se devuelve una sola vez al subirlo y solo se
  guarda su hash SHA-256 (data/raw/<persona>/.token). Las carpetas que ya existían sin token (las del equipo)
  solo se pueden borrar o sustituir con el token de administración de la variable de entorno API_TOKEN_ADMIN.

Ni consentimiento.json ni .token son Streaming_History_Audio_*.json, así que el modelo, listar y el pipeline
(bigdata/preparar.py) los ignoran.
"""
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

VERSION_TEXTO = "2026-11-23"
EDAD_MINIMA = 16
FINALIDAD = "generar las playlists del grupo de viaje a partir de los historiales de escucha de sus miembros"
FICHERO_CONSENTIMIENTO = "consentimiento.json"
FICHERO_TOKEN = ".token"

TEXTO_CONSENTIMIENTO = (
    "Responsable: el equipo del proyecto «Playlist perfecta para viajes en grupo» (NPD Entertainment, proyecto del "
    "1er trimestre de Big Data e IA de CEBANC). "
    f"Finalidad: {FINALIDAD}. "
    "Base jurídica: tu consentimiento (artículo 6.1.a del RGPD), que puedes retirar en cualquier momento. "
    "Qué se guarda: solo 12 campos de cada escucha (fecha, duración escuchada, canción, artista, álbum, identificador "
    "de la canción, cómo empezó y cómo terminó, modo aleatorio, si se saltó, si fue sin conexión y la plataforma); "
    "nunca la IP, el país ni otros datos de la cuenta. "
    "Conservación: el modelo usa los últimos 18 meses de escuchas; el historial se guarda hasta que pidas borrarlo. "
    "Derechos: acceso, rectificación y supresión. Para borrar tus datos usa DELETE /historiales/{persona} con el "
    "token que recibes al subir el historial; el modelo se vuelve a entrenar sin ellos. "
    f"Edad mínima: {EDAD_MINIMA} años (artículo 7 de la LOPDGDD).")


def documento_consentimiento(persona: str, mayor_de_16: bool, ahora: datetime | None = None) -> dict:
    """Prueba del consentimiento: quién, cuándo, qué versión del texto y para qué. Sin IP ni navegador."""
    ahora = ahora or datetime.now(ZoneInfo("Europe/Madrid"))
    return {"persona": persona, "fecha": ahora.isoformat(timespec="seconds"), "version_texto": VERSION_TEXTO,
            "finalidad": FINALIDAD, "mayor_de_16": bool(mayor_de_16)}


def nuevo_token() -> tuple[str, str]:
    """(token para la persona, hash que se guarda)."""
    token = secrets.token_urlsafe(24)
    return token, hash_token(token)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_guardado(carpeta_persona: Path) -> str | None:
    f = Path(carpeta_persona) / FICHERO_TOKEN
    return f.read_text(encoding="utf-8").strip() if f.exists() else None


def token_valido(carpeta_persona: Path, token: str | None) -> bool:
    """El token de la persona si su carpeta tiene .token; si no, solo el de administración (API_TOKEN_ADMIN)."""
    if not token:
        return False
    admin = os.environ.get("API_TOKEN_ADMIN")
    if admin and hmac.compare_digest(token, admin):
        return True
    guardado = hash_guardado(carpeta_persona)
    return guardado is not None and hmac.compare_digest(hash_token(token), guardado)


def ficheros_extra(persona: str, mayor_de_16: bool, hash_del_token: str) -> dict[str, str]:
    """Ficheros que se guardan junto al historial: la prueba del consentimiento y el hash del token."""
    return {FICHERO_CONSENTIMIENTO: json.dumps(documento_consentimiento(persona, mayor_de_16), ensure_ascii=False, indent=2),
            FICHERO_TOKEN: hash_del_token}
