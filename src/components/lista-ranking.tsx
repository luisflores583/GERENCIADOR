"use client";

import { useState } from "react";
import { Botao } from "@/components/botao";

export function ListaRanking({ equipes }: { equipes: { id: string; nome: string }[] }) {
  const [lista, setLista] = useState(equipes);

  function mover(indice: number, destino: number) {
    if (destino < 0 || destino >= lista.length) return;
    const proxima = [...lista];
    const [equipe] = proxima.splice(indice, 1);
    if (!equipe) return;
    proxima.splice(destino, 0, equipe);
    setLista(proxima);
  }

  return (
    <ol className="space-y-2">
      {lista.map((equipe, indice) => (
        <li key={equipe.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3">
          <input type="hidden" name="equipeId" value={equipe.id} />
          <label className="text-sm font-semibold text-navy" htmlFor={`posicao-${equipe.id}`}>
            Posição
            <input
              id={`posicao-${equipe.id}`}
              name={`posicao-${equipe.id}`}
              inputMode="numeric"
              className="mt-1 block h-14 w-24 rounded-2xl border border-navy/15 px-3 text-base"
            />
          </label>
          <span className="min-w-0 flex-1 text-base">
            <span className="text-sm text-navy/60">{indice + 1}.</span> {equipe.nome}
          </span>
          <Botao type="button" variante="secundario" onClick={() => mover(indice, indice - 1)} disabled={indice === 0}>
            Subir
          </Botao>
          <Botao
            type="button"
            variante="secundario"
            onClick={() => mover(indice, indice + 1)}
            disabled={indice === lista.length - 1}
          >
            Descer
          </Botao>
        </li>
      ))}
    </ol>
  );
}
