// Filtros de la playlist, los mismos que la pestaña de playlist del panel, y su paso a la petición de la API.
import type { PeticionPlaylist, TipoDia } from "@/lib/tipos";

export const FRANJAS = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"] as const;

export const OPCIONES_CANCIONES = [10, 20, 30, 50, 75, 100] as const;

export type NumeroCanciones = (typeof OPCIONES_CANCIONES)[number];

export type ModoLongitud = "canciones" | "minutos";

export const MINUTOS = { minimo: 15, maximo: 300, paso: 15 } as const;

// Lo que acepta la API en «excluir_artistas».
export const MAX_ARTISTAS_QUITADOS = 50;

export type Filtros = {
  personas: string[];
  franja: number | null;
  tipoDia: TipoDia;
  modo: ModoLongitud;
  canciones: NumeroCanciones;
  minutos: number;
  quitar: string[];
};

export const filtrosIniciales = (personas: string[]): Filtros => {
  return {
    personas: [...personas],
    franja: null,
    tipoDia: "fin_semana",
    modo: "canciones",
    canciones: 30,
    minutos: 120,
    quitar: [],
  };
};

const longitud = (f: Filtros): Pick<PeticionPlaylist, "n" | "duracion_min"> => {
  if (f.modo === "minutos") return { n: null, duracion_min: f.minutos };
  return { n: f.canciones, duracion_min: null };
};

export const aPeticion = (f: Filtros): PeticionPlaylist => {
  const comun = { personas: f.personas, ...longitud(f), excluir_artistas: f.quitar };
  if (f.franja === null) return { ...comun, ignorar_horario: true };
  return { ...comun, ignorar_horario: false, franja: f.franja, tipo_dia: f.tipoDia };
};

// Pone o quita a una persona sin dejar el grupo vacío; el orden es siempre el de la lista del modelo.
export const alternarPersona = (f: Filtros, persona: string, todas: string[]): Filtros => {
  const elegida = f.personas.includes(persona);
  if (elegida && f.personas.length === 1) return f;
  const personas = todas.filter((p) => (p === persona ? !elegida : f.personas.includes(p)));
  return { ...f, personas };
};

// Tras recargar las personas del modelo: se queda con las elegidas que siguen; si no queda ninguna, todas.
export const ajustarPersonas = (f: Filtros, disponibles: string[]): Filtros => {
  const siguen = disponibles.filter((p) => f.personas.includes(p));
  return { ...f, personas: siguen.length > 0 ? siguen : [...disponibles] };
};

export const sumarArtista = (f: Filtros, artista: string): Filtros => {
  if (f.quitar.includes(artista) || f.quitar.length >= MAX_ARTISTAS_QUITADOS) return f;
  return { ...f, quitar: [...f.quitar, artista] };
};

export const quitarArtista = (f: Filtros, artista: string): Filtros => {
  return { ...f, quitar: f.quitar.filter((a) => a !== artista) };
};

// Lo que llega de un <select> como texto, de vuelta a sus tipos (sin casts).
export const numeroCancionesDe = (texto: string): NumeroCanciones | undefined => {
  return OPCIONES_CANCIONES.find((opcion) => String(opcion) === texto);
};

export const franjaDe = (texto: string): number | null => {
  const indice = FRANJAS.findIndex((_, i) => String(i) === texto);
  return indice === -1 ? null : indice;
};
