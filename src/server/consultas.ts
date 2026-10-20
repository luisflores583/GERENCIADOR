import { campanhaDaEquipe, situacaoDaEquipe, type SituacaoEquipe } from "@/engine/classificacao";
import { nomeDaFase, rodadasDaChaveDeVencedores } from "@/engine/dupla-eliminacao";
import { rotuloDaPartida } from "@/engine/folha-16";
import { prisma } from "@/server/db";
import type { EquipeResumo, PainelDTO, PartidaResumo } from "@/tipos";

const ORDEM_CHAVE = [
  "SEM_REGIAO",
  "VENCEDORES",
  "PERDEDORES",
  "SEMIFINALISTA_A",
  "SEMIFINALISTA_B",
  "SEMIFINALISTA_C",
  "SEMIFINALISTA_D",
  "SEMIFINAL",
  "FINAL",
  "FINAL_EXTRA",
];

export async function montarPainel(slug: string): Promise<PainelDTO | null> {
  const torneio = await prisma.torneio.findUnique({
    where: { slug },
    include: {
      equipes: {
        include: { membros: { include: { atleta: true } } },
      },
      partidas: { include: { equipeA: true, equipeB: true, quadra: true } },
      quadras: { include: { quadra: true }, orderBy: { ordem: "asc" } },
      inscricoes: { where: { status: "APROVADA" }, select: { id: true } },
    },
  });
  if (!torneio) return null;

  const rodadas = rodadasDaChaveDeVencedores(Math.max(2, torneio.equipes.length || 2));
  const segueNaTabela = (equipeId: string) =>
    torneio.partidas.some(
      (partida) =>
        ["AGUARDANDO", "PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"].includes(partida.status) &&
        (partida.equipeAId === equipeId || partida.equipeBId === equipeId),
    );
  const situacao = (equipeId: string, derrotas: number): SituacaoEquipe =>
    situacaoDaEquipe(
      equipeId,
      derrotas,
      torneio.campeaoEquipeId,
      torneio.viceEquipeId,
      torneio.campeaoOuroEquipeId,
      torneio.campeaoPrataEquipeId,
      segueNaTabela(equipeId),
    );

  const equipes: EquipeResumo[] = torneio.equipes
    .map((equipe) => {
      const campanha = campanhaDaEquipe(torneio.partidas, equipe.id);
      return {
        id: equipe.id,
        nome: equipe.nome,
        vitorias: campanha.vitorias,
        derrotas: campanha.derrotas,
        situacao: situacao(equipe.id, campanha.derrotas),
        membros: equipe.membros.map((membro) => membro.atleta.apelido || membro.atleta.nomeCompleto),
        cabeca: equipe.cabeca,
      };
    })
    .sort((a, b) => (a.cabeca ?? 999) - (b.cabeca ?? 999) || a.nome.localeCompare(b.nome, "pt-BR"));

  const porId = new Map(equipes.map((equipe) => [equipe.id, equipe]));
  const resumoEquipe = (id: string | null) => {
    if (!id) return null;
    const equipe = porId.get(id);
    if (!equipe) return null;
    return { id: equipe.id, nome: equipe.nome, situacao: equipe.situacao };
  };

  const partidas: PartidaResumo[] = torneio.partidas
    .filter((partida) => partida.status !== "VAZIA")
    .map((partida) => ({
      id: partida.id,
      codigo: partida.codigo,
      chave: partida.chave,
      rodada: partida.rodada,
      posicao: partida.posicao,
      fase:
        torneio.modeloChave === "FOLHA_16"
          ? rotuloDaPartida(partida.codigo, partida.chave)
          : nomeDaFase(partida.chave, partida.rodada, rodadas),
      equipeA: resumoEquipe(partida.equipeAId),
      equipeB: resumoEquipe(partida.equipeBId),
      placarA: partida.placarA,
      placarB: partida.placarB,
      vencedorId: partida.vencedorId,
      status: partida.status,
      quadra: partida.quadra?.nome ?? null,
      quadraId: partida.quadraId,
      inicioEm: partida.inicioEm?.toISOString() ?? null,
      fimEm: partida.fimEm?.toISOString() ?? null,
      aguardandoAdversario: partida.status === "AGUARDANDO",
    }))
    .sort(
      (a, b) =>
        ORDEM_CHAVE.indexOf(a.chave) - ORDEM_CHAVE.indexOf(b.chave) ||
        a.rodada - b.rodada ||
        Number(a.codigo) - Number(b.codigo) ||
        a.posicao - b.posicao,
    );

  const ocupacao = new Map(
    torneio.partidas
      .filter((partida) => partida.quadraId && ["AGENDADA", "EM_ANDAMENTO", "PAUSADA"].includes(partida.status))
      .map((partida) => [partida.quadraId!, partida.id]),
  );

  const agora = Date.now();
  const eliminacao = new Map<string, number>();
  for (const partida of torneio.partidas) {
    if (partida.status === "CONCLUIDA" && partida.perdedorId && partida.ordemConclusao != null) {
      eliminacao.set(partida.perdedorId, Math.max(eliminacao.get(partida.perdedorId) ?? 0, partida.ordemConclusao));
    }
  }
  const classificacao = [...equipes]
    .sort((a, b) => {
      if (a.id === torneio.campeaoOuroEquipeId) return -1;
      if (b.id === torneio.campeaoOuroEquipeId) return 1;
      if (a.id === torneio.campeaoPrataEquipeId) return -1;
      if (b.id === torneio.campeaoPrataEquipeId) return 1;
      if (a.id === torneio.campeaoEquipeId) return -1;
      if (b.id === torneio.campeaoEquipeId) return 1;
      if (a.id === torneio.viceEquipeId) return -1;
      if (b.id === torneio.viceEquipeId) return 1;
      if (a.derrotas !== b.derrotas) return a.derrotas - b.derrotas;
      const ordemA = eliminacao.get(a.id) ?? -1;
      const ordemB = eliminacao.get(b.id) ?? -1;
      if (ordemA !== ordemB) return ordemB - ordemA;
      if (a.vitorias !== b.vitorias) return b.vitorias - a.vitorias;
      return a.nome.localeCompare(b.nome, "pt-BR");
    })
    .map((equipe, indice) => ({ ...equipe, posicao: indice + 1 }));

  const nomes = new Map(classificacao.map((equipe) => [equipe.id, equipe.nome]));

  return {
    torneio: {
      id: torneio.id,
      nome: torneio.nome,
      slug: torneio.slug,
      descricao: torneio.descricao,
      regulamento: torneio.regulamento,
      local: torneio.local,
      modalidade: torneio.modalidade,
      formato: torneio.formato,
      formacao: torneio.formacao,
      naipe: torneio.naipe,
      status: torneio.status,
      inicioEm: torneio.inicioEm.toISOString(),
      inscricoesAte: torneio.inscricoesAte.toISOString(),
      corDestaque: torneio.corDestaque,
      nomeOrganizador: torneio.nomeOrganizador,
      pontosParaVencer: torneio.pontosParaVencer,
      diferencaMinima: torneio.diferencaMinima,
      pontosMaximos: torneio.pontosMaximos,
      quadrasSimultaneas: torneio.quadrasSimultaneas,
      valorCentavos: torneio.valorCentavos,
      atletasConfirmados: torneio.inscricoes.length,
    },
    contagens: {
      equipes: equipes.length,
      emDisputa: equipes.filter((equipe) => equipe.derrotas < 2).length,
      eliminadas: equipes.filter((equipe) => equipe.derrotas >= 2).length,
    },
    equipes,
    partidas,
    quadras: torneio.quadras.map((vinculo) => ({
      id: vinculo.quadraId,
      nome: vinculo.quadra.nome,
      habilitada: vinculo.habilitada,
      indisponivel: Boolean(vinculo.indisponivelAte && vinculo.indisponivelAte.getTime() > agora),
      indisponivelAte: vinculo.indisponivelAte?.toISOString() ?? null,
      partidaId: ocupacao.get(vinculo.quadraId) ?? null,
    })),
    fila: partidas.filter((partida) => partida.status === "PRONTA"),
    classificacao,
    campeao: torneio.campeaoEquipeId ? (nomes.get(torneio.campeaoEquipeId) ?? null) : null,
    vice: torneio.viceEquipeId ? (nomes.get(torneio.viceEquipeId) ?? null) : null,
    modeloChave: torneio.modeloChave,
    campeaoOuro: torneio.campeaoOuroEquipeId ? (nomes.get(torneio.campeaoOuroEquipeId) ?? null) : null,
    campeaoPrata: torneio.campeaoPrataEquipeId ? (nomes.get(torneio.campeaoPrataEquipeId) ?? null) : null,
    atualizadoEm: new Date().toISOString(),
  };
}
