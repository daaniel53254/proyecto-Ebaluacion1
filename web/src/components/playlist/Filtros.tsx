"use client";

import { type FC, useId } from "react";

import { SelectorArtistas } from "@/components/playlist/SelectorArtistas";
import { boton, tarjeta } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Etiqueta";
import type { AccionesFiltros } from "@/hooks/usePlaylist";
import { cn } from "@/lib/cn";
import {
  FRANJAS,
  type Filtros as ValoresFiltros,
  franjaDe,
  MINUTOS,
  numeroCancionesDe,
  OPCIONES_CANCIONES,
} from "@/lib/filtros";
import { duracionTotal } from "@/lib/formato";
import { colorEnElModelo } from "@/lib/resumen";

type FiltrosProps = {
  filtros: ValoresFiltros;
  acciones: AccionesFiltros;
  personas: string[];
  artistas: string[];
  generando: boolean;
  alGenerar: () => void;
};

const CAMPO = "min-h-11 w-full rounded-2xl border border-linea-2 bg-fondo px-4 text-base text-tinta";
const TITULO = "text-sm font-semibold text-tinta";

type Opcion<T extends string> = {
  valor: T;
  texto: string;
};

type SegmentosProps<T extends string> = {
  leyenda: string;
  opciones: readonly Opcion<T>[];
  valor: T;
  alCambiar: (valor: T) => void;
  desactivado?: boolean;
  ayuda?: string;
};

// Grupo de radios con aspecto de control segmentado.
const Segmentos = <T extends string>({ leyenda, opciones, valor, alCambiar, desactivado, ayuda }: SegmentosProps<T>) => {
  const nombre = useId();
  return (
    <fieldset disabled={desactivado} className="flex min-w-0 flex-col gap-3">
      <legend className={cn(TITULO, "mb-3")}>{leyenda}</legend>
      <div className={cn("grid grid-cols-2 gap-1 rounded-full border border-linea-2 bg-fondo p-1", desactivado && "opacity-50")}>
        {opciones.map((opcion) => {
          return (
            <label
              key={opcion.valor}
              className="flex min-h-9 cursor-pointer items-center justify-center rounded-full px-3 text-sm text-tinta-2 transition-colors has-checked:bg-superficie-2 has-checked:text-tinta has-focus-visible:outline-2 has-focus-visible:outline-acento has-disabled:cursor-not-allowed"
            >
              <input
                type="radio"
                name={nombre}
                value={opcion.valor}
                checked={valor === opcion.valor}
                onChange={() => alCambiar(opcion.valor)}
                className="sr-only"
              />
              {opcion.texto}
            </label>
          );
        })}
      </div>
      {ayuda !== undefined && <p className="text-xs text-apagado">{ayuda}</p>}
    </fieldset>
  );
};

type QuienViajaProps = {
  personas: string[];
  elegidas: string[];
  alAlternar: (persona: string) => void;
};

