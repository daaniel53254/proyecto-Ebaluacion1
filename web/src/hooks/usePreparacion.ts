"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorApi, obtenerPreparacion } from "@/lib/api";
import { esperarPreparacion } from "@/lib/preparacion";
import type { EstadoPreparacion, ResumenPreparacion, ResumenSubida } from "@/lib/tipos";

// Por qué se está entrenando: la subida propia, un borrado o algo que ya estaba en marcha al entrar.
export type OrigenEntreno = { tipo: "subida"; subida: ResumenSubida } | { tipo: "borrado"; persona: string } | { tipo: "otro" };

export type Seguimiento =
  | { fase: "inactiva" }
  | { fase: "entrenando"; origen: OrigenEntreno }
  | { fase: "lista"; origen: OrigenEntreno; resumen: ResumenPreparacion | null }
  | { fase: "error"; origen: OrigenEntreno; mensaje: string };

const MENSAJE_SIN_SEGUIMIENTO = "No se pudo seguir el entrenamiento";

const seguimientoFinal = (estado: EstadoPreparacion, origen: OrigenEntreno): Seguimiento => {
  if (estado.estado === "error") return { fase: "error", origen, mensaje: estado.error ?? MENSAJE_SIN_SEGUIMIENTO };
  return { fase: "lista", origen, resumen: estado.resumen };
};

const mensajeDe = (fallo: unknown): string => {
  if (fallo instanceof ErrorApi) return fallo.message;
  return MENSAJE_SIN_SEGUIMIENTO;
};

export const usePreparacion = (alTerminar: () => void) => {
  const [seguimiento, setSeguimiento] = useState<Seguimiento>({ fase: "inactiva" });
  const control = useRef<AbortController | null>(null);
  const alTerminarActual = useRef(alTerminar);

  useEffect(() => {
    alTerminarActual.current = alTerminar;
  }, [alTerminar]);

  const seguir = useCallback(async (inicial: EstadoPreparacion, origen: OrigenEntreno) => {
    control.current?.abort();
    const propio = new AbortController();
    control.current = propio;
    setSeguimiento({ fase: "entrenando", origen });
    try {
      const final = await esperarPreparacion(obtenerPreparacion, { inicial, senal: propio.signal });
      setSeguimiento(seguimientoFinal(final, origen));
    } catch (fallo: unknown) {
      if (propio.signal.aborted) return;
      setSeguimiento({ fase: "error", origen, mensaje: mensajeDe(fallo) });
    }
    alTerminarActual.current();
  }, []);

  // Si al entrar ya hay un entrenamiento en marcha (de otra persona), también se sigue.
  useEffect(() => {
    let vigente = true;
    obtenerPreparacion()
      .then((estado) => {
        const libre = vigente && control.current === null;
        if (libre && estado.estado === "en_curso") void seguir(estado, { tipo: "otro" });
      })
      .catch(() => {
        // Sin API no hay nada que seguir: el formulario ya enseñará el error al subir.
      });
    return () => {
      vigente = false;
      control.current?.abort();
    };
  }, [seguir]);

  return { seguimiento, seguir };
};
