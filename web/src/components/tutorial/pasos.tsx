import type { FC, ReactNode } from "react";

import { Correo } from "@/components/tutorial/dibujos/Correo";
import { Descargar } from "@/components/tutorial/dibujos/Descargar";
import { Marcar } from "@/components/tutorial/dibujos/Marcar";
import { Privacidad } from "@/components/tutorial/dibujos/Privacidad";
import { Solicitar } from "@/components/tutorial/dibujos/Solicitar";
import type { PasoTutorial } from "@/components/tutorial/Paso";

export const URL_PRIVACIDAD = "https://www.spotify.com/es/account/privacy/";

type FuerteProps = {
  children: ReactNode;
};

const Fuerte: FC<FuerteProps> = ({ children }) => {
  return <strong className="font-semibold text-tinta">{children}</strong>;
};

export const PASOS_TUTORIAL = [
  {
    numero: 1,
    titulo: "Abre la privacidad de tu cuenta",
    texto: (
      <p>
        Entra en spotify.com con tu cuenta y ve a Cuenta → Privacidad. O ve directo:{" "}
        <a
          href={URL_PRIVACIDAD}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-tinta underline decoration-acento decoration-2 underline-offset-4 transition-colors hover:text-acento"
        >
          Privacidad de la cuenta
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
        .
      </p>
    ),
    Dibujo: Privacidad,
  },
  {
    numero: 2,
    titulo: "Marca solo el historial ampliado",
    texto: (
      <p>
        Baja hasta «Descarga tus datos» y marca <Fuerte>solo «Historial ampliado de reproducción»</Fuerte>. No hace
        falta «Datos de la cuenta»: no lo usamos.
      </p>
    ),
    Dibujo: Marcar,
  },
  {
    numero: 3,
    titulo: "Pulsa «Solicitar datos» y confirma el correo",
    texto: (
      <p>
        Pulsa <Fuerte>Solicitar datos</Fuerte>. Spotify te manda un correo para confirmar que eres tú: ábrelo y
        confírmalo, o la petición no sigue adelante.
      </p>
    ),
    Dibujo: Solicitar,
  },
  {
    numero: 4,
    titulo: "Espera el correo con el enlace",
    texto: (
      <p>
        Ahora toca esperar. Spotify avisa de que puede tardar un mes, aunque <Fuerte>suele ser bastante menos</Fuerte>.
        Te llega un correo con el enlace de descarga.
      </p>
    ),
    nota: "El enlace caduca a los pocos días: descárgalo en cuanto te llegue.",
    Dibujo: Correo,
  },
  {
    numero: 5,
    titulo: "Descarga el .zip y no lo abras",
    texto: (
      <p>
        Descarga el fichero (<code className="font-mono text-sm text-tinta">my_spotify_data.zip</code>).{" "}
        <Fuerte>No hace falta descomprimirlo</Fuerte>: en el paso siguiente lo subes tal cual.
      </p>
    ),
    nota: "Dentro vienen también ficheros de vídeos y pódcast. No pasa nada: la web los descarta sola en tu navegador y solo envía los de música.",
    Dibujo: Descargar,
  },
] as const satisfies readonly PasoTutorial[];
