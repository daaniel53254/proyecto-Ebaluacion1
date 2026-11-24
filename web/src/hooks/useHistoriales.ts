"use client";

import { useCallback, useEffect, useState } from "react";

import { borrarHistorial, ErrorApi, obtenerHistoriales } from "@/lib/api";
import type { EstadoPreparacion, Historial } from "@/lib/tipos";

const MENSAJE_FALLO = "No se pudo hablar con la API";

const mensajeDe = (fallo: unknown): string => {
  if (fallo instanceof ErrorApi) return fallo.message;
  return MENSAJE_FALLO;
};

export const useHistoriales = () => {
  const [historiales, setHistoriales] = useState<Historial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      setHistoriales(await obtenerHistoriales());
      setError(null);
    } catch (fallo: unknown) {
      setError(mensajeDe(fallo));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  // Devuelve el reentreno lanzado (o null si no se lanzó ninguno) para que la página lo siga.
  const borrar = async (persona: string): Promise<EstadoPreparacion | null> => {
    setBorrando(persona);
    try {
      const preparacion = await borrarHistorial(persona);
      setError(null);
      return preparacion;
    } catch (fallo: unknown) {
      setError(mensajeDe(fallo));
      return null;
    } finally {
      setBorrando(null);
      await recargar();
    }
  };

  return { historiales, cargando, error, borrando, recargar, borrar };
};
