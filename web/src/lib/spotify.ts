// «Crear en mi Spotify»: login con PKCE (sin secreto de cliente) y creación de la playlist privada.
// El verifier y el state solo viven en sessionStorage durante la ida y vuelta al login; el token, solo en memoria.
// Nunca se escriben en la consola ni el token ni el código.
import { esObjeto } from "@/lib/validacion";

const leerClientId = (valor: string | undefined): string | undefined => {
  const limpio = valor?.trim();
  return limpio === undefined || limpio === "" ? undefined : limpio;
};

// Next sustituye `process.env.NEXT_PUBLIC_*` al compilar: tiene que escribirse así, entero.
export const CLIENT_ID: string | undefined = leerClientId(process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID);
export const REDIRECT_URI = "http://127.0.0.1:3000/spotify/vuelta";
export const PERMISOS = "playlist-modify-private playlist-modify-public";
export const CLAVE_PENDIENTE = "npd_spotify";

const URL_AUTORIZAR = "https://accounts.spotify.com/authorize";
const URL_TOKEN = "https://accounts.spotify.com/api/token";
const URL_API = "https://api.spotify.com/v1";
const LOTE_CANCIONES = 100;
const LARGO_VERIFIER = 64;
const LARGO_STATE = 32;
const SIN_CONEXION = 0;
// Caracteres que la RFC 7636 deja usar en el verifier.
const CARACTERES_VERIFIER = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
const ID_CANCION = /^[A-Za-z0-9]+$/;

export const MENSAJE_LISTA_APP =
  "Tu cuenta de Spotify no está en la lista de la app. Pide a Daniel que la añada o usa «Copiar enlaces».";
const MENSAJE_SIN_CONEXION = "No se pudo conectar con Spotify. Revisa la conexión y vuelve a intentarlo.";
const MENSAJE_SESION = "Spotify no aceptó la sesión. Vuelve a la playlist e inténtalo otra vez.";
const MENSAJE_DEMASIADAS = "Spotify está recibiendo demasiadas peticiones. Espera un poco y vuelve a intentarlo.";
const MENSAJE_LOGIN = "Spotify no aceptó el login. Vuelve a la playlist e inténtalo otra vez.";
const MENSAJE_RARA = "Spotify devolvió una respuesta inesperada.";
const MENSAJE_SIN_CANCIONES =
  "Spotify creó la playlist, pero no dejó añadir las canciones. Ábrela y bórrala, o usa «Copiar enlaces».";
const MENSAJE_SIN_CLIENT_ID = "Falta el Client ID de la app de Spotify.";
const MENSAJE_SIN_ALMACEN =
  "Este navegador no deja guardar datos de la pestaña (¿ventana privada?), así que no se puede crear en Spotify. Usa «Copiar enlaces».";

export class ErrorSpotify extends Error {
  readonly codigo: number;
  // Solo si la playlist llegó a crearse en la cuenta pero algo falló después.
  readonly urlPlaylistCreada: string | undefined;

  constructor(mensaje: string, codigo: number, urlPlaylistCreada?: string) {
    super(mensaje);
    this.name = "ErrorSpotify";
    this.codigo = codigo;
    this.urlPlaylistCreada = urlPlaylistCreada;
  }
}

export type DatosPlaylist = { nombre: string; descripcion: string; trackIds: string[] };

export type Pendiente = DatosPlaylist & { verifier: string; state: string };

export type PlaylistCreada = { id: string; url: string };

export type ResultadoVuelta =
  | { tipo: "cancelado" }
  | { tipo: "sin_playlist" }
  | { tipo: "fallo"; mensaje: string; trackIds: string[] }
  | { tipo: "creada"; nombre: string; url: string };

// ---------- PKCE ----------

// Rechazo de bytes por encima del último múltiplo de 66, para que todos los caracteres salgan con la misma probabilidad.
const textoAleatorio = (largo: number): string => {
  const limite = 256 - (256 % CARACTERES_VERIFIER.length);
  let texto = "";
  while (texto.length < largo) {
    for (const byte of crypto.getRandomValues(new Uint8Array(largo))) {
      if (byte >= limite || texto.length >= largo) continue;
      texto += CARACTERES_VERIFIER.charAt(byte % CARACTERES_VERIFIER.length);
    }
  }
  return texto;
};

export const crearVerifier = (): string => {
  return textoAleatorio(LARGO_VERIFIER);
};

