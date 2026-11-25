import type { FC } from "react";

import { tarjeta } from "@/components/ui/estilos";
import { duracionTotal, porcentaje } from "@/lib/formato";
import type { CifrasPlaylist } from "@/lib/resumen";

type CifrasProps = {
  cifras: CifrasPlaylist;
};

type CifraProps = {
  nombre: string;
  valor: string;
  ayuda?: string;
};

const Cifra: FC<CifraProps> = ({ nombre, valor, ayuda }) => {
  return (
    <div className={tarjeta({ class: "flex flex-col gap-1 p-5" })}>
      <dt className="text-sm text-apagado">{nombre}</dt>
      <dd className="font-display text-2xl font-bold text-acento tabular-nums sm:text-3xl">{valor}</dd>
      {ayuda !== undefined && <dd className="text-xs text-apagado">{ayuda}</dd>}
    </div>
  );
};

export const Cifras: FC<CifrasProps> = ({ cifras }) => {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Cifra nombre="Canciones" valor={String(cifras.canciones)} />
      <Cifra nombre="Duración" valor={duracionTotal(cifras.duracionMin)} />
      <Cifra nombre="Artistas distintos" valor={String(cifras.artistasDistintos)} />
      <Cifra
        nombre="Con gusto real de todos"
        valor={porcentaje(cifras.conGustoRealDeTodos)}
        ayuda="Todos la han escuchado 5 o más veces: no es una predicción."
      />
    </dl>
  );
};
