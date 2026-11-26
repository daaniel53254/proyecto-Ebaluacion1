import type { Metadata } from "next";

import { PanelCancion } from "@/components/cancion/PanelCancion";
import { Etiqueta } from "@/components/ui/Etiqueta";

export const metadata: Metadata = {
  title: "¿Entraría?",
  description: "Escribe cualquier canción y mira si entraría en la playlist del grupo y qué percentil le saldría a cada uno.",
};

const PaginaCancion = () => {
  return (
    <section aria-labelledby="titulo-cancion">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pt-12 pb-16 sm:px-6 lg:px-8 sm:pt-16 lg:pb-24">
        <div className="flex animate-aparecer flex-col items-start gap-5 lg:max-w-3xl">
          <Etiqueta>Paso 4 · ¿Entraría?</Etiqueta>
          <h1 id="titulo-cancion" className="font-display text-titular font-bold tracking-titular">
            ¿Entraría <span className="text-acento">esta canción</span>?
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-tinta-2">
            Escribe una canción, la haya escuchado alguien o no, y elige quién viaja. Te decimos si entraría en vuestra
            playlist y qué percentil le saldría a cada uno.
          </p>
        </div>
        <PanelCancion />
      </div>
    </section>
  );
};

export default PaginaCancion;
