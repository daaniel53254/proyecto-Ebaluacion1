import Image from "next/image";
import Link from "next/link";
import type { FC } from "react";

import { NavPasos } from "@/components/NavPasos";

export const Cabecera: FC = () => {
  return (
    <header className="sticky top-0 z-30 border-b border-linea bg-fondo/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-3 self-start rounded-full pr-2 sm:self-auto"
          aria-label="NPD Entertainment: ir a la portada"
        >
          <Image src="/npd_logo.png" alt="" width={36} height={36} priority className="size-9 rounded-lg" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-sm font-bold tracking-tight">NPD Entertainment</span>
            <span className="mt-1 text-xs text-apagado">Playlist para viajes en grupo</span>
          </span>
        </Link>
        <NavPasos />
      </div>
    </header>
  );
};
