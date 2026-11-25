import Link from "next/link";
import type { FC } from "react";

import type { EstadoArchivos } from "@/hooks/useFormularioSubida";

type ResumenArchivosProps = {
  archivos: EstadoArchivos;
};

const formatoMegas = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

const plural = (cantidad: number, singular: string, varios: string): string => {
  return cantidad === 1 ? singular : varios;
};

const textoResumen = (incluidos: number, descartados: number): string => {
  const suben = `Se suben ${incluidos} ${plural(incluidos, "fichero", "ficheros")}`;
  if (descartados === 0) return suben;
  return `${suben} · Se descartan ${descartados}`;
};

// Lo que se va a enviar, antes de enviarlo: qué ficheros suben y cuáles se quedan fuera y por qué.
export const ResumenArchivos: FC<ResumenArchivosProps> = ({ archivos }) => {
  if (archivos.tipo === "vacio") return null;

  if (archivos.tipo === "preparando") {
    return (
      <p role="status" className="text-sm text-tinta-2">
        Preparando ficheros…
      </p>
    );
  }

  if (archivos.tipo === "error") {
    return (
      <div role="alert" className="flex flex-col gap-1 rounded-2xl border border-acento/60 bg-acento-suave/40 p-4 text-sm">
        <p>{archivos.mensaje}</p>
        <Link href="/tutorial" className="font-semibold text-acento underline-offset-4 hover:underline">
          Cómo pedir el historial ampliado
        </Link>
      </div>
    );
  }

  const { incluidos, descartados, bytes } = archivos.preparado;
  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border border-linea bg-fondo p-4 text-sm">
      <p className="font-display font-semibold">{textoResumen(incluidos.length, descartados.length)}</p>
      <ul aria-label="Ficheros que se suben" className="flex flex-col gap-1 text-tinta-2">
        {incluidos.map((nombre) => {
          return (
            <li key={nombre} className="flex gap-2">
              <span aria-hidden className="text-exito">
                ✓
              </span>
              <span className="break-all">{nombre}</span>
            </li>
          );
        })}
      </ul>
      {descartados.length > 0 && (
        <ul aria-label="Ficheros descartados" className="flex flex-col gap-1 text-apagado">
          {descartados.map((descartado) => {
            return (
              <li key={`${descartado.nombre}-${descartado.motivo}`} className="flex flex-wrap gap-x-2">
                <span aria-hidden>✕</span>
                <span className="break-all">{descartado.nombre}</span>
                <span>({descartado.motivo})</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-apagado tabular-nums">Envío de {formatoMegas.format(bytes / 1_000_000)} MB</p>
    </div>
  );
};
