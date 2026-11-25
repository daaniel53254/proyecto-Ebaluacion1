"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorApi, obtenerArtistasPorPersona, obtenerPersonas, obtenerPreparacion, obtenerSalud } from "@/lib/api";
import {
  ajustarPersonas,
  alternarPersona,
  type Filtros,
  filtrosGuardados,
  filtrosIniciales,
  type ModoLongitud,
  type Momento,
  type NumeroCanciones,
  quitarArtista,
  quitarCancion,
  sumarArtista,
  sumarCancion,
} from "@/lib/filtros";
import { esperarPreparacion } from "@/lib/preparacion";
import type { ArtistaGrupo, CancionCatalogo, EstadoPreparacion, TipoDia } from "@/lib/tipos";

export type EstadoCarga =
  | { tipo: "cargando" }
  | { tipo: "sin_conexion" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "sin_modelo"; preparacion: EstadoPreparacion | null }
  | { tipo: "listo"; personas: string[]; artistas: ArtistaGrupo[]; reentrenando: boolean };

const SIN_CONEXION = 0;
// Los filtros se guardan en la sesión del navegador: así «Vuestra playlist» y «¿Entraría?» usan los mismos.
const CLAVE_SESION = "npd-filtros";

const cargaDeFallo = (fallo: unknown): EstadoCarga => {
  if (fallo instanceof ErrorApi && fallo.codigo !== SIN_CONEXION) return { tipo: "error", mensaje: fallo.message };
  return { tipo: "sin_conexion" };
};

const leerSesion = (): Filtros | null => {
  try {
    return filtrosGuardados(window.sessionStorage.getItem(CLAVE_SESION));
  } catch {
    return null;
  }
};

const guardarSesion = (filtros: Filtros): void => {
  try {
    window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify(filtros));
  } catch {
    // Sin almacenamiento: cada página empieza con los filtros iniciales.
  }
};

// Personas y artistas del modelo, filtros del grupo y espera de un reentreno en marcha.
export const useFiltrosGrupo = () => {
  const [carga, setCarga] = useState<EstadoCarga>({ tipo: "cargando" });
  const [filtros, setFiltros] = useState<Filtros>(() => filtrosIniciales([]));
  // Entrenamiento en marcha que hay que esperar: al terminar se recargan personas y artistas.
  const [entrenando, setEntrenando] = useState<EstadoPreparacion | null>(null);
  const leidos = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const salud = await obtenerSalud();
      setEntrenando(salud.preparacion?.estado === "en_curso" ? salud.preparacion : null);
      if (salud.estado !== "ok") {
        setCarga({ tipo: "sin_modelo", preparacion: salud.preparacion });
        return;
      }
      const [personas, artistas] = await Promise.all([obtenerPersonas(), obtenerArtistasPorPersona()]);
      const nombres = personas.map((p) => p.persona);
      const reentrenando = salud.preparacion?.estado === "en_curso";
      setCarga({ tipo: "listo", personas: nombres, artistas, reentrenando });
      // La sesión se lee una vez y fuera del actualizador: React puede llamar a este dos veces en desarrollo.
      const deSesion = leidos.current ? null : leerSesion();
      leidos.current = true;
      setFiltros((actuales) => ajustarPersonas(deSesion ?? actuales, nombres));
    } catch (fallo: unknown) {
      setCarga(cargaDeFallo(fallo));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (leidos.current) guardarSesion(filtros);
  }, [filtros]);

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

  const todas = carga.tipo === "listo" ? carga.personas : [];
  const acciones = {
    alternarPersona: (persona: string) => setFiltros((f) => alternarPersona(f, persona, todas)),
    elegirMomento: (momento: Momento | null) => setFiltros((f) => ({ ...f, momento })),
    elegirTipoDia: (tipoDia: TipoDia) => setFiltros((f) => ({ ...f, tipoDia })),
    elegirModo: (modo: ModoLongitud) => setFiltros((f) => ({ ...f, modo })),
    elegirCanciones: (canciones: NumeroCanciones) => setFiltros((f) => ({ ...f, canciones })),
    elegirMinutos: (minutos: number) => setFiltros((f) => ({ ...f, minutos })),
    sumarArtista: (artista: string) => setFiltros((f) => sumarArtista(f, artista)),
    quitarArtista: (artista: string) => setFiltros((f) => quitarArtista(f, artista)),
    sumarCancion: (cancion: CancionCatalogo) => setFiltros((f) => sumarCancion(f, cancion)),
    quitarCancion: (trackId: string) => setFiltros((f) => quitarCancion(f, trackId)),
  };

  return { carga, filtros, acciones, recargar: cargar };
};

export type AccionesFiltros = ReturnType<typeof useFiltrosGrupo>["acciones"];
