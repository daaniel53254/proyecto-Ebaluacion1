# Web para el usuario · plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web en Next.js donde cada persona aprende a pedir su historial de Spotify, lo sube (zip o JSON sueltos) y el grupo saca la playlist con los filtros del panel y la exporta a Spotify.

**Architecture:** App Next.js (App Router, componentes cliente) en `web/` que llama directamente a la API FastAPI existente (`api/`) en `http://127.0.0.1:8000`, con CORS. El filtrado del zip se hace en el navegador con JSZip. La exportación A usa el login PKCE de Spotify sin secreto; la B copia enlaces. La demo usa `data/demo/` para no tocar `data/raw/` ni `api/datos/`.

**Tech Stack:** Next.js 15 + React 19 + TypeScript estricto + Tailwind CSS 4, JSZip 3, Vitest 3 + Testing Library (unitarias); FastAPI + pytest (API).

**Spec:** `docs/superpowers/specs/2026-11-24-web-usuario-design.md`

## Global Constraints

- Todo el texto de la interfaz en español.
- Colores NPD: negro `#040708`, naranja `#df4e32`, naranja de relleno con texto blanco `#c8432a`, verde `#6ca67d`, blanco `#f4f4f2`. Títulos en Montserrat. Logo: `panel/img/npd_logo.png`.
- Colores de serie por persona, en orden: `#d23f18`, `#52ab69`, `#3a84ca`, `#b98a00`, `#993f94`. Los colores de estado (verde de éxito, naranja de error) no se usan para series.
- La web siempre en `http://127.0.0.1:3000` (`next dev -H 127.0.0.1 -p 3000`); la API en `http://127.0.0.1:8000`.
- Variables: `NEXT_PUBLIC_API_URL` (por defecto `http://127.0.0.1:8000`), `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` (si falta, se oculta «Crear en mi Spotify»). En la API, `API_ORIGENES` (por defecto `http://127.0.0.1:3000,http://localhost:3000`).
- Ficheros válidos: el nombre (sin carpeta) cumple `/^Streaming_History_Audio_.*\.json$/i`. Todo lo demás se descarta en el navegador.
- Nombre de persona: `/^[a-z0-9_-]{2,30}$/` tras `trim().toLowerCase()` y espacios → `_` (igual que `api/historiales.py`).
- Spotify: `POST /me/playlists` y `POST /playlists/{id}/items` (lotes de 100 `spotify:track:<id>`); permisos `playlist-modify-private playlist-modify-public`; vuelta `http://127.0.0.1:3000/spotify/vuelta`.
- Nunca se usan `data/raw/` ni `api/datos/` en pruebas ni en la demo.
- Rama de trabajo: `daniel/web-usuario`, creada desde `daniel/playlist-sin-horario` (necesita `ignorar_horario`).
- Código siguiendo las skills `hzblj-skills` (const arrow, exportaciones con nombre, `type` en vez de `interface`, nada de `any` ni `as`, guard clauses, hooks para la lógica). Diseño visual con la skill `diseno-web-premium` o `hallmark`.

## Review Focus

1. **Zip de varios cientos de MB o JSON enormes:** la web no se cuelga sin avisar; enseña «Preparando ficheros…» mientras JSZip trabaja y el botón queda desactivado (Task 5).
2. **Subida mientras otro reentreno está en curso:** si `GET /preparacion` ya dice `en_curso`, la subida sigue y el seguimiento espera al estado final, sin dar por buena la preparación anterior (Task 5, prueba de `esperarPreparacion`).
3. **Persona elegida que desaparece del modelo** (alguien la borró en otra pestaña): la API responde 404 y la web enseña el error y recarga la lista de personas (Task 6).
4. **Filtros que dejan la lista vacía** (todos los artistas quitados): mensaje «No queda ninguna canción con estos filtros», sin tabla vacía ni botones de exportar (Task 6).
5. **Volver del login de Spotify sin datos guardados** (pestaña nueva, `sessionStorage` vacío, `state` distinto o el usuario canceló): mensaje claro y enlace a la playlist, nunca una pantalla en blanco (Task 7).

---

### Task 1: API · CORS y `GET /artistas`

**Files:**
- Modify: `api/main.py` (después de crear `app`; nuevo endpoint junto a `/personas`)
- Modify: `api/servicio.py` (método `artistas`)
- Test: `api/tests/test_api.py`

**Interfaces:**
- Produces: `GET /artistas` → `list[str]`, artistas distintos del catálogo, ordenados sin distinguir mayúsculas, sin vacíos. 503 si no hay modelo (como `/personas`). Cabeceras CORS para los orígenes de `API_ORIGENES`.

- [ ] **Step 1: Crear la rama**

