"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { EstadoAcao } from "@/tipos";
import { estadoInicial } from "@/tipos";

export function Formulario({
  acao,
  children,
  className = "",
}: {
  acao: (estado: EstadoAcao, dados: FormData) => Promise<EstadoAcao>;
  children: React.ReactNode;
  className?: string;
}) {
  const roteador = useRouter();
  const [estado, executar, pendente] = useActionState(acao, estadoInicial);
  useEffect(() => {
    if (estado.mensagem) roteador.refresh();
  }, [estado.mensagem, roteador]);
  return (
    <form action={executar} className={`space-y-4 ${className}`} aria-busy={pendente}>
      {estado.erro ? (
        <p role="alert" className="rounded-2xl bg-red-100 px-4 py-3 text-base text-red-900">
          {estado.erro}
        </p>
      ) : null}
      {estado.mensagem ? (
        <p role="status" className="rounded-2xl bg-emerald-100 px-4 py-3 text-base text-emerald-950">
          {estado.mensagem}
        </p>
      ) : null}
      {pendente ? <p className="text-sm font-semibold text-navy">Gravando…</p> : null}
      {estado.afetadas && estado.afetadas.length > 0 ? (
        <ul className="list-disc space-y-1 rounded-2xl bg-amber-50 px-8 py-3 text-sm text-amber-950">
          {estado.afetadas.map((item) => (
            <li key={item.codigo}>{item.descricao}</li>
          ))}
        </ul>
      ) : null}
      <div className="min-w-0 space-y-4">{children}</div>
    </form>
  );
}
