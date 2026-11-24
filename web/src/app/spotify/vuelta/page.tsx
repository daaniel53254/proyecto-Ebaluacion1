import type { Metadata } from "next";

import { VueltaSpotify } from "@/components/spotify/VueltaSpotify";
import { Etiqueta } from "@/components/ui/Etiqueta";

export const metadata: Metadata = {
  title: "Crear en Spotify",
  description: "Vuelta del login de Spotify: se crea la playlist del grupo en tu cuenta.",
  robots: { index: false },
};

const PaginaVueltaSpotify = () => {
  return (
    <section aria-labelledby="titulo-vuelta">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:pb-24">
        <div className="flex animate-aparecer flex-col items-start gap-5">
          <Etiqueta>Paso 3 · A Spotify</Etiqueta>
          <h1 id="titulo-vuelta" className="font-display text-titular font-bold tracking-titular">
            Tu playlist, <span className="text-acento">en tu cuenta</span>
          </h1>
        </div>
        <VueltaSpotify />
      </div>
    </section>
  );
};

export default PaginaVueltaSpotify;
