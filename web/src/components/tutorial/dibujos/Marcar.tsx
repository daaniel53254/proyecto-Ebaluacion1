import type { FC } from "react";

import { Pantalla } from "./Pantalla";

type Casilla = {
  y: number;
  marcada: boolean;
};

const CASILLAS = [
  { y: 58, marcada: false },
  { y: 106, marcada: true },
  { y: 154, marcada: false },
] as const satisfies readonly Casilla[];

type BloqueProps = {
  y: number;
};

const BloqueSinMarcar: FC<BloqueProps> = ({ y }) => {
  return (
    <g opacity="0.6">
      <rect x="24" y={y - 12} width="272" height="38" rx="10" className="fill-superficie stroke-linea" />
      <rect x="40" y={y} width="120" height="8" rx="4" className="fill-linea-2" />
      <rect x="40" y={y + 12} width="80" height="6" rx="3" className="fill-linea" />
      <rect x="264" y={y - 2} width="18" height="18" rx="5" className="fill-fondo stroke-linea-2" />
    </g>
  );
};

const BloqueMarcado: FC<BloqueProps> = ({ y }) => {
  return (
    <g>
      <rect x="24" y={y - 12} width="272" height="38" rx="10" className="fill-acento-suave stroke-acento" />
      <rect x="40" y={y} width="150" height="8" rx="4" className="fill-tinta" />
      <rect x="40" y={y + 12} width="100" height="6" rx="3" className="fill-tinta-2" />
      <rect x="264" y={y - 2} width="18" height="18" rx="5" fill="currentColor" />
      <path
        d={`M268 ${y + 7}l3.5 3.5 6.5-7`}
        fill="none"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-fondo"
      />
    </g>
  );
};

// «Descarga tus datos»: tres bloques con su casilla; solo el del historial ampliado va marcado.
export const Marcar: FC = () => {
  return (
    <Pantalla>
      {CASILLAS.map(({ y, marcada }) => {
        if (!marcada) {
          return <BloqueSinMarcar key={y} y={y} />;
        }
        return <BloqueMarcado key={y} y={y} />;
      })}
    </Pantalla>
  );
};
