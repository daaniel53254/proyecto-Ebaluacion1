import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...clases: ClassValue[]): string => {
  return twMerge(clsx(clases));
};
