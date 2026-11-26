// Tipos de las respuestas y peticiones de la API, copiados de api/esquemas.py, api/main.py y api/preparacion.py.

export type TipoDia = "laborable" | "fin_semana";

export type EstadoDePreparacion = "sin_preparar" | "en_curso" | "lista" | "error";

export type PeriodoModelo = {
  desde: string;
  hasta: string;
  meses?: number;
};

export type ResumenPreparacion = {
  personas: string[];
  periodo: PeriodoModelo;
  filas_entrenamiento: number;
  cv_mae: number;
  canciones_catalogo: number;
};

export type EstadoPreparacion = {
  estado: EstadoDePreparacion;
  motivo: string | null;
  inicio: string | null;
  fin: string | null;
  error: string | null;
  resumen: ResumenPreparacion | null;
};

export type Salud = {
  estado: "ok" | "sin modelo";
  modelo: string | null;
  preparacion: EstadoPreparacion | null;
};

export type Historial = {
  persona: string;
  ficheros: number;
  en_el_modelo: boolean;
};

export type ResumenSubida = {
  persona: string;
  ficheros: number;
  escuchas: number;
  desde: string | null;
  hasta: string | null;
};

export type RespuestaSubida = {
  historial: ResumenSubida;
  preparacion: EstadoPreparacion;
  // Solo la primera vez que sube una persona: hace falta para borrar o sustituir su historial.
  token?: string;
};

export type Persona = {
  persona: string;
  escuchas_periodo: number;
  tasa_no_salto: number;
};

export type Origen = "real" | "prevista";

export type GustoMiembro = {
  gusto: number;
  percentil: number;
  origen: Origen;
};

export type CancionPlaylist = {
  posicion: number;
  track_id: string;
  cancion: string;
  artista: string;
  duracion_s: number | null;
  gusto_grupo: number;
  desempate: number;
  conocida_por_todos: boolean;
  miembros: Record<string, GustoMiembro>;
};

export type Playlist = {
  personas: string[];
  franja: number | null;
  franja_horas: string;
  tipo_dia: string;
  regla: string;
  n_canciones: number;
  duracion_total_min: number;
  canciones: CancionPlaylist[];
};

export type PeticionPlaylist = {
  personas: string[];
  ignorar_horario: boolean;
  franja?: number;
  // Varias franjas seguidas (un momento del día): la API suma sus escuchas y promedia la predicción.
  franjas?: number[];
  tipo_dia?: TipoDia;
  n?: number | null;
  duracion_min?: number | null;
  excluir_artistas: string[];
  excluir_canciones: string[];
};

// Artista del catálogo con las escuchas de cada persona que lo tiene en su historial.
export type ArtistaGrupo = {
  artista: string;
  personas: Record<string, number>;
};

// Canción que alguien del grupo ha escuchado, con las escuchas de cada persona que la tiene en su historial.
export type CancionCatalogo = {
  track_id: string;
  cancion: string;
  artista: string;
  duracion_s: number | null;
  personas: Record<string, number>;
};

export type PeticionCancion = PeticionPlaylist & { track_id: string };

export type GustoCancion = {
  // Real si tiene 3 o más escuchas sin horario (5 en un contexto concreto); si no, la prevista por el modelo (objetivo 1).
  tasa_no_salto: number;
  percentil: number;
  origen: Origen;
  escuchas: number;
};

export type RespuestaCancion = {
  track_id: string;
  cancion: string;
  artista: string;
  personas: string[];
  franja: number | null;
  franja_horas: string;
  tipo_dia: string;
  entra: boolean;
  artista_excluido: boolean;
  cancion_excluida: boolean;
  posicion: number | null;
  n_candidatas: number;
  n_canciones_playlist: number;
  gusto_grupo: number | null;
  conocida_por_todos: boolean;
  miembros: Record<string, GustoCancion>;
};

// «¿Entraría una canción que nadie ha escuchado?» (POST /objetivo2/entraria).
export type PeticionNovedad = { personas: string[]; artista: string; album: string; cancion: string };

export type GustoNovedad = {
  probabilidad_adopcion: number;
  percentil: number;
  escuchas_artista: number;
  ya_la_conoce: boolean;
};

export type ResultadoNovedad = {
  cancion: string | null;
  artista: string;
  album: string;
  percentil_grupo: number;
  entra: boolean;
  motivo: string;
  miembros: Record<string, GustoNovedad>;
};

export type RespuestaNovedad = { personas: string[]; umbral_percentil: number; resultados: ResultadoNovedad[] };
