"use client";

import type { FC } from "react";

import { boton } from "@/components/ui/estilos";
import { type EstadoBotonSpotify, useBotonSpotify } from "@/hooks/useBotonSpotify";
import type { Playlist } from "@/lib/tipos";

type BotonSpotifyProps = {
  playlist: Playlist;
};

const SIN_ALMACENAMIENTO =
  "«Crear en mi Spotify» no funciona en este navegador (¿ventana privada?): no deja guardar datos de la pestaña. Usa «Copiar enlaces».";

const assertNever = (valor: never): never => {
  throw new Error(`Estado no contemplado: ${JSON.stringify(valor)}`);
};

const avisoDe = (estado: EstadoBotonSpotify): string | null => {
  switch (estado.tipo) {
    case "listo":
    case "redirigiendo":
      return null;
    case "sin_almacenamiento":
      return SIN_ALMACENAMIENTO;
    case "fallo":
      return estado.mensaje;
    default:
      return assertNever(estado);
  }
};

// Secundario: en la pantalla de la playlist el principal es «Generar playlist».
export const BotonSpotify: FC<BotonSpotifyProps> = ({ playlist }) => {
  const { estado, crear } = useBotonSpotify(playlist);
  const aviso = avisoDe(estado);
  const desactivado = estado.tipo === "redirigiendo" || estado.tipo === "sin_almacenamiento";
  return (
    <>
      <button
        type="button"
        onClick={() => void crear()}
        disabled={desactivado}
        className={boton({ intencion: "secundario", class: "disabled:cursor-not-allowed disabled:opacity-50" })}
      >
        {estado.tipo === "redirigiendo" ? "Abriendo Spotify…" : "Crear en mi Spotify"}
      </button>
      {aviso !== null && (
        <p role="alert" className="basis-full text-sm text-tinta-2">
          {aviso}
        </p>
      )}
    </>
  );
};
