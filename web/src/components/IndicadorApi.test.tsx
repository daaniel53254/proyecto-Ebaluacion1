import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IndicadorApi } from "@/components/IndicadorApi";
import { ErrorApi, obtenerSalud } from "@/lib/api";

vi.mock("@/lib/api", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/api")>();
  return { ...original, obtenerSalud: vi.fn() };
});

describe("IndicadorApi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("si la API aún no responde, reintenta solo y pasa a «modelo listo» sin recargar", async () => {
    vi.mocked(obtenerSalud)
      .mockRejectedValueOnce(new ErrorApi("sin conexión", 0))
      .mockResolvedValueOnce({ estado: "ok", modelo: "local", preparacion: null });
    render(<IndicadorApi />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("status")).toHaveTextContent("La API no está arrancada");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("API conectada · modelo listo");
    expect(obtenerSalud).toHaveBeenCalledTimes(2);
  });

  it("al desmontar deja de reintentar", async () => {
    vi.mocked(obtenerSalud).mockRejectedValue(new ErrorApi("sin conexión", 0));
    const { unmount } = render(<IndicadorApi />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(obtenerSalud).toHaveBeenCalledTimes(1);
  });
});
