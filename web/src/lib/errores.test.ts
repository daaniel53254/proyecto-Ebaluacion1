import { describe, expect, it } from "vitest";

import { lineasDeDetalle } from "@/lib/errores";

describe("lineasDeDetalle", () => {
  it("un texto no vacío es una línea", () => {
    expect(lineasDeDetalle("ValueError")).toEqual(["ValueError"]);
  });

  it("los errores de validación salen como «campo: problema»", () => {
    expect(lineasDeDetalle([{ campo: "persona", problema: "Field required" }, "otro"])).toEqual([
      "persona: Field required",
      "otro",
    ]);
  });

  it("sin detalle útil no hay líneas", () => {
    expect(lineasDeDetalle(null)).toEqual([]);
    expect(lineasDeDetalle("  ")).toEqual([]);
    expect(lineasDeDetalle({ raro: 1 })).toEqual([]);
  });
});
