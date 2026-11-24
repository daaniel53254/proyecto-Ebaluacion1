import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelPlaylist } from "@/components/playlist/PanelPlaylist";
import { ErrorApi, obtenerArtistas, obtenerPersonas, obtenerSalud, pedirPlaylist } from "@/lib/api";
import type { Persona, Playlist } from "@/lib/tipos";

vi.mock("@/lib/api", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    obtenerSalud: vi.fn(),
    obtenerPersonas: vi.fn(),
    obtenerArtistas: vi.fn(),
    pedirPlaylist: vi.fn(),
  };
});

const persona = (nombre: string): Persona => {
  return { persona: nombre, escuchas_periodo: 100, tasa_no_salto: 0.7 };
};

const VACIA: Playlist = {
  personas: ["ana"],
  franja: null,
  franja_horas: "cualquiera",
  tipo_dia: "cualquiera",
  regla: "r",
  n_canciones: 0,
  duracion_total_min: 0,
  canciones: [],
};

describe("PanelPlaylist", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(obtenerSalud).mockResolvedValue({ estado: "ok", modelo: "local", preparacion: null });
    vi.mocked(obtenerPersonas).mockResolvedValue([persona("ana"), persona("beñat")]);
    vi.mocked(obtenerArtistas).mockResolvedValue(["Rosalía", "Rojuu", "Bad Bunny"]);
    vi.mocked(pedirPlaylist).mockResolvedValue(VACIA);
  });

  it("sin modelo avisa y enlaza a «Súbelo», sin filtros", async () => {
    vi.mocked(obtenerSalud).mockResolvedValue({ estado: "sin modelo", modelo: null, preparacion: null });
    render(<PanelPlaylist />);
    expect(await screen.findByRole("link", { name: "Súbelo" })).toHaveAttribute("href", "/subir");
    expect(screen.queryByRole("button", { name: "Generar playlist" })).not.toBeInTheDocument();
  });

  it("no genera hasta pulsar el botón y manda los filtros elegidos", async () => {
    const usuario = userEvent.setup();
    render(<PanelPlaylist />);
    await usuario.click(await screen.findByRole("button", { name: "beñat" }));
    expect(pedirPlaylist).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Generar playlist" }));

    expect(pedirPlaylist).toHaveBeenCalledWith(expect.objectContaining({ personas: ["ana"], ignorar_horario: true }));
    expect(await screen.findByText("No queda ninguna canción con estos filtros")).toBeInTheDocument();
  });

  it("si alguien ya no está en el modelo (404), enseña el error y recarga las personas", async () => {
    const usuario = userEvent.setup();
    vi.mocked(pedirPlaylist).mockRejectedValue(new ErrorApi("Persona desconocida: beñat", 404, ["beñat"]));
    render(<PanelPlaylist />);
    await screen.findByRole("button", { name: "beñat" });
    vi.mocked(obtenerPersonas).mockResolvedValue([persona("ana")]);

    await usuario.click(screen.getByRole("button", { name: "Generar playlist" }));

    const aviso = await screen.findByRole("alert");
    expect(within(aviso).getByText("Persona desconocida: beñat")).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: "beñat" })).not.toBeInTheDocument());
    expect(obtenerPersonas).toHaveBeenCalledTimes(2);
  });

  it("«Quitar artistas» se maneja con el teclado y los quitados salen como chips", async () => {
    const usuario = userEvent.setup();
    render(<PanelPlaylist />);
    const campo = await screen.findByRole("combobox", { name: "Quitar artistas" });

    await usuario.type(campo, "ro");
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2);
    await usuario.keyboard("{ArrowDown}{Enter}");

    const chip = screen.getByRole("button", { name: "Volver a poner a Rojuu" });
    expect(campo).toHaveValue("");
    expect(campo).toHaveAttribute("aria-expanded", "false");
    await usuario.click(chip);
    expect(screen.queryByRole("button", { name: "Volver a poner a Rojuu" })).not.toBeInTheDocument();
  });
});
