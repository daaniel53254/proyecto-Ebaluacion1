import type { FC } from "react";

import { Pantalla } from "./Pantalla";

const FILAS_BANDEJA = [44, 80, 116] as const;

// Bandeja de entrada: el correo con el enlace llega el último, resaltado, y un reloj por la espera.
export const Correo: FC = () => {
  return (
    <Pantalla>
      {FILAS_BANDEJA.map((y) => {
        return (
          <g key={y} opacity="0.55">
            <circle cx="36" cy={y + 12} r="9" className="fill-linea-2" />
            <rect x="54" y={y + 4} width="110" height="7" rx="3.5" className="fill-linea-2" />
            <rect x="54" y={y + 16} width="150" height="6" rx="3" className="fill-linea" />
          </g>
        );
      })}
      <rect x="16" y="154" width="288" height="32" rx="10" className="fill-acento-suave stroke-acento" />
      <circle cx="36" cy="170" r="8" fill="currentColor" />
      <rect x="54" y="162" width="130" height="7" rx="3.5" className="fill-tinta" />
      <rect x="54" y="174" width="90" height="5" rx="2.5" className="fill-tinta-2" />
      <rect x="236" y="163" width="54" height="14" rx="7" className="fill-acento-relleno" />
      <g transform="translate(262 82)">
        <circle r="28" className="fill-superficie stroke-linea-2" />
        <circle r="19" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M0-11V0l7 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
    </Pantalla>
  );
};
