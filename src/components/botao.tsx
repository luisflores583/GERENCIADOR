import type { ButtonHTMLAttributes } from "react";

const variantes = {
  primario: "bg-coral text-white hover:brightness-110",
  navy: "bg-navy text-white hover:brightness-110",
  secundario: "bg-white text-navy border border-navy/15 hover:bg-sand",
  perigo: "bg-red-700 text-white hover:bg-red-800",
  fantasma: "bg-transparent text-navy hover:bg-white/70",
} as const;

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof variantes }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-14 items-center justify-center rounded-2xl px-5 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-50 ${variantes[variante]} ${className}`}
    />
  );
}
