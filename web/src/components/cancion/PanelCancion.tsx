"use client";

import { type FC, useId } from "react";

import { Filtros } from "@/components/playlist/Filtros";
import { SinDatos } from "@/components/playlist/PanelPlaylist";
import { boton, tarjeta } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { deQuienEs, type EstadoBusqueda, MIN_CARACTERES } from "@/hooks/useBuscarCanciones";
import { type EstadoConsulta, useCancion } from "@/hooks/useCancion";
import { cn } from "@/lib/cn";
import { duracionCancion, enlaceCancion, percentilVisible, porcentaje } from "@/lib/formato";
import { colorEnElModelo } from "@/lib/resumen";
import type { CancionCatalogo, GustoCancion, RespuestaCancion } from "@/lib/tipos";

const AVISO = "rounded-2xl border border-acento/60 bg-acento-suave/40 p-4 text-sm";

const assertNever = (valor: never): never => {
  throw new Error(`Estado no contemplado: ${JSON.stringify(valor)}`);
};

type ResultadosBusquedaProps = {
  busqueda: EstadoBusqueda;
  alElegir: (cancion: CancionCatalogo) => void;
};

const ResultadosBusqueda: FC<ResultadosBusquedaProps> = ({ busqueda, alElegir }) => {
  switch (busqueda.tipo) {
    case "corta":
      return <p className="text-xs text-apagado">Escribe al menos {MIN_CARACTERES} letras del título o del artista.</p>;
    case "buscando":
      return (
        <p role="status" className="text-sm text-tinta-2">
          Buscando…
        </p>
      );
    case "fallo":
      return (
        <p role="alert" className={AVISO}>
          {busqueda.mensaje}
        </p>
      );
    case "lista":
      if (busqueda.canciones.length === 0) {
        return <p className="text-sm text-tinta-2">Ninguna canción del grupo coincide. Solo salen las que alguien ha escuchado.</p>;
      }
      return (
        <ul aria-label="Canciones encontradas" className="flex max-h-80 flex-col overflow-y-auto rounded-2xl border border-linea">
          {busqueda.canciones.map((cancion) => {
            return (
              <li key={cancion.track_id} className="border-t border-linea first:border-t-0">
                <button
                  type="button"
                  onClick={() => alElegir(cancion)}
                  className="flex min-h-11 w-full items-baseline justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-superficie-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-tinta">{cancion.cancion}</span>
                    <span className="block truncate text-sm text-tinta-2">
                      {cancion.artista} <span className="text-apagado">· la escucha {deQuienEs(cancion)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-apagado tabular-nums">{duracionCancion(cancion.duracion_s)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      );
    default:
      return assertNever(busqueda);
  }
};

type ElegirCancionProps = {
  texto: string;
  alEscribir: (texto: string) => void;
  busqueda: EstadoBusqueda;
  elegida: CancionCatalogo | null;
  alElegir: (cancion: CancionCatalogo) => void;
  alCambiar: () => void;
};

const ElegirCancion: FC<ElegirCancionProps> = ({ texto, alEscribir, busqueda, elegida, alElegir, alCambiar }) => {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-titulo`} className={tarjeta({ class: "flex flex-col gap-5 p-6 sm:p-8" })}>
      <div className="flex flex-col gap-2">
        <Etiqueta>La canción</Etiqueta>
        <h2 id={`${id}-titulo`} className="font-display text-2xl font-bold tracking-tight">
          ¿Qué canción quieres poner?
        </h2>
      </div>
      {elegida === null ? (
        <div className="flex flex-col gap-3">
          <label htmlFor={`${id}-campo`} className="text-sm font-semibold text-tinta">
            Busca por título o artista
          </label>
          <input
            id={`${id}-campo`}
            type="search"
            autoComplete="off"
            value={texto}
            onChange={(evento) => alEscribir(evento.target.value)}
            placeholder="p. ej. El Bogueto"
            className="min-h-11 w-full rounded-2xl border border-linea-2 bg-fondo px-4 text-base text-tinta placeholder:text-apagado"
          />
          <ResultadosBusqueda busqueda={busqueda} alElegir={alElegir} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-linea-2 bg-fondo p-4">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-tinta">{elegida.cancion}</p>
            <p className="truncate text-tinta-2">
              {elegida.artista} <span className="text-apagado">· {duracionCancion(elegida.duracion_s)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={enlaceCancion(elegida.track_id)}
              target="_blank"
              rel="noreferrer"
              className={boton({ intencion: "secundario", class: "min-h-10 px-4" })}
            >
              Escuchar
            </a>
            <button type="button" onClick={alCambiar} className={boton({ intencion: "secundario", class: "min-h-10 px-4" })}>
              Cambiar de canción
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

const textoDia = (tipoDia: string): string => {
  if (tipoDia === "laborable") return "laborable";
  if (tipoDia === "fin_semana") return "fin de semana";
  return "cualquier día";
};

const contexto = (r: RespuestaCancion): string => {
  if (r.franja === null) return "Sin importar la hora ni el día";
  return `${r.franja_horas} · ${textoDia(r.tipo_dia)}`;
};

const veredicto = (r: RespuestaCancion): { titulo: string; detalle: string } => {
  if (r.cancion_excluida) {
    return { titulo: "No entraría", detalle: "Has quitado esta canción en los filtros." };
  }
  if (r.artista_excluido) {
    return { titulo: "No entraría", detalle: "Has quitado a su artista en los filtros." };
  }
  if (r.entra) {
    return {
      titulo: "Sí, entraría",
      detalle: `Quedaría en el puesto ${r.posicion ?? "?"} de ${r.n_canciones_playlist}.`,
    };
  }
  const faltan = r.posicion === null ? null : r.posicion - r.n_canciones_playlist;
  return {
    titulo: "No entraría",
    detalle: `Quedaría en el puesto ${r.posicion ?? "?"} y la playlist tiene ${r.n_canciones_playlist}${
      faltan === null ? "" : `: se queda a ${faltan} ${faltan === 1 ? "puesto" : "puestos"}`
    }. Prueba con una lista más larga u otro momento del día.`,
  };
};

const textoOrigen = (gusto: GustoCancion): string => {
  if (gusto.origen === "real") return `real · ${gusto.escuchas} escuchas`;
  if (gusto.escuchas > 0) return `previsto por el modelo · solo ${gusto.escuchas} escuchas`;
  return "previsto por el modelo · no la ha escuchado";
};

type TasaPersonaProps = {
  persona: string;
  gusto: GustoCancion;
  color: string;
};

const TasaPersona: FC<TasaPersonaProps> = ({ persona, gusto, color }) => {
  const ancho = `${Math.round(gusto.tasa_no_salto * 100)}%`;
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-linea p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold text-tinta">
          <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
          {persona}
        </span>
        <span className="font-display text-2xl font-bold text-tinta tabular-nums">{porcentaje(gusto.tasa_no_salto)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-superficie-2">
        <div
          className="h-full rounded-full"
          style={
            gusto.origen === "real"
              ? { width: ancho, backgroundColor: color }
              : {
                  width: ancho,
                  backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 5px)`,
                  boxShadow: `inset 0 0 0 1px ${color}`,
                }
          }
        />
      </div>
      <p className="text-xs text-apagado">
        {textoOrigen(gusto)} · percentil {percentilVisible(gusto.percentil)}
      </p>
    </li>
  );
};

type RespuestaProps = {
  respuesta: RespuestaCancion;
  personasModelo: string[];
};

const Respuesta: FC<RespuestaProps> = ({ respuesta, personasModelo }) => {
  const { titulo, detalle } = veredicto(respuesta);
  return (
    <section aria-labelledby="titulo-respuesta" className="flex animate-aparecer flex-col gap-6">
      <div
        className={cn(
          "flex flex-col gap-2 rounded-3xl border-2 p-6 sm:p-8",
          respuesta.entra ? "border-exito/70 bg-exito/10" : "border-acento/70 bg-acento-suave/30",
        )}
      >
        <p className="text-sm text-tinta-2">
          {respuesta.cancion} · {respuesta.artista}
        </p>
        <h2
          id="titulo-respuesta"
          className={cn(
            "font-display text-4xl font-bold tracking-titular sm:text-5xl",
            respuesta.entra ? "text-exito" : "text-acento",
          )}
        >
          {titulo}
        </h2>
        <p className="text-lg text-tinta">{detalle}</p>
        <p className="text-sm text-tinta-2">
          {respuesta.personas.join(", ")} · {contexto(respuesta)} · {respuesta.n_candidatas.toLocaleString("es-ES")}{" "}
          canciones candidatas
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-xl font-bold">¿Cuántas veces la escucharía cada uno sin saltarla?</h3>
        <p className="max-w-2xl text-sm text-tinta-2">
          Es la tasa de no salto del objetivo 1: la real si esa persona la ha escuchado 3 o más veces (5 si eliges un momento concreto),
          y si no, la que predice el modelo (barra rayada). El percentil la compara con el resto de sus canciones.
        </p>
        <ul aria-label="Tasa de no salto de cada uno" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {respuesta.personas.map((persona) => {
            const gusto = respuesta.miembros[persona];
            if (gusto === undefined) return null;
            return (
              <TasaPersona key={persona} persona={persona} gusto={gusto} color={colorEnElModelo(personasModelo, persona)} />
            );
          })}
        </ul>
      </div>
    </section>
  );
};

type ZonaRespuestaProps = {
  consulta: EstadoConsulta;
  personasModelo: string[];
};

const ZonaRespuesta: FC<ZonaRespuestaProps> = ({ consulta, personasModelo }) => {
  switch (consulta.tipo) {
    case "sin_consultar":
      return <p className="text-tinta-2">Elige una canción y pulsa «Comprobar».</p>;
    case "consultando":
      return (
        <p role="status" className="text-tinta-2">
          Comprobando…
        </p>
      );
    case "fallo":
      return (
        <div role="alert" className={AVISO}>
          <p className="font-semibold">{consulta.mensaje}</p>
          {consulta.detalle.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-tinta-2">
              {consulta.detalle.map((linea) => {
                return <li key={linea}>{linea}</li>;
              })}
            </ul>
          )}
        </div>
      );
    case "respondida":
      return <Respuesta key={consulta.vez} respuesta={consulta.respuesta} personasModelo={personasModelo} />;
    default:
      return assertNever(consulta);
  }
};

export const PanelCancion: FC = () => {
  const estado = useCancion();
  const { carga, consulta } = estado;
  if (carga.tipo !== "listo") return <SinDatos carga={carga} />;

  return (
    <div className="flex flex-col gap-10">
      <ElegirCancion
        texto={estado.texto}
        alEscribir={estado.setTexto}
        busqueda={estado.busqueda}
        elegida={estado.elegida}
        alElegir={estado.elegir}
        alCambiar={estado.cambiarCancion}
      />
      <Filtros
        filtros={estado.filtros}
        acciones={estado.acciones}
        personas={carga.personas}
        artistas={carga.artistas}
        titulo="¿Con quién y para qué playlist?"
        accion={{
          texto: "Comprobar",
          textoOcupado: "Comprobando…",
          ayuda:
            estado.elegida === null
              ? "Primero elige una canción."
              : "Son los mismos filtros que en «Vuestra playlist».",
          ocupado: consulta.tipo === "consultando",
          desactivada: estado.elegida === null,
          alPulsar: () => void estado.comprobar(),
        }}
      />
      <ZonaRespuesta consulta={consulta} personasModelo={carga.personas} />
    </div>
  );
};
