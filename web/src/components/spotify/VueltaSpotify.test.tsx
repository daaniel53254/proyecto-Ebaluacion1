import { cleanup, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = "prueba";
});

import { VueltaSpotify } from "@/components/spotify/VueltaSpotify";
import { CLAVE_PENDIENTE, type Pendiente } from "@/lib/spotify";

const PENDIENTE: Pendiente = {
  nombre: "Viaje · ander · 24/11/2026",
  descripcion: "Playlist del grupo",
  trackIds: ["t1"],
  verifier: "v".repeat(64),
  state: "estado123",
};

const respuesta = (codigo: number, cuerpo: unknown): Response => {
  return new Response(JSON.stringify(cuerpo), { status: codigo, headers: { "Content-Type": "application/json" } });
};

const abrirVuelta = (busqueda: string) => {
  window.history.replaceState(null, "", `/spotify/vuelta${busqueda}`);
  return render(
    <StrictMode>
      <VueltaSpotify />
    </StrictMode>,
  );
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("VueltaSpotify", () => {
  it("sin nada guardado explica que hay que volver a generarla (nunca en blanco)", async () => {
    abrirVuelta("?code=x&state=y");
    expect(
      await screen.findByText("No se encontró la playlist que querías exportar. Vuelve a generarla."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a la playlist" })).toHaveAttribute("href", "/playlist");
  });

  it("si se canceló el login, lo dice y borra lo guardado", async () => {
    sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify(PENDIENTE));
    abrirVuelta("?error=access_denied&state=estado123");
    expect(await screen.findByText("Has cancelado el login de Spotify.")).toBeInTheDocument();
    expect(sessionStorage.getItem(CLAVE_PENDIENTE)).toBeNull();
  });

  it("crea la playlist una sola vez aunque StrictMode repita el efecto, y quita el código de la URL", async () => {
    sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify(PENDIENTE));
    const simulado = vi.fn(async (url: string) => {
      if (url.includes("accounts.spotify.com")) return respuesta(200, { access_token: "tok" });
      if (url.endsWith("/me/playlists")) {
        return respuesta(201, { id: "p1", external_urls: { spotify: "https://open.spotify.com/playlist/p1" } });
      }
      return respuesta(201, { snapshot_id: "s" });
    });
    vi.stubGlobal("fetch", simulado);

    abrirVuelta("?code=x&state=estado123");

    expect(screen.getByText("Creando la playlist…")).toBeInTheDocument();
    const enlace = await screen.findByRole("link", { name: "Abrir en Spotify" });
    expect(enlace).toHaveAttribute("href", "https://open.spotify.com/playlist/p1");
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    expect(simulado).toHaveBeenCalledTimes(3);
    expect(window.location.search).toBe("");
    expect(sessionStorage.getItem(CLAVE_PENDIENTE)).toBeNull();
    expect(screen.getByRole("link", { name: "Volver a la playlist" })).toBeInTheDocument();
  });

  it("con 403 explica lo de la lista y ofrece «Copiar enlaces»", async () => {
    sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify(PENDIENTE));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        return url.includes("accounts.spotify.com") ? respuesta(200, { access_token: "tok" }) : respuesta(403, {});
      }),
    );
    abrirVuelta("?code=x&state=estado123");
    expect(await screen.findByText(/no está en la lista de la app/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar enlaces" })).toBeInTheDocument();
  });
});
