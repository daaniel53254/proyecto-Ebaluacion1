// Los cuatro pasos de la web: los usan la cabecera (navegación) y la portada (tarjetas).
export type Paso = {
  numero: 1 | 2 | 3 | 4;
  ruta: "/tutorial" | "/subir" | "/playlist" | "/cancion";
  titulo: string;
  descripcion: string;
};

export const PASOS = [
  {
    numero: 1,
    ruta: "/tutorial",
    titulo: "Pide tu historial",
    descripcion:
      "Spotify te envía por correo tu historial ampliado de reproducción. Te enseñamos dónde pedirlo, paso a paso.",
  },
  {
    numero: 2,
    ruta: "/subir",
    titulo: "Súbelo",
    descripcion:
      "Sube el .zip tal cual llega. Solo se guardan las escuchas: canción, artista, fecha y si la saltaste.",
  },
  {
    numero: 3,
    ruta: "/playlist",
    titulo: "Vuestra playlist",
    descripcion:
      "Elegid quién viaja y cuánto dura el trayecto. Arriba quedan las canciones que gustan a todos, sin dejar a nadie muy abajo.",
  },
  {
    numero: 4,
    ruta: "/cancion",
    titulo: "¿Entraría?",
    descripcion:
      "Elige una canción y mira si entraría en vuestra playlist y cuántas veces la escucharía cada uno sin saltarla.",
  },
] as const satisfies readonly Paso[];
