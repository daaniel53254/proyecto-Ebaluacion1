"use client";

import { useRef, useState } from "react";

import { ErrorApi, subirHistorial } from "@/lib/api";
import { lineasDeDetalle } from "@/lib/errores";
import { ErrorHistorial, type HistorialPreparado, normalizarPersona, prepararHistorial } from "@/lib/historial";
import type { Historial, RespuestaSubida } from "@/lib/tipos";

export type EstadoArchivos =
  | { tipo: "vacio" }
  | { tipo: "preparando" }
  | { tipo: "listo"; preparado: HistorialPreparado }
  | { tipo: "error"; mensaje: string };

export type EstadoEnvio =
  | { tipo: "inactivo" }
  | { tipo: "enviando" }
  | { tipo: "error"; mensaje: string; detalle: string[] };

type Opciones = {
  historiales: Historial[];
  alSubir: (respuesta: RespuestaSubida) => void;
};

const MENSAJE_FICHERO_ILEGIBLE = "No se pudo leer el fichero. Comprueba que es el .zip que envía Spotify.";
const MENSAJE_SUBIDA_FALLIDA = "No se pudo subir el historial. Inténtalo otra vez.";

const mensajeDeArchivos = (fallo: unknown): string => {
  if (fallo instanceof ErrorHistorial) return fallo.message;
  return MENSAJE_FICHERO_ILEGIBLE;
};

const envioFallido = (fallo: unknown): EstadoEnvio => {
  if (fallo instanceof ErrorApi) return { tipo: "error", mensaje: fallo.message, detalle: lineasDeDetalle(fallo.detalle) };
  return { tipo: "error", mensaje: MENSAJE_SUBIDA_FALLIDA, detalle: [] };
};

export const useFormularioSubida = ({ historiales, alSubir }: Opciones) => {
  const [nombre, setNombre] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [archivos, setArchivos] = useState<EstadoArchivos>({ tipo: "vacio" });
  const [envio, setEnvio] = useState<EstadoEnvio>({ tipo: "inactivo" });
  const ultimaEleccion = useRef(0);

  const persona = normalizarPersona(nombre);
  const yaExiste = persona !== null && historiales.some((historial) => historial.persona === persona);
  const enviando = envio.tipo === "enviando";
  const puedeSubir = persona !== null && consentimiento && archivos.tipo === "listo" && !enviando;

  const elegirArchivos = async (elegidos: File[]) => {
    if (elegidos.length === 0) return;
    ultimaEleccion.current += 1;
    const eleccion = ultimaEleccion.current;
    setArchivos({ tipo: "preparando" });
    setEnvio({ tipo: "inactivo" });
    try {
      const preparado = await prepararHistorial(elegidos);
      if (eleccion === ultimaEleccion.current) setArchivos({ tipo: "listo", preparado });
    } catch (fallo: unknown) {
      if (eleccion === ultimaEleccion.current) setArchivos({ tipo: "error", mensaje: mensajeDeArchivos(fallo) });
    }
  };

  const enviar = async () => {
    if (!puedeSubir) return;
    setEnvio({ tipo: "enviando" });
    try {
      const respuesta = await subirHistorial(persona, consentimiento, archivos.preparado.zip);
      setEnvio({ tipo: "inactivo" });
      setArchivos({ tipo: "vacio" });
      alSubir(respuesta);
    } catch (fallo: unknown) {
      setEnvio(envioFallido(fallo));
    }
  };

  return {
    nombre,
    setNombre,
    persona,
    yaExiste,
    consentimiento,
    setConsentimiento,
    archivos,
    elegirArchivos,
    envio,
    enviando,
    puedeSubir,
    enviar,
  };
};
