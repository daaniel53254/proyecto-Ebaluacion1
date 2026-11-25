import type { CSSProperties, FC } from "react";

import { percentilVisible } from "@/lib/formato";

export type Relleno = "real" | "prevista" | "grupo";

// «real»: relleno sólido; «prevista»: rayas del mismo color con un filo, para que se distinga sin depender del tono.
export const estiloRelleno = (relleno: Relleno, color: string): CSSProperties => {
  if (relleno === "prevista") {
    return {
      backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 5px)`,
      boxShadow: `inset 0 0 0 1px ${color}`,
    };
  }
  return { backgroundColor: color };
};

type BarraProps = {
  percentil: number;
  relleno: Relleno;
  color: string;
};

export const Barra: FC<BarraProps> = ({ percentil, relleno, color }) => {
  const estilo: CSSProperties = { ...estiloRelleno(relleno, color), width: `${percentilVisible(percentil)}%` };
  return (
    <div className="h-2 w-full rounded-full bg-superficie-2">
      <div className="h-full origin-left animate-crecer rounded-full" style={estilo} />
    </div>
  );
};
