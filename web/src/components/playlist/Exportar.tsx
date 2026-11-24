"use client";

import type { FC, ReactNode } from "react";

import { boton, tarjeta } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { type EstadoCopia, useCopiarEnlaces } from "@/hooks/useCopiarEnlaces";
import type { Playlist } from "@/lib/tipos";

type ExportarProps = {
  playlist: Playlist;
  // Hueco para «Crear en mi Spotify» (Task 7): va junto a «Copiar enlaces». De momento no se pasa nada.
  accionExtra?: ReactNode;
};

const INSTRUCCIONES = "Abre Spotify en el ordenador → crea una playlist → haz clic dentro de ella → Ctrl+V";

type AvisoCopiaProps = {
  estado: EstadoCopia;
};

const AvisoCopia: FC<AvisoCopiaProps> = ({ estado }) => {
  if (estado.tipo === "sin_copiar") return null;
  if (estado.tipo === "copiados") {
    return (
      <div className="flex flex-col gap-1 rounded-2xl border border-exito/50 p-4">
        <p className="font-semibold text-exito">Enlaces copiados</p>
        <p className="text-sm text-tinta-2">{INSTRUCCIONES}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-linea-2 p-4">
      <p className="text-sm text-tinta-2">
        El navegador no deja copiar desde aquí. Selecciona los enlaces (Ctrl+A dentro de la caja) y cópialos con Ctrl+C.
      </p>
      <label className="flex flex-col gap-2 text-sm font-semibold">
        Enlaces de la playlist
        <textarea
          readOnly
          value={estado.texto}
          rows={6}
          onFocus={(evento) => evento.currentTarget.select()}
          className="w-full rounded-xl border border-linea-2 bg-fondo p-3 font-mono text-xs font-normal text-tinta-2"
        />
      </label>
      <p className="text-sm text-tinta-2">Después: {INSTRUCCIONES}</p>
    </div>
  );
};

// Exportar la lista: «Copiar enlaces» siempre (un enlace por línea para pegarlos en Spotify Escritorio).
export const Exportar: FC<ExportarProps> = ({ playlist, accionExtra }) => {
  const { estado, copiar } = useCopiarEnlaces(playlist.canciones);
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
