import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelCancion } from "@/components/cancion/PanelCancion";
import { buscarCanciones, consultarCancion, obtenerArtistasPorPersona, obtenerPersonas, obtenerSalud } from "@/lib/api";
import type { CancionCatalogo, Persona, RespuestaCancion } from "@/lib/tipos";

vi.mock("@/lib/api", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    obtenerSalud: vi.fn(),
    obtenerPersonas: vi.fn(),
    obtenerArtistasPorPersona: vi.fn(),
    buscarCanciones: vi.fn(),
    consultarCancion: vi.fn(),
  };
});

const persona = (nombre: string): Persona => {
  return { persona: nombre, escuchas_periodo: 100, tasa_no_salto: 0.7 };
};

const CANCION: CancionCatalogo = {
  track_id: "t1",
  cancion: "Malamente",
  artista: "Rosalía",
  duracion_s: 150,
  personas: { ana: 12 },
};

const respuesta = (cambios: Partial<RespuestaCancion>): RespuestaCancion => {
  return {
    track_id: "t1",
    cancion: "Malamente",
    artista: "Rosalía",
    personas: ["ana", "beñat"],
    franja: 3,
    franja_horas: "12-20h",
    tipo_dia: "laborable",
    entra: true,
    artista_excluido: false,
    cancion_excluida: false,
    posicion: 4,
    n_candidatas: 900,
    n_canciones_playlist: 30,
    gusto_grupo: 0.9,
    conocida_por_todos: false,
    miembros: {
      ana: { tasa_no_salto: 0.92, percentil: 0.95, origen: "real", escuchas: 12 },
      beñat: { tasa_no_salto: 0.61, percentil: 0.9, origen: "prevista", escuchas: 0 },
    },
    ...cambios,
  };
};

const elegirCancion = async (usuario: ReturnType<typeof userEvent.setup>) => {
  await usuario.type(await screen.findByRole("searchbox", { name: "Busca por título o artista" }), "mala");
  const lista = await screen.findByRole("list", { name: "Canciones encontradas" });
  await usuario.click(within(lista).getByRole("button", { name: /Malamente/ }));
};

describe("PanelCancion", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.mocked(obtenerSalud).mockResolvedValue({ estado: "ok", modelo: "local", preparacion: null });
    vi.mocked(obtenerPersonas).mockResolvedValue([persona("ana"), persona("beñat")]);
    vi.mocked(obtenerArtistasPorPersona).mockResolvedValue([{ artista: "Rosalía", personas: { ana: 12 } }]);
    vi.mocked(buscarCanciones).mockResolvedValue([CANCION]);
    vi.mocked(consultarCancion).mockResolvedValue(respuesta({}));
  });

  it("no deja comprobar hasta elegir una canción", async () => {
    render(<PanelCancion />);
    expect(await screen.findByRole("button", { name: "Comprobar" })).toBeDisabled();
    expect(screen.getByText("Primero elige una canción.")).toBeInTheDocument();
  });

  it("busca, elige y manda la canción con los filtros del grupo", async () => {
    const usuario = userEvent.setup();
    render(<PanelCancion />);
    await elegirCancion(usuario);
    await usuario.selectOptions(screen.getByLabelText("Momento del día"), "tarde");
    await usuario.click(screen.getByRole("button", { name: "Comprobar" }));

    expect(buscarCanciones).toHaveBeenCalledWith("mala", expect.anything());
    expect(consultarCancion).toHaveBeenCalledWith(
      expect.objectContaining({ track_id: "t1", personas: ["ana", "beñat"], franjas: [3, 4], ignorar_horario: false }),
    );
    expect(await screen.findByRole("heading", { name: "Sí, entraría" })).toBeInTheDocument();
    expect(screen.getByText("Quedaría en el puesto 4 de 30.")).toBeInTheDocument();
    const tasas = screen.getByRole("list", { name: "Tasa de no salto de cada uno" });
    expect(within(tasas).getByText("92 %")).toBeInTheDocument();
    expect(within(tasas).getByText(/previsto por el modelo · no la ha escuchado/)).toBeInTheDocument();
  });

  it("si no entra, dice cuántos puestos le faltan", async () => {
    vi.mocked(consultarCancion).mockResolvedValue(respuesta({ entra: false, posicion: 39 }));
    const usuario = userEvent.setup();
    render(<PanelCancion />);
    await elegirCancion(usuario);
    await usuario.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(await screen.findByRole("heading", { name: "No entraría" })).toBeInTheDocument();
    expect(screen.getByText(/puesto 39 y la playlist tiene 30: se queda a 9 puestos/)).toBeInTheDocument();
  });

  it("si la canción está quitada en los filtros, lo dice", async () => {
    vi.mocked(consultarCancion).mockResolvedValue(respuesta({ entra: false, posicion: null, cancion_excluida: true }));
    const usuario = userEvent.setup();
    render(<PanelCancion />);
    await elegirCancion(usuario);
    await usuario.click(screen.getByRole("button", { name: "Comprobar" }));
    expect(await screen.findByText("Has quitado esta canción en los filtros.")).toBeInTheDocument();
  });

  it("recupera los filtros elegidos en «Vuestra playlist»", async () => {
    window.sessionStorage.setItem(
      "npd-filtros",
      JSON.stringify({ personas: ["ana", "beñat"], momento: "noche", tipoDia: "laborable", modo: "canciones", canciones: 50 }),
    );
    render(<PanelCancion />);
    expect(await screen.findByLabelText("Momento del día")).toHaveValue("noche");
  });
});
