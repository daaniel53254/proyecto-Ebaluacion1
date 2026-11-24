import { describe, expect, it } from "vitest";

import { cifrasDe, colorEnElModelo, gustoMedioPorPersona } from "@/lib/resumen";
import type { CancionPlaylist, Playlist } from "@/lib/tipos";

const cancion = (artista: string, ana: number, beñat: number, conocida: boolean): CancionPlaylist => {
  return {
    posicion: 1,
    track_id: artista,
    cancion: "c",
    artista,
    duracion_s: 180,
    gusto_grupo: (ana + beñat) / 2,
    desempate: Math.min(ana, beñat),
    conocida_por_todos: conocida,
    miembros: {
      ana: { gusto: ana, percentil: ana, origen: "real" },
      beñat: { gusto: beñat, percentil: beñat, origen: conocida ? "real" : "prevista" },
    },
  };
};

const PLAYLIST: Playlist = {
  personas: ["ana", "beñat"],
  franja: 4,
  franja_horas: "16-20",
  tipo_dia: "laborable",
  regla: "r",
  n_canciones: 2,
  duracion_total_min: 6,
  canciones: [cancion("X", 0.8, 0.6, true), cancion("X", 0.6, 1, false)],
};

describe("resumen", () => {
  it("cifrasDe", () => {
    expect(cifrasDe(PLAYLIST)).toEqual({ canciones: 2, duracionMin: 6, artistasDistintos: 1, conGustoRealDeTodos: 0.5 });
    expect(cifrasDe({ ...PLAYLIST, canciones: [] }).conGustoRealDeTodos).toBe(0);
  });

  it("cifrasDe cuenta una sola vez al artista aunque cambien las mayúsculas", () => {
    const canciones = [cancion("Duko", 0.8, 0.6, true), cancion("duko", 0.6, 1, true), cancion("Rojuu", 0.5, 0.5, true)];
    expect(cifrasDe({ ...PLAYLIST, canciones }).artistasDistintos).toBe(2);
  });

  it("gustoMedioPorPersona", () => {
    const medias = gustoMedioPorPersona(PLAYLIST);
    expect(medias.map((m) => m.persona)).toEqual(["ana", "beñat"]);
    expect(medias[0]?.percentilMedio).toBeCloseTo(0.7);
    expect(medias[1]?.percentilMedio).toBeCloseTo(0.8);
  });

  it("colorEnElModelo no cambia al elegir a otras personas", () => {
    expect(colorEnElModelo(["ana", "beñat"], "beñat")).toBe("#52ab69");
    expect(colorEnElModelo(["ana", "beñat"], "nadie")).toBe("#8f9594");
  });
});
