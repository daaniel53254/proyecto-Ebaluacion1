"use client";

import { type KeyboardEvent, useMemo, useState } from "react";

import { buscarArtistas } from "@/lib/formato";

type OpcionesSelector = {
  artistas: string[];
  elegidos: string[];
  alElegir: (artista: string) => void;
  alQuitar: (artista: string) => void;
};

// Buscador con lista desplegable (patrón «combobox» de ARIA): flechas para moverse, Intro para elegir,
// Escape para cerrar y Retroceso con la búsqueda vacía para quitar el último elegido.
export const useSelectorArtistas = ({ artistas, elegidos, alElegir, alQuitar }: OpcionesSelector) => {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const sugerencias = useMemo(() => buscarArtistas(artistas, busqueda, elegidos), [artistas, busqueda, elegidos]);
  const indiceActivo = Math.min(activo, Math.max(sugerencias.length - 1, 0));
  const desplegado = abierto && sugerencias.length > 0;

  const cambiarBusqueda = (texto: string) => {
    setBusqueda(texto);
    setActivo(0);
    setAbierto(true);
  };

  const elegir = (artista: string) => {
    alElegir(artista);
    setBusqueda("");
    setActivo(0);
  };

  const moverse = (paso: 1 | -1) => {
    setAbierto(true);
    setActivo(Math.min(Math.max(indiceActivo + paso, 0), Math.max(sugerencias.length - 1, 0)));
  };

  const alTeclear = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      moverse(evento.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (evento.key === "Escape") {
      setAbierto(false);
      return;
    }
    if (evento.key === "Enter") {
      const sugerencia = sugerencias[indiceActivo];
      if (!desplegado || sugerencia === undefined) return;
      evento.preventDefault();
      elegir(sugerencia);
      return;
    }
    const ultimo = elegidos.at(-1);
    if (evento.key === "Backspace" && busqueda === "" && ultimo !== undefined) alQuitar(ultimo);
  };

  return {
    busqueda,
    sugerencias,
    desplegado,
    indiceActivo,
    cambiarBusqueda,
    elegir,
    alTeclear,
    abrir: () => setAbierto(true),
    cerrar: () => setAbierto(false),
    marcar: setActivo,
  };
};
