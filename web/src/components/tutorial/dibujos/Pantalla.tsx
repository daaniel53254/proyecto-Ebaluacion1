import type { FC, ReactNode } from "react";

import { cn } from "@/lib/cn";

type PantallaProps = {
  children: ReactNode;
  className?: string;
};

// Marco común de los dibujos: una ventana esquemática (barra con tres puntos y dirección) de 320 × 200.
// Es decorativo: el texto del paso ya cuenta lo mismo, así que el lector de pantalla se lo salta.
export const Pantalla: FC<PantallaProps> = ({ children, className }) => {
  return (
    <svg
      viewBox="0 0 320 200"
      aria-hidden
      focusable="false"
      className={cn("block h-auto w-full text-acento", className)}
    >
      <rect x="1" y="1" width="318" height="198" rx="14" className="fill-superficie-2 stroke-linea-2" />
      <path d="M1 30h318" className="stroke-linea-2" />
      <circle cx="18" cy="15.5" r="3.5" className="fill-linea-2" />
      <circle cx="30" cy="15.5" r="3.5" className="fill-linea-2" />
      <circle cx="42" cy="15.5" r="3.5" className="fill-linea-2" />
      <rect x="66" y="9" width="188" height="13" rx="6.5" className="fill-fondo" />
      {children}
    </svg>
  );
};
