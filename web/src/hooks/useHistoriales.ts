"use client";

import { useCallback, useEffect, useState } from "react";

import { borrarHistorial, ErrorApi, obtenerHistoriales } from "@/lib/api";
import type { EstadoPreparacion, Historial } from "@/lib/tipos";
import { olvidarToken } from "@/lib/tokens";

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
  // El error del borrado se pone después de recargar la lista, que si va bien deja el error en blanco.
  const borrar = async (persona: string, token: string | null): Promise<EstadoPreparacion | null> => {
    setBorrando(persona);
    let preparacion: EstadoPreparacion | null = null;
    let errorBorrado: string | null = null;
    try {
      preparacion = await borrarHistorial(persona, token);
      olvidarToken(persona);
    } catch (fallo: unknown) {
      errorBorrado = mensajeDe(fallo);
    }
    setBorrando(null);
    await recargar();
    if (errorBorrado !== null) setError(errorBorrado);
    return preparacion;
  };

  return { historiales, cargando, error, borrando, recargar, borrar };
};
