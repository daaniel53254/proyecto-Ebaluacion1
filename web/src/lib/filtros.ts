// Filtros de la playlist (y de «¿Entraría?»), los mismos que la pestaña de playlist del panel, y su paso a la petición de la API.
import type { CancionCatalogo, PeticionPlaylist, TipoDia } from "@/lib/tipos";

// El modelo trabaja con seis franjas de 4 horas; la web las junta de dos en dos en momentos del día.
export const MOMENTOS = [
  { valor: "manana", texto: "Mañana", horas: "4-12 h", franjas: [1, 2] },
  { valor: "tarde", texto: "Tarde", horas: "12-20 h", franjas: [3, 4] },
  { valor: "noche", texto: "Noche", horas: "20-4 h", franjas: [5, 0] },
] as const;

export type Momento = (typeof MOMENTOS)[number]["valor"];

export const OPCIONES_CANCIONES = [10, 20, 30, 50, 75, 100] as const;

export type NumeroCanciones = (typeof OPCIONES_CANCIONES)[number];

export type ModoLongitud = "canciones" | "minutos";

export const MINUTOS = { minimo: 15, maximo: 300, paso: 15 } as const;

// Lo que acepta la API en «excluir_artistas».
export const MAX_ARTISTAS_QUITADOS = 50;

// Lo que acepta la API en «excluir_canciones».
export const MAX_CANCIONES_QUITADAS = 200;

// Una playlist «de grupo» necesita al menos dos personas.
export const MIN_PERSONAS = 2;

export type Filtros = {
  personas: string[];
  // null: «No importa» (todas las escuchas, sin filtrar por hora ni día).
  momento: Momento | null;
  tipoDia: TipoDia;
  modo: ModoLongitud;
  canciones: NumeroCanciones;
  minutos: number;
  // Artistas quitados (por nombre) y canciones quitadas (se guarda la canción entera para enseñarla).
  quitar: string[];
  quitarCanciones: CancionCatalogo[];
};

export const filtrosIniciales = (personas: string[]): Filtros => {
  return {
    personas: [...personas],
    momento: null,
    tipoDia: "fin_semana",
    modo: "canciones",
    canciones: 30,
    minutos: 120,
    quitar: [],
    quitarCanciones: [],
  };
};

const longitud = (f: Filtros): Pick<PeticionPlaylist, "n" | "duracion_min"> => {
  if (f.modo === "minutos") return { n: null, duracion_min: f.minutos };
  return { n: f.canciones, duracion_min: null };
};

export const franjasDe = (momento: Momento): number[] => {
  const encontrado = MOMENTOS.find((m) => m.valor === momento);
  return encontrado === undefined ? [] : [...encontrado.franjas];
};

export const aPeticion = (f: Filtros): PeticionPlaylist => {
  const comun = {
    personas: f.personas,
    ...longitud(f),
    excluir_artistas: f.quitar,
    excluir_canciones: f.quitarCanciones.map((c) => c.track_id),
  };
  if (f.momento === null) return { ...comun, ignorar_horario: true };
  return { ...comun, ignorar_horario: false, franjas: franjasDe(f.momento), tipo_dia: f.tipoDia };
};

// Pone o quita a una persona sin bajar del mínimo; el orden es siempre el de la lista del modelo.
export const alternarPersona = (f: Filtros, persona: string, todas: string[]): Filtros => {
  const elegida = f.personas.includes(persona);
  if (elegida && f.personas.length <= MIN_PERSONAS) return f;
  const personas = todas.filter((p) => (p === persona ? !elegida : f.personas.includes(p)));
  return { ...f, personas };
};

// Tras recargar las personas del modelo: se queda con las elegidas que siguen; si no llegan al mínimo, todas.
export const ajustarPersonas = (f: Filtros, disponibles: string[]): Filtros => {
  const siguen = disponibles.filter((p) => f.personas.includes(p));
  return { ...f, personas: siguen.length >= MIN_PERSONAS ? siguen : [...disponibles] };
};

