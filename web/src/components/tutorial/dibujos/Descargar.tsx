import type { FC } from "react";

import { Pantalla } from "./Pantalla";

// El .zip con su cremallera y, al lado, la flecha de descarga con la barra terminada.
export const Descargar: FC = () => {
  return (
    <Pantalla>
      <g transform="translate(46 48)">
        <path
          d="M0 10a10 10 0 0 1 10-10h50l26 26v104a10 10 0 0 1-10 10H10a10 10 0 0 1-10-10z"
          className="fill-superficie stroke-linea-2"
        />
        <path d="M60 0v16a10 10 0 0 0 10 10h16" fill="none" className="stroke-linea-2" />
        <path d="M30 6h8v8h-8v8h8v8h-8v8h8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <rect x="26" y="46" width="16" height="20" rx="4" fill="currentColor" />
        <rect x="16" y="100" width="54" height="8" rx="4" className="fill-linea-2" />
        <rect x="16" y="114" width="38" height="6" rx="3" className="fill-linea" />
      </g>
      <g transform="translate(176 66)">
        <circle cx="54" cy="30" r="28" className="fill-acento-relleno" />
        <path
          d="M54 15v24m-10-10 10 10 10-10M42 46h24"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-tinta"
        />
        <rect x="0" y="82" width="108" height="8" rx="4" fill="currentColor" />
      </g>
    </Pantalla>
  );
};
