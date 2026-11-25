"use client";

import { type ChangeEvent, type DragEvent, type FC, useState } from "react";

import { cn } from "@/lib/cn";

type ZonaArchivosProps = {
  alElegir: (archivos: File[]) => void;
  desactivada: boolean;
};

// Zona para arrastrar o elegir el .zip de Spotify o los .json sueltos. El input queda oculto pero enfocable.
export const ZonaArchivos: FC<ZonaArchivosProps> = ({ alElegir, desactivada }) => {
  const [encima, setEncima] = useState(false);

  const alCambiar = (evento: ChangeEvent<HTMLInputElement>) => {
    alElegir([...(evento.target.files ?? [])]);
    evento.target.value = "";
  };

  const alArrastrar = (evento: DragEvent<HTMLLabelElement>) => {
    evento.preventDefault();
    if (!desactivada) setEncima(true);
  };

  const alSoltar = (evento: DragEvent<HTMLLabelElement>) => {
    evento.preventDefault();
    setEncima(false);
    if (desactivada) return;
    alElegir([...evento.dataTransfer.files]);
  };

  return (
    <label
      onDragOver={alArrastrar}
      onDragLeave={() => setEncima(false)}
      onDrop={alSoltar}
      className={cn(
        "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-linea-2 bg-fondo px-6 py-8 text-center transition-[border-color,background-color] duration-200 ease-salida focus-within:border-acento hover:border-tinta-2",
        encima && "border-acento bg-acento-suave/40",
        desactivada && "cursor-not-allowed opacity-60",
      )}
    >
      <span aria-hidden className="font-display text-3xl leading-none text-acento">
        ↑
      </span>
      <span className="font-display font-semibold">Elige el .zip o los .json</span>
      <span className="text-sm text-apagado">o arrástralos aquí · el my_spotify_data.zip tal cual llega</span>
      <input
        type="file"
        accept=".zip,.json,application/zip,application/json"
        multiple
        disabled={desactivada}
        onChange={alCambiar}
        className="sr-only"
      />
    </label>
  );
};
