import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormularioSubida } from "@/components/subir/FormularioSubida";
import { ErrorApi, subirHistorial } from "@/lib/api";
import { prepararHistorial } from "@/lib/historial";
import type { Historial, RespuestaSubida } from "@/lib/tipos";

vi.mock("@/lib/api", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/api")>();
  return { ...original, subirHistorial: vi.fn(), obtenerHistoriales: vi.fn(), obtenerPreparacion: vi.fn() };
});

vi.mock("@/lib/historial", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/historial")>();
  return { ...original, prepararHistorial: vi.fn(original.prepararHistorial) };
});

const RESPUESTA: RespuestaSubida = {
  historial: { persona: "ana", ficheros: 1, escuchas: 10, desde: "2024-01-01", hasta: "2024-12-31" },
  preparacion: { estado: "en_curso", motivo: "subida de ana", inicio: null, fin: null, error: null, resumen: null },
};

const zipDeSpotify = async () => {
  const zip = new JSZip();
  zip.file("Spotify Extended Streaming History/Streaming_History_Audio_2024.json", "[]");
  zip.file("Spotify Extended Streaming History/Streaming_History_Video_2024.json", "[]");
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  return new File([bytes], "my_spotify_data.zip", { type: "application/zip" });
};

const pintar = (historiales: Historial[] = []) => {
  const alSubir = vi.fn();
  render(<FormularioSubida historiales={historiales} alSubir={alSubir} />);
  return { alSubir, usuario: userEvent.setup() };
};

const botonSubir = () => screen.getByRole("button", { name: "Subir" });
const campoArchivos = () => screen.getByLabelText(/elige el \.zip/i);

const rellenarTodo = async (usuario: ReturnType<typeof userEvent.setup>) => {
  await usuario.type(screen.getByLabelText("Tu nombre"), "ana");
  await usuario.click(screen.getByLabelText("Acepto que se use mi historial para generar las playlists del grupo."));
  await usuario.upload(campoArchivos(), await zipDeSpotify());
  await screen.findByText("Se suben 1 fichero · Se descartan 1");
};

describe("FormularioSubida", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(subirHistorial).mockResolvedValue(RESPUESTA);
  });

  it("el botón Subir queda desactivado sin nombre válido, sin consentimiento o sin archivos", async () => {
    const { usuario } = pintar();
    expect(botonSubir()).toBeDisabled();

    await usuario.type(screen.getByLabelText("Tu nombre"), "á");
    await usuario.click(screen.getByLabelText("Acepto que se use mi historial para generar las playlists del grupo."));
    await usuario.upload(campoArchivos(), await zipDeSpotify());
    await screen.findByText("Se suben 1 fichero · Se descartan 1");
    expect(botonSubir()).toBeDisabled();

    await usuario.clear(screen.getByLabelText("Tu nombre"));
    await usuario.type(screen.getByLabelText("Tu nombre"), "ana");
    expect(botonSubir()).toBeEnabled();

    await usuario.click(screen.getByLabelText("Acepto que se use mi historial para generar las playlists del grupo."));
    expect(botonSubir()).toBeDisabled();
  });

  it("resume lo que se sube y lo que se descarta", async () => {
    const { usuario } = pintar();
    await usuario.upload(campoArchivos(), await zipDeSpotify());
    expect(await screen.findByText("Se suben 1 fichero · Se descartan 1")).toBeInTheDocument();
    expect(screen.getByText("Streaming_History_Video_2024.json")).toBeInTheDocument();
  });

  it("avisa de que sustituye un historial que ya existe", async () => {
    const { usuario } = pintar([{ persona: "ana", ficheros: 3, en_el_modelo: true }]);
    await usuario.type(screen.getByLabelText("Tu nombre"), "Ana");
    expect(screen.getByText("Ya hay un historial de «ana»: se sustituirá")).toBeInTheDocument();
  });

  it("mientras prepara los ficheros lo dice y no deja subir", async () => {
    vi.mocked(prepararHistorial).mockImplementationOnce(() => new Promise(() => {}));
    const { usuario } = pintar();
    await usuario.type(screen.getByLabelText("Tu nombre"), "ana");
    await usuario.click(screen.getByLabelText("Acepto que se use mi historial para generar las playlists del grupo."));
    await usuario.upload(campoArchivos(), await zipDeSpotify());
    expect(await screen.findByText("Preparando ficheros…")).toBeInTheDocument();
    expect(botonSubir()).toBeDisabled();
  });

  it("si el zip no se puede leer, lo explica", async () => {
    vi.mocked(prepararHistorial).mockRejectedValueOnce(new Error("Corrupted zip"));
    const { usuario } = pintar();
    await usuario.upload(campoArchivos(), await zipDeSpotify());
    expect(await screen.findByText("No se pudo leer el fichero. Comprueba que es el .zip que envía Spotify.")).toBeInTheDocument();
  });

  it("sube con el nombre normalizado y avisa al terminar", async () => {
    const { usuario, alSubir } = pintar();
    await rellenarTodo(usuario);
    await usuario.click(botonSubir());
    expect(subirHistorial).toHaveBeenCalledWith("ana", true, expect.any(Blob));
    expect(alSubir).toHaveBeenCalledWith(RESPUESTA);
  });

  it("enseña el error de la API en un aviso", async () => {
    vi.mocked(subirHistorial).mockRejectedValueOnce(new ErrorApi("El zip no tiene escuchas válidas", 422));
    const { usuario, alSubir } = pintar();
    await rellenarTodo(usuario);
    await usuario.click(botonSubir());
    expect(await screen.findByRole("alert")).toHaveTextContent("El zip no tiene escuchas válidas");
    expect(alSubir).not.toHaveBeenCalled();
  });

  it("enseña también el detalle del error de la API", async () => {
    const detalle = [{ campo: "persona", problema: "Field required" }];
    vi.mocked(subirHistorial).mockRejectedValueOnce(new ErrorApi("Entrada no válida", 422, detalle));
    const { usuario } = pintar();
    await rellenarTodo(usuario);
    await usuario.click(botonSubir());
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("Entrada no válida");
    expect(aviso).toHaveTextContent("persona: Field required");
  });
});
