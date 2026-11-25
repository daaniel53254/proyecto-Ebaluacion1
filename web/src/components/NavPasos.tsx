"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC } from "react";

import { cn } from "@/lib/cn";
import { PASOS, type Paso } from "@/lib/pasos";

type EnlacePasoProps = {
  paso: Paso;
  actual: boolean;
};

const EnlacePaso: FC<EnlacePasoProps> = ({ paso, actual }) => {
  return (
    <Link
      href={paso.ruta}
      aria-current={actual ? "page" : undefined}
      className={cn(
        "group relative flex min-h-11 items-center gap-2 rounded-full px-2 py-1.5 text-xs leading-tight font-medium text-apagado transition-colors duration-200 hover:text-tinta sm:px-3 sm:text-sm",
        actual && "text-tinta",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border border-linea-2 font-display text-xs font-bold tabular-nums transition-colors duration-200 group-hover:border-tinta-2",
          actual && "border-acento-relleno bg-acento-relleno text-sobre-acento group-hover:border-acento-relleno",
        )}
      >
        {paso.numero}
      </span>
      <span>{paso.titulo}</span>
    </Link>
  );
};

export const NavPasos: FC = () => {
  const ruta = usePathname();

  return (
    <nav aria-label="Pasos" className="w-full sm:w-auto">
      <ol className="grid grid-cols-2 gap-1 sm:flex sm:items-center sm:gap-1">
        {PASOS.map((paso) => {
          return (
            <li key={paso.ruta}>
              <EnlacePaso paso={paso} actual={ruta.startsWith(paso.ruta)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
