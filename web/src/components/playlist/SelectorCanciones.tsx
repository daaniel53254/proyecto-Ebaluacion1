"use client";

import { type FC, useId } from "react";

import { deQuienEs, MIN_CARACTERES, useBuscarCanciones } from "@/hooks/useBuscarCanciones";
import { MAX_CANCIONES_QUITADAS } from "@/lib/filtros";
import type { CancionCatalogo } from "@/lib/tipos";

type SelectorCancionesProps = {
  elegidas: CancionCatalogo[];
  alElegir: (cancion: CancionCatalogo) => void;
  alQuitar: (trackId: string) => void;
};

type ChipsProps = {
  elegidas: CancionCatalogo[];
  alQuitar: (trackId: string) => void;
};

const Chips: FC<ChipsProps> = ({ elegidas, alQuitar }) => {
  if (elegidas.length === 0) return null;
  return (
    <ul aria-label="Canciones quitadas" className="flex flex-wrap gap-2">
      {elegidas.map((cancion) => {
        return (
          <li key={cancion.track_id} className="max-w-full">
            <button
              type="button"
              onClick={() => alQuitar(cancion.track_id)}
              aria-label={`Volver a poner «${cancion.cancion}»`}
              className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-linea-2 bg-superficie-2 px-3 text-sm text-tinta transition-colors hover:border-tinta-2"
            >
              <span className="truncate">
                {cancion.cancion} <span className="text-tinta-2">· {cancion.artista}</span>
              </span>
              <span className="shrink-0 text-xs text-apagado">{deQuienEs(cancion)}</span>
              <span aria-hidden className="text-apagado">
                ✕
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

// «Quitar canciones»: busca en la API solo entre las canciones que alguien del grupo ha escuchado.
export const SelectorCanciones: FC<SelectorCancionesProps> = ({ elegidas, alElegir, alQuitar }) => {
  const { texto, setTexto, busqueda, limpiar } = useBuscarCanciones();
  const id = useId();
  const lleno = elegidas.length >= MAX_CANCIONES_QUITADAS;
  const ids = new Set(elegidas.map((c) => c.track_id));
  const resultados = busqueda.tipo === "lista" ? busqueda.canciones.filter((c) => !ids.has(c.track_id)) : [];

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-campo`} className="text-sm font-semibold text-tinta">
        Quitar canciones
      </label>
      <div className="relative">
        <input
          id={`${id}-campo`}
          type="search"
          autoComplete="off"
          aria-describedby={`${id}-ayuda`}
          value={texto}
          disabled={lleno}
          placeholder={lleno ? `Ya has quitado ${MAX_CANCIONES_QUITADAS}` : "Busca una canción…"}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Escape") limpiar();
          }}
          className="min-h-11 w-full rounded-2xl border border-linea-2 bg-fondo px-4 text-base text-tinta placeholder:text-apagado disabled:opacity-50"
        />
        {resultados.length > 0 && (
          <ul
            aria-label="Canciones que coinciden"
            className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-linea-2 bg-superficie-2 py-2 shadow-2xl"
          >
            {resultados.map((cancion) => {
              return (
                <li key={cancion.track_id}>
                  <button
                    type="button"
                    onClick={() => {
                      alElegir(cancion);
                      limpiar();
                    }}
                    className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left text-sm text-tinta-2 hover:bg-fondo hover:text-tinta"
                  >
                    <span className="min-w-0 truncate">
                      {cancion.cancion} <span className="text-apagado">· {cancion.artista}</span>
                    </span>
                    <span className="shrink-0 text-xs text-apagado">{deQuienEs(cancion)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p id={`${id}-ayuda`} className="text-xs text-apagado">
        {busqueda.tipo === "buscando" && "Buscando…"}
        {busqueda.tipo === "fallo" && busqueda.mensaje}
        {busqueda.tipo === "lista" && resultados.length === 0 && "Ninguna canción del grupo coincide."}
        {busqueda.tipo === "corta" &&
          `Solo las que alguien del grupo ha escuchado; al lado, de quién son. Escribe al menos ${MIN_CARACTERES} letras.`}
      </p>
      <Chips elegidas={elegidas} alQuitar={alQuitar} />
    </div>
  );
};