Run: `git switch -c daniel/web-usuario`
Expected: `Switched to a new branch 'daniel/web-usuario'`

- [ ] **Step 2: Escribir las pruebas que fallan**

```python
def test_artistas(cliente):
    r = cliente.get("/artistas")
    assert r.status_code == 200
    a = r.json()
    assert a and all(isinstance(x, str) and x for x in a)
    assert a == sorted(a, key=str.casefold) and len(a) == len(set(a))


def test_cors_web(cliente):
    r = cliente.options("/personas", headers={"Origin": "http://127.0.0.1:3000",
                                              "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
    r = cliente.get("/salud", headers={"Origin": "http://otro.com"})
    assert "access-control-allow-origin" not in r.headers
```

- [ ] **Step 3: Ejecutarlas y ver que fallan**

Run: `python -m pytest api/tests/test_api.py -k "artistas or cors" -v`
Expected: FAIL (404 en `/artistas`, falta la cabecera CORS)

- [ ] **Step 4: Implementar**

`Servicio.artistas(self) -> list[str]` en `api/servicio.py` (a partir de `self.catalogo["artista"]`, `dropna`, quitar vacíos, únicos, `sorted(key=str.casefold)`). En `main.py`: `app.add_middleware(CORSMiddleware, allow_origins=ORIGENES, allow_methods=["*"], allow_headers=["*"])`, con `ORIGENES = [o.strip() for o in os.environ.get("API_ORIGENES", "http://127.0.0.1:3000,http://localhost:3000").split(",") if o.strip()]`. Endpoint `@app.get("/artistas", tags=["información"], responses=RESPUESTAS_ERROR)` que devuelve `servicio().artistas()`. Añadir `"/artistas"` a la lista de `inicio()`.

- [ ] **Step 5: Ejecutar toda la batería de la API**

Run: `python -m pytest api/tests -q`
Expected: todo PASS

- [ ] **Step 6: Commit**

```bash
git add api/main.py api/servicio.py api/tests/test_api.py
git commit -m "API: CORS para la web y GET /artistas"
```

---

### Task 2: Carpeta de demo y `arrancar_web.bat`

**Files:**
- Create: `arrancar_web.bat`
- Modify: `.gitignore` (añadir `data/demo/`)

**Interfaces:**
- Produces: `arrancar_web.bat` (arranca la API con `API_HISTORIAL=data\demo\raw` y `API_DATOS=data\demo\modelo` y la web en `127.0.0.1:3000`); `arrancar_web.bat reiniciar` (borra `data\demo` y lo recrea).

- [ ] **Step 1: Escribir `arrancar_web.bat`**

Pasos del script, en este orden (Python como en `api/arrancar_api.bat`: `%USERPROFILE%\anaconda3\python.exe` o `python`):
1. `cd /d "%~dp0"`.
2. Si el primer argumento es `reiniciar`, `rmdir /s /q data\demo`.
3. Si no existe `data\demo\raw`: `xcopy /e /i /q data\raw\daniel data\demo\raw\daniel` y lo mismo con `ander`; después `"%PY%" -m api.preparar_datos --historial data\demo\raw --salida data\demo\modelo`.
4. `pip install -q -r api\requirements.txt`; si no existe `web\node_modules`, `npm --prefix web install`.
5. `set API_HISTORIAL=%CD%\data\demo\raw` y `set API_DATOS=%CD%\data\demo\modelo`; `start "API" "%PY%" -m uvicorn api.main:app --host 127.0.0.1 --port 8000`.
6. `start "Web" npm --prefix web run dev`, y `start http://127.0.0.1:3000`.

- [ ] **Step 2: Añadir `data/demo/` a `.gitignore`**

- [ ] **Step 3: Comprobar la carpeta de demo (la web todavía no existe; el paso 6 fallará hasta la Task 3)**

Run: `arrancar_web.bat reiniciar`, y después `curl http://127.0.0.1:8000/personas`
Expected: `data\demo\raw\{daniel,ander}` y `data\demo\modelo\modelo.joblib` existen; `/personas` devuelve `daniel` y `ander`; `git status` no enseña nada de `data/demo`. `data/raw` no ha cambiado (`git diff --stat` vacío y la fecha de los ficheros igual).

- [ ] **Step 4: Commit**

```bash
git add arrancar_web.bat .gitignore
git commit -m "Demo: carpeta data/demo aparte y arranque de API + web"
```

---

### Task 3: Esqueleto de la web, tema NPD, cliente de la API y portada

