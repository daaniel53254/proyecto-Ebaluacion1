"use client";

import type { FC, ReactNode } from "react";

import { AvisoCopia } from "@/components/playlist/AvisoCopia";
import { boton, tarjeta } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { useCopiarEnlaces } from "@/hooks/useCopiarEnlaces";
import type { Playlist } from "@/lib/tipos";

type ExportarProps = {
  playlist: Playlist;
  // «Crear en mi Spotify», junto a «Copiar enlaces»; Resultado solo lo pasa si hay Client ID.
  accionExtra?: ReactNode;
};

// Exportar la lista: «Copiar enlaces» siempre (un enlace por línea para pegarlos en Spotify Escritorio)
// y, si se pasa, la acción de crearla directamente en la cuenta.
export const Exportar: FC<ExportarProps> = ({ playlist, accionExtra }) => {
  const { estado, copiar } = useCopiarEnlaces(playlist.canciones.map((c) => c.track_id));
  return (
    <section aria-labelledby="titulo-exportar" className={tarjeta({ class: "flex flex-col gap-5 p-6" })}>
      <div className="flex flex-col gap-2">
        <Etiqueta>Llévatela</Etiqueta>
        <h3 id="titulo-exportar" className="font-display text-base font-bold">
          A Spotify
        </h3>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void copiar()} className={boton({ intencion: "secundario" })}>
          Copiar enlaces
        </button>
        {accionExtra}
      </div>
      <div aria-live="polite">
        <AvisoCopia estado={estado} />
      </div>
    </section>
  );
};
