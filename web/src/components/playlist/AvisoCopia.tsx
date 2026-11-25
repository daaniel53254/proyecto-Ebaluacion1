"use client";

import type { FC } from "react";

import type { EstadoCopia } from "@/hooks/useCopiarEnlaces";

const INSTRUCCIONES = "Abre Spotify en el ordenador → crea una playlist → haz clic dentro de ella → Ctrl+V";

type AvisoCopiaProps = {
  estado: EstadoCopia;
};

export const AvisoCopia: FC<AvisoCopiaProps> = ({ estado }) => {
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