**Files:**
- Create: `web/` con `npx create-next-app@15 web --ts --tailwind --app --eslint --src-dir --import-alias "@/*" --use-npm --no-turbopack`
- Create: `web/vitest.config.ts`, `web/vitest.setup.ts`
- Modify: `web/package.json` (scripts `"dev": "next dev -H 127.0.0.1 -p 3000"`, `"start": "next start -H 127.0.0.1 -p 3000"`, `"test": "vitest run"`)
- Create: `web/public/npd_logo.png` (copia de `panel/img/npd_logo.png`)
- Create: `web/src/app/globals.css` (tokens de color como variables CSS y en `@theme` de Tailwind)
- Create: `web/src/app/layout.tsx` (Montserrat con `next/font/google`, `lang="es"`, cabecera y pie)
- Create: `web/src/components/Cabecera.tsx`, `web/src/components/Pie.tsx`
- Create: `web/src/lib/api.ts`, `web/src/lib/tipos.ts`
- Create: `web/src/app/page.tsx` (portada)
- Test: `web/src/lib/api.test.ts`
- Create: `web/.env.example`

**Interfaces:**
- Produces (`web/src/lib/tipos.ts`), copiados de `api/esquemas.py`:
  - `type TipoDia = "laborable" | "fin_semana"`
  - `type Salud = { estado: "ok" | "sin modelo"; modelo: string | null; preparacion: EstadoPreparacion | null }`
  - `type EstadoPreparacion = { estado: "sin_preparar" | "en_curso" | "lista" | "error"; motivo?: string; error?: string; [k: string]: unknown }` (comprobar los campos reales en `api/preparacion.py`)
  - `type Historial = { persona: string; ficheros: number; en_el_modelo: boolean }`
  - `type ResumenSubida = { persona: string; ficheros: number; escuchas: number; desde: string | null; hasta: string | null }`
  - `type Persona = { persona: string; escuchas_periodo: number; tasa_no_salto: number }`
  - `type GustoMiembro = { gusto: number; percentil: number; origen: "real" | "prevista" }`
  - `type CancionPlaylist = { posicion: number; track_id: string; cancion: string; artista: string; duracion_s: number | null; gusto_grupo: number; desempate: number; conocida_por_todos: boolean; miembros: Record<string, GustoMiembro> }`
  - `type Playlist = { personas: string[]; franja: number | null; franja_horas: string; tipo_dia: string; regla: string; n_canciones: number; duracion_total_min: number; canciones: CancionPlaylist[] }`
  - `type PeticionPlaylist = { personas: string[]; ignorar_horario: boolean; franja?: number; tipo_dia?: TipoDia; n?: number | null; duracion_min?: number | null; excluir_artistas: string[] }`
- Produces (`web/src/lib/api.ts`):
  - `class ErrorApi extends Error { codigo: number; detalle: unknown }`; el mensaje es el `error` de `{"error","detalle"}`, o «No se puede conectar con la API» si `fetch` falla.
  - `obtenerSalud(): Promise<Salud>`, `obtenerHistoriales(): Promise<Historial[]>`, `obtenerPersonas(): Promise<Persona[]>`, `obtenerArtistas(): Promise<string[]>`, `obtenerPreparacion(): Promise<EstadoPreparacion>`
  - `subirHistorial(persona: string, consentimiento: boolean, zip: Blob): Promise<{ historial: ResumenSubida; preparacion: EstadoPreparacion }>` (FormData con `persona`, `consentimiento` = `"true"`, `archivo` con nombre `historial.zip`)
  - `borrarHistorial(persona: string): Promise<void>`
  - `pedirPlaylist(p: PeticionPlaylist): Promise<Playlist>`
  - `URL_API: string` = `process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"`
- Produces: `COLORES_SERIE: readonly string[]` y `colorPersona(i: number): string` en `web/src/lib/colores.ts`.

- [ ] **Step 1: Crear la app e instalar las dependencias**

Run: `npx create-next-app@15 web ...` (arriba), y luego `npm --prefix web i jszip@3` y `npm --prefix web i -D vitest@3 @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom`
Expected: `web/` creado; `npm --prefix web run build` compila

- [ ] **Step 2: Escribir las pruebas que fallan del cliente**

```ts
it("devuelve el JSON si la respuesta es 200", async () => {
  mockFetch(200, [{ persona: "ana", ficheros: 2, en_el_modelo: true }]);
  expect(await obtenerHistoriales()).toEqual([{ persona: "ana", ficheros: 2, en_el_modelo: true }]);
  expect(fetchLlamadoCon()).toBe("http://127.0.0.1:8000/historiales");
});
it("lanza ErrorApi con el mensaje de la API", async () => {
  mockFetch(422, { error: "Hace falta el consentimiento para usar el historial", detalle: null });
  await expect(subirHistorial("ana", false, new Blob())).rejects.toMatchObject(
    { codigo: 422, message: "Hace falta el consentimiento para usar el historial" });
});
it("lanza ErrorApi si no hay conexión", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  await expect(obtenerSalud()).rejects.toMatchObject({ codigo: 0, message: "No se puede conectar con la API" });
});
it("pedirPlaylist envía el cuerpo en JSON por POST", async () => { /* método POST a /objetivo2/playlist, cabecera JSON, cuerpo igual al argumento */ });
```

