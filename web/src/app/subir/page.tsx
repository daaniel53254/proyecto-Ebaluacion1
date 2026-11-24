import type { Metadata } from "next";

import { PanelSubida } from "@/components/subir/PanelSubida";
import { Etiqueta } from "@/components/ui/Etiqueta";

export const metadata: Metadata = {
  title: "Súbelo",
  description: "Sube tu historial de Spotify, mira cómo se vuelve a entrenar el modelo y borra tus datos cuando quieras.",
};

const Subir = () => {
  return (
    <section aria-labelledby="titulo-subir">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:pb-24">
        <div className="flex animate-aparecer flex-col items-start gap-5 lg:max-w-3xl">
          <Etiqueta>Paso 2 · Súbelo</Etiqueta>
          <h1 id="titulo-subir" className="font-display text-titular font-bold tracking-titular">
            Sube tu historial <span className="text-acento">tal cual llega</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-tinta-2">
            Antes de enviar nada, el navegador abre el .zip y se queda solo con los ficheros de audio. De ellos, la API
            guarda la canción, el artista, el álbum, la fecha, el tiempo escuchado y cómo terminó.
          </p>
        </div>
        <PanelSubida />
      </div>
    </section>
  );
};

export default Subir;
