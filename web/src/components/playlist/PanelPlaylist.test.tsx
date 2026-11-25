import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelPlaylist } from "@/components/playlist/PanelPlaylist";
import {
  buscarCanciones,
  ErrorApi,
  obtenerArtistasPorPersona,
  obtenerPersonas,
  obtenerSalud,
  pedirPlaylist,
} from "@/lib/api";
import { esperarPreparacion } from "@/lib/preparacion";
import type { EstadoPreparacion, Persona, Playlist } from "@/lib/tipos";

vi.mock("@/lib/api", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    obtenerSalud: vi.fn(),
    obtenerPersonas: vi.fn(),
    obtenerArtistasPorPersona: vi.fn(),
    buscarCanciones: vi.fn(),
    pedirPlaylist: vi.fn(),
  };
});

vi.mock("@/lib/preparacion", () => ({ esperarPreparacion: vi.fn() }));

const EN_CURSO: EstadoPreparacion = { estado: "en_curso", motivo: "subida", inicio: null, fin: null, error: null, resumen: null };

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
    window.sessionStorage.clear();
    vi.mocked(obtenerArtistasPorPersona).mockResolvedValue([
      { artista: "Rosalía", personas: { ana: 12 } },
      { artista: "Rojuu", personas: { beñat: 4, ana: 1 } },
      { artista: "Bad Bunny", personas: { ana: 30, beñat: 20 } },
    ]);
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
    vi.mocked(obtenerPersonas).mockResolvedValue([persona("ana"), persona("beñat"), persona("carla")]);
    render(<PanelPlaylist />);
    await usuario.click(await screen.findByRole("button", { name: "carla" }));
    await usuario.selectOptions(screen.getByLabelText("Momento del día"), "noche");
    expect(pedirPlaylist).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Generar playlist" }));

    expect(pedirPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({ personas: ["ana", "beñat"], ignorar_horario: false, franjas: [5, 0] }),
    );
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

  it("no deja bajar de dos personas y lo dice", async () => {
    const usuario = userEvent.setup();
    render(<PanelPlaylist />);
    const benat = await screen.findByRole("button", { name: "beñat" });
    expect(benat).toHaveAttribute("aria-pressed", "true");
    expect(benat).toHaveAttribute("aria-disabled", "true");
    await usuario.click(benat);
    expect(benat).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/2 de 2 en el grupo · como mínimo, 2 personas/)).toBeInTheDocument();
  });

  it("con una sola persona en el modelo no deja generar", async () => {
    vi.mocked(obtenerPersonas).mockResolvedValue([persona("ana")]);
    render(<PanelPlaylist />);
    expect(await screen.findByText(/Hacen falta al menos 2 personas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generar playlist" })).toBeDisabled();
  });

  it("«Quitar canciones» busca solo entre las conocidas, dice de quién son y las manda a la API", async () => {
    const usuario = userEvent.setup();
    vi.mocked(buscarCanciones).mockResolvedValue([
      { track_id: "t9", cancion: "Malamente", artista: "Rosalía", duracion_s: 150, personas: { ana: 7, beñat: 2 } },
    ]);
    render(<PanelPlaylist />);
    await usuario.type(await screen.findByRole("searchbox", { name: "Quitar canciones" }), "mala");
    const lista = await screen.findByRole("list", { name: "Canciones que coinciden" });
    expect(within(lista).getByRole("button")).toHaveTextContent("ana, beñat");
    await usuario.click(within(lista).getByRole("button"));

    expect(screen.getByRole("button", { name: "Volver a poner «Malamente»" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Generar playlist" }));
    expect(pedirPlaylist).toHaveBeenCalledWith(expect.objectContaining({ excluir_canciones: ["t9"] }));
  });

  it("«Quitar artistas» dice de quién es cada artista", async () => {
    const usuario = userEvent.setup();
    render(<PanelPlaylist />);
    await usuario.type(await screen.findByRole("combobox", { name: "Quitar artistas" }), "rojuu");
    expect(within(screen.getByRole("listbox")).getByRole("option")).toHaveTextContent("Rojuubeñat, ana");
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

  it("mientras se reentrena, espera al final y entonces recarga y quita el aviso", async () => {
    vi.mocked(obtenerSalud).mockResolvedValue({ estado: "ok", modelo: "local", preparacion: EN_CURSO });
    let terminar: () => void = () => undefined;
    vi.mocked(esperarPreparacion).mockReturnValue(
      new Promise((resolver) => {
        terminar = () => resolver({ ...EN_CURSO, estado: "lista" });
      }),
    );
    render(<PanelPlaylist />);
    expect(await screen.findByText(/Se está volviendo a entrenar/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "carla" })).not.toBeInTheDocument();

    vi.mocked(obtenerSalud).mockResolvedValue({ estado: "ok", modelo: "local", preparacion: null });
    vi.mocked(obtenerPersonas).mockResolvedValue([persona("ana"), persona("beñat"), persona("carla")]);
    terminar();

    expect(await screen.findByRole("button", { name: "carla" })).toBeInTheDocument();
    expect(screen.queryByText(/Se está volviendo a entrenar/)).not.toBeInTheDocument();
    expect(esperarPreparacion).toHaveBeenCalledTimes(1);
  });

  it("sin modelo y entrenando, espera y pasa a los filtros cuando termina", async () => {
    vi.mocked(obtenerSalud).mockResolvedValue({ estado: "sin modelo", modelo: null, preparacion: EN_CURSO });
    let terminar: () => void = () => undefined;
    vi.mocked(esperarPreparacion).mockReturnValue(
      new Promise((resolver) => {
        terminar = () => resolver({ ...EN_CURSO, estado: "lista" });
      }),
    );
    render(<PanelPlaylist />);
    expect(await screen.findByText(/Vuelve en un rato/)).toBeInTheDocument();

    vi.mocked(obtenerSalud).mockResolvedValue({ estado: "ok", modelo: "local", preparacion: null });
    terminar();

    expect(await screen.findByRole("button", { name: "Generar playlist" })).toBeInTheDocument();
  });

  it("al salir de la página aborta la espera", async () => {
    vi.mocked(obtenerSalud).mockResolvedValue({ estado: "ok", modelo: "local", preparacion: EN_CURSO });
    vi.mocked(esperarPreparacion).mockReturnValue(new Promise(() => undefined));
    const { unmount } = render(<PanelPlaylist />);
    await screen.findByText(/Se está volviendo a entrenar/);
    const senal = vi.mocked(esperarPreparacion).mock.calls[0]?.[1]?.senal;
    expect(senal?.aborted).toBe(false);

    unmount();

    expect(senal?.aborted).toBe(true);
  });
});
