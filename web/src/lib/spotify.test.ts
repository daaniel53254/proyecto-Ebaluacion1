import { afterEach, describe, expect, it, vi } from "vitest";

// El Client ID se lee al cargar el módulo: se pone uno falso antes de importarlo.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = "prueba";
});

import {
  CLAVE_PENDIENTE,
  CLIENT_ID,
  challengeDe,
  crearPlaylist,
  crearVerifier,
  ErrorSpotify,
  guardarPendiente,
  leerPendiente,
  nombrePlaylist,
  type Pendiente,
  PERMISOS,
  pedirToken,
  REDIRECT_URI,
  terminarExportacion,
  urlLogin,
} from "@/lib/spotify";

const MENSAJE_403 =
  "Tu cuenta de Spotify no está en la lista de la app. Pide a Daniel que la añada o usa «Copiar enlaces».";

const PENDIENTE: Pendiente = {
  nombre: "Viaje · ander, daniel · 24/11/2026",
  descripcion: "Playlist del grupo",
  trackIds: ["t1", "t2"],
  verifier: "v".repeat(64),
  state: "estado123",
};

const respuesta = (codigo: number, cuerpo: unknown): Response => {
  return new Response(JSON.stringify(cuerpo), { status: codigo, headers: { "Content-Type": "application/json" } });
};

const cuerpoJson = (llamada: unknown[] | undefined): unknown => {
  const opciones: unknown = llamada?.[1];
  if (typeof opciones !== "object" || opciones === null || !("body" in opciones)) return null;
  const { body } = opciones;
  return typeof body === "string" ? JSON.parse(body) : null;
};

// fetch simulado con la firma real, para que las llamadas guardadas lleven (url, opciones).
const fetchSimulado = (responder: (url: string) => Response) => {
  return vi.fn<typeof fetch>(async (entrada) => responder(String(entrada)));
};

const PLAYLIST_CREADA = { id: "p1", external_urls: { spotify: "https://open.spotify.com/playlist/p1" } };

afterEach(() => {
  sessionStorage.clear();
});

describe("PKCE", () => {
  it("challenge del ejemplo de la RFC 7636", async () => {
    expect(await challengeDe("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("verifier válido y distinto cada vez", () => {
    const verifier = crearVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
    expect(crearVerifier()).not.toBe(verifier);
  });

  it("urlLogin lleva todos los parámetros", () => {
    const url = new URL(urlLogin({ challenge: "reto", state: "estado" }));
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.spotify.com/authorize");
    const parametros = url.searchParams;
    expect(parametros.get("response_type")).toBe("code");
    expect(parametros.get("client_id")).toBe(CLIENT_ID);
    expect(parametros.get("client_id")).toBe("prueba");
    expect(parametros.get("redirect_uri")).toBe("http://127.0.0.1:3000/spotify/vuelta");
    expect(parametros.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(parametros.get("scope")).toBe("playlist-modify-private playlist-modify-public");
    expect(parametros.get("scope")).toBe(PERMISOS);
    expect(parametros.get("code_challenge_method")).toBe("S256");
    expect(parametros.get("code_challenge")).toBe("reto");
    expect(parametros.get("state")).toBe("estado");
  });
});

describe("pedirToken", () => {
  it("cambia el código por el token con el verifier y sin secreto", async () => {
    const simulado = fetchSimulado(() => respuesta(200, { access_token: "tok", token_type: "Bearer" }));
    vi.stubGlobal("fetch", simulado);

    expect(await pedirToken("codigo1", "verif1")).toBe("tok");

    const [url, opciones] = simulado.mock.calls[0] ?? [];
    expect(url).toBe("https://accounts.spotify.com/api/token");
    expect(opciones?.method).toBe("POST");
    const cuerpo = new URLSearchParams(String(opciones?.body));
    expect(Object.fromEntries(cuerpo)).toEqual({
      grant_type: "authorization_code",
      code: "codigo1",
      redirect_uri: REDIRECT_URI,
      client_id: "prueba",
      code_verifier: "verif1",
    });
    expect(new Headers(opciones?.headers).get("Content-Type")).toBe("application/x-www-form-urlencoded");
  });

  it("si Spotify no devuelve un token, da ErrorSpotify", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(400, { error: "invalid_grant" })));
    await expect(pedirToken("c", "v")).rejects.toBeInstanceOf(ErrorSpotify);
  });
});