const QuienViaja: FC<QuienViajaProps> = ({ personas, elegidas, alAlternar }) => {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={cn(TITULO, "mb-3")}>Quién viaja</legend>
      <div className="flex flex-wrap gap-2">
        {personas.map((persona) => {
          const elegida = elegidas.includes(persona);
          const ultima = elegida && elegidas.length === 1;
          return (
            <button
              key={persona}
              type="button"
              aria-pressed={elegida}
              aria-disabled={ultima}
              onClick={() => alAlternar(persona)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                elegida ? "border-tinta-2 bg-superficie-2 text-tinta" : "border-linea text-apagado hover:border-linea-2",
                ultima && "cursor-not-allowed",
              )}
            >
              <span
                aria-hidden
                className={cn("size-2.5 rounded-full", !elegida && "opacity-40")}
                style={{ backgroundColor: colorEnElModelo(personas, persona) }}
              />
              {persona}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-apagado">Como mínimo, una persona.</p>
    </fieldset>
  );
};

type FranjaProps = {
  franja: number | null;
  alCambiar: (franja: number | null) => void;
};

const Franja: FC<FranjaProps> = ({ franja, alCambiar }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className={TITULO}>
        Franja
      </label>
      <select id={id} value={franja ?? ""} onChange={(e) => alCambiar(franjaDe(e.target.value))} className={CAMPO}>
        <option value="">Sin importar</option>
        {FRANJAS.map((horas, indice) => {
          return (
            <option key={horas} value={indice}>
              {horas} h
            </option>
          );
        })}
      </select>
      <p className="text-xs text-apagado">«Sin importar» usa todas las escuchas y pone primero lo que conoce todo el grupo.</p>
    </div>
  );
};

type LongitudProps = {
  filtros: ValoresFiltros;
  acciones: AccionesFiltros;
};

const Longitud: FC<LongitudProps> = ({ filtros, acciones }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <Segmentos
        leyenda="Longitud"
        opciones={[
          { valor: "canciones", texto: "Canciones" },
          { valor: "minutos", texto: "Minutos" },
        ]}
        valor={filtros.modo}
        alCambiar={acciones.elegirModo}
      />
      {filtros.modo === "canciones" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={id} className="text-sm text-tinta-2">
            Número de canciones
          </label>
          <select
            id={id}
            value={filtros.canciones}
            onChange={(e) => {
              const canciones = numeroCancionesDe(e.target.value);
              if (canciones !== undefined) acciones.elegirCanciones(canciones);
            }}
            className={CAMPO}
          >
            {OPCIONES_CANCIONES.map((opcion) => {
              return (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              );
            })}
          </select>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={id} className="text-sm text-tinta-2">
              Duración del viaje
            </label>
            <output htmlFor={id} className="font-display text-sm font-bold text-acento tabular-nums">
              {filtros.minutos} min · {duracionTotal(filtros.minutos)}
            </output>
          </div>
          <input
            id={id}
            type="range"
            min={MINUTOS.minimo}
            max={MINUTOS.maximo}
            step={MINUTOS.paso}
            value={filtros.minutos}
            onChange={(e) => acciones.elegirMinutos(Number(e.target.value))}
            className="min-h-11 w-full accent-acento"
          />
        </div>
      )}
    </div>
  );
};

// Los mismos filtros que la pestaña de playlist del panel. Cambiarlos no regenera la lista: hay que pulsar el botón.
export const Filtros: FC<FiltrosProps> = ({ filtros, acciones, personas, artistas, generando, alGenerar }) => {
  const sinHorario = filtros.franja === null;
  return (
    <section aria-labelledby="titulo-filtros" className={tarjeta({ class: "flex flex-col gap-8 p-6 sm:p-8" })}>
      <div className="flex flex-col gap-2">
        <Etiqueta>Filtros</Etiqueta>
        <h2 id="titulo-filtros" className="font-display text-2xl font-bold tracking-tight">
          ¿Quién va y cuánto dura?
        </h2>
      </div>
      <QuienViaja personas={personas} elegidas={filtros.personas} alAlternar={acciones.alternarPersona} />
      <div className="grid gap-8 md:grid-cols-3">
        <Franja franja={filtros.franja} alCambiar={acciones.elegirFranja} />
        <Segmentos
          leyenda="Día"
          opciones={[
            { valor: "laborable", texto: "Laborable" },
            { valor: "fin_semana", texto: "Fin de semana" },
          ]}
          valor={filtros.tipoDia}
          alCambiar={acciones.elegirTipoDia}
          desactivado={sinHorario}
          ayuda={sinHorario ? "Elige una franja para filtrar por día." : "Escuchas de ese tipo de día."}
        />
        <Longitud filtros={filtros} acciones={acciones} />
      </div>
      <SelectorArtistas
        artistas={artistas}
        elegidos={filtros.quitar}
        alElegir={acciones.sumarArtista}
        alQuitar={acciones.quitarArtista}
      />
      <div className="flex flex-wrap items-center gap-4 border-t border-linea pt-6">
        <button
          type="button"
          onClick={alGenerar}
          disabled={generando}
          className={boton({ intencion: "principal", class: "disabled:opacity-60" })}
        >
          {generando ? "Generando…" : "Generar playlist"}
        </button>
        <p className="text-sm text-apagado">La lista no cambia hasta que la vuelves a generar.</p>
      </div>
    </section>
  );
};
