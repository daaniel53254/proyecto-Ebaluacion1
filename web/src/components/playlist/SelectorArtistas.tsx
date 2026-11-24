"use client";

import { type FC, useId } from "react";

import { useSelectorArtistas } from "@/hooks/useSelectorArtistas";
import { cn } from "@/lib/cn";
import { MAX_ARTISTAS_QUITADOS } from "@/lib/filtros";

type SelectorArtistasProps = {
  artistas: string[];
  elegidos: string[];
  alElegir: (artista: string) => void;
  alQuitar: (artista: string) => void;
};

type ChipsProps = {
  elegidos: string[];
  alQuitar: (artista: string) => void;
};

const Chips: FC<ChipsProps> = ({ elegidos, alQuitar }) => {
  if (elegidos.length === 0) return null;
  return (
    <ul aria-label="Artistas quitados" className="flex flex-wrap gap-2">
      {elegidos.map((artista) => {
        return (
          <li key={artista}>
            <button
              type="button"
              onClick={() => alQuitar(artista)}
              aria-label={`Volver a poner a ${artista}`}
              className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-linea-2 bg-superficie-2 px-3 text-sm text-tinta transition-colors hover:border-tinta-2"
            >
              <span className="truncate">{artista}</span>
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

// «Quitar artistas»: buscador sobre los artistas del catálogo (pueden ser miles), con 50 sugerencias como mucho.
export const SelectorArtistas: FC<SelectorArtistasProps> = (props) => {
  const { artistas, elegidos } = props;
  const selector = useSelectorArtistas(props);
  const id = useId();
  const idLista = `${id}-lista`;
  const idAyuda = `${id}-ayuda`;
  const idOpcion = (indice: number) => `${id}-opcion-${indice}`;
  const lleno = elegidos.length >= MAX_ARTISTAS_QUITADOS;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-campo`} className="text-sm font-semibold text-tinta">
        Quitar artistas
      </label>
      <div className="relative">
        <input
          id={`${id}-campo`}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={selector.desplegado}
          aria-controls={idLista}
          aria-describedby={idAyuda}
          aria-activedescendant={selector.desplegado ? idOpcion(selector.indiceActivo) : undefined}
          value={selector.busqueda}
          disabled={lleno}
          placeholder={lleno ? `Ya has quitado ${MAX_ARTISTAS_QUITADOS}` : "Busca un artista…"}
          onChange={(evento) => selector.cambiarBusqueda(evento.target.value)}
          onFocus={selector.abrir}
          onBlur={selector.cerrar}
          onKeyDown={selector.alTeclear}
          className="min-h-11 w-full rounded-2xl border border-linea-2 bg-fondo px-4 text-base text-tinta placeholder:text-apagado disabled:opacity-50"
        />
        <ul
          id={idLista}
          role="listbox"
          aria-label="Artistas que coinciden"
          hidden={!selector.desplegado}
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-linea-2 bg-superficie-2 py-2 shadow-2xl"
        >
          {selector.sugerencias.map((artista, indice) => {
            const activa = indice === selector.indiceActivo;
            return (
              <li
                key={artista}
                id={idOpcion(indice)}
                role="option"
                aria-selected={activa}
                onMouseDown={(evento) => evento.preventDefault()}
                onMouseEnter={() => selector.marcar(indice)}
                onClick={() => selector.elegir(artista)}
                className={cn("cursor-pointer truncate px-4 py-2 text-sm text-tinta-2", activa && "bg-fondo text-tinta")}
              >
                {artista}
              </li>
            );
          })}
        </ul>
      </div>
      <p id={idAyuda} className="text-xs text-apagado">
        {artistas.length.toLocaleString("es-ES")} artistas en el catálogo. Escribe para buscar; flechas e Intro
        para elegir.
      </p>
      <Chips elegidos={elegidos} alQuitar={props.alQuitar} />
    </div>
  );
};
