import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// Sin Client ID de Spotify (como ahora, mientras no se dé de alta la app).
vi.hoisted(() => {
  delete process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
});

import { Resultado } from "@/components/playlist/Resultado";
import type { CancionPlaylist, Playlist } from "@/lib/tipos";

const cancion = (posicion: number, track_id: string, artista: string, conocida: boolean): CancionPlaylist => {
  return {
    posicion,
    track_id,
    cancion: `Canción ${track_id}`,
    artista,
    duracion_s: 187,
    gusto_grupo: 0.8,
    desempate: 0.85,
    conocida_por_todos: conocida,
    miembros: {
      ana: { gusto: 0.7, percentil: 0.8, origen: "real" },
      beñat: { gusto: 0.6, percentil: 0.9, origen: conocida ? "real" : "prevista" },
    },
  };
};

const PLAYLIST: Playlist = {
  personas: ["ana", "beñat"],
  franja: null,
  franja_horas: "sin horario",
  tipo_dia: "sin horario",
  regla: "percentil del gusto de cada miembro; gusto del grupo = mínimo",
  n_canciones: 4,
  duracion_total_min: 12.5,
  canciones: [
    cancion(1, "a", "Rosalía", true),
    cancion(2, "b", "Rosalía", true),
    cancion(3, "c", "Bad Bunny", true),
    cancion(4, "d", "Rojuu", false),
  ],
};

const pintar = (playlist: Playlist = PLAYLIST) => {
  return render(<Resultado playlist={playlist} personasModelo={["ana", "beñat"]} />);
};

const cifra = (nombre: string) => {
  const termino = screen.getByText(nombre, { selector: "dt" });
  const valor = termino.nextElementSibling;
  if (valor === null) throw new Error(`Sin valor para ${nombre}`);
  return valor.textContent;
};

describe("Resultado", () => {
  afterEach(cleanup);

  it("sin canciones avisa y no ofrece exportar", () => {
    pintar({ ...PLAYLIST, canciones: [], n_canciones: 0, duracion_total_min: 0 });
    expect(screen.getByText("No queda ninguna canción con estos filtros")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copiar enlaces/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /canciones de la playlist/i })).not.toBeInTheDocument();
  });

  it("enseña las cifras y un enlace «Escuchar» por canción", () => {
    pintar();
    expect(cifra("Canciones")).toBe("4");
    expect(cifra("Duración")).toBe("0 h 13 min");
    expect(cifra("Artistas distintos")).toBe("3");
    expect(cifra("Con gusto real de todos")).toBe("75 %");

    const lista = screen.getByRole("list", { name: /canciones de la playlist/i });
    const enlaces = within(lista).getAllByRole("link", { name: /escuchar/i });
    expect(enlaces).toHaveLength(4);
    expect(enlaces[0]).toHaveAttribute("href", "https://open.spotify.com/track/a");
  });

  it("marca si el gusto de cada uno es real o previsto", () => {
    pintar();
    const fila = screen.getByRole("listitem", { name: /canción d/i });
    expect(within(fila).getByText("beñat: 90, previsto")).toBeInTheDocument();
    expect(within(fila).getByText("ana: 80, real")).toBeInTheDocument();
  });

  it("«Copiar enlaces» copia un enlace por línea y explica cómo pegarlos", async () => {
    const usuario = userEvent.setup();
    const escribir = vi.spyOn(navigator.clipboard, "writeText");
    pintar();

    await usuario.click(screen.getByRole("button", { name: "Copiar enlaces" }));

    expect(escribir).toHaveBeenCalledWith(
      [
        "https://open.spotify.com/track/a",
        "https://open.spotify.com/track/b",
        "https://open.spotify.com/track/c",
        "https://open.spotify.com/track/d",
      ].join("\n"),
    );
    expect(await screen.findByText("Enlaces copiados")).toBeInTheDocument();
    expect(
      screen.getByText("Abre Spotify en el ordenador → crea una playlist → haz clic dentro de ella → Ctrl+V"),
    ).toBeInTheDocument();
  });

  it("si el portapapeles falla, enseña los enlaces para copiarlos a mano", async () => {
    const usuario = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("bloqueado"));
    pintar();

    await usuario.click(screen.getByRole("button", { name: "Copiar enlaces" }));

    const caja = await screen.findByLabelText("Enlaces de la playlist");
    expect(caja).toHaveValue(PLAYLIST.canciones.map((c) => `https://open.spotify.com/track/${c.track_id}`).join("\n"));
  });

  it("sin Client ID no ofrece «Crear en mi Spotify», solo «Copiar enlaces»", () => {
    pintar();
    expect(screen.queryByRole("button", { name: "Crear en mi Spotify" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar enlaces" })).toBeInTheDocument();
  });
});
