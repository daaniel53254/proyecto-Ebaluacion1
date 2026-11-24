"use client";

import { useState } from "react";

import { textoEnlacesDeIds } from "@/lib/formato";

export type EstadoCopia = { tipo: "sin_copiar" } | { tipo: "copiados" } | { tipo: "a_mano"; texto: string };

// Plan B de navegadores sin la API del portapapeles (o sin permiso): una caja oculta y «copiar».
const copiarConSeleccion = (texto: string): boolean => {
  const caja = document.createElement("textarea");
  caja.value = texto;
  caja.setAttribute("readonly", "");
  caja.style.position = "fixed";
  caja.style.opacity = "0";
  document.body.append(caja);
  caja.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    caja.remove();
  }
};

const copiarAlPortapapeles = async (texto: string): Promise<boolean> => {
  if (typeof navigator.clipboard?.writeText !== "function") return copiarConSeleccion(texto);
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return copiarConSeleccion(texto);
  }
};

export const useCopiarEnlaces = (trackIds: string[]) => {
  const [estado, setEstado] = useState<EstadoCopia>({ tipo: "sin_copiar" });

  const copiar = async () => {
    const texto = textoEnlacesDeIds(trackIds);
    const copiado = await copiarAlPortapapeles(texto);
    setEstado(copiado ? { tipo: "copiados" } : { tipo: "a_mano", texto });
  };

  return { estado, copiar };
};
