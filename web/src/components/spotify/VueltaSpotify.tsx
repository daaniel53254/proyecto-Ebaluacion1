"use client";

import type { FC } from "react";

import { AvisoCopia } from "@/components/playlist/AvisoCopia";
import { EnlaceBoton } from "@/components/ui/EnlaceBoton";
import { boton, tarjeta } from "@/components/ui/estilos";
import { useCopiarEnlaces } from "@/hooks/useCopiarEnlaces";
import { type EstadoVuelta, useVueltaSpotify } from "@/hooks/useVueltaSpotify";

const MENSAJE_CANCELADO = "Has cancelado el login de Spotify.";
const MENSAJE_SIN_PLAYLIST = "No se encontró la playlist que querías exportar. Vuelve a generarla.";

const assertNever = (valor: never): never => {
  throw new Error(`Estado no contemplado: ${JSON.stringify(valor)}`);
};

type VolverProps = {
  // El único principal de la pantalla es «Abrir en Spotify»; si no lo hay, lo es volver.
  principal: boolean;
};

const Volver: FC<VolverProps> = ({ principal }) => {
  return (
    <EnlaceBoton href="/playlist" intencion={principal ? "principal" : "secundario"}>
      Volver a la playlist
    </EnlaceBoton>
  );
};

type AvisoProps = {
  titulo: string;
  texto: string;
};

const Aviso: FC<AvisoProps> = ({ titulo, texto }) => {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-lg font-bold">{titulo}</p>
      <p className="text-tinta-2">{texto}</p>
      <div className="flex flex-wrap gap-3">
        <Volver principal />
      </div>
    </div>
  );
};

type FalloProps = {
  mensaje: string;
  trackIds: string[];
};

const Fallo: FC<FalloProps> = ({ mensaje, trackIds }) => {
  const { estado, copiar } = useCopiarEnlaces(trackIds);
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-lg font-bold">No se pudo crear la playlist</p>
      <p role="alert" className="text-tinta-2">
        {mensaje}
      </p>
      <div className="flex flex-wrap gap-3">
        <Volver principal />
        {trackIds.length > 0 && (
          <button type="button" onClick={() => void copiar()} className={boton({ intencion: "secundario" })}>
            Copiar enlaces
          </button>
        )}
      </div>
      <div aria-live="polite">
        <AvisoCopia estado={estado} />
      </div>
    </div>
  );
};

type CreadaProps = {
  nombre: string;
  url: string;
};

const Creada: FC<CreadaProps> = ({ nombre, url }) => {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-lg font-bold text-exito">Playlist creada</p>
      <p className="text-tinta-2">
        «{nombre}» ya está en tu cuenta de Spotify, como playlist privada.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className={boton({ intencion: "principal" })}>
          Abrir en Spotify
        </a>
        <Volver principal={false} />
      </div>
    </div>
  );
};

type ContenidoProps = {
  estado: EstadoVuelta;
};

const Contenido: FC<ContenidoProps> = ({ estado }) => {
  switch (estado.tipo) {
    case "creando":
      return (
        <div className="flex flex-col gap-3">
          <p className="font-display text-lg font-bold">Creando la playlist…</p>
          <p className="text-tinta-2">Un momento: se está guardando en tu cuenta de Spotify.</p>
          <div className="flex flex-wrap gap-3">
            <Volver principal={false} />
          </div>
        </div>
      );
    case "cancelado":
      return <Aviso titulo="No se ha creado nada" texto={MENSAJE_CANCELADO} />;
    case "sin_playlist":
      return <Aviso titulo="No hay nada que crear" texto={MENSAJE_SIN_PLAYLIST} />;
    case "fallo":
      return <Fallo mensaje={estado.mensaje} trackIds={estado.trackIds} />;
    case "creada":
      return <Creada nombre={estado.nombre} url={estado.url} />;
    default:
      return assertNever(estado);
  }
};

// Vuelta del login de Spotify: siempre enseña algo (nunca una pantalla en blanco) y un enlace para volver.
export const VueltaSpotify: FC = () => {
  const estado = useVueltaSpotify();
  return (
    <div aria-live="polite" className={tarjeta({ class: "flex flex-col gap-4 p-6 sm:p-8" })}>
      <Contenido estado={estado} />
    </div>
  );
};
