// Cliente de la API FastAPI. Todas las llamadas se hacen desde el navegador.
import type {
  EstadoPreparacion,
  Historial,
  Persona,
  PeticionPlaylist,
  Playlist,
  RespuestaSubida,
  Salud,
} from "@/lib/tipos";
import {
  type Comprobacion,
  esEstadoPreparacion,
  esListaHistoriales,
  esListaPersonas,
  esListaTextos,
  esObjeto,
  esPlaylist,
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

export const obtenerPreparacion = (): Promise<EstadoPreparacion> => {
  return pedir("/preparacion", esEstadoPreparacion);
};

export const subirHistorial = (persona: string, consentimiento: boolean, zip: Blob): Promise<RespuestaSubida> => {
  const formulario = new FormData();
  formulario.append("persona", persona);
  formulario.append("consentimiento", String(consentimiento));
  formulario.append("archivo", zip, "historial.zip");
  return pedir("/historiales", esRespuestaSubida, { method: "POST", body: formulario });
};

export const borrarHistorial = async (persona: string): Promise<void> => {
  await llamar(`/historiales/${encodeURIComponent(persona)}`, { method: "DELETE" });
};

export const pedirPlaylist = (peticion: PeticionPlaylist): Promise<Playlist> => {
  return pedir("/objetivo2/playlist", esPlaylist, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(peticion),
  });
};
