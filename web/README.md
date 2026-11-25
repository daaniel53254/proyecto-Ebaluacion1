# Web de usuario: playlist para viajes en grupo

Web en Next.js 15 (App Router, TypeScript estricto, Tailwind v4) que habla directamente con la API FastAPI del repositorio. Permite ver el estado del modelo, leer el tutorial para descargar el historial de Spotify, subir el historial de una persona, generar la playlist de un grupo y, opcionalmente, crearla en Spotify.

Páginas: `/` (portada), `/tutorial`, `/subir`, `/playlist` y `/spotify/vuelta` (vuelta del inicio de sesión de Spotify).

## Requisitos

- Node.js 20 o superior.
- Python con las dependencias de `api/requirements.txt` (el entorno virtual `.venv` del repositorio; si no existe, `arrancar_web.bat` usa Anaconda o el Python del sistema).

## Arrancar

Desde la raíz del repositorio, en Windows:

```bat
arrancar_web.bat
arrancar_web.bat reiniciar
```

- `arrancar_web.bat` prepara la carpeta de demo (solo la primera vez), arranca la API en `http://127.0.0.1:8000`, la web en `http://127.0.0.1:3000` y abre el navegador. Si falta `web/node_modules`, ejecuta `npm --prefix web install`.
- `arrancar_web.bat reiniciar` borra `data/demo` y la vuelve a crear desde `data/raw` (útil para volver a empezar solo con `daniel` y `ander`).

**Carpeta de demo.** La API trabaja sobre `data/demo`, que empieza con los historiales de `daniel` y `ander` copiados de `data/raw` y un modelo preparado en `data/demo/modelo`. No se toca `data/raw` ni `api/datos`: lo que se sube o se borra desde la web solo afecta a `data/demo`.

**A mano**, en dos terminales y desde la raíz. Antes hay que preparar `data/demo` (si no, la API arranca sin modelo): copia `data\raw\daniel` y `data\raw\ander` a `data\demo\raw` y entrena el modelo.

```bat
.venv\Scripts\python.exe -m api.preparar_datos --historial data\demo\raw --salida data\demo\modelo
set API_HISTORIAL=%CD%\data\demo\raw
set API_DATOS=%CD%\data\demo\modelo
.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000

npm --prefix web install
npm --prefix web run dev
```

**Primera vez, con internet.** `layout.tsx` usa `next/font/google` y descarga las fuentes Montserrat y Onest la primera vez que se arranca la web. Arráncala una vez con conexión antes de la clase; después funcionan sin red.

Abre siempre la web como **`http://127.0.0.1:3000`**, no como `localhost`: lo que se guarda en el navegador es por origen y la dirección de vuelta de Spotify es `127.0.0.1`.

## Variables de entorno

Web (copiar `web/.env.example` a `web/.env.local`):

| Variable | Valor por defecto | Para qué sirve |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Dirección de la API |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | vacío | Client ID de la app de Spotify; sin él, el botón «Crear en mi Spotify» no aparece (queda «Copiar enlaces») |

API:

| Variable | Para qué sirve |
|---|---|
| `API_ORIGENES` | Orígenes web permitidos por CORS |
| `API_HISTORIAL` | Carpeta con los historiales por persona (`arrancar_web.bat` usa `data\demo\raw`) |
| `API_DATOS` | Carpeta del modelo y los datos preparados (`arrancar_web.bat` usa `data\demo\modelo`) |

Tras cambiar `web/.env.local` hay que reiniciar `npm run dev`.

## Pruebas y compilación

```bash
npm --prefix web test         # Vitest
npm --prefix web run lint     # ESLint
npm --prefix web run build    # compilación de producción y comprobación de tipos
```

## Estructura de `web/src`

- `app/`: páginas y diseño general (`layout.tsx`, `globals.css`) de `/`, `tutorial`, `subir`, `playlist` y `spotify/vuelta`.
- `components/`: piezas de la interfaz, agrupadas por página (`subir`, `playlist`, `spotify`, `tutorial`) y componentes base en `ui/`.
- `hooks/`: la lógica de cada pantalla (estado de la API, historiales, subida, preparación del modelo, playlist, selector de artistas, copia de enlaces, Spotify).
- `lib/`: cliente de la API (`api.ts`), tipos, validación, formato, filtros, errores, resumen del zip y utilidades de Spotify, con sus pruebas `*.test.ts`.

## Dar de alta la app de Spotify

Hace falta solo para «Crear en mi Spotify». Generar la playlist y copiar los enlaces funciona sin ella. Se usa el flujo PKCE, así que no hay Client Secret.

1. Entra en <https://developer.spotify.com/dashboard> con la cuenta de Spotify que será la dueña de la app. Esa cuenta tiene que ser **Premium**.
2. Pulsa **Create app**. Pon un nombre y una descripción cualquiera.
3. En **Redirect URIs** añade exactamente `http://127.0.0.1:3000/spotify/vuelta`. No vale `localhost`.
4. En **Which API/SDKs are you planning to use?** marca **Web API** y acepta las condiciones.
5. Guarda la app y abre **Settings**. En **User Management** añade el nombre y el correo de cada cuenta de Spotify que vaya a crear playlists. En modo desarrollo el máximo es de **5 cuentas** y la dueña cuenta como una; quien no esté en la lista recibe un error de acceso.
6. Copia el **Client ID** de Settings y pégalo en `web/.env.local`:

   ```
   NEXT_PUBLIC_SPOTIFY_CLIENT_ID=el_client_id
   ```

7. Reinicia la web (`npm --prefix web run dev` o cierra y vuelve a abrir `arrancar_web.bat`).

**Estado:** la parte de exportar a Spotify todavía no se ha probado contra Spotify real. Está cubierta por pruebas unitarias, pero falta una prueba de punta a punta con una app dada de alta.

## Límites conocidos

- Hay que abrir la web como `http://127.0.0.1:3000`, no como `localhost`.
- No hay cuentas. Para subir hay que marcar que se tienen 16 años o más y aceptar el consentimiento. La primera vez que alguien sube su historial, la API devuelve un token. La web lo enseña una vez y lo guarda en ese navegador (`localStorage`). Para borrar o sustituir ese historial hay que enviarlo en la cabecera `X-Token`: desde otro navegador, la web pide pegarlo.
- Los historiales copiados a `data/demo` desde `data/raw` (daniel y ander) no tienen token. Solo se pueden borrar o sustituir con el token de administración (`API_TOKEN_ADMIN` en la API). Si no, se vuelve a empezar con `arrancar_web.bat reiniciar`.
- Es solo para la demo local: la API y la web se sirven en `127.0.0.1` y los datos viven en `data/demo`.
