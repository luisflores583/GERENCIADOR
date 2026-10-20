import type { EstadoChave, PartidaMotor } from "@/engine/dupla-eliminacao";

export type SituacaoEquipe = "INVICTA" | "UMA_DERROTA" | "ELIMINADA" | "CAMPEA" | "VICE" | "CAMPEA_OURO" | "CAMPEA_PRATA";

export interface LinhaClassificacao {
  equipeId: string;
  posicao: number;
  vitorias: number;
  derrotas: number;
  situacao: SituacaoEquipe;
  ordemEliminacao: number | null;
}

type PartidaContagem = {
  status: string;
  vencedorId: string | null;
  perdedorId: string | null;
  equipeAId: string | null;
  equipeBId: string | null;
};

export function campanhaDaEquipe(partidas: readonly PartidaContagem[], equipeId: string) {
  let vitorias = 0;
  let derrotas = 0;
  for (const partida of partidas) {
    if (partida.status !== "CONCLUIDA") continue;
    if (!partida.equipeAId || !partida.equipeBId || !partida.vencedorId || !partida.perdedorId) continue;
    if (partida.vencedorId === partida.perdedorId) continue;
    if (partida.vencedorId === equipeId) vitorias += 1;
    if (partida.perdedorId === equipeId) derrotas += 1;
  }
  return { vitorias, derrotas };
}

export function avancouPorFolga(
  partida: {
    status: string;
    vencedorId?: string | null;
    equipeAId?: string | null;
    equipeBId?: string | null;
  },
  equipeId: string | null,
) {
  if (!equipeId) return false;
  const soUmLado = Boolean(partida.equipeAId) !== Boolean(partida.equipeBId);
  const folga = partida.status === "BYE" || (soUmLado && partida.status === "CONCLUIDA");
  if (!folga) return false;
  if (soUmLado) return partida.equipeAId === equipeId || partida.equipeBId === equipeId;
  return !partida.vencedorId || partida.vencedorId === equipeId;
}

export function situacaoDaEquipe(
  equipeId: string,
  derrotas: number,
  campeaoId: string | null,
  viceId: string | null,
  campeaoOuroId: string | null = null,
  campeaoPrataId: string | null = null,
  segueNaTabela = false,
): SituacaoEquipe {
  if (campeaoOuroId && equipeId === campeaoOuroId) return "CAMPEA_OURO";
  if (campeaoPrataId && equipeId === campeaoPrataId) return "CAMPEA_PRATA";
  if (campeaoId && equipeId === campeaoId) return "CAMPEA";
  if (viceId && equipeId === viceId) return "VICE";
  if (derrotas >= 2 && !segueNaTabela) return "ELIMINADA";
  if (derrotas >= 1) return "UMA_DERROTA";
  return "INVICTA";
}

function ordemDeEliminacao(partidas: PartidaMotor[]): Map<string, number> {
  const ordem = new Map<string, number>();
  const concluidas = partidas
    .filter((partida) => partida.status === "CONCLUIDA" && partida.perdedorId)
    .sort((a, b) => (a.ordemConclusao ?? 0) - (b.ordemConclusao ?? 0));
  for (const partida of concluidas) {
    ordem.set(partida.perdedorId!, partida.ordemConclusao ?? ordem.size + 1);
  }
  return ordem;
}

export function classificar(estado: EstadoChave): LinhaClassificacao[] {
  const eliminacao = ordemDeEliminacao(estado.partidas);
  const linhas = estado.equipesIds.map((equipeId) => {
    const derrotas = estado.derrotas[equipeId] ?? 0;
    const vitorias = estado.vitorias[equipeId] ?? 0;
    const segueNaTabela = estado.partidas.some(
      (partida) =>
        (partida.status === "AGUARDANDO" || partida.status === "PRONTA") &&
        (partida.equipeAId === equipeId || partida.equipeBId === equipeId),
    );
    return {
      equipeId,
      posicao: 0,
      vitorias,
      derrotas,
      situacao: situacaoDaEquipe(
        equipeId,
        derrotas,
        estado.campeaoId,
        estado.viceId,
        estado.campeaoOuroId,
        estado.campeaoPrataId,
        segueNaTabela,
      ),
      ordemEliminacao: eliminacao.get(equipeId) ?? null,
    };
  });

  linhas.sort((a, b) => {
    if (a.equipeId === estado.campeaoOuroId) return -1;
    if (b.equipeId === estado.campeaoOuroId) return 1;
    if (a.equipeId === estado.campeaoPrataId) return -1;
    if (b.equipeId === estado.campeaoPrataId) return 1;
    if (a.equipeId === estado.campeaoId) return -1;
    if (b.equipeId === estado.campeaoId) return 1;
    if (a.equipeId === estado.viceId) return -1;
    if (b.equipeId === estado.viceId) return 1;
    if (a.derrotas !== b.derrotas) return a.derrotas - b.derrotas;
    const ordemA = a.ordemEliminacao ?? -1;
    const ordemB = b.ordemEliminacao ?? -1;
    if (ordemA !== ordemB) return ordemB - ordemA;
    if (a.vitorias !== b.vitorias) return b.vitorias - a.vitorias;
    return a.equipeId.localeCompare(b.equipeId);
  });

  return linhas.map((linha, indice) => ({ ...linha, posicao: indice + 1 }));
}

export interface ResumoAoVivo {
  completa: boolean;
  campeaoId: string | null;
  viceId: string | null;
  equipes: Array<{
    id: string;
    vitorias: number;
    derrotas: number;
    situacao: SituacaoEquipe;
  }>;
  partidas: Array<{
    id: string;
    chave: PartidaMotor["chave"];
    status: PartidaMotor["status"];
    equipeAId: string | null;
    equipeBId: string | null;
    placarA: number | null;
    placarB: number | null;
    aguardandoAdversario: boolean;
  }>;
}

export function montarResumo(estado: EstadoChave): ResumoAoVivo {
  const tabela = classificar(estado);
  return {
    completa: estado.completa,
    campeaoId: estado.campeaoId,
    viceId: estado.viceId,
    equipes: tabela.map((linha) => ({
      id: linha.equipeId,
      vitorias: linha.vitorias,
      derrotas: linha.derrotas,
      situacao: linha.situacao,
    })),
    partidas: estado.partidas
      .filter((partida) => partida.status !== "VAZIA")
      .map((partida) => ({
        id: partida.id,
        chave: partida.chave,
        status: partida.status,
        equipeAId: partida.equipeAId,
        equipeBId: partida.equipeBId,
        placarA: partida.placarA,
        placarB: partida.placarB,
        aguardandoAdversario: partida.status === "AGUARDANDO",
      })),
  };
}
