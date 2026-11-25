"use client";

import { useState } from "react";

import { useBuscarCanciones } from "@/hooks/useBuscarCanciones";
import { useFiltrosGrupo } from "@/hooks/useFiltrosGrupo";
import { debeRecargar } from "@/hooks/usePlaylist";
import { consultarCancion, ErrorApi } from "@/lib/api";
import { lineasDeDetalle } from "@/lib/errores";
import { aPeticion } from "@/lib/filtros";
import type { CancionCatalogo, RespuestaCancion } from "@/lib/tipos";

export type EstadoConsulta =
  | { tipo: "sin_consultar" }
  | { tipo: "consultando" }
  | { tipo: "respondida"; respuesta: RespuestaCancion; vez: number }
  | { tipo: "fallo"; mensaje: string; detalle: string[] };

const MENSAJE_FALLO = "No se pudo comprobar la canción";

const mensajeDe = (fallo: unknown, porDefecto: string): string => {
  return fallo instanceof ErrorApi ? fallo.message : porDefecto;
};

// «¿Entraría?»: buscar una canción del catálogo y preguntar a la API si entraría en la playlist con los filtros del grupo.
export const useCancion = () => {
  const { carga, filtros, acciones, recargar } = useFiltrosGrupo();
  const { texto, setTexto, busqueda, limpiar } = useBuscarCanciones();
  const [elegida, setElegida] = useState<CancionCatalogo | null>(null);
  const [consulta, setConsulta] = useState<EstadoConsulta>({ tipo: "sin_consultar" });
  const [veces, setVeces] = useState(0);

  const elegir = (cancion: CancionCatalogo) => {
    setElegida(cancion);
    limpiar();
    setConsulta({ tipo: "sin_consultar" });
  };

  const cambiarCancion = () => {
    setElegida(null);
    setConsulta({ tipo: "sin_consultar" });
  };

  const comprobar = async () => {
    if (elegida === null) return;
    setConsulta({ tipo: "consultando" });
    try {
      const respuesta = await consultarCancion({ ...aPeticion(filtros), track_id: elegida.track_id });
      setVeces((v) => v + 1);
      setConsulta({ tipo: "respondida", respuesta, vez: veces + 1 });
    } catch (fallo: unknown) {
      const detalle = fallo instanceof ErrorApi ? lineasDeDetalle(fallo.detalle) : [];
      setConsulta({ tipo: "fallo", mensaje: mensajeDe(fallo, MENSAJE_FALLO), detalle });
      if (debeRecargar(fallo)) void recargar();
    }
  };

  return {
    carga,
    filtros,
    acciones,
    texto,
    setTexto,
    busqueda,
    elegida,
    elegir,
    cambiarCancion,
    consulta,
    comprobar,
  };
};
