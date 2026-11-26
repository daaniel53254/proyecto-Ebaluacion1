"use client";

import type { FC } from "react";

import { NovedadCancion } from "@/components/cancion/NovedadCancion";
import { QuienViaja } from "@/components/playlist/Filtros";
import { SinDatos } from "@/components/playlist/PanelPlaylist";
import { tarjeta } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { useFiltrosGrupo } from "@/hooks/useFiltrosGrupo";

// Paso 4: se escribe cualquier canción y se pregunta si entraría para las personas elegidas.
export const PanelCancion: FC = () => {
  const { carga, filtros, acciones } = useFiltrosGrupo();
  if (carga.tipo !== "listo") return <SinDatos carga={carga} />;

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="Quién viaja" className={tarjeta({ class: "flex flex-col gap-5 p-6 sm:p-8" })}>
        <Etiqueta>El grupo</Etiqueta>
        <QuienViaja personas={carga.personas} elegidas={filtros.personas} alAlternar={acciones.alternarPersona} />
      </section>
      <NovedadCancion personas={filtros.personas} />
    </div>
  );
};
