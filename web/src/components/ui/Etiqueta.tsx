import type { FC, ReactNode } from "react";

import { cn } from "@/lib/cn";

type EtiquetaProps = {
  children: ReactNode;
  className?: string;
};

// Etiqueta superior de sección: 12 px, mayúsculas, con la raya naranja del logo delante.
export const Etiqueta: FC<EtiquetaProps> = ({ children, className }) => {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-xs font-semibold tracking-etiqueta text-apagado uppercase",
        className,
      )}
    >
      <span aria-hidden className="h-0.5 w-6 rounded-full bg-acento" />
      {children}
    </p>
  );
};
