# Web para el usuario · diseño

Fecha: 24/11/2026 · Proyecto «Playlist perfecta para viajes en grupo» (NPD Entertainment · CEBANC)

## 1. Qué es y por qué

Una web en la que cada persona del grupo aprende a pedir su historial a Spotify, lo sube y, cuando ya está en el modelo, el grupo saca la playlist del viaje con los mismos filtros que el panel de Streamlit y la puede llevar a Spotify.

Es el objetivo final del proyecto: que lo que hace la API (`api/`, FastAPI de Ander) lo pueda usar alguien que no sabe qué es `/docs`. Se enseñará en la presentación de la entrega final (24-26/11/2026), en el PC de Daniel.

## 2. Objetivos, lo que no entra y lo que sería un fracaso

**Objetivos**

1. Tutorial claro de cómo pedir a Spotify el «Historial ampliado de reproducción» y qué llega.
2. Subida del historial: el `.zip` tal cual o los `Streaming_History_Audio_*.json` sueltos.
3. Cada persona sube el suyo cuando quiera; la web enseña quién está ya en el modelo y si se está reentrenando.
4. Playlist del grupo con los filtros del panel: personas, franja (o «sin importar»), tipo de día, longitud en canciones o en minutos y artistas a quitar.
5. Resultado con las canciones, el gusto de cada miembro y el enlace de cada una a Spotify.
6. Exportar a Spotify de dos formas: **A)** «Crear en mi Spotify» (login de Spotify, crea la playlist en la cuenta) y **B)** «Copiar enlaces» (se pegan con Ctrl+V en una playlist de Spotify Escritorio).
7. Botón para que una persona borre su historial (RGPD, art. 17), que la API ya permite.

**No entra**

- Desplegar en internet: funciona en local (`127.0.0.1`).
- Cuentas de usuario o contraseñas propias: cualquiera que abra la web puede subir o borrar (es una demo).
- Cambiar el modelo o la lógica de la playlist: se usa tal cual `POST /objetivo2/playlist`.
- Descargar la lista en CSV (no se pidió).

**Fracaso aunque funcione**

- Que la subida mande a la API ficheros que no hacen falta (los `Streaming_History_Video_*.json` u otros): se quitan en el navegador antes de enviar.
- Que en la demo se quede colgada sin decir nada mientras reentrena: siempre se ve en qué estado está.
- Que el botón de Spotify rompa la página si no está configurado o falla: entonces se oculta o avisa, y «Copiar enlaces» sigue ahí.
- Que no parezca de NPD Entertainment.

## 3. Restricciones

- **Identidad NPD:** negro `#040708`, naranja `#df4e32` (rellenos con texto blanco `#c8432a`), verde `#6ca67d`, blanco `#f4f4f2`; títulos en Montserrat; logo en `panel/img/npd_logo.png`. Colores de series (personas): `#d23f18`, `#52ab69`, `#3a84ca`, `#b98a00`, `#993f94`, en ese orden; los de estado no se reutilizan para series.
- **Todo en español.**
- **Spotify (reglas de febrero de 2026):** la app de desarrollo exige que el dueño (Daniel) tenga Premium; solo la pueden usar 5 cuentas apuntadas a mano; la dirección de vuelta tiene que ser `http://127.0.0.1:<puerto>/...` (no vale `localhost`). Endpoints: `POST /me/playlists` para crear y `POST /playlists/{id}/items` para añadir (los antiguos `/users/{id}/playlists` y `/playlists/{id}/tracks` ya no existen).
- **El historial tarda hasta 30 días** en llegar de Spotify: el tutorial lo avisa arriba del todo.
- **Tamaño:** el zip de Daniel ocupa ~66 MB descomprimido; la API admite hasta 400 MB.
- **Plazo:** entrega final del 24 al 26/11/2026.

## 4. Formas de construirla (elegida: Next.js)

