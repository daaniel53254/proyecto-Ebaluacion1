import { describe, expect, it } from "vitest";

import { esCancionPlaylist, esPlaylist } from "@/lib/validacion";

const CANCION = {
  posicion: 1,
  track_id: "a",
  cancion: "Canción",
  artista: "Artista",
  duracion_s: 187,
  gusto_grupo: 0.8,
  desempate: 0.9,
  conocida_por_todos: false,
  miembros: {
    ana: { gusto: 0.7, percentil: 0.8, origen: "real" },
    beñat: { gusto: 0.6, percentil: 0.95, origen: "prevista" },
  },
};

const PLAYLIST = {
  personas: ["ana", "beñat"],
  franja: null,
  franja_horas: "sin horario",
  tipo_dia: "sin horario",
  regla: "regla",
  n_canciones: 1,
  duracion_total_min: 3.1,
  canciones: [CANCION],
};

describe("esCancionPlaylist", () => {
  it("acepta una canción bien formada, también sin duración", () => {
    expect(esCancionPlaylist(CANCION)).toBe(true);
    expect(esCancionPlaylist({ ...CANCION, duracion_s: null })).toBe(true);
  });

  it.each([
    ["sin track_id", { ...CANCION, track_id: 3 }],
    ["duración en texto", { ...CANCION, duracion_s: "3:07" }],
    ["miembros en lista", { ...CANCION, miembros: [] }],
    ["origen desconocido", { ...CANCION, miembros: { ana: { gusto: 1, percentil: 1, origen: "otro" } } }],
    ["percentil que falta", { ...CANCION, miembros: { ana: { gusto: 1, origen: "real" } } }],
  ])("rechaza una canción %s", (_, valor) => {
    expect(esCancionPlaylist(valor)).toBe(false);
  });
});

describe("esPlaylist", () => {
  it("acepta la respuesta de la API, sin horario o con franja", () => {
    expect(esPlaylist(PLAYLIST)).toBe(true);
    expect(esPlaylist({ ...PLAYLIST, franja: 4, franja_horas: "16-20", tipo_dia: "laborable" })).toBe(true);
    expect(esPlaylist({ ...PLAYLIST, canciones: [], n_canciones: 0 })).toBe(true);
  });

  it.each([
    ["con una canción mal formada", { ...PLAYLIST, canciones: [{ ...CANCION, cancion: null }] }],
    ["sin franja_horas", { ...PLAYLIST, franja_horas: undefined }],
    ["con la franja en texto", { ...PLAYLIST, franja: "4" }],
    ["sin n_canciones", { ...PLAYLIST, n_canciones: "1" }],
    ["sin tipo_dia", { ...PLAYLIST, tipo_dia: null }],
    ["con una canción sin el gusto de alguien del grupo", { ...PLAYLIST, personas: ["ana", "beñat", "carla"] }],
  ])("rechaza una playlist %s", (_, valor) => {
    expect(esPlaylist(valor)).toBe(false);
  });
});
