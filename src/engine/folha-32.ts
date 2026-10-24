import type { LadoChave, Origem, PartidaMotor } from "@/engine/dupla-eliminacao";

export const LIMITE_FOLHA_32 = 16;
export const JOGOS_FOLHA_32 = 30;

function cabeca(numero: number): Origem {
  return { tipo: "CABECA", cabeca: numero };
}

function vencedor(partidaId: string): Origem {
  return { tipo: "VENCEDOR", partidaId };
}

function perdedor(partidaId: string): Origem {
  return { tipo: "PERDEDOR", partidaId };
}

function semPonteiro(rotulo: string): Origem {
  return { tipo: "SEM_PONTEIRO", rotulo };
}

type Definicao = {
  id: string;
  chave: LadoChave;
  rodada: number;
  posicao: number;
  origemA: Origem;
  origemB: Origem;
};

const DEFINICOES: Definicao[] = [
  { id: "1", chave: "VENCEDORES", rodada: 1, posicao: 1, origemA: cabeca(1), origemB: cabeca(16) },
  { id: "2", chave: "VENCEDORES", rodada: 1, posicao: 2, origemA: cabeca(9), origemB: cabeca(8) },
  { id: "3", chave: "VENCEDORES", rodada: 1, posicao: 3, origemA: cabeca(5), origemB: cabeca(12) },
  { id: "4", chave: "VENCEDORES", rodada: 1, posicao: 4, origemA: cabeca(4), origemB: cabeca(13) },
  { id: "5", chave: "VENCEDORES", rodada: 1, posicao: 5, origemA: cabeca(3), origemB: cabeca(14) },
  { id: "6", chave: "VENCEDORES", rodada: 1, posicao: 6, origemA: cabeca(6), origemB: cabeca(11) },
  { id: "7", chave: "VENCEDORES", rodada: 1, posicao: 7, origemA: cabeca(7), origemB: cabeca(10) },
  { id: "8", chave: "VENCEDORES", rodada: 1, posicao: 8, origemA: cabeca(15), origemB: cabeca(2) },
  { id: "9", chave: "VENCEDORES", rodada: 2, posicao: 9, origemA: vencedor("1"), origemB: vencedor("2") },
  { id: "10", chave: "VENCEDORES", rodada: 2, posicao: 10, origemA: vencedor("3"), origemB: vencedor("4") },
  { id: "11", chave: "VENCEDORES", rodada: 2, posicao: 11, origemA: vencedor("5"), origemB: vencedor("6") },
  { id: "12", chave: "VENCEDORES", rodada: 2, posicao: 12, origemA: vencedor("7"), origemB: vencedor("8") },
  { id: "13", chave: "VENCEDORES", rodada: 3, posicao: 13, origemA: vencedor("9"), origemB: vencedor("10") },
  { id: "14", chave: "VENCEDORES", rodada: 3, posicao: 14, origemA: vencedor("11"), origemB: vencedor("12") },
  { id: "15", chave: "VENCEDORES", rodada: 4, posicao: 15, origemA: vencedor("13"), origemB: vencedor("14") },
  { id: "16", chave: "VENCEDORES", rodada: 5, posicao: 16, origemA: vencedor("15"), origemB: semPonteiro("Sem ponteiro") },
  { id: "17", chave: "PERDEDORES", rodada: 1, posicao: 17, origemA: perdedor("1"), origemB: perdedor("2") },
  { id: "18", chave: "PERDEDORES", rodada: 1, posicao: 18, origemA: perdedor("3"), origemB: perdedor("4") },
  { id: "19", chave: "PERDEDORES", rodada: 1, posicao: 19, origemA: perdedor("5"), origemB: perdedor("6") },
  { id: "20", chave: "PERDEDORES", rodada: 1, posicao: 20, origemA: perdedor("7"), origemB: perdedor("8") },
  { id: "21", chave: "PERDEDORES", rodada: 2, posicao: 21, origemA: vencedor("17"), origemB: perdedor("9") },
  { id: "22", chave: "PERDEDORES", rodada: 2, posicao: 22, origemA: vencedor("18"), origemB: perdedor("10") },
  { id: "23", chave: "PERDEDORES", rodada: 2, posicao: 23, origemA: vencedor("19"), origemB: perdedor("11") },
  { id: "24", chave: "PERDEDORES", rodada: 2, posicao: 24, origemA: vencedor("20"), origemB: perdedor("12") },
  { id: "25", chave: "PERDEDORES", rodada: 3, posicao: 25, origemA: semPonteiro("Semifinalista C"), origemB: vencedor("21") },
  { id: "26", chave: "PERDEDORES", rodada: 3, posicao: 26, origemA: semPonteiro("Semifinalista D"), origemB: vencedor("24") },
  { id: "27", chave: "SEMIFINAL", rodada: 1, posicao: 27, origemA: semPonteiro("Semifinalista B"), origemB: semPonteiro("Semifinalista C") },
  { id: "28", chave: "SEMIFINAL", rodada: 1, posicao: 28, origemA: semPonteiro("Semifinalista A"), origemB: semPonteiro("Semifinalista D") },
  { id: "29", chave: "FINAL", rodada: 1, posicao: 29, origemA: perdedor("27"), origemB: perdedor("28") },
  { id: "30", chave: "FINAL", rodada: 1, posicao: 30, origemA: vencedor("27"), origemB: vencedor("28") },
];

function partidaVazia(definicao: Definicao): PartidaMotor {
  return {
    id: definicao.id,
    chave: definicao.chave,
    rodada: definicao.rodada,
    posicao: definicao.posicao,
    origemA: definicao.origemA,
    origemB: definicao.origemB,
    equipeAId: null,
    equipeBId: null,
    vencedorId: null,
    perdedorId: null,
    placarA: null,
    placarB: null,
    status: "AGUARDANDO",
    ordemConclusao: null,
  };
}

export function construirFolha32(): PartidaMotor[] {
  return DEFINICOES.map(partidaVazia);
}

const REGIAO: Partial<Record<LadoChave, string>> = {
  VENCEDORES: "Vencedores",
  PERDEDORES: "Perdedores",
  SEMIFINAL: "Semifinais",
  FINAL: "Finais",
};

const OBSERVACAO: Record<string, string> = {
  "29": "Disputa de 3º lugar",
  "30": "Final",
};

export function rotuloDaPartida32(codigo: string, chave: LadoChave): string {
  const regiao = REGIAO[chave];
  const observacao = OBSERVACAO[codigo];
  const base = regiao ? `Jogo ${codigo} · ${regiao}` : `Jogo ${codigo}`;
  return observacao ? `${base} · ${observacao}` : base;
}

export function textoDaVaga(origem: unknown): string | null {
  if (!origem || typeof origem !== "object" || !("tipo" in origem)) return null;
  if ((origem as { tipo?: string }).tipo !== "SEM_PONTEIRO") return null;
  const rotulo = (origem as { rotulo?: string }).rotulo;
  return rotulo && rotulo.trim() ? rotulo : "Sem ponteiro";
}