| Opción | A favor | En contra |
|---|---|---|
| Web estática servida por la API en `/web` | Un solo comando, nada que instalar | Menos «de producto»; todo a mano en JS |
| **App Next.js/React en `web/`** (elegida) | Aspecto de producto, componentes, TypeScript; las skills instaladas la cubren | Node, compilar y un segundo servidor |
| Pestaña nueva en el panel de Streamlit | Lo más rápido | No parece una web para usuarios; tutorial pobre |

Daniel eligió Next.js porque hay tiempo, y las dos formas de exportar a Spotify (A y B).

## 5. Lo que decidió Daniel

- Aceptar **zip y JSON sueltos**, y quitar del zip lo que no sean `Streaming_History_Audio_*.json` (los `Streaming_History_Video_*.json` de podcasts y vídeos, el PDF de Spotify si viene, etc.).
- **Cada uno sube el suyo**; luego cualquiera elige quién viaja entre los que ya están.
- **Demo en clase**, en local.
- **Filtros como el panel** y, al final, las canciones con enlace; exportar con **A y B**.
- **Carpeta de demo aparte:** la web no toca `data/raw/` ni `api/datos/` (de ahí tiran el panel y el pipeline).
- **La demo empieza con daniel y ander ya en el modelo** (son los historiales con los que se entrenó); en directo se sube el historial de cualquier otra persona (p. ej. Aitor).
- **Nombres:** se ve el nombre que escribe cada uno al subir (no los seudónimos del panel).

## 6. Cómo funciona

### 6.1 Arquitectura

```
navegador (http://127.0.0.1:3000)  ── Next.js (web/)
      │  fetch directo                       │
      ▼                                      │ login PKCE (sin secreto)
API FastAPI (http://127.0.0.1:8000)          ▼
                                       accounts.spotify.com / api.spotify.com
```

- Next.js con App Router, TypeScript estricto y Tailwind, en la carpeta `web/` del repositorio. Todo lo que habla con la API se hace en el navegador (componentes cliente); no hace falta servidor de Next más allá de servir las páginas.
- La web llama a la API directamente. Para eso se añade a la API un `CORSMiddleware` que permite el origen `http://127.0.0.1:3000` (y `http://localhost:3000`), configurable con la variable `API_ORIGENES`. *(Decisión del constructor: no se usa el proxy de Next porque limita el tamaño del cuerpo de las subidas.)*
- La URL de la API va en `NEXT_PUBLIC_API_URL` (por defecto `http://127.0.0.1:8000`) y el Client ID de Spotify en `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`. Si este último no está, el botón A no aparece.

### 6.2 Cambios pequeños en la API

1. `CORSMiddleware` (arriba).
2. `GET /artistas`: lista ordenada de artistas del catálogo del modelo, para el selector «Quitar artistas» (el panel la saca de `srv.catalogo`).
3. Arranque: un `arrancar_web.bat` en la raíz que levanta la API y la web a la vez, para la demo. Fija `API_HISTORIAL=data/demo/raw` y `API_DATOS=data/demo/modelo`. Si `data/demo/raw` no existe, copia en ella `data/raw/daniel` y `data/raw/ander` y prepara el modelo (`python -m api.preparar_datos` con esas rutas). Un `arrancar_web.bat reiniciar` borra `data/demo/` y vuelve a ese estado inicial. `data/demo/` queda fuera de Git (ya lo está `data/`; comprobarlo). La web arranca con `next dev -H 127.0.0.1 -p 3000` (o `next start` tras compilar) para que el puerto coincida con la dirección de vuelta registrada en Spotify.

Los nombres que se ven son los que devuelve la API (`/personas`, `/historiales`), es decir, los que escribió cada uno al subir; no se usan los seudónimos del panel.

No se toca la lógica del modelo ni de la playlist. Hay que comprobar que `POST /objetivo2/playlist` respeta `ignorar_horario` (en `main.py` se pasan `franja` y `tipo_dia`, que el esquema deja a `null` cuando se ignora el horario).

### 6.3 Páginas

