import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useHistoriales } from "@/hooks/useHistoriales";
import { borrarHistorial, ErrorApi, obtenerHistoriales } from "@/lib/api";
import type { EstadoPreparacion } from "@/lib/tipos";

vi.mock("@/lib/api", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/api")>();
  return { ...original, borrarHistorial: vi.fn(), obtenerHistoriales: vi.fn() };
});

const PREPARACION: EstadoPreparacion = {
  estado: "en_curso",
  motivo: "borrado de ana",
  inicio: null,
  fin: null,
  error: null,
  resumen: null,
};

describe("useHistoriales", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(obtenerHistoriales).mockResolvedValue([{ persona: "ana", ficheros: 1, en_el_modelo: true }]);
  });

  it("si el borrado falla, el error sigue a la vista después de recargar la lista", async () => {
    vi.mocked(borrarHistorial).mockRejectedValueOnce(new ErrorApi("El token no coincide", 403));
    const { result } = renderHook(() => useHistoriales());
    await waitFor(() => expect(result.current.cargando).toBe(false));

    await act(async () => {
      await result.current.borrar("ana", "malo");
    });

    expect(result.current.error).toBe("El token no coincide");
  });

  it("al borrar envía el token y después lo olvida", async () => {
    window.localStorage.setItem("npd-token:ana", "bueno");
    vi.mocked(borrarHistorial).mockResolvedValueOnce(PREPARACION);
    const { result } = renderHook(() => useHistoriales());
    await waitFor(() => expect(result.current.cargando).toBe(false));

    await act(async () => {
      await result.current.borrar("ana", "bueno");
    });

    expect(borrarHistorial).toHaveBeenCalledWith("ana", "bueno");
    expect(window.localStorage.getItem("npd-token:ana")).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
