"use client";

import { type FC, useId } from "react";

import { SelectorArtistas } from "@/components/playlist/SelectorArtistas";
import { SelectorCanciones } from "@/components/playlist/SelectorCanciones";
import { boton, tarjeta } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Etiqueta";
import type { AccionesFiltros } from "@/hooks/useFiltrosGrupo";
import { cn } from "@/lib/cn";
import {
  type Filtros as ValoresFiltros,
  MIN_PERSONAS,
  MINUTOS,
  MOMENTOS,
  type Momento,
  momentoDe,
  numeroCancionesDe,
  OPCIONES_CANCIONES,
} from "@/lib/filtros";
import { duracionTotal } from "@/lib/formato";
import { colorEnElModelo } from "@/lib/resumen";
import type { ArtistaGrupo } from "@/lib/tipos";

// El botón del final: «Generar playlist» en el paso 3 y «Comprobar» en «¿Entraría?».
export type AccionFiltros = {
  texto: string;
  textoOcupado: string;
  ayuda: string;
  ocupado: boolean;
  desactivada?: boolean;
  alPulsar: () => void;
};

type FiltrosProps = {
  filtros: ValoresFiltros;
  acciones: AccionesFiltros;
  personas: string[];
  artistas: ArtistaGrupo[];
  accion: AccionFiltros;
  titulo?: string;
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

export type QuienViajaProps = {
  personas: string[];
  elegidas: string[];
  alAlternar: (persona: string) => void;
};

const textoQuienViaja = (elegidas: number, total: number): string => {
  if (total < MIN_PERSONAS) return `Hacen falta al menos ${MIN_PERSONAS} personas en el modelo: que suba su historial alguien más.`;
  return `${elegidas} de ${total} en el grupo · como mínimo, ${MIN_PERSONAS} personas.`;
};

// Cada persona es un interruptor: elegida, con su color de fondo y una marca; fuera, con borde discontinuo y apagada.
export const QuienViaja: FC<QuienViajaProps> = ({ personas, elegidas, alAlternar }) => {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={cn(TITULO, "mb-3")}>Quién viaja</legend>
      <div className="flex flex-wrap gap-2">
        {personas.map((persona) => {
          const elegida = elegidas.includes(persona);
          const bloqueada = elegida && elegidas.length <= MIN_PERSONAS;
          const color = colorEnElModelo(personas, persona);
          return (
            <button
              key={persona}
              type="button"
              aria-pressed={elegida}
              aria-disabled={bloqueada}
              title={bloqueada ? `Como mínimo, ${MIN_PERSONAS} personas` : undefined}
              onClick={() => alAlternar(persona)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition-colors",
                elegida ? "text-tinta" : "border-dashed border-linea-2 text-apagado line-through hover:text-tinta-2",
                bloqueada && "cursor-not-allowed",
              )}
              style={
                elegida
                  ? { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)` }
                  : undefined
              }
            >
              <span
                aria-hidden
                className="grid size-5 place-items-center rounded-full text-xs font-bold"
                style={elegida ? { backgroundColor: color, color: "var(--npd-negro)" } : { border: `2px solid ${color}` }}
              >
                {elegida ? "✓" : ""}
              </span>
              {persona}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-apagado">{textoQuienViaja(elegidas.length, personas.length)}</p>
    </fieldset>
  );
};

type MomentoDelDiaProps = {
  momento: Momento | null;
  alCambiar: (momento: Momento | null) => void;
};

const MomentoDelDia: FC<MomentoDelDiaProps> = ({ momento, alCambiar }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className={TITULO}>
        Momento del día
      </label>
      <select id={id} value={momento ?? ""} onChange={(e) => alCambiar(momentoDe(e.target.value))} className={CAMPO}>
        <option value="">No importa</option>
        {MOMENTOS.map((m) => {
          return (
            <option key={m.valor} value={m.valor}>
              {m.texto} ({m.horas})
            </option>
          );
        })}
      </select>
      <p className="text-xs text-apagado">«No importa» usa todas las escuchas y busca canciones que gusten parecido a todos, sin dejar a nadie muy abajo. Solo entran canciones que ha escuchado al menos la mitad del grupo.</p>
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
export const Filtros: FC<FiltrosProps> = ({ filtros, acciones, personas, artistas, accion, titulo }) => {
  const sinHorario = filtros.momento === null;
  const pocasPersonas = personas.length < MIN_PERSONAS;
  return (
    <section aria-labelledby="titulo-filtros" className={tarjeta({ class: "flex flex-col gap-8 p-6 sm:p-8" })}>
      <div className="flex flex-col gap-2">
        <Etiqueta>Filtros</Etiqueta>
        <h2 id="titulo-filtros" className="font-display text-2xl font-bold tracking-tight">
          {titulo ?? "¿Quién va y cuánto dura?"}
        </h2>
      </div>
      <QuienViaja personas={personas} elegidas={filtros.personas} alAlternar={acciones.alternarPersona} />
      <div className="grid gap-8 md:grid-cols-3">
        <MomentoDelDia momento={filtros.momento} alCambiar={acciones.elegirMomento} />
        <Segmentos
          leyenda="Día"
          opciones={[
            { valor: "laborable", texto: "Laborable" },
            { valor: "fin_semana", texto: "Fin de semana" },
          ]}
          valor={filtros.tipoDia}
          alCambiar={acciones.elegirTipoDia}
          desactivado={sinHorario}
          ayuda={sinHorario ? "Elige un momento del día para filtrar por día." : "Escuchas de ese tipo de día."}
        />
        <Longitud filtros={filtros} acciones={acciones} />
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <SelectorArtistas
          artistas={artistas}
          elegidos={filtros.quitar}
          alElegir={acciones.sumarArtista}
          alQuitar={acciones.quitarArtista}
        />
        <SelectorCanciones
          elegidas={filtros.quitarCanciones}
          alElegir={acciones.sumarCancion}
          alQuitar={acciones.quitarCancion}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-linea pt-6">
        <button
          type="button"
          onClick={accion.alPulsar}
          disabled={accion.ocupado || accion.desactivada === true || pocasPersonas}
          className={boton({ intencion: "principal", class: "disabled:cursor-not-allowed disabled:opacity-60" })}
        >
          {accion.ocupado ? accion.textoOcupado : accion.texto}
        </button>
        <p className="text-sm text-apagado">{accion.ayuda}</p>
      </div>
    </section>
  );
};
