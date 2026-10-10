import type { EstadoChave, PartidaMotor } from "@/engine/dupla-eliminacao";

export type SituacaoEquipe = "INVICTA" | "UMA_DERROTA" | "ELIMINADA" | "CAMPEA" | "VICE";

export interface LinhaClassificacao {
  equipeId: string;
  posicao: number;
  vitorias: number;
  derrotas: number;
  situacao: SituacaoEquipe;
  ordemEliminacao: number | null;
}

export function situacaoDaEquipe(
  equipeId: string,
  derrotas: number,
  campeaoId: string | null,
  viceId: string | null,
): SituacaoEquipe {
  if (campeaoId && equipeId === campeaoId) return "CAMPEA";
  if (viceId && equipeId === viceId) return "VICE";
  if (derrotas >= 2) return "ELIMINADA";
  if (derrotas === 1) return "UMA_DERROTA";
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
    return {
      equipeId,
      posicao: 0,
      vitorias,
      derrotas,
      situacao: situacaoDaEquipe(equipeId, derrotas, estado.campeaoId, estado.viceId),
      ordemEliminacao: eliminacao.get(equipeId) ?? null,
    };
  });

  linhas.sort((a, b) => {
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