- [ ] **Step 3: Ejecutarlas y ver que fallan**

Run: `npm --prefix web test`
Expected: FAIL (módulo `@/lib/api` sin exportar)

- [ ] **Step 4: Implementar `tipos.ts`, `api.ts` y `colores.ts`**

- [ ] **Step 5: Ejecutar las pruebas**

Run: `npm --prefix web test`
Expected: PASS

- [ ] **Step 6: Tema, layout y portada**

- Tokens: `--npd-negro`, `--npd-naranja`, `--npd-naranja-relleno`, `--npd-verde`, `--npd-blanco`, con fondo oscuro (como el panel).
- Cabecera: logo y los tres pasos como navegación («1 · Pide tu historial» `/tutorial`, «2 · Súbelo» `/subir`, «3 · Vuestra playlist» `/playlist`), con el actual marcado.
- Pie: «Solo se guardan los datos de escucha. Puedes borrar los tuyos cuando quieras en Súbelo.»
- Portada: titular, los tres pasos como tarjetas con enlace y un indicador del estado de la API (`obtenerSalud`: «API conectada · modelo listo», «API conectada · sin modelo» o «La API no está arrancada: ejecuta arrancar_web.bat»).

- [ ] **Step 7: Verificar en el navegador**

Run: `arrancar_web.bat`; abrir `http://127.0.0.1:3000`
Expected: portada con la identidad NPD y «modelo listo»; sin errores en la consola; con la API parada, el aviso de «no está arrancada».

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "Web: esqueleto Next.js con la identidad NPD, cliente de la API y portada"
```

---

### Task 4: Filtrado del zip y de los JSON en el navegador

**Files:**
- Create: `web/src/lib/historial.ts`
- Test: `web/src/lib/historial.test.ts`

**Interfaces:**
- Produces:
  - `type Descartado = { nombre: string; motivo: "no es del historial de audio" | "duplicado" }`
  - `type HistorialPreparado = { zip: Blob; incluidos: string[]; descartados: Descartado[]; bytes: number }`
  - `class ErrorHistorial extends Error {}`
  - `prepararHistorial(archivos: File[]): Promise<HistorialPreparado>`: acepta un único `.zip` o uno o más `.json` (no mezclados). Lanza `ErrorHistorial` con:
    - «Sube un .zip o los ficheros .json, no los dos a la vez» si se mezclan;
    - «Sube un solo .zip» si hay más de uno;
    - «El fichero no es un .zip válido» si JSZip falla;
    - «No hay ningún fichero Streaming_History_Audio_*.json. Pide a Spotify el «Historial ampliado de reproducción» (mira el paso 1).» si no queda ninguno.
  - `normalizarPersona(nombre: string): string | null` (`null` si no es válido; regla en Global Constraints).
  - Los incluidos van en la raíz del zip nuevo, con su nombre sin carpeta; si dos tienen el mismo nombre, el segundo sale en `descartados` como «duplicado».

- [ ] **Step 1: Escribir las pruebas que fallan** (cada zip de prueba se construye con JSZip dentro de la prueba)

```ts
it("del zip de Spotify se queda solo con los de audio", async () => {
  const zip = await zipCon({
    "Spotify Extended Streaming History/Streaming_History_Audio_2024.json": "[]",
    "Spotify Extended Streaming History/Streaming_History_Video_2024.json": "[]",
    "Spotify Extended Streaming History/ReadMeFirst_ExtendedStreamingHistory.pdf": "x" });
  const r = await prepararHistorial([zip]);
  expect(r.incluidos).toEqual(["Streaming_History_Audio_2024.json"]);
  expect(r.descartados.map(d => d.nombre)).toEqual(
    ["Streaming_History_Video_2024.json", "ReadMeFirst_ExtendedStreamingHistory.pdf"]);
  expect(Object.keys((await JSZip.loadAsync(r.zip)).files)).toEqual(["Streaming_History_Audio_2024.json"]);
});
it("JSON sueltos: empaqueta los de audio y descarta el resto", async () => { /* Audio_2023.json + Audio_2024_1.json + Video_2025.json → 2 incluidos, 1 descartado */ });
it("acepta mayúsculas en la extensión", async () => { /* Streaming_History_Audio_2024.JSON se incluye */ });
it("sin ficheros de audio lanza ErrorHistorial que manda al tutorial", async () => {
  await expect(prepararHistorial([await zipCon({ "a/Streaming_History_Video_2024.json": "[]" })]))
    .rejects.toThrow(/Historial ampliado de reproducción/);
});
it("rechaza mezclar zip y json", async () => { /* mensaje exacto de arriba */ });
it("zip roto", async () => { /* File de texto llamado x.zip → «El fichero no es un .zip válido» */ });
it("duplicados en carpetas distintas", async () => { /* a/Audio_2024.json y b/Audio_2024.json → 1 incluido, 1 «duplicado» */ });
it.each([[" Ana López ", "ana_lópez", null], ["Aitor", "aitor"], ["a", null], ["daniel-2", "daniel-2"]])(
  "normalizarPersona(%s)", ...);
