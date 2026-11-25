import Link from "next/link";
import type { FC } from "react";

import { tarjeta } from "@/components/ui/estilos";
import type { Paso } from "@/lib/pasos";

type TarjetaPasoProps = {
  paso: Paso;
};

export const TarjetaPaso: FC<TarjetaPasoProps> = ({ paso }) => {
  return (
    <Link href={paso.ruta} className={tarjeta({ interactiva: true, class: "group flex h-full flex-col p-6 sm:p-7" })}>
      <span className="font-display text-5xl leading-none font-bold text-linea-2 tabular-nums transition-colors duration-300 group-hover:text-acento">
        {paso.numero}
      </span>
      <h3 className="mt-8 font-display text-xl font-bold tracking-tight">{paso.titulo}</h3>
      <p className="mt-3 text-sm leading-relaxed text-tinta-2">{paso.descripcion}</p>
      <span className="mt-auto flex items-center gap-2 pt-8 text-sm font-semibold text-tinta">
        Ir al paso {paso.numero}
        <span aria-hidden className="transition-transform duration-300 ease-salida group-hover:translate-x-1">
          →
        </span>
      </span>
    </Link>
  );
};