| Ruta | Qué hay |
|---|---|
| `/` | Portada: qué hace la web en tres pasos (pide tu historial → súbelo → sacad la playlist), con enlaces a cada uno y el estado de la API (`GET /salud`). |
| `/tutorial` | Paso a paso para pedir el historial (ver 6.4). |
| `/subir` | Formulario de subida (ver 6.5) y lista de quién está ya, con su botón de borrar. |
| `/playlist` | Filtros, resultado y exportación (ver 6.6 y 6.7). |
| `/spotify/vuelta` | Vuelta del login de Spotify: cambia el código por el token y termina de crear la playlist. |

Cabecera fija con el logo de NPD y los tres pasos; pie con la nota de privacidad.

### 6.4 Tutorial

Pasos numerados con dibujos propios (no capturas de Spotify) de cada pantalla:

1. Entra en spotify.com → Cuenta → **Privacidad de la cuenta** (enlace directo).
2. Baja hasta «Descarga tus datos» y marca **solo «Historial ampliado de reproducción»** (no hace falta «Datos de la cuenta»).
3. Pulsa **Solicitar datos** y confirma el correo que te manda Spotify.
4. Espera: **puede tardar hasta 30 días** (suele ser menos). Te llega un correo con el enlace de descarga, que caduca en unos días.
5. Descarga el `.zip` (`my_spotify_data.zip`). No hace falta descomprimirlo: súbelo tal cual en el paso siguiente.

Al final: qué datos se usan (canción, artista, álbum, fecha, tiempo escuchado, cómo terminó, modo aleatorio) y cuáles no (nada de la cuenta, IP ni dispositivo: la API se queda solo con esos campos) y botón «Ya lo tengo → subir».

### 6.5 Subida

- Campo **nombre** (lo que aparecerá en el grupo). Se valida igual que la API: de 2 a 30 caracteres, letras sin tilde, números, `_` o `-`, y se pasa a minúsculas.
- Zona para **arrastrar o elegir** un `.zip` o varios `.json`.
- En el navegador (con JSZip):
  - si es un zip, se abre y se quedan solo los ficheros cuyo nombre empieza por `Streaming_History_Audio_` y acaba en `.json`, estén en la carpeta que estén;
  - si son JSON sueltos, se quedan los que cumplan ese patrón y se avisa de los descartados;
  - se enseña el resumen antes de enviar: ficheros que se suben, cuáles se descartan y por qué;
  - si no queda ningún fichero de audio, se explica que hay que pedir el «Historial ampliado» (enlace al tutorial) y no se envía nada;
  - se crea un zip nuevo solo con esos ficheros y se envía a `POST /historiales` (`persona`, `consentimiento`, `archivo`).
- Casilla de **consentimiento** obligatoria con el texto de la API.
- Tras subir: resumen que devuelve la API (ficheros, escuchas, desde-hasta) y seguimiento de `GET /preparacion` cada 2 s hasta `lista` (o `error`, con su mensaje). Mientras, se ve «Entrenando el modelo con tu historial…».
- Si el nombre ya existe, se avisa antes de enviar de que **sustituye** su historial anterior.
- **Quién está ya** (`GET /historiales`): nombre, ficheros y si está en el modelo. Cada fila tiene «Borrar mis datos», con confirmación («se borra tu historial y se vuelve a entrenar sin él; no se puede deshacer») → `DELETE /historiales/{persona}`.
- Los errores de la API (`{"error", "detalle"}`) se enseñan tal cual en un aviso.

### 6.6 Playlist

- Si no hay modelo (`/salud` dice «sin modelo») o se está preparando, aviso con el estado y enlace a subir.
- **Filtros**, igual que el panel:
  - **Quién viaja:** chips de las personas del modelo (`GET /personas`), todas marcadas al principio; mínimo una.
  - **Franja:** «Sin importar» (por defecto, `ignorar_horario: true`) o una de las 6 de 4 horas (00-04 … 20-24).
  - **Día:** laborable o fin de semana (por defecto fin de semana); desactivado con «Sin importar».
  - **Longitud:** «Canciones» (10, 20, 30, 50, 75 o 100; por defecto 30) o «Minutos» (15 a 300 de 15 en 15; por defecto 120) → `n` o `duracion_min`.
  - **Quitar artistas:** buscador con selección múltiple sobre `GET /artistas`.