```

(`"ana_lópez"` → `null`, porque lleva tilde.)

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `npm --prefix web test -- historial`
Expected: FAIL

- [ ] **Step 3: Implementar `historial.ts`** (JSZip `loadAsync`; `generateAsync({ type: "blob", compression: "DEFLATE" })`)

- [ ] **Step 4: Ejecutar las pruebas**

Run: `npm --prefix web test -- historial`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/historial.ts web/src/lib/historial.test.ts
git commit -m "Web: preparar el historial en el navegador (solo Streaming_History_Audio)"
```

---

### Task 5: Página «Súbelo» (`/subir`)

**Files:**
- Create: `web/src/app/subir/page.tsx`
- Create: `web/src/components/subir/FormularioSubida.tsx`, `ZonaArchivos.tsx`, `ResumenArchivos.tsx`, `EstadoEntrenamiento.tsx`, `ListaPersonas.tsx`
- Create: `web/src/hooks/usePreparacion.ts`, `web/src/hooks/useHistoriales.ts`
- Create: `web/src/lib/preparacion.ts`
- Test: `web/src/lib/preparacion.test.ts`, `web/src/components/subir/FormularioSubida.test.tsx`

**Interfaces:**
- Consumes: `prepararHistorial`, `normalizarPersona` (Task 4); `subirHistorial`, `obtenerPreparacion`, `obtenerHistoriales`, `borrarHistorial` (Task 3).
- Produces: `esperarPreparacion(leer: () => Promise<EstadoPreparacion>, opciones?: { cadaMs?: number; alCambiar?: (e: EstadoPreparacion) => void; senal?: AbortSignal }): Promise<EstadoPreparacion>`. Sondea cada `cadaMs` (por defecto 2000) hasta `lista` o `error`. Solo da por buena una `lista` después de haber visto `en_curso`, o si la respuesta de `subirHistorial` ya traía `en_curso` (Review Focus 2). Se pasa el estado inicial devuelto por la subida.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
it("espera de en_curso a lista", async () => {
  const leer = secuencia([{ estado: "en_curso" }, { estado: "en_curso" }, { estado: "lista" }]);
  expect((await esperarPreparacion(leer, { cadaMs: 0 })).estado).toBe("lista");
  expect(leer).toHaveBeenCalledTimes(3);
});
it("no se fía de una «lista» anterior a ver en_curso", async () => {
  const leer = secuencia([{ estado: "lista", motivo: "anterior" }, { estado: "en_curso" }, { estado: "lista", motivo: "subida de aitor" }]);
  expect((await esperarPreparacion(leer, { cadaMs: 0 })).motivo).toBe("subida de aitor");
});
it("termina en error", async () => { /* en_curso → error: devuelve el error */ });
```

En `FormularioSubida.test.tsx`, con la API simulada:
- el botón «Subir» queda desactivado sin nombre válido, sin consentimiento o sin archivos;
- al elegir un zip con Audio y Video, se ve «Se suben 1 fichero · Se descartan 1» con el nombre del descartado;
- si el nombre ya está en `obtenerHistoriales`, se ve «Ya hay un historial de «ana»: se sustituirá»;
- mientras `prepararHistorial` trabaja, se ve «Preparando ficheros…» y el botón está desactivado (Review Focus 1);
- el error de la API sale en un aviso con el mensaje.

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `npm --prefix web test -- preparacion FormularioSubida`
Expected: FAIL

- [ ] **Step 3: Implementar** `esperarPreparacion`, los hooks y los componentes, según el apartado 6.5 del spec. Textos fijos:
- consentimiento: «Acepto que se use mi historial para generar las playlists del grupo.»;
- entrenando: «Entrenando el modelo con tu historial…»;
- listo: «¡Listo! Ya estás en el modelo. → Vuestra playlist»;
- confirmación de borrado: «Se borra tu historial y se vuelve a entrenar sin él. No se puede deshacer.».

`ListaPersonas` enseña nombre, ficheros y «en el modelo» o «entrenando…»; recarga después de subir, de borrar y al terminar la preparación.

- [ ] **Step 4: Ejecutar las pruebas**

Run: `npm --prefix web test`
Expected: PASS

- [ ] **Step 5: Verificar en el navegador contra la demo**

Run: `arrancar_web.bat reiniciar`; en `/subir`, nombre `aitor`, arrastrar los 5 JSON de `data/dataset/datos aitor/` y subir.
Expected: resumen con 5 ficheros; «Entrenando…» y luego «¡Listo!»; la lista enseña aitor, ander y daniel; `data/raw/` sin cambios. Borrar a aitor: desaparece y vuelve a entrenar.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "Web: página para subir el historial, seguimiento del reentreno y borrado"
```

