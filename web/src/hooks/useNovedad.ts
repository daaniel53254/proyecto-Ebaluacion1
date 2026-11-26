"use client";

import { useState } from "react";

import { consultarNovedad, ErrorApi } from "@/lib/api";
import { lineasDeDetalle } from "@/lib/errores";
import type { ResultadoNovedad } from "@/lib/tipos";

export type EstadoNovedad =
  | { tipo: "sin_consultar" }
  | { tipo: "consultando" }
  | { tipo: "respondida"; resultado: ResultadoNovedad; umbral: number }
  | { tipo: "fallo"; mensaje: string; detalle: string[] };

const MENSAJE_FALLO = "No se pudo comprobar la canción";

// «¿Entraría una canción que nadie ha escuchado?»: se escribe a mano y la API la puntúa para cada miembro.
export const useNovedad = (personas: string[]) => {
  const [artista, setArtista] = useState("");
  const [album, setAlbum] = useState("");
  const [cancion, setCancion] = useState("");
  const [estado, setEstado] = useState<EstadoNovedad>({ tipo: "sin_consultar" });

  const comprobar = async () => {
    if (artista.trim() === "") return;
    setEstado({ tipo: "consultando" });
    try {
      const respuesta = await consultarNovedad({
        personas,
        artista: artista.trim(),
        album: album.trim(),
        cancion: cancion.trim(),
      });
      const [resultado] = respuesta.resultados;
      if (resultado === undefined) throw new ErrorApi(MENSAJE_FALLO, 0);
      setEstado({ tipo: "respondida", resultado, umbral: respuesta.umbral_percentil });
    } catch (fallo: unknown) {
      const detalle = fallo instanceof ErrorApi ? lineasDeDetalle(fallo.detalle) : [];
      setEstado({ tipo: "fallo", mensaje: fallo instanceof ErrorApi ? fallo.message : MENSAJE_FALLO, detalle });
    }
  };

  return { artista, setArtista, album, setAlbum, cancion, setCancion, estado, comprobar };
};