const base64Url = (bytes: Uint8Array): string => {
  const binario = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const challengeDe = async (verifier: string): Promise<string> => {
  const resumen = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(resumen));
};

const clientIdObligatorio = (): string => {
  if (CLIENT_ID === undefined) throw new ErrorSpotify(MENSAJE_SIN_CLIENT_ID, SIN_CONEXION);
  return CLIENT_ID;
};

export const urlLogin = ({ challenge, state }: { challenge: string; state: string }): string => {
  const parametros = new URLSearchParams({
    response_type: "code",
    client_id: clientIdObligatorio(),
    scope: PERMISOS,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  });
  return `${URL_AUTORIZAR}?${parametros.toString()}`;
};

// ---------- Lo pendiente en sessionStorage (puede lanzar en ventanas privadas: siempre con try/catch) ----------

const esListaDeIds = (valor: unknown): valor is string[] => {
  return Array.isArray(valor) && valor.every((id) => typeof id === "string" && ID_CANCION.test(id));
};

const esPendiente = (valor: unknown): valor is Pendiente => {
  if (!esObjeto(valor)) return false;
  return (
    typeof valor.nombre === "string" &&
    typeof valor.descripcion === "string" &&
    esListaDeIds(valor.trackIds) &&
    typeof valor.verifier === "string" &&
    typeof valor.state === "string" &&
    valor.state !== ""
  );
};

export const guardarPendiente = (pendiente: Pendiente): boolean => {
  try {
    sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify(pendiente));
    return true;
  } catch {
    return false;
  }
};

export const leerPendiente = (): Pendiente | null => {
  try {
    const guardado = sessionStorage.getItem(CLAVE_PENDIENTE);
    if (guardado === null) return null;
    const valor: unknown = JSON.parse(guardado);
    return esPendiente(valor) ? valor : null;
  } catch {
    return null;
  }
};

export const borrarPendiente = (): void => {
  try {
    sessionStorage.removeItem(CLAVE_PENDIENTE);
  } catch {
    // Si no se puede tocar sessionStorage, tampoco se pudo guardar nada en él.
  }
};

// Se prueba a escribir y borrar: en algunas ventanas privadas sessionStorage existe pero lanza al usarlo.
// El estado pendiente vive en sessionStorage, que es por origen: si la web no está en el de la dirección de vuelta, no vale.
export const origenValido = (origenActual: string): boolean => {
  return origenActual === new URL(REDIRECT_URI).origin;
};

export const hayAlmacenamiento = (): boolean => {
  const prueba = `${CLAVE_PENDIENTE}_prueba`;
  try {
    sessionStorage.setItem(prueba, "1");
    sessionStorage.removeItem(prueba);
    return true;
  } catch {
    return false;
  }
};

export const iniciarExportacion = async (datos: DatosPlaylist): Promise<void> => {
  const verifier = crearVerifier();
  const state = textoAleatorio(LARGO_STATE);
  const challenge = await challengeDe(verifier);
  const destino = urlLogin({ challenge, state });
  if (!guardarPendiente({ ...datos, verifier, state })) throw new ErrorSpotify(MENSAJE_SIN_ALMACEN, SIN_CONEXION);
  window.location.assign(destino);
};

// ---------- Llamadas a Spotify ----------

const mensajeDeCodigo = (codigo: number, porDefecto: string): string => {
  if (codigo === 403) return MENSAJE_LISTA_APP;
  if (codigo === 401) return MENSAJE_SESION;
  if (codigo === 429) return MENSAJE_DEMASIADAS;
  return porDefecto;
};

const leerJson = async (respuesta: Response): Promise<unknown> => {
  try {
    const cuerpo: unknown = await respuesta.json();
    return cuerpo;
  } catch {
    return null;
  }
};

const llamar = async (url: string, opciones: RequestInit, mensajeFallo: string): Promise<unknown> => {
  const respuesta = await fetch(url, opciones).catch(() => {
    throw new ErrorSpotify(MENSAJE_SIN_CONEXION, SIN_CONEXION);
  });
  if (!respuesta.ok) throw new ErrorSpotify(mensajeDeCodigo(respuesta.status, mensajeFallo), respuesta.status);
  return leerJson(respuesta);
};

