import Link from "next/link";
import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { Campo, Entrada, Selecao } from "@/components/campo";
import { Formulario } from "@/components/formulario";
import { SeloSituacao, SeloStatus } from "@/components/selo";
import { situacaoDaEquipe } from "@/engine/classificacao";
import { tamanhoDaEquipe } from "@/engine/sorteio";
import { acaoAdicionarMembro, acaoCriarEquipe, acaoInscrever } from "@/server/acoes";
import { prisma } from "@/server/db";
import { exigirAtleta } from "@/server/sessao";

export default async function TorneioDoAtleta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { atleta } = await exigirAtleta();
  const torneio = await prisma.torneio.findUnique({
    where: { id },
    include: {
      equipes: { include: { membros: { include: { atleta: true } } } },
      sorteios: true,
    },
  });
  if (!torneio) notFound();
  const inscricao = await prisma.inscricao.findUnique({
    where: { torneioId_atletaId: { torneioId: id, atletaId: atleta.id } },
    include: { equipe: { include: { membros: { include: { atleta: true } } } } },
  });
  const sorteioConfirmado = torneio.sorteios.some((item) => item.tipo === "EQUIPES" && item.status === "CONFIRMADO");
  const mostrarEquipe = torneio.formacao === "PRE_FORMADAS" || sorteioConfirmado;
  const equipe = mostrarEquipe ? inscricao?.equipe : null;
  const partidas = equipe
    ? await prisma.partida.findMany({
        where: { torneioId: id, OR: [{ equipeAId: equipe.id }, { equipeBId: equipe.id }] },
        include: { equipeA: true, equipeB: true, quadra: true },
        orderBy: { rodada: "asc" },
      })
    : [];
  const atletas = await prisma.atleta.findMany({ orderBy: { nomeCompleto: "asc" } });
  const tamanho = tamanhoDaEquipe(torneio.formato);
  const situacao = equipe ? situacaoDaEquipe(equipe.id, equipe.derrotas, torneio.campeaoEquipeId, torneio.viceEquipeId) : null;
  const abertas = torneio.equipes.filter((item) => item.status === "PENDENTE" && item.membros.length < tamanho);

  return (
    <div className="space-y-6">
      <div>
        <SeloStatus status={torneio.status} />
        <h1 className="mt-2 font-display text-4xl text-navy">{torneio.nome}</h1>
        <Link className="mt-2 inline-flex min-h-14 items-center font-semibold text-ocean" href={`/ao-vivo/${torneio.slug}`}>Ver chave completa</Link>
      </div>
      {!inscricao || inscricao.status === "REJEITADA" || inscricao.status === "CANCELADA" ? (
        <Formulario acao={acaoInscrever} className="rounded-3xl bg-foam p-5 shadow-card">
          <input type="hidden" name="torneioId" value={torneio.id} />
          <p>Inscrição individual neste torneio.</p>
          <Botao type="submit">Inscrever-me</Botao>
        </Formulario>
      ) : (
        <p className="rounded-2xl bg-white px-4 py-3">Sua inscrição está {inscricao.status.toLowerCase()}.</p>
      )}
      {torneio.formacao === "SORTEADAS" && inscricao && !sorteioConfirmado ? (
        <p className="rounded-3xl bg-amber-50 p-4">Sua equipe será divulgada somente depois da confirmação oficial do sorteio.</p>
      ) : null}
      {equipe && situacao ? (
        <section className="rounded-3xl bg-foam p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-3xl">{equipe.nome}</h2>
            <SeloSituacao situacao={situacao} />
          </div>
          <p className="mt-2">{equipe.vitorias} vitórias · {equipe.derrotas} derrotas</p>
          <ul className="mt-2">{equipe.membros.map((membro) => <li key={membro.atletaId}>{membro.atleta.nomeCompleto}</li>)}</ul>
        </section>
      ) : null}
      {torneio.formacao === "PRE_FORMADAS" && torneio.status === "INSCRICOES_ABERTAS" && !equipe ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Formulario acao={acaoCriarEquipe} className="rounded-3xl bg-foam p-5 shadow-card">
            <h2 className="font-display text-2xl">Criar equipe</h2>
            <input type="hidden" name="torneioId" value={torneio.id} />
            <input type="hidden" name="atletaId" value={atleta.id} />
            <Campo id="nome" rotulo="Nome">
              <Entrada id="nome" name="nome" required />
            </Campo>
            <Campo id="parceiros" rotulo="Parceiros" dica={`A equipe fecha com ${tamanho} pessoas, incluindo você.`}>
              <Selecao id="parceiros" name="atletaId" multiple className="min-h-32">
                {atletas.filter((item) => item.id !== atleta.id).map((item) => (
                  <option key={item.id} value={item.id}>{item.nomeCompleto}</option>
                ))}
              </Selecao>
            </Campo>
            <Botao type="submit">Criar</Botao>
          </Formulario>
          <section className="rounded-3xl bg-white p-5 shadow-card">
            <h2 className="font-display text-2xl">Entrar em uma equipe</h2>
            {abertas.map((item) => (
              <Formulario key={item.id} acao={acaoAdicionarMembro} className="mt-3">
                <input type="hidden" name="equipeId" value={item.id} />
                <input type="hidden" name="atletaId" value={atleta.id} />
                <p>{item.nome} · {item.membros.length}/{tamanho}</p>
                <Botao type="submit" variante="navy">Pedir vaga</Botao>
              </Formulario>
            ))}
          </section>
        </div>
      ) : null}
      <section>
        <h2 className="font-display text-2xl">Jogos da equipe</h2>
        <ul className="mt-3 space-y-2">
          {partidas.map((partida) => (
            <li key={partida.id} className="rounded-2xl bg-white p-3">
              {partida.equipeA?.nome ?? "Aguardando adversário"} {partida.placarA ?? "–"} x {partida.placarB ?? "–"} {partida.equipeB?.nome ?? "Aguardando adversário"} · {partida.quadra?.nome ?? "sem quadra"} · {partida.status}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