---

### Task 6: Página «Vuestra playlist» (`/playlist`) con filtros, resultado y «Copiar enlaces»

**Files:**
- Create: `web/src/app/playlist/page.tsx`
- Create: `web/src/components/playlist/Filtros.tsx`, `SelectorArtistas.tsx`, `Resultado.tsx`, `Cifras.tsx`, `TablaCanciones.tsx`, `GustoPorPersona.tsx`, `Exportar.tsx`
- Create: `web/src/lib/filtros.ts`, `web/src/lib/formato.ts`
- Test: `web/src/lib/filtros.test.ts`, `web/src/lib/formato.test.ts`, `web/src/components/playlist/Resultado.test.tsx`

**Interfaces:**
- Consumes: `obtenerPersonas`, `obtenerArtistas`, `pedirPlaylist`, `obtenerSalud`, `colorPersona` (Task 3).
- Produces:
  - `type Filtros = { personas: string[]; franja: number | null; tipoDia: TipoDia; modo: "canciones" | "minutos"; canciones: 10 | 20 | 30 | 50 | 75 | 100; minutos: number; quitar: string[] }`
  - `filtrosIniciales(personas: string[]): Filtros` → todas las personas, `franja: null`, `tipoDia: "fin_semana"`, `modo: "canciones"`, `canciones: 30`, `minutos: 120`, `quitar: []`
  - `aPeticion(f: Filtros): PeticionPlaylist`
  - `FRANJAS: readonly string[]` = `["00-04","04-08","08-12","12-16","16-20","20-24"]`
  - `enlaceCancion(id: string): string` → `https://open.spotify.com/track/<id>`
  - `textoEnlaces(c: CancionPlaylist[]): string` → un enlace por línea
  - `duracionCancion(s: number | null): string` → `"3:07"` o `"—"`
  - `duracionTotal(min: number): string` → `"2 h 05 min"`
  - El componente `Exportar` recibe `{ playlist: Playlist }` y es también el que monta el botón A (Task 7).

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
it("sin horario manda ignorar_horario y no manda franja", () => {
  expect(aPeticion(filtrosIniciales(["ana", "beñat"]))).toEqual(
    { personas: ["ana", "beñat"], ignorar_horario: true, n: 30, duracion_min: null, excluir_artistas: [] });
});
it("con franja manda franja y tipo_dia", () => {
  expect(aPeticion({ ...filtrosIniciales(["ana"]), franja: 3, tipoDia: "laborable" }))
    .toMatchObject({ ignorar_horario: false, franja: 3, tipo_dia: "laborable" });
});
it("en minutos manda duracion_min y n null", () => {
  expect(aPeticion({ ...filtrosIniciales(["ana"]), modo: "minutos", minutos: 90 }))
    .toMatchObject({ n: null, duracion_min: 90 });
});
it.each([[187, "3:07"], [null, "—"], [59, "0:59"]])("duracionCancion(%s)", ...);
it.each([[125.4, "2 h 05 min"], [42, "0 h 42 min"]])("duracionTotal(%s)", ...);
it("textoEnlaces", () => { /* dos canciones → "https://open.spotify.com/track/a\nhttps://open.spotify.com/track/b" */ });
```

Antes de dar por buena la regla de `n: null`, comprobar en `api/esquemas.py` que la API acepta `n: null` con `duracion_min`. Si no lo acepta, no mandar `n`.

En `Resultado.test.tsx`:
- con 0 canciones se ve «No queda ninguna canción con estos filtros» y no hay botones de exportar (Review Focus 4);
- con canciones se ven las cifras (canciones, duración, artistas distintos, % «con gusto real de todos») y un enlace «Escuchar» por canción;
- «Copiar enlaces» llama a `navigator.clipboard.writeText(textoEnlaces(...))` y enseña «Enlaces copiados» con las instrucciones de pegado.

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `npm --prefix web test -- filtros formato Resultado`
Expected: FAIL

- [ ] **Step 3: Implementar**, según el apartado 6.6 del spec:
- «Generar playlist» lanza la petición; los filtros no la regeneran solos.
- Barra por persona con su `percentil` en su color y la marca «real» (relleno sólido) o «prevista» (relleno a rayas o más claro), con leyenda.
- Barra del gusto del grupo y la frase de la regla.
- `GustoPorPersona`: barras horizontales hechas con CSS del percentil medio por persona.
- Si `pedirPlaylist` da 404, se enseña el error y se recarga `obtenerPersonas` (Review Focus 3).
- Si `/salud` no dice «ok», aviso con enlace a «Súbelo» y sin filtros.
- Instrucciones de pegado: «Abre Spotify en el ordenador → crea una playlist → haz clic dentro de ella → Ctrl+V».

- [ ] **Step 4: Ejecutar las pruebas**

Run: `npm --prefix web test`
Expected: PASS

- [ ] **Step 5: Verificar en el navegador**

Contra la demo (daniel y ander):
- sin horario y 30 canciones → 30 filas;
- franja 16-20 y laborable → otra lista;
- 60 minutos → duración total ≤ ~60 min más una canción;
- quitar el primer artista de la lista → ya no aparece;
- comparar una lista con la pestaña de playlist del panel con los mismos filtros (la de la demo puede variar si el modelo se reentrenó, pero con daniel y ander debe coincidir con el panel si `api/datos` se preparó con los mismos historiales);
- pegar los enlaces copiados en una playlist de Spotify Escritorio.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "Web: playlist del grupo con los filtros del panel y copia de enlaces"
```

