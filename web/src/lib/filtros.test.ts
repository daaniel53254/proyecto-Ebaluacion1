import { describe, expect, it } from "vitest";

import {
  aPeticion,
  ajustarPersonas,
  alternarPersona,
  FRANJAS,
  filtrosIniciales,
  franjaDe,
  MAX_ARTISTAS_QUITADOS,
  numeroCancionesDe,
  quitarArtista,
  sumarArtista,
} from "@/lib/filtros";

describe("filtrosIniciales", () => {
  it("marca a todas las personas, sin horario, fin de semana y 30 canciones", () => {
    expect(filtrosIniciales(["ana", "beñat"])).toEqual({
      personas: ["ana", "beñat"],
      franja: null,
      tipoDia: "fin_semana",
      modo: "canciones",
      canciones: 30,
      minutos: 120,
      quitar: [],
    });
  });

  it("las franjas son las seis de cuatro horas", () => {
    expect(FRANJAS).toEqual(["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"]);
  });
});

describe("aPeticion", () => {
  it("sin horario manda ignorar_horario y no manda franja", () => {
    expect(aPeticion(filtrosIniciales(["ana", "beñat"]))).toEqual({
      personas: ["ana", "beñat"],
      ignorar_horario: true,
      n: 30,
      duracion_min: null,
      excluir_artistas: [],
    });
  });

  it("con franja manda franja y tipo_dia", () => {
    expect(aPeticion({ ...filtrosIniciales(["ana"]), franja: 3, tipoDia: "laborable" })).toMatchObject({
      ignorar_horario: false,
      franja: 3,
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

  it("no deja el grupo vacío", () => {
    const filtros = filtrosIniciales(["ana"]);
    expect(alternarPersona(filtros, "ana", ["ana"]).personas).toEqual(["ana"]);
  });
});

describe("ajustarPersonas", () => {
  it("quita a quien ya no está en el modelo", () => {
    expect(ajustarPersonas(filtrosIniciales(["ana", "beñat"]), ["ana"]).personas).toEqual(["ana"]);
  });

  it("si no queda nadie de los elegidos, marca a todos los que hay", () => {
    expect(ajustarPersonas(filtrosIniciales(["ana"]), ["beñat", "carla"]).personas).toEqual(["beñat", "carla"]);
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

describe("lectura de los desplegables", () => {
  it("numeroCancionesDe solo acepta las opciones del panel", () => {
    expect(numeroCancionesDe("50")).toBe(50);
    expect(numeroCancionesDe("40")).toBeUndefined();
  });

  it("franjaDe pasa «Sin importar» a null", () => {
    expect(franjaDe("4")).toBe(4);
    expect(franjaDe("")).toBeNull();
    expect(franjaDe("9")).toBeNull();
  });
});
