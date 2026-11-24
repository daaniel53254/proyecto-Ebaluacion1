// Cifras que se sacan de una playlist ya generada (las mismas que calcula el panel).
import { colorPersona } from "@/lib/colores";
import type { Playlist } from "@/lib/tipos";

export type CifrasPlaylist = {
  canciones: number;
  duracionMin: number;
  artistasDistintos: number;
  conGustoRealDeTodos: number;
};

export type GustoMedio = {
  persona: string;
  percentilMedio: number;
};

export const cifrasDe = (playlist: Playlist): CifrasPlaylist => {
  const { canciones } = playlist;
  const conocidas = canciones.filter((c) => c.conocida_por_todos).length;
  return {
    canciones: canciones.length,
    duracionMin: playlist.duracion_total_min,
    artistasDistintos: new Set(canciones.map((c) => c.artista.toLocaleLowerCase("es"))).size,
    conGustoRealDeTodos: canciones.length === 0 ? 0 : conocidas / canciones.length,
  };
};

export const gustoMedioPorPersona = (playlist: Playlist): GustoMedio[] => {
  const { canciones } = playlist;
  return playlist.personas.map((persona) => {
    const suma = canciones.reduce((total, c) => total + (c.miembros[persona]?.percentil ?? 0), 0);
    return { persona, percentilMedio: canciones.length === 0 ? 0 : suma / canciones.length };
  });
};

// Color de cada persona según su puesto en la lista del modelo, para que no cambie al elegir a otras.
export const colorEnElModelo = (personasModelo: string[], persona: string): string => {
  return colorPersona(personasModelo.indexOf(persona));
};
