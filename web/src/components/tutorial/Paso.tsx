import type { FC, ReactNode } from "react";

import { tarjeta } from "@/components/ui/estilos";

export type PasoTutorial = {
  numero: 1 | 2 | 3 | 4 | 5;
  titulo: string;
  texto: ReactNode;
  nota?: ReactNode;
  Dibujo: FC;
};

type PasoProps = {
  paso: PasoTutorial;
};

// Un paso del tutorial: número y texto a la izquierda, el dibujo esquemático de la pantalla a la derecha.
// El <li> toma su nombre del título («Paso 1 Abre…»), que es lo que anuncia el lector de pantalla.
export const Paso: FC<PasoProps> = ({ paso }) => {
  const { numero, titulo, texto, nota, Dibujo } = paso;
  const idTitulo = `paso-${numero}`;

  return (
    <li
      aria-labelledby={idTitulo}
      className="grid gap-6 border-t border-linea py-10 first:border-t-0 first:pt-0 lg:grid-cols-12 lg:items-center lg:gap-10 lg:py-14"
    >
      <div className="flex flex-col gap-4 lg:col-span-5">
        <h2 id={idTitulo} className="flex flex-col gap-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          <span className="font-display text-sm font-semibold tracking-etiqueta text-acento uppercase tabular-nums">
            Paso {numero}
          </span>{" "}
          <span className="text-balance">{titulo}</span>
        </h2>
        <div className="max-w-prose text-base leading-relaxed text-pretty text-tinta-2 sm:text-lg">{texto}</div>
        {nota && <p className="max-w-prose text-sm leading-relaxed text-apagado">{nota}</p>}
      </div>
      <div className={tarjeta({ class: "p-4 sm:p-6 lg:col-span-7" })}>
        <Dibujo />
      </div>
    </li>
  );
};
