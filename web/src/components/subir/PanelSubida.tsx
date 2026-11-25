"use client";

import type { FC } from "react";

import { EstadoEntrenamiento } from "@/components/subir/EstadoEntrenamiento";
import { FormularioSubida } from "@/components/subir/FormularioSubida";
import { ListaPersonas } from "@/components/subir/ListaPersonas";
import { useHistoriales } from "@/hooks/useHistoriales";
import { usePreparacion } from "@/hooks/usePreparacion";
import type { RespuestaSubida } from "@/lib/tipos";

// Une el formulario, el seguimiento del reentreno y la lista: la lista se recarga al subir, al borrar
// y cuando termina la preparación.
export const PanelSubida: FC = () => {
  const lista = useHistoriales();
  const { recargar } = lista;
  const { seguimiento, seguir } = usePreparacion(() => void recargar());
  const entrenando = seguimiento.fase === "entrenando";

  const alSubir = (respuesta: RespuestaSubida) => {
    void recargar();
    void seguir(respuesta.preparacion, { tipo: "subida", subida: respuesta.historial });
  };

  const alBorrar = async (persona: string, token: string | null) => {
    const preparacion = await lista.borrar(persona, token);
    if (preparacion !== null) void seguir(preparacion, { tipo: "borrado", persona });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
      <div className="lg:col-span-7">
        <FormularioSubida historiales={lista.historiales} alSubir={alSubir} />
      </div>
      <div className="flex flex-col gap-6 lg:col-span-5">
        <EstadoEntrenamiento seguimiento={seguimiento} />
        <ListaPersonas
          historiales={lista.historiales}
          cargando={lista.cargando}
          error={lista.error}
          entrenando={entrenando}
          borrando={lista.borrando}
          alBorrar={(persona, token) => void alBorrar(persona, token)}
        />
      </div>
    </div>
  );
};
