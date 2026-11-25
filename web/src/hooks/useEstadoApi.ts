"use client";

import { useEffect, useState } from "react";

import { ErrorApi, obtenerSalud } from "@/lib/api";
import type { Salud } from "@/lib/tipos";

export type EstadoApi =
  | { tipo: "comprobando" }
  | { tipo: "modelo_listo"; salud: Salud }
  | { tipo: "sin_modelo"; salud: Salud }
  | { tipo: "sin_conexion" }
  | { tipo: "error"; mensaje: string };

const REINTENTO_MS = 2500;

const estadoDeSalud = (salud: Salud): EstadoApi => {
  if (salud.estado === "ok") return { tipo: "modelo_listo", salud };
  return { tipo: "sin_modelo", salud };
};

const estadoDeFallo = (fallo: unknown): EstadoApi => {
  if (fallo instanceof ErrorApi && fallo.codigo !== 0) return { tipo: "error", mensaje: fallo.message };
  return { tipo: "sin_conexion" };
};

export const useEstadoApi = (): EstadoApi => {
  const [estado, setEstado] = useState<EstadoApi>({ tipo: "comprobando" });

  useEffect(() => {
    let vigente = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    // Con «sin conexión» se reintenta: el .bat arranca la API y la web a la vez y la API tarda más.
    const comprobar = () => {
      obtenerSalud()
        .then((salud) => {
          if (vigente) setEstado(estadoDeSalud(salud));
        })
        .catch((fallo: unknown) => {
          if (!vigente) return;
          const nuevo = estadoDeFallo(fallo);
          setEstado(nuevo);
          if (nuevo.tipo === "sin_conexion") temporizador = setTimeout(comprobar, REINTENTO_MS);
        });
    };
    comprobar();

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, []);

  return estado;
};
