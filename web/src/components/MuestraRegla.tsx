import type { CSSProperties, FC } from "react";

import { tarjeta } from "@/components/ui/estilos";
import { colorPersona } from "@/lib/colores";

// Ejemplo inventado (no son datos de nadie) que enseña la regla de la playlist:
// una barra por persona con su percentil y, a la derecha, el del grupo, que es el mínimo. Van ordenadas por él.
type CancionEjemplo = {
  nombre: string;
  percentiles: readonly [number, number, number];
};

const PERSONAS_EJEMPLO = ["Ane", "Iker", "Leire"] as const;

const CANCIONES_EJEMPLO: readonly CancionEjemplo[] = [
  { nombre: "Canción A", percentiles: [92, 81, 88] },
  { nombre: "Canción C", percentiles: [74, 78, 69] },
  { nombre: "Canción B", percentiles: [97, 34, 90] },
];

type BarraProps = {
  percentil: number;
  color: string;
  retraso: number;
};

const Barra: FC<BarraProps> = ({ percentil, color, retraso }) => {
  const estilo: CSSProperties = {
    width: `${percentil}%`,
    backgroundColor: color,
    animationDelay: `${retraso}ms`,
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-superficie-2">
      <div className="h-full origin-left animate-crecer rounded-full" style={estilo} />
    </div>
  );
};

type FilaProps = {
  cancion: CancionEjemplo;
  indice: number;
};

const Fila: FC<FilaProps> = ({ cancion, indice }) => {
  const gustoGrupo = Math.min(...cancion.percentiles);
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
      <p className="text-sm font-medium text-tinta">{cancion.nombre}</p>
      <p className="row-span-2 text-right">
        <span className="block font-display text-2xl font-bold tabular-nums">{gustoGrupo}</span>
        <span className="block text-xs text-apagado">grupo</span>
      </p>
      <div className="flex flex-col gap-1.5">
        {cancion.percentiles.map((percentil, persona) => {
          return (
            <Barra
              key={PERSONAS_EJEMPLO[persona]}
              percentil={percentil}
              color={colorPersona(persona)}
              retraso={indice * 120 + persona * 60}
            />
          );
        })}
      </div>
    </li>
  );
};

export const MuestraRegla: FC = () => {
  return (
    <figure className={tarjeta({ class: "w-full p-6 sm:p-8" })}>
      <figcaption className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <span className="font-display text-base font-bold">Así puntúa cada canción</span>
        <span className="rounded-full border border-linea-2 px-2.5 py-0.5 text-xs text-apagado">Ejemplo</span>
      </figcaption>
      <ul className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-tinta-2">
        {PERSONAS_EJEMPLO.map((persona, indice) => {
          return (
            <li key={persona} className="flex items-center gap-2">
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: colorPersona(indice) }} />
              {persona}
            </li>
          );
        })}
      </ul>
      <ol className="divide-y divide-linea">
        {CANCIONES_EJEMPLO.map((cancion, indice) => {
          return <Fila key={cancion.nombre} cancion={cancion} indice={indice} />;
        })}
      </ol>
      <p className="mt-6 border-t border-linea pt-4 text-sm text-tinta-2">
        La canción B le encanta a dos, pero a Iker no: baja al final de la lista. Cuenta lo que le gusta{" "}
        <span className="text-tinta">al que menos le gusta</span>.
      </p>
    </figure>
  );
};
