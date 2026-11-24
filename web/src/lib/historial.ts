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

type Candidato = { nombre: string; contenido: ArrayBuffer };

export class ErrorHistorial extends Error {}

const PATRON_AUDIO = /^Streaming_History_Audio_.*\.json$/i;
const PATRON_PERSONA = /^[a-z0-9_-]{2,30}$/;

const esZip = (archivo: File) => archivo.name.toLowerCase().endsWith(".zip");

const nombreSinCarpeta = (ruta: string) => ruta.split("/").pop() ?? ruta;

const candidatosDeZip = async (archivo: File): Promise<Candidato[]> => {
  const zip = await JSZip.loadAsync(await archivo.arrayBuffer()).catch(() => {
    throw new ErrorHistorial("El fichero no es un .zip válido");
  });
  const entradas = Object.values(zip.files).filter((entrada) => !entrada.dir);
  return Promise.all(
    entradas.map(async (entrada) => ({
      nombre: nombreSinCarpeta(entrada.name),
      contenido: await entrada.async("arraybuffer"),
    })),
  );
};

const candidatosSueltos = (archivos: File[]): Promise<Candidato[]> => {
  return Promise.all(
    archivos.map(async (archivo) => ({ nombre: archivo.name, contenido: await archivo.arrayBuffer() })),
  );
};

const candidatosDe = (archivos: File[]): Promise<Candidato[]> => {
  const zips = archivos.filter(esZip);
  if (zips.length === 0) return candidatosSueltos(archivos);
  if (zips.length !== archivos.length) {
    throw new ErrorHistorial("Sube un .zip o los ficheros .json, no los dos a la vez");
  }
  const [unico] = zips;
  if (zips.length > 1 || !unico) throw new ErrorHistorial("Sube un solo .zip");
  return candidatosDeZip(unico);
};

export const prepararHistorial = async (archivos: File[]): Promise<HistorialPreparado> => {
  const candidatos = await candidatosDe(archivos);
  const incluidos = new Map<string, ArrayBuffer>();
  const descartados: Descartado[] = [];

  for (const { nombre, contenido } of candidatos) {
    if (!PATRON_AUDIO.test(nombre)) {
      descartados.push({ nombre, motivo: "no es del historial de audio" });
    } else if (incluidos.has(nombre)) {
      descartados.push({ nombre, motivo: "duplicado" });
    } else {
      incluidos.set(nombre, contenido);
    }
  }

  if (incluidos.size === 0) {
    throw new ErrorHistorial(
      "No hay ningún fichero Streaming_History_Audio_*.json. Pide a Spotify el «Historial ampliado de reproducción» (mira el paso 1).",
    );
  }

  const nuevo = new JSZip();
  for (const [nombre, contenido] of incluidos) nuevo.file(nombre, contenido);
  const zip = await nuevo.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { zip, incluidos: [...incluidos.keys()], descartados, bytes: zip.size };
};

export const normalizarPersona = (nombre: string): string | null => {
  const normalizado = nombre.trim().toLowerCase().replace(/\s+/g, "_");
  return PATRON_PERSONA.test(normalizado) ? normalizado : null;
};
