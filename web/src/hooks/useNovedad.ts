"use client";

import { useState } from "react";

import { consultarNovedad, ErrorApi } from "@/lib/api";
import { lineasDeDetalle } from "@/lib/errores";
import type { ResultadoNovedad } from "@/lib/tipos";

export type EstadoNovedad =
  | { tipo: "sin_consultar" }
  | { tipo: "consultando" }
  | { tipo: "respondida"; resultado: ResultadoNovedad; umbral: number; sinArtista: boolean }
  | { tipo: "fallo"; mensaje: string; detalle: string[] };

const MENSAJE_FALLO = "No se pudo comprobar la canción";

// «¿Entraría esta canción?»: cualquier canción, la haya escuchado alguien o no. El título es obligatorio; el artista
// afina el resultado (sin él, el modelo solo conoce lo general de cada persona).
export const useNovedad = (personas: string[]) => {
  const [cancion, setCancion] = useState("");
  const [artista, setArtista] = useState("");
  const [estado, setEstado] = useState<EstadoNovedad>({ tipo: "sin_consultar" });

  const comprobar = async () => {
    if (cancion.trim() === "") return;
    setEstado({ tipo: "consultando" });
    try {
      const respuesta = await consultarNovedad({ personas, cancion: cancion.trim(), artista: artista.trim() });
      const [resultado] = respuesta.resultados;
      if (resultado === undefined) throw new ErrorApi(MENSAJE_FALLO, 0);
      setEstado({ tipo: "respondida", resultado, umbral: respuesta.umbral_percentil, sinArtista: resultado.artista === "?" });
    } catch (fallo: unknown) {
      const detalle = fallo instanceof ErrorApi ? lineasDeDetalle(fallo.detalle) : [];
      setEstado({ tipo: "fallo", mensaje: fallo instanceof ErrorApi ? fallo.message : MENSAJE_FALLO, detalle });
    }
  };

  return { cancion, setCancion, artista, setArtista, estado, comprobar };
};
