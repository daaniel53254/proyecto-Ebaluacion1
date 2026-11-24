"use client";

import type { FC, FormEvent } from "react";

import { ResumenArchivos } from "@/components/subir/ResumenArchivos";
import { ZonaArchivos } from "@/components/subir/ZonaArchivos";
import { boton, tarjeta } from "@/components/ui/estilos";
import { useFormularioSubida } from "@/hooks/useFormularioSubida";
import type { Historial, RespuestaSubida } from "@/lib/tipos";

type FormularioSubidaProps = {
  historiales: Historial[];
  ocupado: boolean;
  alSubir: (respuesta: RespuestaSubida) => void;
};

const TEXTO_CONSENTIMIENTO = "Acepto que se use mi historial para generar las playlists del grupo.";

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

export const FormularioSubida: FC<FormularioSubidaProps> = ({ historiales, ocupado, alSubir }) => {
  const formulario = useFormularioSubida({ historiales, ocupado, alSubir });
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

      <label className="flex cursor-pointer items-start gap-3 text-sm text-tinta-2">
        <input
          type="checkbox"
          checked={formulario.consentimiento}
          onChange={(evento) => formulario.setConsentimiento(evento.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-acento-relleno"
        />
        <span>{TEXTO_CONSENTIMIENTO}</span>
      </label>

      {envio.tipo === "error" && (
        <p role="alert" className="rounded-2xl border border-acento/60 bg-acento-suave/40 p-4 text-sm">
          {envio.mensaje}
        </p>
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