---

### Task 7: «Crear en mi Spotify» (PKCE) y `/spotify/vuelta`

**Files:**
- Create: `web/src/lib/spotify.ts`
- Create: `web/src/app/spotify/vuelta/page.tsx`
- Create: `web/src/components/playlist/BotonSpotify.tsx` (lo monta `Exportar` de la Task 6)
- Test: `web/src/lib/spotify.test.ts`

**Interfaces:**
- Produces (`spotify.ts`):
  - `CLIENT_ID: string | undefined` (= `process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID`), `REDIRECT_URI = "http://127.0.0.1:3000/spotify/vuelta"`, `PERMISOS = "playlist-modify-private playlist-modify-public"`
  - `type Pendiente = { nombre: string; descripcion: string; trackIds: string[]; verifier: string; state: string }`
  - `crearVerifier(): string` (64 caracteres de `[A-Za-z0-9-._~]`, con `crypto.getRandomValues`), `challengeDe(verifier: string): Promise<string>` (SHA-256 en base64url sin `=`)
  - `urlLogin(p: { challenge: string; state: string }): string` → `https://accounts.spotify.com/authorize?response_type=code&client_id=…&scope=…&redirect_uri=…&code_challenge_method=S256&code_challenge=…&state=…`
  - `iniciarExportacion(p: { nombre: string; descripcion: string; trackIds: string[] }): Promise<void>` (guarda `Pendiente` en `sessionStorage["npd_spotify"]` y redirige)
  - `pedirToken(code: string, verifier: string): Promise<string>` (`POST https://accounts.spotify.com/api/token`, form `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `code_verifier`)
  - `crearPlaylist(token: string, p: { nombre: string; descripcion: string; trackIds: string[] }): Promise<{ id: string; url: string }>` (`POST https://api.spotify.com/v1/me/playlists` con `{ name, description, public: false }`, y después `POST /v1/playlists/{id}/items` con `{ uris }` en lotes de 100; `url` = `external_urls.spotify`)
  - `class ErrorSpotify extends Error { codigo: number }`; con 403, el mensaje es «Tu cuenta de Spotify no está en la lista de la app. Pide a Daniel que la añada o usa «Copiar enlaces».»
  - `nombrePlaylist(personas: string[], fecha: Date): string` → `"Viaje · ander, daniel · 24/11/2026"`

- [ ] **Step 1: Escribir las pruebas que fallan** (con `fetch` simulado)

```ts
it("challenge del ejemplo de la RFC 7636", async () => {
  expect(await challengeDe("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});
it("verifier válido", () => { expect(crearVerifier()).toMatch(/^[A-Za-z0-9\-._~]{64}$/); });
it("urlLogin lleva todos los parámetros", () => { /* new URL(...).searchParams: client_id, redirect_uri exacto, scope, S256, state */ });
it("crearPlaylist con 230 canciones hace 1 + 3 llamadas", async () => {
  /* 1.ª a /v1/me/playlists con public:false; después 3 a /v1/playlists/p1/items con 100, 100 y 30 uris "spotify:track:…" */
});
it("403 da ErrorSpotify con el mensaje de la lista de la app", async () => { ... });
it("nombrePlaylist", () => { expect(nombrePlaylist(["ander", "daniel"], new Date(2026, 10, 24))).toBe("Viaje · ander, daniel · 24/11/2026"); });
```

- [ ] **Step 2: Ejecutarlas y ver que fallan**

Run: `npm --prefix web test -- spotify`
Expected: FAIL

- [ ] **Step 3: Implementar `spotify.ts`, `BotonSpotify` y `/spotify/vuelta`**

- `BotonSpotify` no se monta si `CLIENT_ID` no está.
- En `/spotify/vuelta` cubrir cada caso (Review Focus 5):
  - `?error=access_denied` → «Has cancelado el login de Spotify.»;
  - sin `Pendiente` en `sessionStorage` o `state` distinto → «No se encontró la playlist que querías exportar. Vuelve a generarla.»;
  - si todo va bien → «Creando la playlist…» → enlace «Abrir en Spotify» a `url`.
- En todos los casos, enlace «Volver a la playlist». Borrar `npd_spotify` al terminar, haya ido bien o mal. El token solo vive en memoria.

- [ ] **Step 4: Ejecutar las pruebas**

Run: `npm --prefix web test`
Expected: PASS

- [ ] **Step 5: Verificar sin Client ID**

Expected: no se ve el botón A; «Copiar enlaces» sigue ahí. Con un `NEXT_PUBLIC_SPOTIFY_CLIENT_ID=prueba` falso, el botón lleva a `accounts.spotify.com` con los parámetros correctos (Spotify dirá que el cliente no es válido: es lo esperado). La prueba real queda pendiente del Client ID de Daniel.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "Web: crear la playlist en la cuenta de Spotify (login PKCE)"
```

---

### Task 8: Tutorial (`/tutorial`)

**Files:**
- Create: `web/src/app/tutorial/page.tsx`
- Create: `web/src/components/tutorial/Paso.tsx` y un dibujo SVG por paso en `web/src/components/tutorial/dibujos/` (`Privacidad.tsx`, `Marcar.tsx`, `Solicitar.tsx`, `Correo.tsx`, `Descargar.tsx`)
- Test: `web/src/app/tutorial/page.test.tsx`

**Interfaces:**
- Consumes: nada de otras tareas (es contenido).

- [ ] **Step 1: Escribir la prueba que falla**

```ts
it("tiene los 5 pasos, el aviso de 30 días y el enlace a subir", () => {
  render(<Tutorial />);
  expect(screen.getAllByRole("listitem", { name: /paso/i })).toHaveLength(5);
  expect(screen.getByText(/hasta 30 días/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /privacidad de la cuenta/i })).toHaveAttribute("href", "https://www.spotify.com/es/account/privacy/");
  expect(screen.getByRole("link", { name: /ya lo tengo/i })).toHaveAttribute("href", "/subir");
});
```

- [ ] **Step 2: Ejecutarla y ver que falla**

Run: `npm --prefix web test -- tutorial`
Expected: FAIL

- [ ] **Step 3: Implementar**, con los pasos, textos y el bloque «qué datos se usan» del apartado 6.4 del spec. El aviso de «hasta 30 días» va destacado arriba del todo. Los dibujos son esquemas propios de cada pantalla (sin logos ni capturas de Spotify).

- [ ] **Step 4: Ejecutar las pruebas**

Run: `npm --prefix web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "Web: tutorial para pedir el historial ampliado de Spotify"
```

---

### Task 9: Documentación y prueba de punta a punta

**Files:**
- Create: `web/README.md` (arranque con `arrancar_web.bat`, `.env.local`, cómo dar de alta la app de Spotify paso a paso: dueño Premium, dirección de vuelta, máximo 5 cuentas, dónde poner el Client ID)
- Modify: `README.md` (una línea en la estructura del repositorio y otra en «Arrancar el entorno» que apunten a `web/README.md`)

- [ ] **Step 1: Escribir los README**

- [ ] **Step 2: Prueba de punta a punta en el navegador** (`arrancar_web.bat reiniciar`)

1. La portada enseña «modelo listo».
2. El tutorial se ve entero, también a 375 px de ancho.
3. Subir `danielHistoricoSpotify.zip` como `daniel`: el resumen enseña 10 ficheros incluidos y 3 Video descartados, la subida termina en «¡Listo!» y `data/raw/daniel` no ha cambiado.
4. Subir los JSON de Aitor como `aitor`.
5. Playlist para los 3 sin horario: la copia de enlaces funciona.
6. Borrar a aitor.
7. Ni la consola ni la API tienen errores.

Expected: todo funciona y `npm --prefix web run build` compila sin avisos de tipos.

- [ ] **Step 3: Commit**

```bash
git add web/README.md README.md
git commit -m "Web: instrucciones de arranque y de la app de Spotify"
```
