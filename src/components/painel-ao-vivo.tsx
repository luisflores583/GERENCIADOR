"use client";

import { useEffect, useState } from "react";
import { ChaveVisual } from "@/components/chave-visual";
import { SeloPartida, SeloSituacao, SeloStatus } from "@/components/selo";
import { formatarDataHora } from "@/lib/formatacao";
import { ROTULO_FORMATO, ROTULO_FORMACAO, ROTULO_NAIPE } from "@/lib/rotulos";
import type { PainelDTO, PartidaResumo } from "@/tipos";

export function PainelAoVivo({ inicial }: { inicial: PainelDTO }) {
  const [painel, setPainel] = useState(inicial);
  const [telao, setTelao] = useState(false);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      const resposta = await fetch(`/api/publico/${inicial.torneio.slug}/painel`, { cache: "no-store" });
      if (!resposta.ok || !ativo) return;
      setPainel((await resposta.json()) as PainelDTO);
    };
    const fonte = new EventSource(`/api/publico/${inicial.torneio.slug}/eventos`);
    fonte.onopen = () => setConectado(true);
    fonte.onerror = () => setConectado(false);
    fonte.onmessage = () => {
      void atualizar();
    };
    const intervalo = window.setInterval(() => {
      void atualizar();
    }, 20000);
    return () => {
      ativo = false;
      fonte.close();
      window.clearInterval(intervalo);
    };
  }, [inicial.torneio.slug]);

  const emAndamento = painel.partidas.filter((partida) => partida.status === "EM_ANDAMENTO" || partida.status === "PAUSADA");
  const agendadas = painel.partidas.filter((partida) => partida.status === "AGENDADA");
  const destaque = painel.torneio.corDestaque;

  return (
    <div className={telao ? "text-lg sm:text-xl lg:text-2xl" : ""} style={{ ["--cor" as string]: destaque }}>
      <header className="overflow-hidden rounded-[2rem] bg-navy text-white shadow-card">
        <div className="h-2" style={{ background: destaque }} />
        <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-white/70">{painel.torneio.nomeOrganizador || "Arena"}</p>
            <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">{painel.torneio.nome}</h1>
            <p className="mt-3 max-w-2xl text-white/80">
              {painel.torneio.modalidade} · {ROTULO_FORMATO[painel.torneio.formato]} · {ROTULO_NAIPE[painel.torneio.naipe]} · {ROTULO_FORMACAO[painel.torneio.formacao]}
            </p>
            <p className="mt-2 text-white/80">
              {painel.torneio.local} · {formatarDataHora(painel.torneio.inicioEm)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <SeloStatus status={painel.torneio.status} />
              <span className="rounded-full bg-white/15 px-3 py-1 text-sm">{conectado ? "Ao vivo" : "Reconectando"}</span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <Indicador rotulo="Equipes" valor={painel.contagens.equipes || painel.torneio.atletasConfirmados} />
            <Indicador rotulo="Na disputa" valor={painel.contagens.emDisputa} />
            <Indicador rotulo="Eliminadas" valor={painel.contagens.eliminadas} />
            <Indicador rotulo="Na fila" valor={painel.fila.length} />
          </dl>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy/70" aria-live="polite">
          Atualizado em {formatarDataHora(painel.atualizadoEm)}
        </p>
        <button
          type="button"
          className="min-h-14 rounded-2xl bg-white px-5 text-base font-semibold text-navy"
          onClick={() => setTelao((valor) => !valor)}
        >
          {telao ? "Modo normal" : "Modo telão"}
        </button>
      </div>

      {painel.campeao ? (
        <p className="mt-6 rounded-3xl bg-yellow-100 px-5 py-4 text-xl font-semibold text-yellow-950">
          Campeã: {painel.campeao}
          {painel.vice ? ` · Vice: ${painel.vice}` : ""}
        </p>
      ) : null}

      <section className="mt-8 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Bloco titulo="Em andamento" partidas={emAndamento} vazio="Nenhuma partida rolando agora." />
        <Bloco titulo="Agendadas" partidas={agendadas} vazio="Nenhuma partida aguardando início." />
        <Bloco titulo="Próximas da fila" partidas={painel.fila.slice(0, 4)} vazio="A fila está vazia." />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-3xl text-navy">Quadras</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {painel.quadras.filter((quadra) => quadra.habilitada).map((quadra) => {
            const partida = painel.partidas.find((item) => item.id === quadra.partidaId);
            return (
              <article key={quadra.id} className="rounded-3xl bg-foam p-4 shadow-card">
                <h3 className="text-xl font-bold text-navy">{quadra.nome}</h3>
                <p className="mt-1 text-sm text-navy/70">
                  {quadra.indisponivel ? "Indisponível" : partida ? "Ocupada" : "Livre"}
                </p>
                {partida ? (
                  <p className="mt-3 font-semibold">
                    {partida.equipeA?.nome ?? "Aguardando"} x {partida.equipeB?.nome ?? "Aguardando"}
                  </p>
                ) : (
                  <p className="mt-3 text-navy/60">Aguardando o próximo confronto.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-3xl text-navy">Chaveamento</h2>
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <SeloSituacao situacao="INVICTA" />
          <SeloSituacao situacao="UMA_DERROTA" />
          <SeloSituacao situacao="ELIMINADA" />
          <SeloPartida status="EM_ANDAMENTO" />
          <SeloPartida status="CONCLUIDA" />
          <SeloPartida status="AGUARDANDO" />
        </div>
        {painel.partidas.length === 0 ? (
          <p className="rounded-3xl bg-white p-6 text-navy/70">A chave será publicada depois do sorteio.</p>
        ) : (
          <ChaveVisual partidas={painel.partidas} />
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-3xl text-navy">Classificação</h2>
        <div className="overflow-x-auto rounded-3xl bg-foam shadow-card">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-navy text-white">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Equipe</th>
                <th className="px-4 py-3">Integrantes</th>
                <th className="px-4 py-3">V</th>
                <th className="px-4 py-3">D</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {painel.classificacao.map((equipe) => (
                <tr key={equipe.id} className="border-t border-navy/10">
                  <td className="px-4 py-3 font-bold">{equipe.posicao}</td>
                  <td className="px-4 py-3 font-semibold">{equipe.nome}</td>
                  <td className="px-4 py-3">{equipe.membros.join(", ")}</td>
                  <td className="px-4 py-3">{equipe.vitorias}</td>
                  <td className="px-4 py-3">{equipe.derrotas}</td>
                  <td className="px-4 py-3">
                    <SeloSituacao situacao={equipe.situacao} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-3xl bg-white/10 p-4">
      <dt className="text-sm text-white/70">{rotulo}</dt>
      <dd className="text-3xl font-bold">{valor}</dd>
    </div>
  );
}

function Bloco({ titulo, partidas, vazio }: { titulo: string; partidas: PartidaResumo[]; vazio: string }) {
  return (
    <section className="rounded-3xl bg-foam p-4 shadow-card">
      <h2 className="font-display text-2xl text-navy">{titulo}</h2>
      {partidas.length === 0 ? <p className="mt-3 text-navy/70">{vazio}</p> : null}
      <ul className="mt-3 space-y-3">
        {partidas.map((partida) => (
          <li key={partida.id} className="rounded-2xl bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-ocean">{partida.fase}</p>
              <SeloPartida status={partida.status} />
            </div>
            <p className="mt-2 text-lg font-bold">
              {partida.equipeA?.nome ?? "Aguardando adversário"}{" "}
              <span className="tabular-nums">
                {partida.placarA ?? "–"} x {partida.placarB ?? "–"}
              </span>{" "}
              {partida.equipeB?.nome ?? "Aguardando adversário"}
            </p>
            <p className="text-sm text-navy/70">{partida.quadra ?? "Quadra a definir"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
