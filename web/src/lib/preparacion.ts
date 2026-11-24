// Sigue GET /preparacion hasta que el reentreno termina. Una «lista» solo vale si antes se ha visto
// «en_curso» (o la subida ya lo traía): si no, podría ser la del entrenamiento anterior, sin lo recién subido.
import type { EstadoPreparacion } from "@/lib/tipos";

export type OpcionesEspera = {
  cadaMs?: number;
  alCambiar?: (estado: EstadoPreparacion) => void;
  senal?: AbortSignal;
  inicial?: EstadoPreparacion;
};

const CADA_MS_POR_DEFECTO = 2000;

const esFinal = (estado: EstadoPreparacion): boolean => {
  return estado.estado === "lista" || estado.estado === "error";
};

const esperar = (ms: number, senal?: AbortSignal): Promise<void> => {
  return new Promise((resolver, rechazar) => {
    if (senal?.aborted) {
      rechazar(senal.reason);
      return;
    }
    const cancelar = () => {
      clearTimeout(temporizador);
      rechazar(senal?.reason);
    };
    const temporizador = setTimeout(() => {
      senal?.removeEventListener("abort", cancelar);
      resolver();
    }, ms);
    senal?.addEventListener("abort", cancelar, { once: true });
  });
};

export const esperarPreparacion = async (
  leer: () => Promise<EstadoPreparacion>,
  opciones: OpcionesEspera = {},
): Promise<EstadoPreparacion> => {
  const { cadaMs = CADA_MS_POR_DEFECTO, alCambiar, senal, inicial } = opciones;
  let vistoEnCurso = inicial?.estado === "en_curso";

  for (;;) {
    senal?.throwIfAborted();
    const estado = await leer();
    senal?.throwIfAborted();
    alCambiar?.(estado);
    if (estado.estado === "en_curso") vistoEnCurso = true;
    if (vistoEnCurso && esFinal(estado)) return estado;
    await esperar(cadaMs, senal);
  }
};
