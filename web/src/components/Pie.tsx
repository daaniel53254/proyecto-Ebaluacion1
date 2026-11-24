import Image from "next/image";
import type { FC } from "react";

export const Pie: FC = () => {
  return (
    <footer className="mt-auto border-t border-linea">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-apagado sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-3 sm:items-center">
          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-exito sm:mt-0" />
          <span>Solo se guardan los datos de escucha. Puedes borrar los tuyos cuando quieras en Súbelo.</span>
        </p>
        <p className="flex items-center gap-2 text-xs">
          <Image src="/npd_logo.png" alt="" width={20} height={20} className="size-5 rounded" />
          NPD Entertainment
        </p>
      </div>
    </footer>
  );
};
