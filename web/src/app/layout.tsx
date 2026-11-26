import type { Metadata, Viewport } from "next";
import { Montserrat, Onest } from "next/font/google";
import type { ReactNode } from "react";

import { Cabecera } from "@/components/Cabecera";
import { Pie } from "@/components/Pie";
import { cn } from "@/lib/cn";

import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
const onest = Onest({ subsets: ["latin"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "NPD Entertainment · Playlist para viajes en grupo",
    template: "%s · NPD Entertainment",
  },
  description:
    "Subid vuestros historiales de Spotify y sacad una playlist que guste a todo el grupo: buscamos canciones que gusten a todos, sin dejar a nadie muy abajo.",
  icons: { icon: "/npd_logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#040708",
  colorScheme: "dark",
};

type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="es" className={cn(montserrat.variable, onest.variable)}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <a
          href="#contenido"
          className="sr-only rounded-full bg-acento-relleno px-4 py-2 text-sobre-acento focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Saltar al contenido
        </a>
        <Cabecera />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Pie />
      </body>
    </html>
  );
};

export default RootLayout;
