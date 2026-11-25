"use client";

import { type FC, useState } from "react";

import { boton, tarjeta } from "@/components/ui/estilos";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { cn } from "@/lib/cn";
import type { Historial } from "@/lib/tipos";
import { leerToken } from "@/lib/tokens";

type ListaPersonasProps = {
  historiales: Historial[];
  cargando: boolean;
  error: string | null;
  entrenando: boolean;
  borrando: string | null;
  alBorrar: (persona: string, token: string | null) => void;
};

const TEXTO_CONFIRMACION = "Se borra tu historial y se vuelve a entrenar sin él. No se puede deshacer.";

const textoEstado = (historial: Historial, entrenando: boolean): string => {
  if (historial.en_el_modelo) return "en el modelo";
  return entrenando ? "entrenando…" : "fuera del modelo";
};

type FilaPersonaProps = {
  historial: Historial;
  entrenando: boolean;
  borrando: boolean;
  confirmando: boolean;
  alPedirBorrado: () => void;
  alCancelar: () => void;
  alConfirmar: (token: string | null) => void;
};

const FilaPersona: FC<FilaPersonaProps> = (props) => {
  const { historial, entrenando, borrando, confirmando } = props;
  const idConfirmacion = `confirmar-${historial.persona}`;
  const idToken = `token-${historial.persona}`;
  const [tokenEscrito, setTokenEscrito] = useState("");
  // Sin token en este navegador hay que pegarlo: la API no deja borrar sin él.
  const tokenGuardado = confirmando ? leerToken(historial.persona) : null;
  const token = tokenGuardado ?? (tokenEscrito.trim() || null);
  return (
    <li className="flex flex-col gap-3 border-t border-linea py-4 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-display font-semibold">{historial.persona}</span>
          <span className="text-sm text-apagado">
            {historial.ficheros} {historial.ficheros === 1 ? "fichero" : "ficheros"} ·{" "}
            <span className={cn(historial.en_el_modelo && "text-exito")}>{textoEstado(historial, entrenando)}</span>
          </span>
        </div>
        {!confirmando && (
          <button
            type="button"
            onClick={props.alPedirBorrado}
            disabled={borrando}
            className={boton({ intencion: "secundario", class: "min-h-10 px-4 disabled:opacity-50" })}
          >
            {borrando ? "Borrando…" : "Borrar mis datos"}
          </button>
        )}
      </div>
      {confirmando && (
        <div
          role="alertdialog"
          aria-labelledby={idConfirmacion}
          className="flex flex-col gap-3 rounded-2xl border border-acento/60 bg-acento-suave/40 p-4"
        >
          <p id={idConfirmacion} className="text-sm">
            {TEXTO_CONFIRMACION}
          </p>
          {tokenGuardado === null && (
            <div className="flex flex-col gap-2">
              <label htmlFor={idToken} className="text-sm font-semibold">
                Token de «{historial.persona}»
              </label>
              <input
                id={idToken}
                autoComplete="off"
                spellCheck={false}
                value={tokenEscrito}
                onChange={(evento) => setTokenEscrito(evento.target.value)}
                className="min-h-10 rounded-xl border border-linea-2 bg-fondo px-3 font-mono text-sm text-tinta"
              />
              <p className="text-xs text-apagado">El que te dio la web al subir tu historial.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => props.alConfirmar(token)}
              disabled={token === null}
              className={boton({ intencion: "secundario", class: "min-h-10 border-acento px-4 disabled:opacity-50" })}
            >
              Sí, borrar a «{historial.persona}»
            </button>
            <button
              type="button"
              onClick={props.alCancelar}
              autoFocus
              className={boton({ intencion: "secundario", class: "min-h-10 px-4" })}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

type ContenidoProps = Omit<ListaPersonasProps, "error">;

const Contenido: FC<ContenidoProps> = ({ historiales, cargando, entrenando, borrando, alBorrar }) => {
  const [confirmando, setConfirmando] = useState<string | null>(null);

  if (cargando) return <p className="text-sm text-apagado">Cargando…</p>;
  if (historiales.length === 0) return <p className="text-sm text-apagado">Todavía no ha subido nadie su historial.</p>;

  return (
    <ul>
      {historiales.map((historial) => {
        return (
          <FilaPersona
            key={historial.persona}
            historial={historial}
            entrenando={entrenando}
            borrando={borrando === historial.persona}
            confirmando={confirmando === historial.persona}
            alPedirBorrado={() => setConfirmando(historial.persona)}
            alCancelar={() => setConfirmando(null)}
            alConfirmar={(token) => {
              setConfirmando(null);
              alBorrar(historial.persona, token);
            }}
          />
        );
      })}
    </ul>
  );
};

// Quién ha subido ya su historial, si está en el modelo y el botón para borrar sus datos (con confirmación).
export const ListaPersonas: FC<ListaPersonasProps> = ({ error, ...resto }) => {
  return (
    <section aria-labelledby="quien-esta" className={tarjeta({ class: "flex flex-col gap-4 p-6" })}>
      <Etiqueta>Quién está ya</Etiqueta>
      <h2 id="quien-esta" className="sr-only">
        Quién está ya
      </h2>
      {error !== null && (
        <p role="alert" className="rounded-2xl border border-acento/60 bg-acento-suave/40 p-4 text-sm">
          {error}
        </p>
      )}
      <Contenido {...resto} />
    </section>
  );
};
