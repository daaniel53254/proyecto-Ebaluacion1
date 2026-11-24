"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorApi, obtenerArtistas, obtenerPersonas, obtenerPreparacion, obtenerSalud, pedirPlaylist } from "@/lib/api";
import { lineasDeDetalle } from "@/lib/errores";
import {
  aPeticion,
  ajustarPersonas,
  alternarPersona,
  type Filtros,
  filtrosIniciales,
  type ModoLongitud,
  type NumeroCanciones,
  quitarArtista,
  sumarArtista,
} from "@/lib/filtros";
import { esperarPreparacion } from "@/lib/preparacion";
import type { EstadoPreparacion, Playlist, TipoDia } from "@/lib/tipos";

export type EstadoCarga =
  | { tipo: "cargando" }
  | { tipo: "sin_conexion" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "sin_modelo"; preparacion: EstadoPreparacion | null }
  | { tipo: "listo"; personas: string[]; artistas: string[]; reentrenando: boolean };

export type EstadoResultado =
  | { tipo: "sin_generar" }
  | { tipo: "generando" }
  | { tipo: "generada"; playlist: Playlist; vez: number }
  | { tipo: "fallo"; mensaje: string; detalle: string[] };

const SIN_CONEXION = 0;
const MENSAJE_FALLO = "No se pudo generar la playlist";
// 404: alguien del grupo ya no está en el modelo; 503: el modelo se ha retirado. En los dos casos se recarga.
const CODIGOS_QUE_RECARGAN: readonly number[] = [404, 503];

const cargaDeFallo = (fallo: unknown): EstadoCarga => {
  if (fallo instanceof ErrorApi && fallo.codigo !== SIN_CONEXION) return { tipo: "error", mensaje: fallo.message };
  return { tipo: "sin_conexion" };
};

const resultadoDeFallo = (fallo: unknown): EstadoResultado => {
  if (!(fallo instanceof ErrorApi)) return { tipo: "fallo", mensaje: MENSAJE_FALLO, detalle: [] };
  return { tipo: "fallo", mensaje: fallo.message, detalle: lineasDeDetalle(fallo.detalle) };
};

const debeRecargar = (fallo: unknown): boolean => {
  return fallo instanceof ErrorApi && CODIGOS_QUE_RECARGAN.includes(fallo.codigo);
};

export const usePlaylist = () => {
  const [carga, setCarga] = useState<EstadoCarga>({ tipo: "cargando" });
  const [filtros, setFiltros] = useState<Filtros>(() => filtrosIniciales([]));
  const [resultado, setResultado] = useState<EstadoResultado>({ tipo: "sin_generar" });
  // Entrenamiento en marcha que hay que esperar: al terminar se recargan personas y artistas.
  const [entrenando, setEntrenando] = useState<EstadoPreparacion | null>(null);
  const generaciones = useRef(0);

  const cargar = useCallback(async () => {
    try {
      const salud = await obtenerSalud();
      setEntrenando(salud.preparacion?.estado === "en_curso" ? salud.preparacion : null);
      if (salud.estado !== "ok") {
        setCarga({ tipo: "sin_modelo", preparacion: salud.preparacion });
        return;
      }
      const [personas, artistas] = await Promise.all([obtenerPersonas(), obtenerArtistas()]);
      const nombres = personas.map((p) => p.persona);
      const reentrenando = salud.preparacion?.estado === "en_curso";
      setCarga({ tipo: "listo", personas: nombres, artistas, reentrenando });
      setFiltros((actuales) => ajustarPersonas(actuales, nombres));
    } catch (fallo: unknown) {
      setCarga(cargaDeFallo(fallo));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (entrenando === null) return;
    const control = new AbortController();
    esperarPreparacion(obtenerPreparacion, { inicial: entrenando, senal: control.signal })
      .catch(() => {
        // Si no se puede seguir (API caída), la recarga de abajo ya enseñará el estado real.
      })
      .finally(() => {
        if (!control.signal.aborted) void cargar();
      });
    return () => control.abort();
  }, [entrenando, cargar]);

  const generar = async () => {
    setResultado({ tipo: "generando" });
    try {
      const playlist = await pedirPlaylist(aPeticion(filtros));
      generaciones.current += 1;
      setResultado({ tipo: "generada", playlist, vez: generaciones.current });
    } catch (fallo: unknown) {
      setResultado(resultadoDeFallo(fallo));
      if (debeRecargar(fallo)) void cargar();
    }
  };

  const todas = carga.tipo === "listo" ? carga.personas : [];
  const acciones = {
    alternarPersona: (persona: string) => setFiltros((f) => alternarPersona(f, persona, todas)),
    elegirFranja: (franja: number | null) => setFiltros((f) => ({ ...f, franja })),
    elegirTipoDia: (tipoDia: TipoDia) => setFiltros((f) => ({ ...f, tipoDia })),
    elegirModo: (modo: ModoLongitud) => setFiltros((f) => ({ ...f, modo })),
    elegirCanciones: (canciones: NumeroCanciones) => setFiltros((f) => ({ ...f, canciones })),
    elegirMinutos: (minutos: number) => setFiltros((f) => ({ ...f, minutos })),
    sumarArtista: (artista: string) => setFiltros((f) => sumarArtista(f, artista)),
    quitarArtista: (artista: string) => setFiltros((f) => quitarArtista(f, artista)),
  };

  return { carga, filtros, acciones, resultado, generar };
};

export type AccionesFiltros = ReturnType<typeof usePlaylist>["acciones"];