describe("crearPlaylist", () => {
  it("con 230 canciones hace 1 + 3 llamadas", async () => {
    const simulado = fetchSimulado((url) => {
      return url.endsWith("/me/playlists") ? respuesta(201, PLAYLIST_CREADA) : respuesta(201, { snapshot_id: "s" });
    });
    vi.stubGlobal("fetch", simulado);
    const trackIds = Array.from({ length: 230 }, (_, i) => `id${i}`);

    const creada = await crearPlaylist("tok", { nombre: "Viaje", descripcion: "desc", trackIds });

    expect(creada).toEqual({ id: "p1", url: "https://open.spotify.com/playlist/p1" });
    expect(simulado).toHaveBeenCalledTimes(4);
    const [primera, ...lotes] = simulado.mock.calls;
    expect(primera?.[0]).toBe("https://api.spotify.com/v1/me/playlists");
    expect(cuerpoJson(primera)).toEqual({ name: "Viaje", description: "desc", public: false });
    expect(new Headers(primera?.[1]?.headers).get("Authorization")).toBe("Bearer tok");
    expect(lotes.map((llamada) => llamada[0])).toEqual(Array(3).fill("https://api.spotify.com/v1/playlists/p1/items"));
    const tamanos = lotes.map((llamada) => {
      const cuerpo = cuerpoJson(llamada);
      return typeof cuerpo === "object" && cuerpo !== null && "uris" in cuerpo && Array.isArray(cuerpo.uris)
        ? cuerpo.uris.length
        : -1;
    });
    expect(tamanos).toEqual([100, 100, 30]);
    expect(cuerpoJson(lotes[2])).toEqual({ uris: trackIds.slice(200).map((id) => `spotify:track:${id}`) });
  });

  it("403 da ErrorSpotify con el mensaje de la lista de la app", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(403, { error: { status: 403, message: "Forbidden" } })));
    const promesa = crearPlaylist("tok", { nombre: "Viaje", descripcion: "", trackIds: ["a"] });
    await expect(promesa).rejects.toMatchObject({ codigo: 403, message: MENSAJE_403 });
  });

  it("una respuesta sin enlace https no se acepta", async () => {
    const rara = { id: "p1", external_urls: { spotify: "javascript:alert(1)" } };
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(201, rara)));
    await expect(crearPlaylist("tok", { nombre: "V", descripcion: "", trackIds: [] })).rejects.toBeInstanceOf(
      ErrorSpotify,
    );
  });

  it("sin conexión da ErrorSpotify con código 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(crearPlaylist("tok", { nombre: "V", descripcion: "", trackIds: [] })).rejects.toMatchObject({
      codigo: 0,
    });
  });
});

describe("nombrePlaylist", () => {
  it("lleva las personas y la fecha", () => {
    expect(nombrePlaylist(["ander", "daniel"], new Date(2026, 10, 24))).toBe("Viaje · ander, daniel · 24/11/2026");
  });

  it("rellena con ceros el día y el mes", () => {
    expect(nombrePlaylist(["aitor"], new Date(2026, 0, 5))).toBe("Viaje · aitor · 05/01/2026");
  });
});

describe("pendiente en sessionStorage", () => {
  it("se guarda y se lee", () => {
    expect(guardarPendiente(PENDIENTE)).toBe(true);
    expect(leerPendiente()).toEqual(PENDIENTE);
  });

  it("algo ajeno o roto en la clave se lee como nada", () => {
    sessionStorage.setItem(CLAVE_PENDIENTE, "{no es json");
    expect(leerPendiente()).toBeNull();
    sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ ...PENDIENTE, trackIds: ["a:b"] }));
    expect(leerPendiente()).toBeNull();
  });

  it("si el navegador no deja usar sessionStorage, no revienta", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    expect(guardarPendiente(PENDIENTE)).toBe(false);
    expect(leerPendiente()).toBeNull();
  });
});

describe("terminarExportacion (vuelta del login)", () => {
  const parametros = (texto: string) => new URLSearchParams(texto);

  it("si se canceló el login, lo dice y no llama a Spotify", async () => {
    const simulado = vi.fn();
    vi.stubGlobal("fetch", simulado);
    const resultado = await terminarExportacion({ parametros: parametros("error=access_denied"), pendiente: PENDIENTE });
    expect(resultado).toEqual({ tipo: "cancelado" });
    expect(simulado).not.toHaveBeenCalled();
  });

  it("sin pendiente no hay playlist que exportar", async () => {
    const simulado = vi.fn();
    vi.stubGlobal("fetch", simulado);
    const resultado = await terminarExportacion({ parametros: parametros("code=x&state=y"), pendiente: null });
    expect(resultado).toEqual({ tipo: "sin_playlist" });
    expect(simulado).not.toHaveBeenCalled();
  });

  it("con un state distinto no se cambia el código", async () => {
    const simulado = vi.fn();
    vi.stubGlobal("fetch", simulado);
    const resultado = await terminarExportacion({ parametros: parametros("code=x&state=otro"), pendiente: PENDIENTE });
    expect(resultado).toEqual({ tipo: "sin_playlist" });
    expect(simulado).not.toHaveBeenCalled();
  });

  it("si falla el token, explica el fallo y guarda las canciones para copiarlas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(400, { error: "invalid_grant" })));
    const resultado = await terminarExportacion({
      parametros: parametros("code=x&state=estado123"),
      pendiente: PENDIENTE,
    });
    expect(resultado).toMatchObject({ tipo: "fallo", trackIds: ["t1", "t2"] });
  });

  it("con 403 da el mensaje de la lista de la app", async () => {
    const simulado = vi.fn(async (url: string) => {
      return url.includes("accounts.spotify.com") ? respuesta(200, { access_token: "tok" }) : respuesta(403, {});
    });
    vi.stubGlobal("fetch", simulado);
    const resultado = await terminarExportacion({
      parametros: parametros("code=x&state=estado123"),
      pendiente: PENDIENTE,
    });
    expect(resultado).toEqual({ tipo: "fallo", mensaje: MENSAJE_403, trackIds: ["t1", "t2"] });
  });

  it("si todo va bien, devuelve el enlace de la playlist", async () => {
    const simulado = vi.fn(async (url: string) => {
      if (url.includes("accounts.spotify.com")) return respuesta(200, { access_token: "tok" });
      return url.endsWith("/me/playlists") ? respuesta(201, PLAYLIST_CREADA) : respuesta(201, { snapshot_id: "s" });
    });
    vi.stubGlobal("fetch", simulado);
    const resultado = await terminarExportacion({
      parametros: parametros("code=x&state=estado123"),
      pendiente: PENDIENTE,
    });
    expect(resultado).toEqual({
      tipo: "creada",
      nombre: PENDIENTE.nombre,
      url: "https://open.spotify.com/playlist/p1",
    });
    expect(simulado).toHaveBeenCalledTimes(3);
  });
});
