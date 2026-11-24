// Cómo se escriben en pantalla las duraciones, los porcentajes y los enlaces de la playlist.
import type { CancionPlaylist } from "@/lib/tipos";

export const MAX_SUGERENCIAS_ARTISTAS = 50;

export const enlaceCancion = (id: string): string => {
  return `https://open.spotify.com/track/${id}`;
};

export const textoEnlacesDeIds = (trackIds: string[]): string => {
  return trackIds.map(enlaceCancion).join("\n");
};

export const textoEnlaces = (canciones: CancionPlaylist[]): string => {
  return textoEnlacesDeIds(canciones.map((c) => c.track_id));
};

export const duracionCancion = (segundos: number | null): string => {
  if (segundos === null) return "—";
  const total = Math.round(segundos);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export const duracionTotal = (minutos: number): string => {
  const total = Math.round(minutos);
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")} min`;
};

export const porcentaje = (fraccion: number): string => {
  return `${Math.round(fraccion * 100)} %`;
};

// Percentil de 0 a 1 como número de 0 a 100, que es como se lee en las barras.
export const percentilVisible = (percentil: number): number => {
  return Math.round(percentil * 100);
};

const normalizar = (texto: string): string => {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");
};

// Artistas que contienen la búsqueda (sin tildes ni mayúsculas), sin los ya elegidos y como mucho 50.
export const buscarArtistas = (artistas: string[], busqueda: string, elegidos: string[]): string[] => {
  const buscado = normalizar(busqueda.trim());
  const encontrados: string[] = [];
  for (const artista of artistas) {
    if (encontrados.length >= MAX_SUGERENCIAS_ARTISTAS) break;
    if (elegidos.includes(artista)) continue;
    if (normalizar(artista).includes(buscado)) encontrados.push(artista);
  }
  return encontrados;
};
