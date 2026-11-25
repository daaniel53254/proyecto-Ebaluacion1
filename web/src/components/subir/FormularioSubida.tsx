"use client";

import type { FC, FormEvent } from "react";

import { ResumenArchivos } from "@/components/subir/ResumenArchivos";
import { ZonaArchivos } from "@/components/subir/ZonaArchivos";
import { boton, tarjeta } from "@/components/ui/estilos";
import { type TokenNuevo, useFormularioSubida } from "@/hooks/useFormularioSubida";
import type { Historial, RespuestaSubida } from "@/lib/tipos";

type FormularioSubidaProps = {
  historiales: Historial[];
  alSubir: (respuesta: RespuestaSubida) => void;
};

const TEXTO_CONSENTIMIENTO = "Acepto que se use mi historial para generar las playlists del grupo.";
const TEXTO_EDAD = "Tengo 16 años o más.";

type CasillaProps = {
  texto: string;
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
};

const Casilla: FC<CasillaProps> = ({ texto, marcada, alCambiar }) => {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-tinta-2">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(evento) => alCambiar(evento.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-acento-relleno"
      />
      <span>{texto}</span>
    </label>
  );
};

type CampoTokenProps = {
  persona: string;
  valor: string;
  alCambiar: (valor: string) => void;
};

// Solo aparece al sustituir un historial cuyo token no está guardado en este navegador.
const CampoToken: FC<CampoTokenProps> = ({ persona, valor, alCambiar }) => {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="token-subida" className="font-display font-semibold">
        Token de «{persona}»
      </label>
      <input
        id="token-subida"
        name="token"
        autoComplete="off"
        spellCheck={false}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        aria-describedby="ayuda-token-subida"
        className="min-h-11 rounded-xl border border-linea-2 bg-fondo px-4 font-mono text-tinta"
      />
      <p id="ayuda-token-subida" className="text-sm text-apagado">
        El que te dio la web la primera vez que subiste tu historial.
      </p>
    </div>
  );
};

type AvisoTokenProps = {
  tokenNuevo: TokenNuevo;
};

const AvisoToken: FC<AvisoTokenProps> = ({ tokenNuevo }) => {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-2xl border border-exito/60 p-4 text-sm">
      <p className="font-semibold text-tinta">Guarda tu token, «{tokenNuevo.persona}»</p>
      <p className="text-tinta-2">
        Solo se enseña ahora. Este navegador lo recuerda, pero desde otro te lo pedirá para borrar o sustituir tu
        historial.
      </p>
      <code className="select-all break-all rounded-xl bg-fondo px-3 py-2 font-mono text-tinta">{tokenNuevo.token}</code>
    </div>
  );
};

type AyudaNombreProps = {
  nombre: string;
  persona: string | null;
  yaExiste: boolean;
};

const AyudaNombre: FC<AyudaNombreProps> = ({ nombre, persona, yaExiste }) => {
  if (nombre.trim() === "") {
    return (
      <p id="ayuda-nombre" className="text-sm text-apagado">
        Lo que aparecerá en el grupo.
      </p>
    );
  }
  if (persona === null) {
    return (
      <p id="ayuda-nombre" className="text-sm text-acento">
        De 2 a 30 caracteres: letras sin tilde ni ñ, números, «_» o «-».
      </p>
    );
  }
  if (yaExiste) {
    return (
      <p id="ayuda-nombre" className="text-sm text-acento">
        Ya hay un historial de «{persona}»: se sustituirá
      </p>
    );
  }
  return (
    <p id="ayuda-nombre" className="text-sm text-apagado">
      Aparecerás como «{persona}».
    </p>
  );
};

export const FormularioSubida: FC<FormularioSubidaProps> = ({ historiales, alSubir }) => {
  const formulario = useFormularioSubida({ historiales, alSubir });
  const { nombre, persona, yaExiste, archivos, envio } = formulario;

  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    void formulario.enviar();
  };

  return (
    <form onSubmit={alEnviar} noValidate className={tarjeta({ class: "flex flex-col gap-6 p-6 sm:p-8" })}>
      <div className="flex flex-col gap-2">
        <label htmlFor="nombre" className="font-display font-semibold">
          Tu nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          autoComplete="nickname"
          spellCheck={false}
          value={nombre}
          onChange={(evento) => formulario.setNombre(evento.target.value)}
          aria-describedby="ayuda-nombre"
          aria-invalid={nombre.trim() !== "" && persona === null}
          placeholder="p. ej. aitor"
          className="min-h-11 rounded-xl border border-linea-2 bg-fondo px-4 text-tinta placeholder:text-apagado"
        />
        <AyudaNombre nombre={nombre} persona={persona} yaExiste={yaExiste} />
      </div>

      <div className="flex flex-col gap-3">
        <ZonaArchivos
          alElegir={(elegidos) => void formulario.elegirArchivos(elegidos)}
          desactivada={formulario.enviando}
        />
        <ResumenArchivos archivos={archivos} />
      </div>

      {formulario.pideToken && persona !== null && (
        <CampoToken persona={persona} valor={formulario.tokenEscrito} alCambiar={formulario.setTokenEscrito} />
      )}

      <div className="flex flex-col gap-3">
        <Casilla texto={TEXTO_EDAD} marcada={formulario.mayorDe16} alCambiar={formulario.setMayorDe16} />
        <Casilla
          texto={TEXTO_CONSENTIMIENTO}
          marcada={formulario.consentimiento}
          alCambiar={formulario.setConsentimiento}
        />
      </div>

      {formulario.tokenNuevo !== null && <AvisoToken tokenNuevo={formulario.tokenNuevo} />}

      {envio.tipo === "error" && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-acento/60 bg-acento-suave/40 p-4 text-sm">
          <p>{envio.mensaje}</p>
          {envio.detalle.length > 0 && (
            <ul className="flex flex-col gap-1 text-tinta-2">
              {envio.detalle.map((linea, posicion) => {
                return <li key={`${posicion}-${linea}`}>{linea}</li>;
              })}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!formulario.puedeSubir}
        className={boton({
          class: "self-start disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        })}
      >
        {formulario.enviando ? "Subiendo…" : "Subir"}
      </button>
    </form>
  );
};
