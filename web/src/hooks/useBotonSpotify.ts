"use client";

import { useEffect, useState } from "react";

import {
  DESCRIPCION_PLAYLIST,
  ErrorSpotify,
  hayAlmacenamiento,
  iniciarExportacion,
  nombrePlaylist,
  origenValido,
} from "@/lib/spotify";
import type { Playlist } from "@/lib/tipos";

export type EstadoBotonSpotify =
  | { tipo: "listo" }
  | { tipo: "redirigiendo" }
  | { tipo: "sin_almacenamiento" }
  | { tipo: "otro_origen" }
  | { tipo: "fallo"; mensaje: string };

const MENSAJE_FALLO = "No se pudo abrir el login de Spotify. Usa «Copiar enlaces».";

export const useBotonSpotify = (playlist: Playlist) => {
  const [estado, setEstado] = useState<EstadoBotonSpotify>({ tipo: "listo" });

  // Se comprueba al montar (no al renderizar en el servidor, donde no hay sessionStorage).
  useEffect(() => {
    if (!origenValido(window.location.origin)) {
      setEstado({ tipo: "otro_origen" });
      return;
    }
    if (!hayAlmacenamiento()) setEstado({ tipo: "sin_almacenamiento" });
  }, []);

  // Si se vuelve atrás desde Spotify, el navegador puede restaurar la página tal cual: el botón vuelve a valer.
  useEffect(() => {
    const alVolver = (evento: PageTransitionEvent) => {
      if (evento.persisted) setEstado((actual) => (actual.tipo === "redirigiendo" ? { tipo: "listo" } : actual));
    };
    window.addEventListener("pageshow", alVolver);
    return () => window.removeEventListener("pageshow", alVolver);
  }, []);

  const crear = async () => {
    setEstado({ tipo: "redirigiendo" });
    try {
      await iniciarExportacion({
        nombre: nombrePlaylist(playlist.personas, new Date()),
        descripcion: DESCRIPCION_PLAYLIST,
        trackIds: playlist.canciones.map((c) => c.track_id),
      });
    } catch (fallo: unknown) {
      setEstado({ tipo: "fallo", mensaje: fallo instanceof ErrorSpotify ? fallo.message : MENSAJE_FALLO });
    }
  };

  return { estado, crear };
};
