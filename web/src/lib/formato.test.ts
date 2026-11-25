import { describe, expect, it } from "vitest";

import {
  buscarArtistas,
  duracionCancion,
  duracionTotal,
  enlaceCancion,
  porcentaje,
  textoEnlaces,
} from "@/lib/formato";
import type { CancionPlaylist } from "@/lib/tipos";

const cancion = (track_id: string): CancionPlaylist => {
  return {
    posicion: 1,
    track_id,
    cancion: "c",
    artista: "a",
    duracion_s: 200,
    gusto_grupo: 0.5,
    desempate: 0.5,
    conocida_por_todos: true,
    miembros: {},
  };
};

describe("formato", () => {
  it("enlaceCancion", () => {
    expect(enlaceCancion("abc")).toBe("https://open.spotify.com/track/abc");
  });

  it("textoEnlaces da un enlace por línea", () => {
    expect(textoEnlaces([cancion("a"), cancion("b")])).toBe(
      "https://open.spotify.com/track/a\nhttps://open.spotify.com/track/b",
    );
  });

  it.each([
    [187, "3:07"],
    [null, "—"],
    [59, "0:59"],
  ])("duracionCancion(%s)", (segundos, esperado) => {
    expect(duracionCancion(segundos)).toBe(esperado);
  });

  it.each([
    [125.4, "2 h 05 min"],
    [42, "0 h 42 min"],
    [119.6, "2 h 00 min"],
  ])("duracionTotal(%s)", (minutos, esperado) => {
    expect(duracionTotal(minutos)).toBe(esperado);
  });

  it.each([
    [0.734, "73 %"],
    [1, "100 %"],
  ])("porcentaje(%s)", (fraccion, esperado) => {
    expect(porcentaje(fraccion)).toBe(esperado);
  });
});

describe("buscarArtistas", () => {
  const artistas = ["Rosalía", "Rojuu", "Bad Bunny", "Ráfaga"];

  it("encuentra sin importar tildes ni mayúsculas y deja fuera los ya elegidos", () => {
    expect(buscarArtistas(artistas, "ro", ["Rojuu"])).toEqual(["Rosalía"]);
    expect(buscarArtistas(artistas, "RAFA", [])).toEqual(["Ráfaga"]);
  });

  it("no enseña más del límite", () => {
    const muchos = Array.from({ length: 200 }, (_, i) => `Grupo ${i}`);
    expect(buscarArtistas(muchos, "grupo", [])).toHaveLength(50);
  });
});
