"""Prueba de la API con un tercer historial que no se ha usado para entrenar (anexo A.8 del informe).

Con la API arrancada (api\\arrancar_api.bat o `uvicorn api.main:app --port 8000`):

    python scripts/probar_tercer_historial.py --zip ruta/al/my_spotify_data.zip --persona carla \\
        --franja 3 --tipo-dia fin_semana --n 30

1. Sube el zip con consentimiento (pregunta antes si la persona ha aceptado y tiene 16 años o más).
2. Espera a que GET /preparacion diga «lista» (la API reentrena con los tres historiales).
3. Pide POST /objetivo2/playlist para todas las personas del modelo en ese contexto e imprime la lista con el
   origen del gusto de cada miembro (real, mezcla o prevista).
4. Pregunta si borrar el historial subido (DELETE /historiales/{persona} con el token de la subida).

No guarda nada en disco: ni el historial ni la salida. No subas a Git el zip ni lo que imprime.
Solo usa la biblioteca estándar de Python.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path


def pedir(metodo: str, url: str, cuerpo: bytes | None = None, cabeceras: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(url, data=cuerpo, method=metodo, headers=cabeceras or {})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except json.JSONDecodeError:
            return e.code, {"error": e.reason}


def formulario(campos: dict, fichero: Path) -> tuple[bytes, str]:
    """multipart/form-data con los campos de texto y el zip (sin dependencias externas)."""
    limite = uuid.uuid4().hex
    partes = []
    for k, v in campos.items():
        partes.append(f'--{limite}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    partes.append(f'--{limite}\r\nContent-Disposition: form-data; name="archivo"; filename="{fichero.name}"\r\n'
                  'Content-Type: application/zip\r\n\r\n'.encode() + fichero.read_bytes() + b"\r\n")
    partes.append(f"--{limite}--\r\n".encode())
    return b"".join(partes), f"multipart/form-data; boundary={limite}"


def si(pregunta: str) -> bool:
    return input(f"{pregunta} [s/N] ").strip().lower() in ("s", "si", "sí", "y", "yes")


def main():
    a = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    a.add_argument("--zip", required=True, type=Path, help="el .zip del historial ampliado de Spotify")
    a.add_argument("--persona", required=True, help="nombre en el grupo (2 a 30 letras sin tilde, números, _ o -)")
    a.add_argument("--franja", type=int, default=3, choices=range(6), help="0 = 0-4 h ... 5 = 20-24 h (por defecto 3)")
    a.add_argument("--tipo-dia", default="fin_semana", choices=["laborable", "fin_semana"])
    a.add_argument("--n", type=int, default=30, help="canciones de la playlist (por defecto 30)")
    a.add_argument("--historial", default="18_meses", choices=["18_meses", "completo"])
    a.add_argument("--api", default="http://localhost:8000", help="dirección de la API")
    a.add_argument("--token", help="X-Token, solo si esa persona ya tiene historial subido")
    args = a.parse_args()
    api = args.api.rstrip("/")

    if not args.zip.is_file():
        sys.exit(f"No existe {args.zip}")
    codigo, salud = pedir("GET", f"{api}/salud")
    if codigo != 200:
        sys.exit(f"La API no responde en {api} (¿está arrancada?)")

    _, priv = pedir("GET", f"{api}/privacidad")
    print(f"\nTexto del consentimiento (versión {priv.get('version')}):\n{priv.get('texto')}\n")
    if not si(f"¿«{args.persona}» ha aceptado este texto y tiene 16 años o más?"):
        sys.exit("Sin consentimiento no se sube nada.")

    # 1. Subida
    cuerpo, tipo = formulario({"persona": args.persona, "consentimiento": "true", "mayor_de_16": "true"}, args.zip)
    cab = {"Content-Type": tipo, **({"X-Token": args.token} if args.token else {})}
    codigo, r = pedir("POST", f"{api}/historiales", cuerpo, cab)
    if codigo != 202:
        sys.exit(f"La subida ha fallado ({codigo}): {r}")
    persona = r["historial"]["persona"]
    token = r.get("token") or args.token
    print(f"Subido: {r['historial']['escuchas']:,} escuchas de {r['historial']['desde']} a {r['historial']['hasta']}"
          .replace(",", "."))
    if r.get("token"):
        print(f"Token de «{persona}» (solo se muestra ahora): {r['token']}")

    # 2. Reentrenamiento
    inicio = time.time()
    while True:
        _, prep = pedir("GET", f"{api}/preparacion")
        if prep.get("estado") != "en_curso":
            break
        time.sleep(2)
    if prep.get("estado") != "lista":
        sys.exit(f"La preparación no ha terminado bien: {prep}")
    print(f"Modelo reentrenado en {time.time() - inicio:.0f} s · {prep.get('resumen')}")

    # 3. Playlist para todas las personas del modelo
    _, personas = pedir("GET", f"{api}/personas")
    grupo = [p["persona"] for p in personas]
    peticion = {"personas": grupo, "franja": args.franja, "tipo_dia": args.tipo_dia, "n": args.n,
                "historial": args.historial}
    codigo, pl = pedir("POST", f"{api}/objetivo2/playlist", json.dumps(peticion).encode(),
                       {"Content-Type": "application/json"})
    if codigo != 200:
        sys.exit(f"La playlist ha fallado ({codigo}): {pl}")
    print(f"\nPlaylist de {', '.join(grupo)} · {pl['franja_horas']} · {pl['tipo_dia']} · historial {pl['historial']}")
    print(f"{pl['n_canciones']} canciones, {pl['duracion_total_min']} min\n")
    ancho = max(len(p) for p in grupo)
    print(f"{'#':>3}  {'gusto':>5}  " + "  ".join(f"{p[:ancho]:<{ancho}}" for p in grupo) + "  canción · artista")
    cuenta = {p: {} for p in grupo}
    for c in pl["canciones"]:
        origen = {p: c["miembros"][p]["origen"] for p in grupo}
        for p, o in origen.items():
            cuenta[p][o] = cuenta[p].get(o, 0) + 1
        print(f"{c['posicion']:>3}  {c['gusto_grupo']:5.2f}  " + "  ".join(f"{origen[p]:<{ancho}}" for p in grupo)
              + f"  {c['cancion']} · {c['artista']}")
    print("\nOrigen del gusto por miembro:", json.dumps(cuenta, ensure_ascii=False))
    print(f"Canciones que conoce «{persona}» (gusto real o mezcla): "
          f"{sum(v for k, v in cuenta[persona].items() if k != 'prevista')} de {pl['n_canciones']}")

    # 4. Borrado
    if si(f"\n¿Borrar el historial de «{persona}» de la API (y reentrenar sin él)?"):
        codigo, r = pedir("DELETE", f"{api}/historiales/{persona}", cabeceras={"X-Token": token or ""})
        print("Borrado." if codigo == 202 else f"No se ha podido borrar ({codigo}): {r}")
    else:
        print(f"Se queda. Para borrarlo más tarde: DELETE {api}/historiales/{persona} con la cabecera X-Token.")


if __name__ == "__main__":
    main()
