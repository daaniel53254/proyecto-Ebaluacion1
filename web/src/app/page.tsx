import type { Metadata } from "next";

import { IndicadorApi } from "@/components/IndicadorApi";
import { MuestraRegla } from "@/components/MuestraRegla";
import { TarjetaPaso } from "@/components/TarjetaPaso";
import { EnlaceBoton } from "@/components/ui/EnlaceBoton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { PASOS } from "@/lib/pasos";

export const metadata: Metadata = {
  description:
    "Pide tu historial de Spotify, súbelo y sacad una playlist que guste a todo el grupo, en tres pasos.",
};

const Portada = () => {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 -top-40 -z-10 mx-auto h-96 max-w-3xl rounded-full bg-acento-suave/60 blur-3xl"
        />
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pt-12 pb-16 sm:px-6 lg:px-8 sm:pt-20 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pb-24">
          <div className="flex animate-aparecer flex-col items-start gap-6 lg:col-span-7">
            <Etiqueta>NPD Entertainment · Viajes en grupo</Etiqueta>
            <h1 className="font-display text-titular font-bold tracking-titular">
              La playlist que <span className="text-acento">os gusta a todos</span> para el viaje
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-tinta-2">
              Cada uno sube su historial de Spotify y el modelo aprende qué canciones disfruta y cuáles salta. Luego
              elegís quién viaja y sale una lista sin canciones que alguien quiera saltar.
            </p>
            <div className="flex flex-wrap gap-3">
              <EnlaceBoton href="/tutorial">Empezar</EnlaceBoton>
              <EnlaceBoton href="/playlist" intencion="secundario">
                Ya hemos subido los historiales
              </EnlaceBoton>
            </div>
            <IndicadorApi />
          </div>
          <div className="animate-aparecer [animation-delay:150ms] lg:col-span-5">
            <MuestraRegla />
          </div>
        </div>
      </section>

      <section aria-labelledby="como-funciona" className="border-t border-linea">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:px-8 lg:grid-cols-12 lg:py-24">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <Etiqueta>Cómo funciona</Etiqueta>
            <h2 id="como-funciona" className="font-display text-seccion font-bold tracking-tight">
              Cuatro pasos y a la carretera
            </h2>
            <p className="text-tinta-2">
              Pedir el historial a Spotify es lo único que tarda. Lo demás son unos minutos.
            </p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
            {PASOS.map((paso) => {
              return (
                <li key={paso.ruta}>
                  <TarjetaPaso paso={paso} />
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </>
  );
};

export default Portada;
