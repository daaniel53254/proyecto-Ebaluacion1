import { describe, expect, it } from "vitest";

import {
  aPeticion,
  ajustarPersonas,
  alternarPersona,
  filtrosGuardados,
  filtrosIniciales,
  MAX_ARTISTAS_QUITADOS,
  MOMENTOS,
  momentoDe,
  numeroCancionesDe,
  quitarArtista,
  quitarCancion,
  sumarArtista,
  sumarCancion,
} from "@/lib/filtros";

describe("filtrosIniciales", () => {
  it("marca a todas las personas, sin horario, fin de semana y 30 canciones", () => {
    expect(filtrosIniciales(["ana", "beñat"])).toEqual({
      personas: ["ana", "beñat"],
      momento: null,
      tipoDia: "fin_semana",
      modo: "canciones",
      canciones: 30,
      minutos: 120,
      quitar: [],
      quitarCanciones: [],
    });
  });

  it("los momentos del día juntan las seis franjas de 4 horas de dos en dos, sin repetir ninguna", () => {
    expect(MOMENTOS.map((m) => m.texto)).toEqual(["Mañana", "Tarde", "Noche"]);
    const todas = MOMENTOS.flatMap((m) => [...m.franjas]).sort();
    expect(todas).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("aPeticion", () => {
  it("con «No importa» manda ignorar_horario y no manda franjas", () => {
    expect(aPeticion(filtrosIniciales(["ana", "beñat"]))).toEqual({
      personas: ["ana", "beñat"],
      ignorar_horario: true,
      n: 30,
      duracion_min: null,
      excluir_artistas: [],
      excluir_canciones: [],
    });
  });

  it("con un momento del día manda sus franjas y el tipo de día", () => {
    expect(aPeticion({ ...filtrosIniciales(["ana"]), momento: "noche", tipoDia: "laborable" })).toMatchObject({
      ignorar_horario: false,
      franjas: [5, 0],
      tipo_dia: "laborable",
    });
  });

  it("en minutos manda duracion_min y n null", () => {
    expect(aPeticion({ ...filtrosIniciales(["ana"]), modo: "minutos", minutos: 90 })).toMatchObject({
      n: null,
      duracion_min: 90,
    });
  });

  it("manda los artistas que se quitan", () => {
    expect(aPeticion({ ...filtrosIniciales(["ana"]), quitar: ["Rosalía"] }).excluir_artistas).toEqual(["Rosalía"]);
  });
});

describe("alternarPersona", () => {
  it("quita y vuelve a poner a una persona, en el orden del modelo", () => {
    const todas = ["ana", "beñat", "carla"];
    const sinBenat = alternarPersona(filtrosIniciales(todas), "beñat", todas);
    expect(sinBenat.personas).toEqual(["ana", "carla"]);
    expect(alternarPersona(sinBenat, "beñat", todas).personas).toEqual(["ana", "beñat", "carla"]);
  });

  it("no deja menos de dos personas", () => {
    const todas = ["ana", "beñat", "carla"];
    const dos = alternarPersona(filtrosIniciales(todas), "carla", todas);
    expect(alternarPersona(dos, "ana", todas).personas).toEqual(["ana", "beñat"]);
  });
});

describe("ajustarPersonas", () => {
  it("quita a quien ya no está en el modelo si siguen quedando dos", () => {
    expect(ajustarPersonas(filtrosIniciales(["ana", "beñat", "carla"]), ["ana", "beñat"]).personas).toEqual([
      "ana",
      "beñat",
    ]);
  });

  it("si de los elegidos quedan menos de dos, marca a todos los que hay", () => {
    expect(ajustarPersonas(filtrosIniciales(["ana", "dani"]), ["ana", "beñat", "carla"]).personas).toEqual([
      "ana",
      "beñat",
      "carla",
    ]);
  });
});

describe("artistas que se quitan", () => {
  it("no repite un artista ya quitado y lo vuelve a poner", () => {
    const filtros = sumarArtista(filtrosIniciales(["ana"]), "Rosalía");
    expect(sumarArtista(filtros, "Rosalía").quitar).toEqual(["Rosalía"]);
    expect(quitarArtista(filtros, "Rosalía").quitar).toEqual([]);
  });

  it("no pasa del máximo que acepta la API", () => {
    const lleno = { ...filtrosIniciales(["ana"]), quitar: Array.from({ length: MAX_ARTISTAS_QUITADOS }, (_, i) => `a${i}`) };
    expect(sumarArtista(lleno, "otro").quitar).toHaveLength(MAX_ARTISTAS_QUITADOS);
  });
});

describe("canciones que se quitan", () => {
  const cancion = { track_id: "t1", cancion: "Malamente", artista: "Rosalía", duracion_s: 150, personas: { ana: 3 } };

  it("se mandan por su track_id, sin repetir, y se pueden volver a poner", () => {
    const filtros = sumarCancion(sumarCancion(filtrosIniciales(["ana"]), cancion), cancion);
    expect(aPeticion(filtros).excluir_canciones).toEqual(["t1"]);
    expect(quitarCancion(filtros, "t1").quitarCanciones).toEqual([]);
  });

  it("se recuperan de la sesión con su título y de quién son", () => {
    const filtros = { ...filtrosIniciales(["ana", "beñat"]), quitarCanciones: [cancion] };
    expect(filtrosGuardados(JSON.stringify(filtros))?.quitarCanciones).toEqual([cancion]);
  });
});

describe("lectura de los desplegables", () => {
  it("numeroCancionesDe solo acepta las opciones del panel", () => {
    expect(numeroCancionesDe("50")).toBe(50);
    expect(numeroCancionesDe("40")).toBeUndefined();
  });

  it("momentoDe pasa «No importa» a null", () => {
    expect(momentoDe("tarde")).toBe("tarde");
    expect(momentoDe("")).toBeNull();
    expect(momentoDe("madrugada")).toBeNull();
  });
});

describe("filtrosGuardados", () => {
  it("recupera los filtros guardados en la sesión", () => {
    const filtros = { ...filtrosIniciales(["ana", "beñat"]), momento: "tarde" as const, quitar: ["Rosalía"] };
    expect(filtrosGuardados(JSON.stringify(filtros))).toEqual(filtros);
  });

  it("lo que no encaja vuelve al valor inicial y un texto roto no devuelve nada", () => {
    const raros = filtrosGuardados(JSON.stringify({ personas: [1], momento: "madrugada", canciones: 40, minutos: 5 }));
    expect(raros).toEqual(filtrosIniciales([]));
    expect(filtrosGuardados("{roto")).toBeNull();
    expect(filtrosGuardados(null)).toBeNull();
  });
});
