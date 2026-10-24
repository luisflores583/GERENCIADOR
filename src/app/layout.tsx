import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Areia Viva — torneios de vôlei de praia",
  description: "Gestão de torneios de vôlei de areia com dupla eliminação, quadras e painel ao vivo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${outfit.variable} ${fraunces.variable} font-sans text-ink antialiased`}>
        <a href="#conteudo" className="sr-only min-h-14 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4">
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
