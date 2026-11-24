"use client";

import { useEffect, useRef, useState } from "react";

import { borrarPendiente, leerPendiente, type ResultadoVuelta, terminarExportacion } from "@/lib/spotify";

export type EstadoVuelta = { tipo: "creando" } | ResultadoVuelta;

const MENSAJE_INESPERADO = "Algo falló al crear la playlist. Vuelve a la playlist e inténtalo otra vez.";

// Lee lo que dejó la ida al login, lo borra de sessionStorage y quita el código de la URL antes de cambiarlo por el
// token. El código solo se puede usar una vez: el ref evita que StrictMode (que repite el efecto en desarrollo) lo
// cambie dos veces; la segunda pasada ya no encontraría lo pendiente.
export const useVueltaSpotify = (): EstadoVuelta => {
  const [estado, setEstado] = useState<EstadoVuelta>({ tipo: "creando" });
  const empezado = useRef(false);

  useEffect(() => {
    if (empezado.current) return;
    empezado.current = true;

    const parametros = new URLSearchParams(window.location.search);
    const pendiente = leerPendiente();
    borrarPendiente();
    window.history.replaceState(null, "", window.location.pathname);

    terminarExportacion({ parametros, pendiente })
      .then(setEstado)
      .catch(() => setEstado({ tipo: "fallo", mensaje: MENSAJE_INESPERADO, trackIds: pendiente?.trackIds ?? [] }));
  }, []);

  return estado;
};