- Botón «Generar playlist» → `POST /objetivo2/playlist`. No se regenera sola en cada cambio.
- **Resultado:**
  - Cifras arriba: canciones, duración total (h y min), artistas distintos y % de canciones con gusto real de todos (`conocida_por_todos`).
  - Lista: posición, canción, artista, duración (m:ss), una barra por persona con su percentil (en su color de serie; marca si es «real» o «prevista»), barra del gusto del grupo y enlace «Escuchar» a `https://open.spotify.com/track/<track_id>`.
  - Barra horizontal sencilla «Cuánto le gusta la playlist a cada uno» (percentil medio por persona), como en el panel.
  - Texto corto de la regla: «cada canción vale lo que le gusta al que menos le gusta».

### 6.7 Exportar a Spotify

**B) Copiar enlaces** (siempre): copia al portapapeles los enlaces `https://open.spotify.com/track/<id>`, uno por línea, y enseña cómo pegarlos: abre Spotify Escritorio → crea una playlist → haz clic en ella → Ctrl+V.

**A) Crear en mi Spotify** (solo si hay `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`):

1. Se guarda la lista (ids, nombre propuesto «Viaje · <personas> · <fecha>») en `sessionStorage` y se redirige al login de Spotify con **PKCE** (sin secreto de cliente), permisos `playlist-modify-private playlist-modify-public`, `redirect_uri = http://127.0.0.1:3000/spotify/vuelta`.
2. En `/spotify/vuelta`: se cambia el código por el token, se crea la playlist privada con `POST /me/playlists` y se añaden las canciones con `POST /playlists/{id}/items` en lotes de 100 URIs `spotify:track:<id>`.
3. Se muestra el enlace a la playlist creada y un botón para volver.
4. Errores: si Spotify responde 403 (la cuenta no está en la lista de las 5 de la app), se explica que hay que pedir a Daniel que la añada y se ofrece «Copiar enlaces». El token no se guarda más allá de la pestaña.

**Lo que tiene que hacer Daniel** (fuera de la web): dar de alta la app en developer.spotify.com con su cuenta Premium, registrar `http://127.0.0.1:3000/spotify/vuelta`, apuntar las cuentas de Ander y Aitor y poner el Client ID en `web/.env.local`.

## 7. Lo que queda para el constructor

- Estructura interna de componentes, nombres de ficheros y estilo de código (siguiendo las skills `hzblj-skills` instaladas: componentes, hooks, type-safety, tailwind, nextjs-routing).
- El diseño visual concreto dentro de la identidad NPD (skill de diseño de webs instalada, `hallmark` o `diseno-web-premium`), los dibujos del tutorial y las animaciones.
- Cómo se tipan las respuestas de la API (a partir de `api/esquemas.py`).
- Pruebas: como mínimo, la lógica de filtrar el zip o los JSON y el flujo PKCE, con pruebas unitarias (Spotify simulado mientras no haya Client ID); y la web probada de punta a punta en el navegador contra la carpeta de demo, subiendo los JSON de Aitor (`data/dataset/datos aitor/`) y luego `danielHistoricoSpotify.zip` para probar el zip. Las pruebas de la API usan carpetas temporales, nunca `data/raw/` ni `api/datos/`.
- **Orden de trabajo (decisión de Claude),** para que cada paso ya funcione si se acaba el tiempo: API (CORS, `/artistas`, carpeta de demo) → subida y estado → playlist con filtros → «Copiar enlaces» → tutorial → «Crear en mi Spotify».
- **La exportación A** se construye y se prueba con Spotify simulado; la prueba real llega cuando Daniel dé de alta la app y pase el Client ID. Si no llega antes de la demo, queda oculta.
- Instrucciones de arranque en `web/README.md` y una línea en el README raíz.
