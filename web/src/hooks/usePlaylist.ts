"use client";

import { useRef, useState } from "react";

import { useFiltrosGrupo } from "@/hooks/useFiltrosGrupo";
import { ErrorApi, pedirPlaylist } from "@/lib/api";
import { lineasDeDetalle } from "@/lib/errores";
import { aPeticion } from "@/lib/filtros";
import type { Playlist } from "@/lib/tipos";

export type { AccionesFiltros, EstadoCarga } from "@/hooks/useFiltrosGrupo";

export type EstadoResultado =
  | { tipo: "sin_generar" }
  | { tipo: "generando" }
  | { tipo: "generada"; playlist: Playlist; vez: number }
  | { tipo: "fallo"; mensaje: string; detalle: string[] };

const MENSAJE_FALLO = "No se pudo generar la playlist";
// 404: alguien del grupo ya no está en el modelo; 503: el modelo se ha retirado. En los dos casos se recarga.
const CODIGOS_QUE_RECARGAN: readonly number[] = [404, 503];

const resultadoDeFallo = (fallo: unknown): EstadoResultado => {
  if (!(fallo instanceof ErrorApi)) return { tipo: "fallo", mensaje: MENSAJE_FALLO, detalle: [] };
  return { tipo: "fallo", mensaje: fallo.message, detalle: lineasDeDetalle(fallo.detalle) };
};

export const debeRecargar = (fallo: unknown): boolean => {
  return fallo instanceof ErrorApi && CODIGOS_QUE_RECARGAN.includes(fallo.codigo);
};

export const usePlaylist = () => {
  const { carga, filtros, acciones, recargar } = useFiltrosGrupo();
  const [resultado, setResultado] = useState<EstadoResultado>({ tipo: "sin_generar" });
  const generaciones = useRef(0);

  const generar = async () => {
    setResultado({ tipo: "generando" });
    try {
      const playlist = await pedirPlaylist(aPeticion(filtros));
      generaciones.current += 1;
      setResultado({ tipo: "generada", playlist, vez: generaciones.current });
    } catch (fallo: unknown) {
      setResultado(resultadoDeFallo(fallo));
      if (debeRecargar(fallo)) void recargar();
    }
  };

  return { carga, filtros, acciones, resultado, generar };
};
