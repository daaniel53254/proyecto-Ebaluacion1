"use client";

import { type FC, useId } from "react";

import { boton, tarjeta } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { type EstadoNovedad, useNovedad } from "@/hooks/useNovedad";
import { cn } from "@/lib/cn";
import { percentilVisible, porcentaje } from "@/lib/formato";

const CAMPO = "min-h-11 w-full rounded-2xl border border-linea-2 bg-fondo px-4 text-base text-tinta placeholder:text-apagado";

const assertNever = (valor: never): never => {
  throw new Error(`Estado no contemplado: ${JSON.stringify(valor)}`);
};

type ResultadoProps = { estado: EstadoNovedad };

const Resultado: FC<ResultadoProps> = ({ estado }) => {
  switch (estado.tipo) {
    case "sin_consultar":
      return <p className="text-tinta-2">Escribe el artista (y el álbum, si lo sabes) y pulsa «¿Entraría?».</p>;
    case "consultando":
      return (
        <p role="status" className="text-tinta-2">
          Comprobando…
        </p>
      );
    case "fallo":
      return (
        <div role="alert" className="rounded-2xl border border-acento/60 bg-acento-suave/40 p-4 text-sm">
          <p className="font-semibold">{estado.mensaje}</p>
          {estado.detalle.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-tinta-2">
              {estado.detalle.map((linea) => {
                return <li key={linea}>{linea}</li>;
              })}
            </ul>
          )}
        </div>
      );
    case "respondida": {
      const { resultado, umbral } = estado;
      return (
        <div className="flex animate-aparecer flex-col gap-4">
          <div
            className={cn(
              "flex flex-col gap-1 rounded-2xl border-2 p-5",
              resultado.entra ? "border-exito/70 bg-exito/10" : "border-acento/70 bg-acento-suave/30",
            )}
          >
            <p className="text-sm text-tinta-2">
              {resultado.cancion ?? "Canción sin título"} · {resultado.artista}
            </p>
            <p className={cn("font-display text-3xl font-bold", resultado.entra ? "text-exito" : "text-acento")}>
              {resultado.entra ? "Sí entraría" : "No entraría"}
            </p>
            <p className="text-tinta">{resultado.motivo}</p>
            <p className="text-sm text-tinta-2">Entra si todos están en el percentil {percentilVisible(umbral)} o más.</p>
          </div>
          <ul aria-label="Gusto previsto de cada uno" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(resultado.miembros).map(([persona, gusto]) => {
              return (
                <li key={persona} className="flex flex-col gap-1 rounded-2xl border border-linea p-4">
                  <span className="font-semibold text-tinta">{persona}</span>
                  <span className="font-display text-2xl font-bold tabular-nums">
                    percentil {percentilVisible(gusto.percentil)}
                  </span>
                  <span className="text-sm text-tinta-2">
                    Probabilidad de que la adopte: {porcentaje(gusto.probabilidad_adopcion)} · ha escuchado al artista{" "}
                    {gusto.escuchas_artista.toLocaleString("es-ES")} veces
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    default:
      return assertNever(estado);
  }
};

type NovedadCancionProps = { personas: string[] };

export const NovedadCancion: FC<NovedadCancionProps> = ({ personas }) => {
  const id = useId();
  const { artista, setArtista, album, setAlbum, cancion, setCancion, estado, comprobar } = useNovedad(personas);
  return (
    <section aria-labelledby={`${id}-titulo`} className={tarjeta({ class: "flex flex-col gap-5 p-6 sm:p-8" })}>
      <div className="flex flex-col gap-2">
        <Etiqueta>Una canción nueva</Etiqueta>
        <h2 id={`${id}-titulo`} className="font-display text-2xl font-bold tracking-tight">
          ¿Y una canción que nadie ha escuchado?
        </h2>
        <p className="max-w-2xl text-sm text-tinta-2">
          Escribe una canción (aunque nadie del grupo la tenga) y el modelo dice si entraría para {personas.join(", ")},
          sin mirar el horario.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-tinta">
          Artista
          <input
            className={CAMPO}
            value={artista}
            onChange={(e) => setArtista(e.target.value)}
            placeholder="p. ej. Rosalía"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-tinta">
          Álbum (opcional)
          <input
            className={CAMPO}
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
            placeholder="p. ej. LUX"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-tinta">
          Título (opcional)
          <input
            className={CAMPO}
            value={cancion}
            onChange={(e) => setCancion(e.target.value)}
            placeholder="p. ej. Berghain"
            autoComplete="off"
          />
        </label>
      </div>
      <div>
        <button
          type="button"
          onClick={() => void comprobar()}
          disabled={artista.trim() === "" || estado.tipo === "consultando"}
          className={boton({ intencion: "principal", class: "min-h-11 px-6" })}
        >
          ¿Entraría?
        </button>
      </div>
      <Resultado estado={estado} />
    </section>
  );
};
