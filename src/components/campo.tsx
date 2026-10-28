import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Campo({
  id,
  rotulo,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="block space-y-2 text-base">
      <span className="font-semibold text-navy">{rotulo}</span>
      {children}
      {dica ? <span className="block text-sm text-navy/70">{dica}</span> : null}
    </label>
  );
}

const classeCampo =
  "min-h-14 w-full rounded-2xl border border-navy/15 bg-white px-4 text-base text-ink outline-none ring-coral focus:ring-2";

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${classeCampo} ${props.className ?? ""}`} />;
}

export function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${classeCampo} min-h-32 py-3 ${props.className ?? ""}`} />;
}

export function Selecao(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${classeCampo} ${props.className ?? ""}`} />;
}