export const pedirToken = async (code: string, verifier: string): Promise<string> => {
  const cuerpo = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientIdObligatorio(),
    code_verifier: verifier,
  });
  const opciones: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: cuerpo.toString(),
  };
  const respuesta = await llamar(URL_TOKEN, opciones, MENSAJE_LOGIN);
  if (!esObjeto(respuesta) || typeof respuesta.access_token !== "string" || respuesta.access_token === "") {
    throw new ErrorSpotify(MENSAJE_LOGIN, SIN_CONEXION);
  }
  return respuesta.access_token;
};

// Solo se acepta un enlace https: es el href de «Abrir en Spotify».
const playlistDeRespuesta = (valor: unknown): PlaylistCreada | null => {
  if (!esObjeto(valor) || typeof valor.id !== "string" || !esObjeto(valor.external_urls)) return null;
  const url = valor.external_urls.spotify;
  if (typeof url !== "string" || !url.startsWith("https://")) return null;
  return { id: valor.id, url };
};

const enLotes = <T>(lista: T[], tamano: number): T[][] => {
  const lotes: T[][] = [];
  for (let inicio = 0; inicio < lista.length; inicio += tamano) lotes.push(lista.slice(inicio, inicio + tamano));
  return lotes;
};

const peticionJson = (token: string, cuerpo: unknown): RequestInit => {
  return {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  };
};

export const crearPlaylist = async (token: string, datos: DatosPlaylist): Promise<PlaylistCreada> => {
  const fallo = "Spotify no dejó crear la playlist.";
  const cuerpo = { name: datos.nombre, description: datos.descripcion, public: false };
  const creada = playlistDeRespuesta(await llamar(`${URL_API}/me/playlists`, peticionJson(token, cuerpo), fallo));
  if (creada === null) throw new ErrorSpotify(MENSAJE_RARA, SIN_CONEXION);

  const urlCanciones = `${URL_API}/playlists/${encodeURIComponent(creada.id)}/items`;
  try {
    for (const lote of enLotes(datos.trackIds, LOTE_CANCIONES)) {
      const uris = lote.map((id) => `spotify:track:${id}`);
      await llamar(urlCanciones, peticionJson(token, { uris }), MENSAJE_SIN_CANCIONES);
    }
  } catch (fallo: unknown) {
    // La playlist ya existe en la cuenta: el mensaje tiene que decirlo, sea cual sea el código.
    throw new ErrorSpotify(MENSAJE_SIN_CANCIONES, fallo instanceof ErrorSpotify ? fallo.codigo : SIN_CONEXION, creada.url);
  }
  return creada;
};

// ---------- La vuelta del login ----------

const MENSAJE_LOGIN_RECHAZADO =
  "Spotify no completó el login. Si tu cuenta no está en la lista de la app, pide a Daniel que la añada o usa «Copiar enlaces».";

export const terminarExportacion = async ({
  parametros,
  pendiente,
}: {
  parametros: URLSearchParams;
  pendiente: Pendiente | null;
}): Promise<ResultadoVuelta> => {
  const error = parametros.get("error");
  if (error === "access_denied") return { tipo: "cancelado" };
  if (pendiente === null) return { tipo: "sin_playlist" };
  const trackIds = pendiente.trackIds;
  if (error !== null) return { tipo: "fallo", mensaje: MENSAJE_LOGIN_RECHAZADO, trackIds };

  const code = parametros.get("code");
  if (code === null || code === "" || parametros.get("state") !== pendiente.state) return { tipo: "sin_playlist" };

  try {
    const token = await pedirToken(code, pendiente.verifier);
    const creada = await crearPlaylist(token, pendiente);
    return { tipo: "creada", nombre: pendiente.nombre, url: creada.url };
  } catch (fallo: unknown) {
    const mensaje = fallo instanceof ErrorSpotify ? fallo.message : MENSAJE_RARA;
    return { tipo: "fallo", mensaje, trackIds };
  }
};

// ---------- Nombre propuesto ----------

const dosCifras = (numero: number): string => {
  return String(numero).padStart(2, "0");
};

export const nombrePlaylist = (personas: string[], fecha: Date): string => {
  const dia = `${dosCifras(fecha.getDate())}/${dosCifras(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
  return `Viaje · ${personas.join(", ")} · ${dia}`;
};

export const DESCRIPCION_PLAYLIST =
  "Hecha con NPD Entertainment: cada canción vale la media de lo que le gusta a cada uno.";
