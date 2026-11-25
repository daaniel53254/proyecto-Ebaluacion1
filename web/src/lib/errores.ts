// El «detalle» de los errores de la API ({"error", "detalle"}) en líneas legibles: un texto suelto o la lista
// de errores de validación de FastAPI ({campo, problema}). Lo demás no se enseña.
import { esObjeto } from "@/lib/validacion";

const lineaDe = (elemento: unknown): string | null => {
  if (typeof elemento === "string") return elemento.trim() === "" ? null : elemento;
  if (!esObjeto(elemento) || typeof elemento.problema !== "string") return null;
  return typeof elemento.campo === "string" && elemento.campo !== ""
    ? `${elemento.campo}: ${elemento.problema}`
    : elemento.problema;
};

export const lineasDeDetalle = (detalle: unknown): string[] => {
  const elementos: unknown[] = Array.isArray(detalle) ? detalle : [detalle];
  return elementos.map(lineaDe).filter((linea): linea is string => linea !== null);
};
