"use client";

import { useEffect, useState } from "react";

import { buscarCanciones, ErrorApi } from "@/lib/api";
import type { CancionCatalogo } from "@/lib/tipos";

export type EstadoBusqueda =
  | { tipo: "corta" }
  | { tipo: "buscando" }
  | { tipo: "lista"; canciones: CancionCatalogo[] }
  | { tipo: "fallo"; mensaje: string };

export const MIN_CARACTERES = 2;
const ESPERA_MS = 250;

// Busca en la API las canciones que alguien del grupo ha escuchado, al dejar de escribir; una búsqueda nueva cancela la anterior.
export const useBuscarCanciones = () => {
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState<EstadoBusqueda>({ tipo: "corta" });

  useEffect(() => {
    const buscado = texto.trim();
    if (buscado.length < MIN_CARACTERES) {
      setBusqueda({ tipo: "corta" });
      return;
    }
    const control = new AbortController();
    const espera = window.setTimeout(() => {
      setBusqueda({ tipo: "buscando" });
      buscarCanciones(buscado, control.signal)
        .then((canciones) => setBusqueda({ tipo: "lista", canciones }))
        .catch((fallo: unknown) => {
          if (control.signal.aborted) return;
          setBusqueda({ tipo: "fallo", mensaje: fallo instanceof ErrorApi ? fallo.message : "No se pudo buscar" });
        });
    }, ESPERA_MS);
    return () => {
      window.clearTimeout(espera);
      control.abort();
    };
  }, [texto]);

  return { texto, setTexto, busqueda, limpiar: () => setTexto("") };
};

// «aitor, daniel»: quién tiene la canción en su historial, de más a menos escuchas.
export const deQuienEs = (cancion: CancionCatalogo): string => {
  return Object.keys(cancion.personas).join(", ");
};
