import Link from "next/link";
import type { FC, ReactNode } from "react";

import { boton, type VariantesBoton } from "@/components/ui/estilos";

type EnlaceBotonProps = VariantesBoton & {
  href: string;
  children: ReactNode;
  className?: string;
};

export const EnlaceBoton: FC<EnlaceBotonProps> = ({ href, children, intencion, className }) => {
  return (
    <Link href={href} className={boton({ intencion, class: className })}>
      {children}
    </Link>
  );
};
