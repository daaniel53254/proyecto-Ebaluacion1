import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = "prueba";
});

import { BotonSpotify } from "@/components/playlist/BotonSpotify";
import { CLAVE_PENDIENTE, leerPendiente } from "@/lib/spotify";
import type { Playlist } from "@/lib/tipos";

const PLAYLIST: Playlist = {
  personas: ["ander", "daniel"],
  franja: null,
  franja_horas: "sin horario",
  tipo_dia: "sin horario",
  regla: "mínimo",
  n_canciones: 2,
  duracion_total_min: 6,
  canciones: ["a1", "b2"].map((track_id, i) => ({
    posicion: i + 1,
    track_id,
    cancion: track_id,
    artista: "X",
    duracion_s: 180,
    gusto_grupo: 0.5,
    desempate: 0.5,
    conocida_por_todos: true,
    miembros: {},
  })),
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("BotonSpotify", () => {
  it("es secundario y al pulsarlo guarda lo pendiente antes de ir al login", async () => {
    const usuario = userEvent.setup();
    render(<BotonSpotify playlist={PLAYLIST} />);
    const boton = screen.getByRole("button", { name: "Crear en mi Spotify" });
    expect(boton.className).toContain("border-linea-2");

    await usuario.click(boton);

    const pendiente = leerPendiente();
    expect(pendiente?.trackIds).toEqual(["a1", "b2"]);
    expect(pendiente?.nombre).toMatch(/^Viaje · ander, daniel · \d{2}\/\d{2}\/\d{4}$/);
    expect(pendiente?.verifier).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
    expect(pendiente?.state).not.toBe("");
  });

  it("si sessionStorage no funciona, se desactiva y lo explica", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    render(<BotonSpotify playlist={PLAYLIST} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/ventana privada/);
    expect(screen.getByRole("button", { name: "Crear en mi Spotify" })).toBeDisabled();
    expect(sessionStorage.getItem(CLAVE_PENDIENTE)).toBeNull();
  });
});
