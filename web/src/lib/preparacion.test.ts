import { describe, expect, it, vi } from "vitest";

import { esperarPreparacion } from "@/lib/preparacion";
import type { EstadoPreparacion } from "@/lib/tipos";

const estado = (parcial: Partial<EstadoPreparacion>): EstadoPreparacion => {
  return { estado: "sin_preparar", motivo: null, inicio: null, fin: null, error: null, resumen: null, ...parcial };
};

// Devuelve las respuestas en orden y repite la última.
const secuencia = (respuestas: Partial<EstadoPreparacion>[]) => {
  let llamada = 0;
  return vi.fn(async () => {
    const respuesta = respuestas[Math.min(llamada, respuestas.length - 1)] ?? {};
    llamada += 1;
    return estado(respuesta);
  });
};

describe("esperarPreparacion", () => {
  it("espera de en_curso a lista", async () => {
    const leer = secuencia([{ estado: "en_curso" }, { estado: "en_curso" }, { estado: "lista" }]);
    expect((await esperarPreparacion(leer, { cadaMs: 0 })).estado).toBe("lista");
    expect(leer).toHaveBeenCalledTimes(3);
  });

  it("no se fía de una «lista» anterior a ver en_curso", async () => {
    const leer = secuencia([
      { estado: "lista", motivo: "anterior" },
      { estado: "en_curso" },
      { estado: "lista", motivo: "subida de aitor" },
    ]);
    expect((await esperarPreparacion(leer, { cadaMs: 0 })).motivo).toBe("subida de aitor");
  });

  it("termina en error", async () => {
    const leer = secuencia([{ estado: "en_curso" }, { estado: "error", error: "ValueError: pocos datos" }]);
    const final = await esperarPreparacion(leer, { cadaMs: 0 });
    expect(final.estado).toBe("error");
    expect(final.error).toBe("ValueError: pocos datos");
  });

  it("si la subida ya traía en_curso, la primera «lista» vale", async () => {
    const leer = secuencia([{ estado: "lista", motivo: "subida de aitor" }]);
    const final = await esperarPreparacion(leer, { cadaMs: 0, inicial: estado({ estado: "en_curso" }) });
    expect(final.motivo).toBe("subida de aitor");
    expect(leer).toHaveBeenCalledTimes(1);
  });

  it("avisa de cada estado leído", async () => {
    const alCambiar = vi.fn();
    await esperarPreparacion(secuencia([{ estado: "en_curso" }, { estado: "lista" }]), { cadaMs: 0, alCambiar });
    expect(alCambiar.mock.calls.map(([e]) => e.estado)).toEqual(["en_curso", "lista"]);
  });

  it("se puede cancelar con la señal", async () => {
    const control = new AbortController();
    const leer = secuencia([{ estado: "en_curso" }]);
    const espera = esperarPreparacion(leer, { cadaMs: 10, senal: control.signal });
    control.abort();
    await expect(espera).rejects.toThrow();
  });
});
