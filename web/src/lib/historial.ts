// Prepara en el navegador lo que se sube: del zip de Spotify (o de los JSON sueltos) se queda solo con
// los Streaming_History_Audio_*.json y los vuelve a empaquetar, para no subir vídeo, PDF ni datos ajenos.
import JSZip from "jszip";

export type Descartado = {
  nombre: string;
  motivo: "no es del historial de audio" | "duplicado";
};

export type HistorialPreparado = {
  zip: Blob;
  incluidos: string[];
  descartados: Descartado[];
  bytes: number;
};

type Candidato = { nombre: string; leer: () => Promise<ArrayBuffer> };

export class ErrorHistorial extends Error {}

// Mismos patrones que la API (api/historiales.py): lo que la web acepta, la API también.
const PATRON_AUDIO = /^Streaming_History_Audio_[\w-]+\.json$/i;
const PATRON_PERSONA = /^[a-z0-9][a-z0-9_-]{1,29}$/;

const esZip = (archivo: File) => archivo.name.toLowerCase().endsWith(".zip");

const nombreSinCarpeta = (ruta: string) => ruta.split("/").pop() ?? ruta;

const candidatosDeZip = async (archivo: File): Promise<Candidato[]> => {
  const zip = await JSZip.loadAsync(await archivo.arrayBuffer()).catch(() => {
    throw new ErrorHistorial("El fichero no es un .zip válido");
  });
  return Object.values(zip.files)
    .filter((entrada) => !entrada.dir)
    .map((entrada) => ({
      nombre: nombreSinCarpeta(entrada.name),
      leer: () => entrada.async("arraybuffer"),
    }));
};

const candidatosSueltos = (archivos: File[]): Candidato[] => {
  return archivos.map((archivo) => ({ nombre: archivo.name, leer: () => archivo.arrayBuffer() }));
};

const candidatosDe = async (archivos: File[]): Promise<Candidato[]> => {
  const zips = archivos.filter(esZip);
  if (zips.length === 0) return candidatosSueltos(archivos);
  if (zips.length !== archivos.length) {
    throw new ErrorHistorial("Sube un .zip o los ficheros .json, no los dos a la vez");
  }
  const [unico] = zips;
  if (zips.length > 1 || !unico) throw new ErrorHistorial("Sube un solo .zip");
  return candidatosDeZip(unico);
};

// Se decide por el nombre antes de descomprimir: solo se lee lo que se va a subir.
const clasificar = (candidatos: Candidato[]) => {
  const incluidos = new Map<string, Candidato>();
  const descartados: Descartado[] = [];
  for (const candidato of candidatos) {
    if (!PATRON_AUDIO.test(candidato.nombre)) {
      descartados.push({ nombre: candidato.nombre, motivo: "no es del historial de audio" });
    } else if (incluidos.has(candidato.nombre)) {
      descartados.push({ nombre: candidato.nombre, motivo: "duplicado" });
    } else {
      incluidos.set(candidato.nombre, candidato);
    }
  }
  return { incluidos, descartados };
};

export const prepararHistorial = async (archivos: File[]): Promise<HistorialPreparado> => {
  const { incluidos, descartados } = clasificar(await candidatosDe(archivos));

  if (incluidos.size === 0) {
    throw new ErrorHistorial(
      "No hay ningún fichero Streaming_History_Audio_*.json. Pide a Spotify el «Historial ampliado de reproducción» (mira el paso 1).",
    );
  }

  const nuevo = new JSZip();
  for (const [nombre, candidato] of incluidos) nuevo.file(nombre, await candidato.leer());
  const zip = await nuevo.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { zip, incluidos: [...incluidos.keys()], descartados, bytes: zip.size };
};

export const normalizarPersona = (nombre: string): string | null => {
  const normalizado = nombre.trim().toLowerCase().replace(/ /g, "_");
  return PATRON_PERSONA.test(normalizado) ? normalizado : null;
};
