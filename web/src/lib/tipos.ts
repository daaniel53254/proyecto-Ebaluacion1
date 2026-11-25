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

export type GustoMiembro = {
  gusto: number;
  percentil: number;
  origen: "real" | "prevista";
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
  tipo_dia?: TipoDia;
  n?: number | null;
  duracion_min?: number | null;
  excluir_artistas: string[];
};
