import { describe, expect, it } from "vitest";

import { COLORES_SERIE, colorPersona } from "@/lib/colores";

describe("colorPersona", () => {
  it("da los colores de la serie en orden fijo", () => {
    expect(colorPersona(0)).toBe("#d23f18");
    expect(colorPersona(1)).toBe("#52ab69");
  });

  it("vuelve a empezar cuando hay más personas que colores", () => {
    expect(colorPersona(COLORES_SERIE.length)).toBe(colorPersona(0));
  });

  it("usa el gris de reserva con índices no válidos", () => {
    expect(colorPersona(-1)).toBe("#8f9594");
    expect(colorPersona(1.5)).toBe("#8f9594");
  });
});
