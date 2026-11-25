"use client";

import type { FC } from "react";

import { estiloRelleno } from "@/components/playlist/BarraGusto";
import { BotonSpotify } from "@/components/playlist/BotonSpotify";
import { Cifras } from "@/components/playlist/Cifras";
import { Exportar } from "@/components/playlist/Exportar";
import { GustoPorPersona } from "@/components/playlist/GustoPorPersona";
import { TablaCanciones } from "@/components/playlist/TablaCanciones";
import { tarjeta } from "@/components/ui/estilos";
import { cifrasDe, colorEnElModelo, gustoMedioPorPersona } from "@/lib/resumen";
import { CLIENT_ID } from "@/lib/spotify";
import type { Playlist } from "@/lib/tipos";

type ResultadoProps = {
  playlist: Playlist;
  // Personas del modelo en su orden: da a cada una el mismo color en toda la web.
  personasModelo: string[];
};

const contexto = (playlist: Playlist): string => {
  if (playlist.franja === null) return "Sin importar la hora ni el día";
  const dia = playlist.tipo_dia === "laborable" ? "laborable" : "fin de semana";
  return `${playlist.franja_horas} · ${dia}`;
};

type LeyendaProps = {
  personas: string[];
  colorDe: (persona: string) => string;
};

const MUESTRA = "inline-block h-2 w-6 rounded-full";
const COLOR_MUESTRA = "var(--npd-blanco-2)";

const Leyenda: FC<LeyendaProps> = ({ personas, colorDe }) => {
  return (
    <ul aria-label="Leyenda" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-tinta-2">
      {personas.map((persona) => {
        return (
          <li key={persona} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: colorDe(persona) }} />
            {persona}
          </li>
        );
      })}
      <li className="flex items-center gap-2">
        <span aria-hidden className={MUESTRA} style={estiloRelleno("real", COLOR_MUESTRA)} />
        real (5 o más escuchas)
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className={MUESTRA} style={estiloRelleno("prevista", COLOR_MUESTRA)} />
        previsto por el modelo
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className={MUESTRA} style={estiloRelleno("grupo", "var(--npd-blanco)")} />
        grupo (la media)
      </li>
    </ul>
  );
};

const SinCanciones: FC = () => {
  return (
    <section aria-live="polite" className={tarjeta({ class: "flex flex-col gap-2 p-6 sm:p-8" })}>
      <p className="font-display text-lg font-bold">No queda ninguna canción con estos filtros</p>
      <p className="text-sm text-tinta-2">Prueba a quitar menos artistas o a cambiar la franja y vuelve a generarla.</p>
    </section>
  );
};

export const Resultado: FC<ResultadoProps> = ({ playlist, personasModelo }) => {
  if (playlist.canciones.length === 0) return <SinCanciones />;

  const colorDe = (persona: string) => colorEnElModelo(personasModelo, persona);
  return (
    <section aria-labelledby="titulo-resultado" className="flex animate-aparecer flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 id="titulo-resultado" className="font-display text-seccion font-bold tracking-titular">
          Vuestra playlist
        </h2>
        <p className="text-tinta-2">
          {playlist.personas.join(", ")} · {contexto(playlist)}
        </p>
      </div>
      <Cifras cifras={cifrasDe(playlist)} />
      <p className="max-w-2xl text-lg text-tinta-2">
        Cada canción vale lo que le gusta <span className="text-acento">al que menos le gusta</span>. Las barras son
        el percentil de cada uno (100 es de sus favoritas) y la blanca, la media del grupo.
      </p>
      <div className="flex flex-col gap-4">
        <Leyenda personas={playlist.personas} colorDe={colorDe} />
        <TablaCanciones canciones={playlist.canciones} personas={playlist.personas} colorDe={colorDe} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <GustoPorPersona medias={gustoMedioPorPersona(playlist)} colorDe={colorDe} />
        <Exportar
          playlist={playlist}
          accionExtra={CLIENT_ID === undefined ? null : <BotonSpotify playlist={playlist} />}
        />
      </div>
    </section>
  );
};
