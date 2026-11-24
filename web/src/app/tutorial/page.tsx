import type { Metadata } from "next";

import { Paso } from "@/components/tutorial/Paso";
import { PASOS_TUTORIAL } from "@/components/tutorial/pasos";
import { EnlaceBoton } from "@/components/ui/EnlaceBoton";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { tarjeta } from "@/components/ui/estilos";

export const metadata: Metadata = {
  title: "Pide tu historial",
  description:
    "Cómo pedir a Spotify tu historial ampliado de reproducción, paso a paso, y qué datos usamos de él.",
};

const DATOS_USADOS = [
  "Canción",
  "Artista",
  "Álbum",
  "Fecha y hora",
  "Tiempo escuchado",
  "Cómo terminó (si la saltaste)",
  "Modo aleatorio",
] as const;

const DATOS_NO_USADOS = ["Nada de tu cuenta", "Ni la IP", "Ni el dispositivo"] as const;

const Tutorial = () => {
  return (
    <>
      <section aria-labelledby="titulo-tutorial">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-12 pb-12 sm:px-6 sm:pt-16">
          <div className="flex animate-aparecer flex-col items-start gap-5 lg:max-w-3xl">
            <Etiqueta>Paso 1 · Pide tu historial</Etiqueta>
            <h1 id="titulo-tutorial" className="font-display text-titular font-bold tracking-titular">
              Pide tu historial <span className="text-acento">hoy mismo</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-tinta-2">
              Spotify guarda todo lo que escuchas y te lo da si se lo pides. Son cinco pasos y unos dos minutos; lo
              que tarda es lo que viene después.
            </p>
          </div>
          <div
            role="note"
            className="flex animate-aparecer flex-col gap-2 rounded-3xl border border-acento/60 bg-acento-suave/40 p-5 [animation-delay:150ms] sm:flex-row sm:items-center sm:gap-6 sm:p-6"
          >
            <span aria-hidden className="font-display text-5xl leading-none font-bold text-acento tabular-nums">
              30
            </span>
            <p className="text-base leading-relaxed text-tinta-2 sm:text-lg">
              <strong className="font-semibold text-tinta">Spotify puede tardar hasta 30 días</strong> en mandarte el
              historial (suele ser menos). Pídelo ya, aunque el viaje sea dentro de unas semanas.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Pasos para pedir el historial">
        <ol className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-16 sm:px-6 lg:pb-24">
          {PASOS_TUTORIAL.map((paso) => {
            return <Paso key={paso.numero} paso={paso} />;
          })}
        </ol>
      </section>

      <section aria-labelledby="que-datos" className="border-t border-linea">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:py-24">
          <div className="flex flex-col items-start gap-4 lg:col-span-5">
            <Etiqueta>Tus datos</Etiqueta>
            <h2 id="que-datos" className="font-display text-seccion font-bold tracking-tight">
              Qué usamos <span className="text-acento">y qué no</span>
            </h2>
            <p className="text-tinta-2">
              Del historial, la API se queda solo con estos campos de cada escucha. Lo demás ni se guarda.
            </p>
            <EnlaceBoton href="/subir" className="mt-4">
              Ya lo tengo: a subirlo <span aria-hidden>→</span>
            </EnlaceBoton>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            <div className={tarjeta({ class: "p-6" })}>
              <h3 className="font-display text-lg font-bold tracking-tight">Lo que se usa</h3>
              <ul className="mt-4 flex flex-col gap-2.5 text-tinta-2">
                {DATOS_USADOS.map((dato) => {
                  return (
                    <li key={dato} className="flex items-center gap-3">
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-acento" />
                      {dato}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className={tarjeta({ class: "p-6" })}>
              <h3 className="font-display text-lg font-bold tracking-tight">Lo que no</h3>
              <ul className="mt-4 flex flex-col gap-2.5 text-tinta-2">
                {DATOS_NO_USADOS.map((dato) => {
                  return (
                    <li key={dato} className="flex items-center gap-3">
                      <span aria-hidden className="h-0.5 w-2.5 shrink-0 rounded-full bg-linea-2" />
                      {dato}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-apagado">
                Tampoco los vídeos ni los pódcast: el navegador los quita antes de enviar.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Tutorial;
