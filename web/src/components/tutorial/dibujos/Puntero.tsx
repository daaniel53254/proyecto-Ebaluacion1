import type { FC } from "react";

type PunteroProps = {
  x: number;
  y: number;
};

// Flecha del ratón, con la punta en (x, y).
export const Puntero: FC<PunteroProps> = ({ x, y }) => {
  return (
    <path
      d="M0 0v17l4.5-4 3 7 3-1.3-3-6.8h6z"
      transform={`translate(${x} ${y})`}
      strokeWidth="1.5"
      strokeLinejoin="round"
      className="fill-tinta stroke-fondo"
    />
  );
};
