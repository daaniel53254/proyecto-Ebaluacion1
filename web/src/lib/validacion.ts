// Comprobaciones mínimas del JSON que llega de la API: la forma de primer nivel de cada respuesta.
// La API valida con Pydantic lo que devuelve; aquí solo se evita tratar como válida una respuesta ajena
// (otro servicio en el mismo puerto, un proxy, una versión antigua).
import type {
  EstadoPreparacion,
  Historial,
  Persona,
  Playlist,
  RespuestaSubida,
  ResumenSubida,
  Salud,
} from "@/lib/tipos";

export type Comprobacion<T> = (valor: unknown) => valor is T;

type Objeto = Record<string, unknown>;

const ESTADOS_PREPARACION = ["sin_preparar", "en_curso", "lista", "error"] as const;

export const esObjeto = (valor: unknown): valor is Objeto => {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
};

const esTextoONulo = (valor: unknown): valor is string | null => {
  return valor === null || typeof valor === "string";
};

const esListaDe = <T>(comprobar: Comprobacion<T>): Comprobacion<T[]> => {
  return (valor: unknown): valor is T[] => Array.isArray(valor) && valor.every(comprobar);
};

const esEstadoDePreparacion = (valor: unknown): valor is EstadoPreparacion["estado"] => {
  return ESTADOS_PREPARACION.some((estado) => estado === valor);
};

export const esEstadoPreparacion: Comprobacion<EstadoPreparacion> = (valor): valor is EstadoPreparacion => {
  if (!esObjeto(valor)) return false;
  return (
    esEstadoDePreparacion(valor.estado) &&
    esTextoONulo(valor.motivo) &&
    esTextoONulo(valor.error) &&
    (valor.resumen === null || esObjeto(valor.resumen))
  );
};

export const esSalud: Comprobacion<Salud> = (valor): valor is Salud => {
  if (!esObjeto(valor)) return false;
  const estadoValido = valor.estado === "ok" || valor.estado === "sin modelo";
  const preparacionValida = valor.preparacion === null || esEstadoPreparacion(valor.preparacion);
  return estadoValido && esTextoONulo(valor.modelo) && preparacionValida;
};

const esHistorial = (valor: unknown): valor is Historial => {
  if (!esObjeto(valor)) return false;
  return (
    typeof valor.persona === "string" &&
    typeof valor.ficheros === "number" &&
    typeof valor.en_el_modelo === "boolean"
  );
};

const esPersona = (valor: unknown): valor is Persona => {
  if (!esObjeto(valor)) return false;
  return (
    typeof valor.persona === "string" &&
    typeof valor.escuchas_periodo === "number" &&
    typeof valor.tasa_no_salto === "number"
  );
};

const esTexto = (valor: unknown): valor is string => {
  return typeof valor === "string";
};

export const esListaHistoriales = esListaDe(esHistorial);
export const esListaPersonas = esListaDe(esPersona);
export const esListaTextos = esListaDe(esTexto);

const esResumenSubida = (valor: unknown): valor is ResumenSubida => {
  if (!esObjeto(valor)) return false;
  return (
    typeof valor.persona === "string" &&
    typeof valor.ficheros === "number" &&
    typeof valor.escuchas === "number" &&
    esTextoONulo(valor.desde) &&
    esTextoONulo(valor.hasta)
  );
};

export const esRespuestaSubida: Comprobacion<RespuestaSubida> = (valor): valor is RespuestaSubida => {
  if (!esObjeto(valor)) return false;
  return esResumenSubida(valor.historial) && esEstadoPreparacion(valor.preparacion);
};

export const esPlaylist: Comprobacion<Playlist> = (valor): valor is Playlist => {
  if (!esObjeto(valor)) return false;
  return (
    esListaTextos(valor.personas) &&
    typeof valor.regla === "string" &&
    typeof valor.duracion_total_min === "number" &&
    Array.isArray(valor.canciones)
  );
};

