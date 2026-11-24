// Los tres pasos de la web: los usan la cabecera (navegación) y la portada (tarjetas).
export type Paso = {
  numero: 1 | 2 | 3;
  ruta: "/tutorial" | "/subir" | "/playlist";
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
      "Elegid quién viaja y cuánto dura el trayecto. Cada canción vale lo que le gusta al que menos le gusta.",
  },
] as const satisfies readonly Paso[];
