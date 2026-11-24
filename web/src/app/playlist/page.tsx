import type { Metadata } from "next";

import { PanelPlaylist } from "@/components/playlist/PanelPlaylist";
import { Etiqueta } from "@/components/ui/Etiqueta";

export const metadata: Metadata = {
  title: "Vuestra playlist",
  description: "Elegid quién viaja, la franja y cuánto dura el trayecto, y sacad la playlist del grupo.",
};

const PaginaPlaylist = () => {
  return (
    <section aria-labelledby="titulo-playlist">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:pb-24">
        <div className="flex animate-aparecer flex-col items-start gap-5 lg:max-w-3xl">
          <Etiqueta>Paso 3 · Vuestra playlist</Etiqueta>
          <h1 id="titulo-playlist" className="font-display text-titular font-bold tracking-titular">
            Música que <span className="text-acento">nadie salta</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-tinta-2">
            Elegid quién viaja, a qué hora y cuánto dura el trayecto. Cada canción vale lo que le gusta al que menos le
            gusta, así que arriba quedan las que os gustan a todos.
          </p>
        </div>
        <PanelPlaylist />
      </div>
    </section>
  );
};

export default PaginaPlaylist;
