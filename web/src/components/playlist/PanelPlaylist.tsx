"use client";

import type { FC } from "react";

import { Filtros } from "@/components/playlist/Filtros";
import { Resultado } from "@/components/playlist/Resultado";
import { EnlaceBoton } from "@/components/ui/EnlaceBoton";
import { tarjeta } from "@/components/ui/estilos";
import { type EstadoCarga, type EstadoResultado, usePlaylist } from "@/hooks/usePlaylist";
import type { EstadoPreparacion } from "@/lib/tipos";

const AVISO = "rounded-2xl border border-acento/60 bg-acento-suave/40 p-4 text-sm";

const assertNever = (valor: never): never => {
  throw new Error(`Estado no contemplado: ${JSON.stringify(valor)}`);
};

const textoSinModelo = (preparacion: EstadoPreparacion | null): string => {
  if (preparacion?.estado === "en_curso") return "Se está entrenando el modelo con los historiales. Vuelve en un rato.";
  if (preparacion?.estado === "error") return `El último entrenamiento falló: ${preparacion.error ?? "sin detalle"}.`;
  return "Todavía no hay modelo: hace falta que alguien suba su historial.";
};

type SinModeloProps = {
  preparacion: EstadoPreparacion | null;
};

const SinModelo: FC<SinModeloProps> = ({ preparacion }) => {
  return (
    <div role="status" className={tarjeta({ class: "flex flex-col items-start gap-4 p-6 sm:p-8" })}>
      <p className="font-display text-lg font-bold">Aún no se puede generar la playlist</p>
      <p className="text-tinta-2">{textoSinModelo(preparacion)}</p>
      <EnlaceBoton href="/subir">Súbelo</EnlaceBoton>
    </div>
  );
};

type ZonaResultadoProps = {
  resultado: EstadoResultado;
  personasModelo: string[];
};

const ZonaResultado: FC<ZonaResultadoProps> = ({ resultado, personasModelo }) => {
  switch (resultado.tipo) {
    case "sin_generar":
      return <p className="text-tinta-2">Elige los filtros y pulsa «Generar playlist».</p>;
    case "generando":
      return (
        <p role="status" className="text-tinta-2">
          Generando la playlist…
        </p>
      );
    case "fallo":
      return (
        <div role="alert" className={AVISO}>
          <p className="font-semibold">{resultado.mensaje}</p>
          {resultado.detalle.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-tinta-2">
              {resultado.detalle.map((linea) => {
                return <li key={linea}>{linea}</li>;
              })}
            </ul>
          )}
        </div>
      );
    case "generada":
      return <Resultado key={resultado.vez} playlist={resultado.playlist} personasModelo={personasModelo} />;
    default:
      return assertNever(resultado);
  }
};

type ContenidoProps = {
  carga: EstadoCarga;
};

export const SinDatos: FC<ContenidoProps> = ({ carga }) => {
  switch (carga.tipo) {
    case "cargando":
      return <p className="text-tinta-2">Cargando las personas del modelo…</p>;
    case "sin_conexion":
      return (
        <p role="alert" className={AVISO}>
          La API no está arrancada: ejecuta arrancar_web.bat
        </p>
      );
    case "error":
      return (
        <p role="alert" className={AVISO}>
          La API respondió con un error: {carga.mensaje}
        </p>
      );
    case "sin_modelo":
      return <SinModelo preparacion={carga.preparacion} />;
    case "listo":
      return null;
    default:
      return assertNever(carga);
  }
};

export const PanelPlaylist: FC = () => {
  const { carga, filtros, acciones, resultado, generar } = usePlaylist();
  if (carga.tipo !== "listo") return <SinDatos carga={carga} />;

  return (
    <div className="flex flex-col gap-10">
      {carga.reentrenando && (
        <p role="status" className="rounded-2xl border border-linea-2 p-4 text-sm text-tinta-2">
          Se está volviendo a entrenar el modelo con los últimos cambios; mientras, la playlist sale del anterior.
        </p>
      )}
      <Filtros
        filtros={filtros}
        acciones={acciones}
        personas={carga.personas}
        artistas={carga.artistas}
        accion={{
          texto: "Generar playlist",
          textoOcupado: "Generando…",
          ayuda: "La lista no cambia hasta que la vuelves a generar.",
          ocupado: resultado.tipo === "generando",
          alPulsar: () => void generar(),
        }}
      />
      <ZonaResultado resultado={resultado} personasModelo={carga.personas} />
    </div>
  );
};
