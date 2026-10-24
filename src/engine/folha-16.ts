import type { LadoChave, Origem, PartidaMotor } from "@/engine/dupla-eliminacao";

export const LIMITE_FOLHA_16 = 16;

export const JOGOS_SEM_DESTINO_DE_PERDEDOR = [
  "10",
  "12",
  "14",
  "16",
  "17",
  "18",
  "19",
  "20",
  "22",
  "24",
  "25",
  "26",
  "29",
  "30",
] as const;

export const JOGOS_SEM_DESTINO_DE_VENCEDOR = ["29", "30"] as const;

function cabeca(numero: number): Origem {
  return { tipo: "CABECA", cabeca: numero };
}

function vencedor(partidaId: string): Origem {
  return { tipo: "VENCEDOR", partidaId };
}

function perdedor(partidaId: string): Origem {
  return { tipo: "PERDEDOR", partidaId };
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
  { id: "1", chave: "SEM_REGIAO", rodada: 1, posicao: 1, origemA: cabeca(1), origemB: cabeca(16) },
  { id: "2", chave: "SEM_REGIAO", rodada: 1, posicao: 2, origemA: cabeca(9), origemB: cabeca(8) },
  { id: "3", chave: "SEM_REGIAO", rodada: 1, posicao: 3, origemA: cabeca(5), origemB: cabeca(12) },
  { id: "4", chave: "SEM_REGIAO", rodada: 1, posicao: 4, origemA: cabeca(4), origemB: cabeca(13) },
  { id: "5", chave: "SEM_REGIAO", rodada: 1, posicao: 5, origemA: cabeca(3), origemB: cabeca(14) },
  { id: "6", chave: "SEM_REGIAO", rodada: 1, posicao: 6, origemA: cabeca(6), origemB: cabeca(11) },
  { id: "7", chave: "SEM_REGIAO", rodada: 1, posicao: 7, origemA: cabeca(7), origemB: cabeca(10) },
  { id: "8", chave: "SEM_REGIAO", rodada: 1, posicao: 8, origemA: cabeca(15), origemB: cabeca(2) },
  { id: "9", chave: "VENCEDORES", rodada: 2, posicao: 9, origemA: vencedor("1"), origemB: vencedor("2") },
  { id: "10", chave: "PERDEDORES", rodada: 2, posicao: 10, origemA: perdedor("1"), origemB: perdedor("2") },
  { id: "11", chave: "VENCEDORES", rodada: 2, posicao: 11, origemA: vencedor("3"), origemB: vencedor("4") },
  { id: "12", chave: "PERDEDORES", rodada: 2, posicao: 12, origemA: perdedor("3"), origemB: perdedor("4") },
  { id: "13", chave: "VENCEDORES", rodada: 2, posicao: 13, origemA: vencedor("5"), origemB: vencedor("6") },
  { id: "14", chave: "PERDEDORES", rodada: 2, posicao: 14, origemA: perdedor("5"), origemB: perdedor("6") },
  { id: "15", chave: "VENCEDORES", rodada: 2, posicao: 15, origemA: vencedor("7"), origemB: vencedor("8") },
  { id: "16", chave: "PERDEDORES", rodada: 2, posicao: 16, origemA: perdedor("7"), origemB: perdedor("8") },
  { id: "17", chave: "SEM_REGIAO", rodada: 3, posicao: 17, origemA: perdedor("13"), origemB: vencedor("10") },
  { id: "18", chave: "SEM_REGIAO", rodada: 3, posicao: 18, origemA: perdedor("15"), origemB: vencedor("12") },
  { id: "19", chave: "SEM_REGIAO", rodada: 3, posicao: 19, origemA: perdedor("9"), origemB: vencedor("14") },
  { id: "20", chave: "SEM_REGIAO", rodada: 3, posicao: 20, origemA: perdedor("11"), origemB: vencedor("16") },
  { id: "21", chave: "SEMIFINALISTA_A", rodada: 4, posicao: 21, origemA: vencedor("9"), origemB: vencedor("11") },
  { id: "22", chave: "SEM_REGIAO", rodada: 4, posicao: 22, origemA: vencedor("17"), origemB: vencedor("18") },
  { id: "23", chave: "SEMIFINALISTA_B", rodada: 4, posicao: 23, origemA: vencedor("13"), origemB: vencedor("15") },
  { id: "24", chave: "SEM_REGIAO", rodada: 4, posicao: 24, origemA: vencedor("19"), origemB: vencedor("20") },
  { id: "25", chave: "SEMIFINALISTA_C", rodada: 5, posicao: 25, origemA: perdedor("21"), origemB: vencedor("22") },
  { id: "26", chave: "SEMIFINALISTA_D", rodada: 5, posicao: 26, origemA: perdedor("23"), origemB: vencedor("24") },
  { id: "27", chave: "SEMIFINAL", rodada: 6, posicao: 27, origemA: vencedor("23"), origemB: vencedor("25") },
  { id: "28", chave: "SEMIFINAL", rodada: 6, posicao: 28, origemA: vencedor("21"), origemB: vencedor("26") },
  { id: "29", chave: "FINAL", rodada: 7, posicao: 29, origemA: perdedor("27"), origemB: perdedor("28") },
  { id: "30", chave: "FINAL", rodada: 7, posicao: 30, origemA: vencedor("27"), origemB: vencedor("28") },
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

export function construirFolha16(): PartidaMotor[] {
  return DEFINICOES.map(partidaVazia);
}

const REGIAO: Partial<Record<LadoChave, string>> = {
  VENCEDORES: "Vencedores",
  PERDEDORES: "Perdedores",
  SEMIFINALISTA_A: "Semifinalista A",
  SEMIFINALISTA_B: "Semifinalista B",
  SEMIFINALISTA_C: "Semifinalista C",
  SEMIFINALISTA_D: "Semifinalista D",
  SEMIFINAL: "Semifinais",
  FINAL: "Finais",
};

export function rotuloDaPartida(codigo: string, chave: LadoChave): string {
  const regiao = REGIAO[chave];
  const serie = codigo === "29" ? " · Série Prata" : codigo === "30" ? " · Série Ouro" : "";
  if (!regiao) return `Jogo ${codigo}`;
  return `Jogo ${codigo} · ${regiao}${serie}`;
}

export function ehFolha16(codigos: readonly string[]): boolean {
  return codigos.includes("30") && codigos.includes("1");
}