export const sumarArtista = (f: Filtros, artista: string): Filtros => {
  if (f.quitar.includes(artista) || f.quitar.length >= MAX_ARTISTAS_QUITADOS) return f;
  return { ...f, quitar: [...f.quitar, artista] };
};

export const quitarArtista = (f: Filtros, artista: string): Filtros => {
  return { ...f, quitar: f.quitar.filter((a) => a !== artista) };
};

export const sumarCancion = (f: Filtros, cancion: CancionCatalogo): Filtros => {
  const yaEsta = f.quitarCanciones.some((c) => c.track_id === cancion.track_id);
  if (yaEsta || f.quitarCanciones.length >= MAX_CANCIONES_QUITADAS) return f;
  return { ...f, quitarCanciones: [...f.quitarCanciones, cancion] };
};

export const quitarCancion = (f: Filtros, trackId: string): Filtros => {
  return { ...f, quitarCanciones: f.quitarCanciones.filter((c) => c.track_id !== trackId) };
};

// Lo que llega de un <select> como texto, de vuelta a sus tipos (sin casts).
export const numeroCancionesDe = (texto: string): NumeroCanciones | undefined => {
  return OPCIONES_CANCIONES.find((opcion) => String(opcion) === texto);
};

export const momentoDe = (texto: string): Momento | null => {
  return MOMENTOS.find((m) => m.valor === texto)?.valor ?? null;
};

const esListaDeTextos = (valor: unknown): valor is string[] => {
  return Array.isArray(valor) && valor.every((x) => typeof x === "string");
};

const esCancionGuardada = (valor: unknown): valor is CancionCatalogo => {
  if (typeof valor !== "object" || valor === null) return false;
  const campo = (clave: string): unknown => Reflect.get(valor, clave);
  const personas = campo("personas");
  const duracion = campo("duracion_s");
  return (
    typeof campo("track_id") === "string" &&
    typeof campo("cancion") === "string" &&
    typeof campo("artista") === "string" &&
    (duracion === null || typeof duracion === "number") &&
    typeof personas === "object" &&
    personas !== null &&
    Object.values(personas).every((n) => typeof n === "number")
  );
};

// Filtros guardados en la sesión (JSON), de vuelta a su tipo; lo que no encaje se queda con el valor inicial.
export const filtrosGuardados = (texto: string | null): Filtros | null => {
  if (texto === null) return null;
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof datos !== "object" || datos === null) return null;
  const base = filtrosIniciales([]);
  const leer = (clave: string): unknown => (clave in datos ? Reflect.get(datos, clave) : undefined);
  const personas = leer("personas");
  const momento = leer("momento");
  const tipoDia = leer("tipoDia");
  const modo = leer("modo");
  const canciones = numeroCancionesDe(String(leer("canciones")));
  const minutos = leer("minutos");
  const quitar = leer("quitar");
  const quitarCanciones = leer("quitarCanciones");
  return {
    personas: esListaDeTextos(personas) ? personas : base.personas,
    momento: typeof momento === "string" ? momentoDe(momento) : null,
    tipoDia: tipoDia === "laborable" || tipoDia === "fin_semana" ? tipoDia : base.tipoDia,
    modo: modo === "canciones" || modo === "minutos" ? modo : base.modo,
    canciones: canciones ?? base.canciones,
    minutos:
      typeof minutos === "number" && minutos >= MINUTOS.minimo && minutos <= MINUTOS.maximo ? minutos : base.minutos,
    quitar: esListaDeTextos(quitar) ? quitar.slice(0, MAX_ARTISTAS_QUITADOS) : base.quitar,
    quitarCanciones:
      Array.isArray(quitarCanciones) && quitarCanciones.every(esCancionGuardada)
        ? quitarCanciones.slice(0, MAX_CANCIONES_QUITADAS)
        : base.quitarCanciones,
  };
};
