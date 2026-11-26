import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelCancion } from "@/components/cancion/PanelCancion";
import { consultarNovedad, ErrorApi, obtenerArtistasPorPersona, obtenerPersonas, obtenerSalud } from "@/lib/api";
import type { Persona, RespuestaNovedad } from "@/lib/tipos";

vi.mock("@/lib/api", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    obtenerSalud: vi.fn(),
    obtenerPersonas: vi.fn(),
    obtenerArtistasPorPersona: vi.fn(),
    consultarNovedad: vi.fn(),
  };
});

const persona = (nombre: string): Persona => {
  return { persona: nombre, escuchas_periodo: 100, tasa_no_salto: 0.7 };
};

const respuesta = (entra: boolean, artista = "Rosalía"): RespuestaNovedad => {
  return {
    personas: ["ana", "beñat"],
    umbral_percentil: 0.8,
    resultados: [
      {
        cancion: "Berghain",
        artista,
        album: "?",
        percentil_grupo: entra ? 0.9 : 0.53,
        entra,
        motivo: entra ? "entra: está en el 20 % más prometedor" : "no entra: no llega al percentil 0.80 para beñat (0.53)",
        miembros: {
          ana: { probabilidad_adopcion: 0.39, percentil: 0.9, escuchas_artista: 447, ya_la_conoce: false },
          beñat: { probabilidad_adopcion: 0.36, percentil: entra ? 0.92 : 0.53, escuchas_artista: 7, ya_la_conoce: false },
        },
      },
    ],
  };
};

const escribirCancion = async (usuario: ReturnType<typeof userEvent.setup>, titulo: string) => {
  await usuario.type(await screen.findByLabelText("Canción"), titulo);
};

describe("PanelCancion", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.mocked(obtenerSalud).mockResolvedValue({ estado: "ok", modelo: "local", preparacion: null });
    vi.mocked(obtenerPersonas).mockResolvedValue([persona("ana"), persona("beñat")]);
    vi.mocked(obtenerArtistasPorPersona).mockResolvedValue([{ artista: "Rosalía", personas: { ana: 12 } }]);
    vi.mocked(consultarNovedad).mockResolvedValue(respuesta(true));
  });

  it("no deja comprobar hasta escribir el título de la canción", async () => {
    render(<PanelCancion />);
    expect(await screen.findByRole("button", { name: "¿Entraría?" })).toBeDisabled();
  });

  it("manda el título y el artista con las personas del grupo", async () => {
    const usuario = userEvent.setup();
    render(<PanelCancion />);
    await escribirCancion(usuario, "Berghain");
    await usuario.type(screen.getByLabelText(/Artista/), "Rosalía");
    await usuario.click(screen.getByRole("button", { name: "¿Entraría?" }));

    expect(consultarNovedad).toHaveBeenCalledWith({ personas: ["ana", "beñat"], cancion: "Berghain", artista: "Rosalía" });
    expect(await screen.findByText("Sí entraría")).toBeInTheDocument();
    const gustos = screen.getByRole("list", { name: "Gusto previsto de cada uno" });
    expect(within(gustos).getByText("percentil 90")).toBeInTheDocument();
  });

  it("si no entra, da el motivo", async () => {
    vi.mocked(consultarNovedad).mockResolvedValue(respuesta(false));
    const usuario = userEvent.setup();
    render(<PanelCancion />);
    await escribirCancion(usuario, "Berghain");
    await usuario.click(screen.getByRole("button", { name: "¿Entraría?" }));
    expect(await screen.findByText("No entraría")).toBeInTheDocument();
    expect(screen.getByText(/no llega al percentil 0.80 para beñat/)).toBeInTheDocument();
  });

  it("sin artista avisa de que el resultado es menos fino", async () => {
    vi.mocked(consultarNovedad).mockResolvedValue(respuesta(false, "?"));
    const usuario = userEvent.setup();
    render(<PanelCancion />);
    await escribirCancion(usuario, "Berghain");
    await usuario.click(screen.getByRole("button", { name: "¿Entraría?" }));
    expect(consultarNovedad).toHaveBeenCalledWith({ personas: ["ana", "beñat"], cancion: "Berghain", artista: "" });
    expect(await screen.findByText(/pon también el artista para afinar/)).toBeInTheDocument();
  });

  it("si la API falla, lo dice", async () => {
    vi.mocked(consultarNovedad).mockRejectedValue(new ErrorApi("No se puede conectar con la API", 0));
    const usuario = userEvent.setup();
    render(<PanelCancion />);
    await escribirCancion(usuario, "Berghain");
    await usuario.click(screen.getByRole("button", { name: "¿Entraría?" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se puede conectar con la API");
  });
});
