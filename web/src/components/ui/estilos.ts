import { tv, type VariantProps } from "tailwind-variants";

// Botón en pastilla: un solo «principal» por pantalla (relleno naranja oscuro con texto blanco);
// el «secundario» es de borde fino. Altura mínima de 44 px para el dedo.
export const boton = tv({
  base: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 font-display text-sm font-semibold tracking-tight transition-[background-color,border-color,color,transform] duration-200 ease-salida select-none active:scale-97",
  variants: {
    intencion: {
      principal: "bg-acento-relleno text-sobre-acento hover:bg-acento",
      secundario: "border border-linea-2 text-tinta hover:border-tinta-2 hover:bg-superficie",
    },
  },
  defaultVariants: { intencion: "principal" },
});

export type VariantesBoton = VariantProps<typeof boton>;

// Tarjeta: superficie un paso por encima del fondo, borde fino y radio grande.
export const tarjeta = tv({
  base: "rounded-3xl border border-linea bg-superficie",
  variants: {
    interactiva: {
      true: "transition-[border-color,background-color,transform] duration-300 ease-salida hover:-translate-y-0.5 hover:border-linea-2 hover:bg-superficie-2",
    },
  },
});
