import type { FC } from "react";

import { Barra } from "@/components/playlist/BarraGusto";
import { tarjeta } from "@/components/ui/estilos";
import { percentilVisible } from "@/lib/formato";
import type { GustoMedio } from "@/lib/resumen";

type GustoPorPersonaProps = {
  medias: GustoMedio[];
  colorDe: (persona: string) => string;
};

// Percentil medio de la lista para cada uno, como la barra horizontal del panel.
export const GustoPorPersona: FC<GustoPorPersonaProps> = ({ medias, colorDe }) => {
  return (
    <figure className={tarjeta({ class: "flex flex-col gap-5 p-6" })}>
      <figcaption className="font-display text-base font-bold">Cuánto le gusta la playlist a cada uno</figcaption>
      <ul className="flex flex-col gap-3">
        {medias.map(({ persona, percentilMedio }) => {
          return (
            <li key={persona} className="grid grid-cols-[5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
              <span className="truncate text-tinta-2">{persona}</span>
              <Barra percentil={percentilMedio} relleno="real" color={colorDe(persona)} />
              <span className="text-right font-display font-bold tabular-nums">{percentilVisible(percentilMedio)}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-relaxed text-apagado">
        Percentil medio de las canciones de la lista para cada uno (100 = sus favoritas en este contexto). Si a alguien
        le sale cerca de 50, el modelo no distingue bien sus gustos.
      </p>
    </figure>
  );
};
