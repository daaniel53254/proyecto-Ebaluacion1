import type { FC } from "react";

import { Pantalla } from "./Pantalla";
import { Puntero } from "./Puntero";

const OPCIONES_MENU = [52, 74, 96, 146, 168] as const;

// Página de la cuenta: menú lateral con «Privacidad de la cuenta» resaltada y el ratón encima.
export const Privacidad: FC = () => {
  return (
    <Pantalla>
      <path d="M100 30v169" className="stroke-linea" />
      {OPCIONES_MENU.map((y) => {
        return <rect key={y} x="16" y={y} width="64" height="8" rx="4" className="fill-linea-2" />;
      })}
      <rect x="10" y="114" width="82" height="22" rx="11" className="fill-acento-suave" />
      <rect x="20" y="121" width="56" height="8" rx="4" fill="currentColor" />
      <rect x="120" y="50" width="120" height="14" rx="7" className="fill-tinta-2" />
      <rect x="120" y="78" width="180" height="8" rx="4" className="fill-linea-2" />
      <rect x="120" y="94" width="150" height="8" rx="4" className="fill-linea-2" />
      <rect x="120" y="122" width="180" height="56" rx="10" className="fill-superficie stroke-linea" />
      <rect x="134" y="136" width="90" height="8" rx="4" className="fill-linea-2" />
      <rect x="134" y="152" width="130" height="8" rx="4" className="fill-linea-2" />
      <Puntero x={70} y={126} />
    </Pantalla>
  );
};
