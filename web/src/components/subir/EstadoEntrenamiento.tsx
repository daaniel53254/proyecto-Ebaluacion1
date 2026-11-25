import Link from "next/link";
import type { FC } from "react";

import { tarjeta } from "@/components/ui/estilos";
import type { OrigenEntreno, Seguimiento } from "@/hooks/usePreparacion";
import type { ResumenSubida } from "@/lib/tipos";

type EstadoEntrenamientoProps = {
  seguimiento: Seguimiento;
};

const formatoFecha = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
const formatoNumero = new Intl.NumberFormat("es-ES");

const fecha = (texto: string | null): string => {
  if (texto === null) return "?";
  const valor = new Date(texto);
  return Number.isNaN(valor.getTime()) ? texto : formatoFecha.format(valor);
};

const textoEntrenando = (origen: OrigenEntreno): string => {
  if (origen.tipo === "subida") return "Entrenando el modelo con tu historial…";
  if (origen.tipo === "borrado") return `Volviendo a entrenar sin los datos de «${origen.persona}»…`;
  return "Se está entrenando el modelo con los últimos cambios…";
};

const textoListo = (origen: OrigenEntreno): string => {
  if (origen.tipo === "subida") return "¡Listo! Ya estás en el modelo.";
  if (origen.tipo === "borrado") return `Listo: el modelo ya no usa los datos de «${origen.persona}».`;
  return "Listo: el modelo está al día.";
};

type DatosSubidaProps = {
  subida: ResumenSubida;
};

const DatosSubida: FC<DatosSubidaProps> = ({ subida }) => {
  return (
    <dl className="grid grid-cols-3 gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <dt className="text-apagado">Ficheros</dt>
        <dd className="font-display text-xl font-bold text-acento tabular-nums">{subida.ficheros}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-apagado">Escuchas</dt>
        <dd className="font-display text-xl font-bold text-acento tabular-nums">
          {formatoNumero.format(subida.escuchas)}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-apagado">Desde – hasta</dt>
        <dd className="text-tinta-2">
          {fecha(subida.desde)} – {fecha(subida.hasta)}
        </dd>
      </div>
    </dl>
  );
};

const Progreso: FC = () => {
  return (
    <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-superficie-2">
      <div className="h-full w-1/3 animate-pulse rounded-full bg-acento" />
    </div>
  );
};

const Mensaje: FC<EstadoEntrenamientoProps> = ({ seguimiento }) => {
  if (seguimiento.fase === "inactiva") return null;
  if (seguimiento.fase === "entrenando") {
    return (
      <>
        <p className="font-display font-semibold">{textoEntrenando(seguimiento.origen)}</p>
        <Progreso />
        <p className="text-sm text-apagado">Tarda un par de minutos. Puedes dejar esta página abierta.</p>
      </>
    );
  }
  if (seguimiento.fase === "error") {
    return (
      <p role="alert" className="text-sm">
        El entrenamiento ha fallado: {seguimiento.mensaje}
      </p>
    );
  }
  return (
    <p className="font-display font-semibold">
      {textoListo(seguimiento.origen)}{" "}
      <Link href="/playlist" className="text-acento underline-offset-4 hover:underline">
        → Vuestra playlist
      </Link>
    </p>
  );
};

// Seguimiento del reentreno tras subir o borrar. Siempre está en el DOM para que el lector de pantalla lea los cambios.
export const EstadoEntrenamiento: FC<EstadoEntrenamientoProps> = ({ seguimiento }) => {
  const origen = seguimiento.fase === "inactiva" ? null : seguimiento.origen;
  return (
    <div role="status" aria-live="polite" className={seguimiento.fase === "inactiva" ? "sr-only" : undefined}>
      {seguimiento.fase !== "inactiva" && (
        <div className={tarjeta({ class: "flex flex-col gap-4 p-6" })}>
          {origen?.tipo === "subida" && <DatosSubida subida={origen.subida} />}
          <Mensaje seguimiento={seguimiento} />
        </div>
      )}
    </div>
  );
};
