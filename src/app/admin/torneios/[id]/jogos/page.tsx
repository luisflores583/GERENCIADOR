import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { Campo, Entrada } from "@/components/campo";
import { Formulario } from "@/components/formulario";
import { IniciarTorneio } from "@/components/iniciar-torneio";
import { MenuTorneio } from "@/components/menu-torneio";
import { SeloPartida } from "@/components/selo";
import { formatarDataHora } from "@/lib/formatacao";
import { nomeDaFase, rodadasDaChaveDeVencedores } from "@/engine/dupla-eliminacao";
import { rotuloDaPartida } from "@/engine/folha-16";
import { ROTULO_PARTIDA } from "@/lib/rotulos";
import {
  acaoConfirmarPlacar,
  acaoCorrigirPlacar,
  acaoDevolver,
  acaoIniciar,
  acaoPausarPartida,
  acaoRetomarPartida,
} from "@/server/acoes";
import { prisma } from "@/server/db";

export default async function Jogos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const torneio = await prisma.torneio.findUnique({
    where: { id },
    include: {
      partidas: {
        include: {
          equipeA: true,
          equipeB: true,
          quadra: true,
          historico: { include: { admin: true }, orderBy: { criadoEm: "desc" } },
        },
      },
      equipes: true,
    },
  });
  if (!torneio) notFound();
  const rodadas = rodadasDaChaveDeVencedores(Math.max(2, torneio.equipes.length));
  const partidas = torneio.partidas
    .filter((partida) => partida.status !== "VAZIA")
    .sort((a, b) => a.rodada - b.rodada || a.posicao - b.posicao);
  const grupos = ["EM_ANDAMENTO", "PAUSADA", "AGENDADA", "PRONTA", "AGUARDANDO", "CONCLUIDA", "BYE", "NAO_NECESSARIA"];
  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <h1 id="registrar" className="font-display text-4xl text-navy">Registrar resultado</h1>
      <p className="mt-2 max-w-3xl text-navy/70">
        Escolha a equipe vencedora e confirme. A chave, as derrotas, as eliminações e as quadras avançam na hora. O placar não entra neste registro.
      </p>
      {torneio.status === "EM_ANDAMENTO" ? (
        <div className="mt-4">
          <IniciarTorneio torneioId={torneio.id} />
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">
          {torneio.status === "FINALIZADO" ? (
            <p>Este torneio já foi encerrado.</p>
          ) : torneio.status === "PAUSADO" ? (
            <>
              <p>O torneio está pausado. Retome para gravar a vitória.</p>
              <div className="mt-3">
                <IniciarTorneio torneioId={torneio.id} retomada />
              </div>
            </>
          ) : (
            <>
              <p>A vitória entra quando o torneio está em andamento. Inicie para liberar os jogos.</p>
              <p className="mt-2">
                A chave usa a ordem atual das equipes confirmadas. Para sortear ou numerar o ranking, monte isso em Sorteio antes de iniciar.
              </p>
              <div className="mt-3">
                <IniciarTorneio torneioId={torneio.id} />
              </div>
            </>
          )}
        </div>
      )}
      {partidas.every((partida) => !["PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"].includes(partida.status) || !partida.equipeA || !partida.equipeB) ? (
        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-navy">
          Nenhuma partida está pronta para receber a vitória. A chave precisa ter os dois adversários definidos.
        </p>
      ) : null}
      {grupos.map((status) => {
        const lista = partidas.filter((partida) => partida.status === status);
        if (lista.length === 0) return null;
        return (
          <section key={status} className="mt-6 space-y-3">
            <h2 className="font-display text-2xl text-navy">{ROTULO_PARTIDA[status as keyof typeof ROTULO_PARTIDA] ?? status}</h2>
            {lista.map((partida) => (
              <article key={partida.id} className="rounded-3xl bg-foam p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ocean">
                      {torneio.modeloChave === "FOLHA_16"
                        ? rotuloDaPartida(partida.codigo, partida.chave)
                        : `${nomeDaFase(partida.chave, partida.rodada, rodadas)} · ${partida.codigo}`}
                    </p>
                    <h2 className="text-2xl font-bold">
                      {nomeDoLado(partida.equipeA?.nome, partida.status)} x {nomeDoLado(partida.equipeB?.nome, partida.status)}
                    </h2>
                    <p className="text-sm text-navy/70">
                      {partida.quadra?.nome ?? "Sem quadra"}
                      {textoDoConfronto(partida)}
                    </p>
                  </div>
                  <SeloPartida status={partida.status} />
                </div>
                {["PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"].includes(partida.status) && partida.equipeA && partida.equipeB ? (
                  <Formulario acao={acaoConfirmarPlacar} className="mt-4">
                    <input type="hidden" name="partidaId" value={partida.id} />
                    <fieldset className="space-y-2">
                      <legend className="font-semibold text-navy">Quem venceu</legend>
                      {[partida.equipeA, partida.equipeB].map((equipe) => (
                        <label key={equipe.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4">
                          <input type="radio" name="vencedorEquipeId" value={equipe.id} required className="h-5 w-5" />
                          <span className="text-lg font-semibold">{equipe.nome}</span>
                        </label>
                      ))}
                    </fieldset>
                    <div className="flex flex-wrap gap-2">
                      <Botao type="submit">Confirmar vitória</Botao>
                    </div>
                  </Formulario>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {partida.status === "AGENDADA" || partida.status === "PRONTA" ? (
                    <Formulario acao={acaoIniciar} className="w-auto">
                      <input type="hidden" name="partidaId" value={partida.id} />
                      <Botao type="submit" variante="navy">Iniciar</Botao>
                    </Formulario>
                  ) : null}
                  {partida.status === "EM_ANDAMENTO" ? (
                    <Formulario acao={acaoPausarPartida} className="w-auto">
                      <input type="hidden" name="partidaId" value={partida.id} />
                      <Botao type="submit" variante="secundario">Pausar</Botao>
                    </Formulario>
                  ) : null}
                  {partida.status === "PAUSADA" ? (
                    <Formulario acao={acaoRetomarPartida} className="w-auto">
                      <input type="hidden" name="partidaId" value={partida.id} />
                      <Botao type="submit" variante="navy">Retomar</Botao>
                    </Formulario>
                  ) : null}
                  {partida.status === "AGENDADA" ? (
                    <Formulario acao={acaoDevolver} className="w-auto">
                      <input type="hidden" name="partidaId" value={partida.id} />
                      <Botao type="submit" variante="fantasma">Devolver à fila</Botao>
                    </Formulario>
                  ) : null}
                </div>
                {partida.status === "CONCLUIDA" ? (
                  <Formulario acao={acaoCorrigirPlacar} className="mt-4">
                    <input type="hidden" name="partidaId" value={partida.id} />
                    <fieldset className="space-y-2">
                      <legend className="font-semibold text-navy">Novo vencedor</legend>
                      {[partida.equipeA, partida.equipeB].filter((equipe) => equipe).map((equipe) => (
                        <label key={equipe!.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4">
                          <input
                            type="radio"
                            name="vencedorEquipeId"
                            value={equipe!.id}
                            required
                            defaultChecked={vencedorAtual(partida) === equipe!.id}
                            className="h-5 w-5"
                          />
                          <span className="text-lg font-semibold">{equipe!.nome}</span>
                        </label>
                      ))}
                    </fieldset>
                    <Campo id={`motivo-${partida.id}`} rotulo="Motivo da correção">
                      <Entrada id={`motivo-${partida.id}`} name="motivo" required />
                    </Campo>
                    <label className="flex min-h-14 items-center gap-2 text-sm">
                      <input type="checkbox" name="confirmarDependencias" className="h-5 w-5" />
                      Confirmo o recálculo das partidas dependentes
                    </label>
                    <Botao type="submit" variante="secundario">Corrigir vencedor</Botao>
                  </Formulario>
                ) : null}
                {partida.historico.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-navy/70">
                    {partida.historico.map((item) => (
                      <li key={item.id}>
                        {formatarDataHora(item.criadoEm)} · {item.acao === "CORRECAO" ? "Correção" : "Confirmação"} por {item.admin.nome}
                        {item.motivo ? ` · ${item.motivo}` : ""} · {textoDoHistorico(item, partida)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function nomeDaEquipe(
  partida: { equipeA: { id: string; nome: string } | null; equipeB: { id: string; nome: string } | null },
  id: string | null,
) {
  if (!id) return null;
  if (partida.equipeA?.id === id) return partida.equipeA.nome;
  if (partida.equipeB?.id === id) return partida.equipeB.nome;
  return null;
}

function vencedorAtual(partida: {
  vencedorId: string | null;
  placarA: number | null;
  placarB: number | null;
  equipeAId: string | null;
  equipeBId: string | null;
}) {
  if (partida.vencedorId) return partida.vencedorId;
  if (partida.placarA != null && partida.placarB != null && partida.placarA !== partida.placarB) {
    return partida.placarA > partida.placarB ? partida.equipeAId : partida.equipeBId;
  }
  return null;
}

function nomeDoLado(nome: string | null | undefined, status: string) {
  if (nome) return nome;
  return status === "BYE" || status === "VAZIA" || status === "NAO_NECESSARIA" ? "Folga" : "Aguardando adversário";
}

function textoDoConfronto(partida: {
  status: string;
  equipeA: { id: string; nome: string } | null;
  equipeB: { id: string; nome: string } | null;
  vencedorId: string | null;
  placarA: number | null;
  placarB: number | null;
  equipeAId: string | null;
  equipeBId: string | null;
}) {
  const umLado = Boolean(partida.equipeAId) !== Boolean(partida.equipeBId);
  if (partida.status === "BYE" || (partida.status === "CONCLUIDA" && umLado)) {
    return " · avançou por folga";
  }
  if (partida.placarA != null && partida.placarB != null) return ` · ${partida.placarA} x ${partida.placarB}`;
  const nome = nomeDaEquipe(partida, vencedorAtual(partida));
  return nome ? ` · vitória de ${nome}` : "";
}

function textoDoHistorico(
  item: { placarANovo: number | null; placarBNovo: number | null; vencedorNovoId: string | null },
  partida: { equipeA: { id: string; nome: string } | null; equipeB: { id: string; nome: string } | null },
) {
  if (item.placarANovo != null && item.placarBNovo != null) return `${item.placarANovo} x ${item.placarBNovo}`;
  const nome = nomeDaEquipe(partida, item.vencedorNovoId);
  return nome ? `vitória de ${nome}` : "vitória confirmada";
}
