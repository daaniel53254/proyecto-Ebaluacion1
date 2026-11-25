// Paleta categórica de las personas, en orden fijo (la misma RAMPA de panel/tema.py, validada para fondo
// oscuro y daltonismo). Empieza por el naranja y el verde del logo. Nunca se rota ni se reordena.
export const COLORES_SERIE: readonly string[] = ["#d23f18", "#52ab69", "#3a84ca", "#b98a00", "#993f94"];

const COLOR_DE_RESERVA = "#8f9594";

export const colorPersona = (i: number): string => {
  if (!Number.isInteger(i) || i < 0) return COLOR_DE_RESERVA;
  return COLORES_SERIE[i % COLORES_SERIE.length] ?? COLOR_DE_RESERVA;
};
