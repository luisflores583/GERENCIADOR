import Link from "next/link";
import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { CamposEquipe } from "@/components/campos-equipe";
import { Formulario } from "@/components/formulario";
import { SeloSituacao, SeloStatus } from "@/components/selo";
import { campanhaDaEquipe, situacaoDaEquipe } from "@/engine/classificacao";
import { tamanhoDaEquipe } from "@/engine/sorteio";
import { cobraInscricao, formatarMoeda } from "@/lib/formatacao";
import { acaoAdicionarMembro, acaoCadastrarEquipe, acaoInscrever } from "@/server/acoes";
import { prisma } from "@/server/db";
import { AVISO_PAGAMENTO_NAO_CONFIGURADO, pagamentoDaInscricao, pagamentoEstaConfigurado } from "@/server/pagamentos";
import { exigirAtleta } from "@/server/sessao";

export default async function TorneioDoAtleta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retorno?: string }>;
}) {
  const { id } = await params;
  const busca = await searchParams;
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
  const tamanho = tamanhoDaEquipe(torneio.formato);
  const campanha = equipe ? campanhaDaEquipe(partidas, equipe.id) : null;
  const situacao = equipe && campanha
    ? situacaoDaEquipe(
        equipe.id,
        campanha.derrotas,
        torneio.campeaoEquipeId,
        torneio.viceEquipeId,
        torneio.campeaoOuroEquipeId,
        torneio.campeaoPrataEquipeId,
      )
    : null;
  const abertas = torneio.equipes.filter((item) => item.status === "PENDENTE" && item.membros.length < tamanho && item.incompleta);
  const prazoAberto = torneio.inscricoesAte.getTime() >= Date.now();
  const podeCadastrarEquipe = torneio.formacao === "PRE_FORMADAS" && torneio.status === "INSCRICOES_ABERTAS" && prazoAberto && !torneio.equipesTravadasEm && !equipe;
  const cobrada = cobraInscricao(torneio.valorCentavos);
  const configurado = pagamentoEstaConfigurado();
  const pagamento = cobrada ? await pagamentoDaInscricao(atleta.id, torneio.id) : null;
  const naLista = Boolean(inscricao && inscricao.status !== "REJEITADA" && inscricao.status !== "CANCELADA");
  const pagamentoAprovado = pagamento?.status === "APROVADO";
  const lancadaPelaOrganizacao = inscricao?.status === "APROVADA" && !pagamentoAprovado && pagamento?.status == null;
  const faltaPagamento = cobrada && !pagamentoAprovado && !lancadaPelaOrganizacao;

  return (
    <div className="space-y-6">
      <div>
        <SeloStatus status={torneio.status} />
        <h1 className="mt-2 font-display text-4xl text-navy">{torneio.nome}</h1>
        <p className="mt-2 text-navy/70">Inscrição {formatarMoeda(torneio.valorCentavos)}</p>
        <Link className="mt-2 inline-flex min-h-14 items-center font-semibold text-ocean" href={`/ao-vivo/${torneio.slug}`}>Ver chave completa</Link>
      </div>
      {torneio.status === "INSCRICOES_ENCERRADAS" && (!inscricao || inscricao.status === "REJEITADA" || inscricao.status === "CANCELADA") ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">As inscrições estão encerradas. A lista atual permanece. Ninguém novo entra.</p>
      ) : null}
      {faltaPagamento ? (
        <AvisoDePagamento
          valorCentavos={torneio.valorCentavos}
          configurado={configurado}
          status={pagamento?.status ?? null}
          continuar={pagamento?.status === "AGUARDANDO" ? pagamento.initPoint : ""}
          retorno={busca.retorno}
          jaNaLista={naLista}
        />
      ) : null}
      {faltaPagamento && naLista ? (
        <Formulario acao={acaoInscrever} className="rounded-3xl bg-foam p-5 shadow-card">
          <input type="hidden" name="torneioId" value={torneio.id} />
          <p>PIX, cartão e boleto abrem no Mercado Pago.</p>
          <Botao type="submit">Pagar inscrição</Botao>
        </Formulario>
      ) : null}
      {torneio.formacao === "SORTEADAS" && torneio.status === "INSCRICOES_ABERTAS" && !naLista ? (
        <Formulario acao={acaoInscrever} className="rounded-3xl bg-foam p-5 shadow-card">
          <input type="hidden" name="torneioId" value={torneio.id} />
          <p>Inscrição individual neste torneio. A equipe será sorteada depois.</p>
          {cobrada ? <p>PIX, cartão e boleto abrem no Mercado Pago. A vaga entra na lista quando o pagamento for aprovado.</p> : null}
          <Botao type="submit">{cobrada ? "Pagar inscrição" : "Inscrever-me"}</Botao>
        </Formulario>
      ) : null}
      {inscricao && inscricao.status !== "REJEITADA" && inscricao.status !== "CANCELADA" ? (
        <p className="rounded-2xl bg-white px-4 py-3">Sua inscrição está {inscricao.status.toLowerCase()}.</p>
      ) : null}
      {torneio.formacao === "SORTEADAS" && inscricao && !sorteioConfirmado ? (
        <p className="rounded-3xl bg-amber-50 p-4">Sua equipe será divulgada somente depois da confirmação oficial do sorteio.</p>
      ) : null}
      {equipe && situacao ? (
        <section className="rounded-3xl bg-foam p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-3xl">{equipe.nome}</h2>
            <SeloSituacao situacao={situacao} />
          </div>
          <p className="mt-2">{campanha?.vitorias ?? 0} vitórias · {campanha?.derrotas ?? 0} derrotas</p>
          <ul className="mt-2">{equipe.membros.map((membro) => <li key={membro.atletaId}>{membro.atleta.nomeCompleto}</li>)}</ul>
        </section>
      ) : null}
      {podeCadastrarEquipe ? (
        <Formulario acao={acaoCadastrarEquipe} className="rounded-3xl bg-foam p-5 shadow-card">
          <h2 className="font-display text-3xl">Cadastrar equipe</h2>
          <p className="text-navy/70">
            Você entra como integrante 1. Escreva o nome, o sexo e o telefone de quem joga com você. O e-mail é opcional.
            {torneio.naipe === "MISTO" ? " A equipe mista precisa de pelo menos uma atleta feminina." : ""}
          </p>
          <input type="hidden" name="torneioId" value={torneio.id} />
          <CamposEquipe tamanho={tamanho} fixo={atleta} />
          {cobrada ? <p>PIX, cartão e boleto abrem no Mercado Pago. A equipe entra na lista quando o pagamento for aprovado.</p> : null}
          <Botao type="submit">{cobrada ? "Pagar inscrição" : "Gravar equipe"}</Botao>
        </Formulario>
      ) : null}
      {torneio.formacao === "PRE_FORMADAS" && podeCadastrarEquipe && abertas.length > 0 ? (
        <section className="rounded-3xl bg-white p-5 shadow-card">
          <h2 className="font-display text-2xl">Entrar em uma equipe incompleta</h2>
          {abertas.map((item) => (
            <Formulario key={item.id} acao={acaoAdicionarMembro} className="mt-3">
              <input type="hidden" name="equipeId" value={item.id} />
              <input type="hidden" name="atletaId" value={atleta.id} />
              <p>{item.nome} · {item.membros.length}/{tamanho}</p>
              <Botao type="submit" variante="navy">{cobrada ? "Pagar inscrição" : "Pedir vaga"}</Botao>
            </Formulario>
          ))}
        </section>
      ) : null}
      {torneio.formacao === "PRE_FORMADAS" && torneio.status === "INSCRICOES_ABERTAS" && !prazoAberto && !equipe ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3">O prazo de inscrição terminou.</p>
      ) : null}
      <section>
        <h2 className="font-display text-2xl">Jogos da equipe</h2>
        <ul className="mt-3 space-y-2">
          {partidas.map((partida) => (
            <li key={partida.id} className="rounded-2xl bg-white p-3">
              {textoDoJogo(partida)} · {partida.quadra?.nome ?? "sem quadra"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AvisoDePagamento({
  valorCentavos,
  configurado,
  status,
  continuar,
  retorno,
  jaNaLista,
}: {
  valorCentavos: number | null;
  configurado: boolean;
  status: "AGUARDANDO" | "APROVADO" | "RECUSADO" | "CANCELADO" | null;
  continuar: string;
  retorno?: string;
  jaNaLista: boolean;
}) {
  return (
    <section className="space-y-3 rounded-3xl bg-white p-5 shadow-card">
      <p>Inscrição {formatarMoeda(valorCentavos)}. O pagamento abre no Mercado Pago, com PIX, cartão ou boleto.</p>
      {configurado ? null : <p role="status">{AVISO_PAGAMENTO_NAO_CONFIGURADO}</p>}
      {status === "AGUARDANDO" ? (
        <p>
          {jaNaLista
            ? "Aguardando pagamento."
            : "Aguardando pagamento. A vaga entra na lista quando o Mercado Pago confirmar."}
        </p>
      ) : null}
      {status === "RECUSADO" || status === "CANCELADO" ? <p>O pagamento não foi concluído. Você pode tentar de novo.</p> : null}
      {retorno === "aprovado" ? <p>Se o Mercado Pago aprovou, a vaga entra na lista em seguida.</p> : null}
      {retorno === "recusado" ? <p>O pagamento não foi concluído. Você pode tentar de novo.</p> : null}
      {retorno === "pendente" ? <p>O pagamento ainda está em análise. A vaga entra na lista quando o Mercado Pago confirmar.</p> : null}
      {continuar ? (
        <a className="inline-flex min-h-14 items-center font-semibold text-ocean" href={continuar}>
          Continuar o pagamento
        </a>
      ) : null}
    </section>
  );
}

function textoDoJogo(partida: {
  status: string;
  equipeA: { nome: string } | null;
  equipeB: { nome: string } | null;
  equipeAId: string | null;
  equipeBId: string | null;
  vencedorId: string | null;
  placarA: number | null;
  placarB: number | null;
}) {
  const umLado = Boolean(partida.equipeA) !== Boolean(partida.equipeB);
  if (partida.status === "BYE" || (partida.status === "CONCLUIDA" && umLado)) {
    const nome = partida.equipeA?.nome ?? partida.equipeB?.nome ?? "A equipe";
    return `${nome} avançou por folga`;
  }
  const esquerda = partida.equipeA?.nome ?? "Aguardando adversário";
  const direita = partida.equipeB?.nome ?? "Aguardando adversário";
  const meio =
    partida.placarA != null && partida.placarB != null
      ? `${partida.placarA} x ${partida.placarB}`
      : partida.status === "CONCLUIDA"
        ? `vitória de ${partida.vencedorId === partida.equipeAId ? partida.equipeA?.nome : partida.equipeB?.nome}`
        : "– x –";
  return `${esquerda} ${meio} ${direita}`;
}
