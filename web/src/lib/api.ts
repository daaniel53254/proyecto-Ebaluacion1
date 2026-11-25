// Cliente de la API FastAPI. Todas las llamadas se hacen desde el navegador.
import type {
  ArtistaGrupo,
  CancionCatalogo,
  EstadoPreparacion,
  Historial,
  Persona,
  PeticionCancion,
  PeticionPlaylist,
  Playlist,
  RespuestaCancion,
  RespuestaSubida,
  Salud,
} from "@/lib/tipos";
import {
  type Comprobacion,
  esEstadoPreparacion,
  esListaArtistasGrupo,
  esListaCancionesCatalogo,
  esListaHistoriales,
  esListaPersonas,
  esListaTextos,
  esObjeto,
  esPlaylist,
  esRespuestaCancion,
  esRespuestaSubida,
  esSalud,
} from "@/lib/validacion";

export const URL_API: string = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const SIN_CONEXION = 0;
const MENSAJE_SIN_CONEXION = "No se puede conectar con la API";
const MENSAJE_RESPUESTA_INESPERADA = "La API devolvió una respuesta inesperada";

export class ErrorApi extends Error {
  readonly codigo: number;
  readonly detalle: unknown;

  constructor(mensaje: string, codigo: number, detalle: unknown = null) {
    super(mensaje);
    this.name = "ErrorApi";
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

const leerJson = async (respuesta: Response): Promise<unknown> => {
  try {
    const cuerpo: unknown = await respuesta.json();
    return cuerpo;
  } catch {
    return null;
  }
};

const errorDeRespuesta = (codigo: number, cuerpo: unknown): ErrorApi => {
  if (esObjeto(cuerpo) && typeof cuerpo.error === "string") {
    return new ErrorApi(cuerpo.error, codigo, cuerpo.detalle ?? null);
  }
  return new ErrorApi(`La API respondió con un error (${codigo})`, codigo, cuerpo);
};

const llamar = async (ruta: string, opciones?: RequestInit): Promise<{ codigo: number; cuerpo: unknown }> => {
  const respuesta = await fetch(`${URL_API}${ruta}`, opciones).catch((causa: unknown) => {
    throw new ErrorApi(MENSAJE_SIN_CONEXION, SIN_CONEXION, causa);
  });
  const cuerpo = await leerJson(respuesta);
  if (!respuesta.ok) throw errorDeRespuesta(respuesta.status, cuerpo);
  return { codigo: respuesta.status, cuerpo };
};

const pedir = async <T>(ruta: string, comprobar: Comprobacion<T>, opciones?: RequestInit): Promise<T> => {
  const { codigo, cuerpo } = await llamar(ruta, opciones);
  if (!comprobar(cuerpo)) throw new ErrorApi(MENSAJE_RESPUESTA_INESPERADA, codigo, cuerpo);
  return cuerpo;
};

export const obtenerSalud = (): Promise<Salud> => {
  return pedir("/salud", esSalud);
};

export const obtenerHistoriales = (): Promise<Historial[]> => {
  return pedir("/historiales", esListaHistoriales);
};

export const obtenerPersonas = (): Promise<Persona[]> => {
  return pedir("/personas", esListaPersonas);
};

export const obtenerArtistas = (): Promise<string[]> => {
  return pedir("/artistas", esListaTextos);
};

// Solo los artistas que alguien del modelo ha escuchado, con las escuchas de cada persona.
export const obtenerArtistasPorPersona = (): Promise<ArtistaGrupo[]> => {
  return pedir("/artistas?por_persona=true", esListaArtistasGrupo);
};

export const buscarCanciones = (texto: string, senal?: AbortSignal): Promise<CancionCatalogo[]> => {
  const consulta = new URLSearchParams({ buscar: texto, limite: "20" });
  return pedir(`/canciones?${consulta.toString()}`, esListaCancionesCatalogo, { signal: senal });
};

export const consultarCancion = (peticion: PeticionCancion): Promise<RespuestaCancion> => {
  return pedir("/objetivo2/cancion", esRespuestaCancion, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(peticion),
  });
};

export const obtenerPreparacion = (): Promise<EstadoPreparacion> => {
  return pedir("/preparacion", esEstadoPreparacion);
};

export type Subida = {
  persona: string;
  consentimiento: boolean;
  mayorDe16: boolean;
  zip: Blob;
  // Solo para sustituir un historial que ya existe.
  token: string | null;
};

const cabeceraToken = (token: string | null): HeadersInit | undefined => {
  return token === null ? undefined : { "X-Token": token };
};

export const subirHistorial = ({ persona, consentimiento, mayorDe16, zip, token }: Subida): Promise<RespuestaSubida> => {
  const formulario = new FormData();
  formulario.append("persona", persona);
  formulario.append("consentimiento", String(consentimiento));
  formulario.append("mayor_de_16", String(mayorDe16));
  formulario.append("archivo", zip, "historial.zip");
  return pedir("/historiales", esRespuestaSubida, { method: "POST", body: formulario, headers: cabeceraToken(token) });
};

// Devuelve el reentreno lanzado, o null si no quedaba nadie y la API retiró el modelo.
export const borrarHistorial = async (persona: string, token: string | null): Promise<EstadoPreparacion | null> => {
  const { cuerpo } = await llamar(`/historiales/${encodeURIComponent(persona)}`, {
    method: "DELETE",
    headers: cabeceraToken(token),
  });
  if (esObjeto(cuerpo) && esEstadoPreparacion(cuerpo.preparacion)) return cuerpo.preparacion;
  return null;
};

export const pedirPlaylist = (peticion: PeticionPlaylist): Promise<Playlist> => {
  return pedir("/objetivo2/playlist", esPlaylist, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(peticion),
  });
};
