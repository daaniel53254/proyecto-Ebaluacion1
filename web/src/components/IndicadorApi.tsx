"use client";

import type { FC } from "react";

import { type EstadoApi, useEstadoApi } from "@/hooks/useEstadoApi";
import { cn } from "@/lib/cn";

type Aspecto = {
  texto: string;
  punto: string;
};

const assertNever = (valor: never): never => {
  throw new Error(`Estado de la API no contemplado: ${JSON.stringify(valor)}`);
};

const aspectoDe = (estado: EstadoApi): Aspecto => {
  switch (estado.tipo) {
    case "comprobando":
      return { texto: "Comprobando la API…", punto: "bg-apagado animate-pulse" };
    case "modelo_listo":
      return { texto: "API conectada · modelo listo", punto: "bg-exito" };
    case "sin_modelo":
      return { texto: "API conectada · sin modelo", punto: "bg-acento" };
    case "sin_conexion":
      return { texto: "La API no está arrancada: ejecuta arrancar_web.bat", punto: "bg-acento" };
    case "error":
      return { texto: `La API respondió con un error: ${estado.mensaje}`, punto: "bg-acento" };
    default:
      return assertNever(estado);
  }
};

export const IndicadorApi: FC = () => {
  const estado = useEstadoApi();
  const { texto, punto } = aspectoDe(estado);

  return (
    <p
      role="status"
      className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-linea bg-superficie px-4 py-2 text-sm text-tinta-2"
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", punto)} />
      <span className="min-w-0">{texto}</span>
    </p>
  );
};
