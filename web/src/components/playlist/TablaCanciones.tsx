import type { FC } from "react";

import { Barra, type Relleno } from "@/components/playlist/BarraGusto";
import { cn } from "@/lib/cn";
import { duracionCancion, enlaceCancion, percentilVisible } from "@/lib/formato";
import type { CancionPlaylist, GustoMiembro } from "@/lib/tipos";

type TablaCancionesProps = {
  canciones: CancionPlaylist[];
  personas: string[];
  colorDe: (persona: string) => string;
};

type FilaGustoProps = {
  nombre: string;
  percentil: number;
  relleno: Relleno;
  color: string;
  textoLector: string;
};

const FilaGusto: FC<FilaGustoProps> = ({ nombre, percentil, relleno, color, textoLector }) => {
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs">
      <span aria-hidden className={cn("truncate text-apagado", relleno === "grupo" && "font-semibold text-tinta")}>
        {nombre}
      </span>
      <span aria-hidden>
        <Barra percentil={percentil} relleno={relleno} color={color} />
      </span>
      <span aria-hidden className="text-right text-tinta-2 tabular-nums">
        {percentilVisible(percentil)}
      </span>
      <span className="sr-only">{textoLector}</span>
    </li>
  );
};

const textoOrigen = (gusto: GustoMiembro): string => {
  return gusto.origen === "real" ? "real" : "previsto";
};

type GustosProps = {
  cancion: CancionPlaylist;
  personas: string[];
  colorDe: (persona: string) => string;
};

const COLOR_GRUPO = "var(--npd-blanco)";

const Gustos: FC<GustosProps> = ({ cancion, personas, colorDe }) => {
  return (
    <ul aria-label="Gusto de cada uno (percentil)" className="flex flex-col gap-1.5">
      {personas.map((persona) => {
        const gusto = cancion.miembros[persona];
        if (gusto === undefined) return null;
        const valor = percentilVisible(gusto.percentil);
        return (
          <FilaGusto
            key={persona}
            nombre={persona}
            percentil={gusto.percentil}
            relleno={gusto.origen}
            color={colorDe(persona)}
            textoLector={`${persona}: ${valor}, ${textoOrigen(gusto)}`}
          />
        );
      })}
      <FilaGusto
        nombre="grupo"
        percentil={cancion.gusto_grupo}
        relleno="grupo"
        color={COLOR_GRUPO}
        textoLector={`grupo: ${percentilVisible(cancion.gusto_grupo)}`}
      />
    </ul>
  );
};

type FilaCancionProps = {
  cancion: CancionPlaylist;
  personas: string[];
  colorDe: (persona: string) => string;
};

const FilaCancion: FC<FilaCancionProps> = ({ cancion, personas, colorDe }) => {
  const idTitulo = `cancion-${cancion.posicion}`;
  return (
    <li
      aria-labelledby={idTitulo}
      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 py-4 md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(14rem,20rem)_auto] md:items-center md:gap-x-6"
    >
      <span className="pt-0.5 font-display text-sm font-bold text-apagado tabular-nums">{cancion.posicion}</span>
      <div className="min-w-0">
        <p id={idTitulo} className="truncate font-semibold text-tinta">
          {cancion.cancion}
        </p>
        <p className="truncate text-sm text-tinta-2">
          {cancion.artista} <span className="text-apagado">· {duracionCancion(cancion.duracion_s)}</span>
        </p>
      </div>
      <div className="col-span-2 col-start-2 row-start-2 md:col-span-1 md:col-start-3 md:row-start-1">
        <Gustos cancion={cancion} personas={personas} colorDe={colorDe} />
      </div>
      <a
        href={enlaceCancion(cancion.track_id)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Escuchar «${cancion.cancion}» en Spotify`}
        className="col-start-3 row-start-1 inline-flex min-h-11 items-center rounded-full border border-linea-2 px-4 text-sm font-semibold text-tinta transition-colors hover:border-tinta-2 md:col-start-4"
      >
        Escuchar
      </a>
    </li>
  );
};

// Una sola lista para todas las anchuras: en el móvil, cada canción es una ficha; desde md, una fila.
export const TablaCanciones: FC<TablaCancionesProps> = ({ canciones, personas, colorDe }) => {
  return (
    <ol aria-label="Canciones de la playlist" className="divide-y divide-linea border-y border-linea">
      {canciones.map((cancion) => {
        return <FilaCancion key={cancion.track_id} cancion={cancion} personas={personas} colorDe={colorDe} />;
      })}
    </ol>
  );
};
