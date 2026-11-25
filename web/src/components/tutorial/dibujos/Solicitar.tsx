import type { FC } from "react";

import { Pantalla } from "./Pantalla";
import { Puntero } from "./Puntero";

// Botón «Solicitar datos» pulsado y, al lado, el sobre del correo de confirmación.
export const Solicitar: FC = () => {
  return (
    <Pantalla>
      <rect x="24" y="50" width="150" height="10" rx="5" className="fill-tinta-2" />
      <rect x="24" y="70" width="190" height="7" rx="3.5" className="fill-linea-2" />
      <rect x="24" y="84" width="160" height="7" rx="3.5" className="fill-linea-2" />
      <rect x="24" y="112" width="112" height="32" rx="16" className="fill-acento-relleno" />
      <rect x="46" y="124.5" width="68" height="7" rx="3.5" className="fill-tinta" />
      <circle cx="120" cy="138" r="14" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <Puntero x={118} y={134} />
      <g transform="translate(196 104)">
        <rect width="100" height="70" rx="10" className="fill-superficie stroke-linea-2" />
        <rect x="18" y="16" width="64" height="40" rx="4" className="fill-fondo stroke-linea-2" />
        <path d="M18 18l32 20 32-20" fill="none" strokeLinejoin="round" stroke="currentColor" strokeWidth="1.75" />
      </g>
    </Pantalla>
  );
};
