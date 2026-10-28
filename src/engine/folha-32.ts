import type { LadoChave, Origem, PartidaMotor } from "@/engine/dupla-eliminacao";

export const LIMITE_FOLHA_32 = 32;

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

function jogo(
  id: string,
  chave: LadoChave,
  origemA: Origem,
  origemB: Origem,
): Definicao {
  const numero = Number(id);
  return { id, chave, rodada: numero <= 16 ? 1 : 2, posicao: numero, origemA, origemB };
}

const DEFINICOES: Definicao[] = [
  jogo("1", "SEM_REGIAO", cabeca(1), cabeca(32)),
  jogo("2", "SEM_REGIAO", cabeca(17), cabeca(16)),
  jogo("3", "SEM_REGIAO", cabeca(9), cabeca(24)),
  jogo("4", "SEM_REGIAO", cabeca(25), cabeca(8)),
  jogo("5", "SEM_REGIAO", cabeca(5), cabeca(28)),
  jogo("6", "SEM_REGIAO", cabeca(21), cabeca(12)),
  jogo("7", "SEM_REGIAO", cabeca(13), cabeca(20)),
  jogo("8", "SEM_REGIAO", cabeca(29), cabeca(4)),
  jogo("9", "SEM_REGIAO", cabeca(3), cabeca(30)),
  jogo("10", "SEM_REGIAO", cabeca(19), cabeca(14)),
  jogo("11", "SEM_REGIAO", cabeca(11), cabeca(22)),
  jogo("12", "SEM_REGIAO", cabeca(27), cabeca(6)),
  jogo("13", "SEM_REGIAO", cabeca(7), cabeca(26)),
  jogo("14", "SEM_REGIAO", cabeca(23), cabeca(10)),
  jogo("15", "SEM_REGIAO", cabeca(15), cabeca(18)),
  jogo("16", "SEM_REGIAO", cabeca(31), cabeca(2)),
  jogo("17", "SEM_REGIAO", perdedor("1"), perdedor("2")),
  jogo("18", "SEM_REGIAO", vencedor("1"), vencedor("2")),
  jogo("19", "SEM_REGIAO", perdedor("3"), perdedor("4")),
  jogo("20", "SEM_REGIAO", vencedor("3"), vencedor("4")),
  jogo("21", "SEM_REGIAO", perdedor("5"), perdedor("6")),
  jogo("22", "SEM_REGIAO", vencedor("5"), vencedor("6")),
  jogo("23", "SEM_REGIAO", perdedor("7"), perdedor("8")),
  jogo("24", "SEM_REGIAO", vencedor("7"), vencedor("8")),
  jogo("25", "SEM_REGIAO", perdedor("9"), perdedor("10")),
  jogo("26", "SEM_REGIAO", vencedor("9"), vencedor("10")),
  jogo("27", "SEM_REGIAO", perdedor("11"), perdedor("12")),
  jogo("28", "SEM_REGIAO", vencedor("11"), vencedor("12")),
  jogo("29", "SEM_REGIAO", perdedor("13"), perdedor("14")),
  jogo("30", "SEM_REGIAO", vencedor("13"), vencedor("14")),
  jogo("31", "SEM_REGIAO", perdedor("15"), perdedor("16")),
  jogo("32", "SEM_REGIAO", vencedor("15"), vencedor("16")),
  jogo("33", "SEM_REGIAO", vencedor("17"), perdedor("20")),
  jogo("34", "SEM_REGIAO", vencedor("18"), vencedor("20")),
  jogo("35", "SEM_REGIAO", vencedor("19"), perdedor("22")),
  jogo("36", "SEM_REGIAO", vencedor("22"), vencedor("24")),
  jogo("37", "SEM_REGIAO", vencedor("21"), perdedor("24")),
  jogo("38", "SEM_REGIAO", vencedor("26"), vencedor("28")),
  jogo("39", "SEM_REGIAO", vencedor("23"), perdedor("26")),
  jogo("40", "SEM_REGIAO", vencedor("30"), vencedor("32")),
  jogo("41", "SEM_REGIAO", vencedor("25"), perdedor("28")),
  jogo("42", "SEMIFINALISTA_A", vencedor("34"), vencedor("36")),
  jogo("43", "SEM_REGIAO", vencedor("27"), perdedor("30")),
  jogo("44", "SEMIFINALISTA_B", vencedor("38"), vencedor("40")),
  jogo("45", "SEM_REGIAO", vencedor("29"), perdedor("32")),
  jogo("46", "SEM_REGIAO", vencedor("31"), perdedor("18")),
  jogo("47", "SEM_REGIAO", vencedor("33"), vencedor("35")),
  jogo("48", "SEM_REGIAO", vencedor("37"), vencedor("39")),
  jogo("49", "SEM_REGIAO", vencedor("41"), vencedor("43")),
  jogo("50", "SEM_REGIAO", vencedor("45"), vencedor("46")),
  jogo("51", "SEM_REGIAO", vencedor("47"), perdedor("38")),
  jogo("52", "SEM_REGIAO", vencedor("48"), perdedor("40")),
  jogo("53", "SEM_REGIAO", perdedor("34"), vencedor("49")),
  jogo("54", "SEM_REGIAO", perdedor("36"), vencedor("50")),
  jogo("55", "SEM_REGIAO", vencedor("51"), vencedor("52")),
  jogo("56", "SEM_REGIAO", vencedor("53"), vencedor("54")),
  jogo("57", "SEMIFINALISTA_C", perdedor("42"), vencedor("55")),
  jogo("58", "SEMIFINALISTA_D", vencedor("56"), perdedor("44")),
  jogo("59", "SEMIFINAL", vencedor("44"), vencedor("57")),
  jogo("60", "SEMIFINAL", vencedor("42"), vencedor("58")),
  jogo("61", "FINAL", perdedor("59"), perdedor("60")),
  jogo("62", "FINAL", vencedor("59"), vencedor("60")),
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
  SEMIFINALISTA_A: "Semifinalista A",
  SEMIFINALISTA_B: "Semifinalista B",
  SEMIFINALISTA_C: "Semifinalista C",
  SEMIFINALISTA_D: "Semifinalista D",
  SEMIFINAL: "Semifinais",
  FINAL: "Finais",
};

export function rotuloDaPartida32(codigo: string, chave: LadoChave): string {
  const regiao = REGIAO[chave];
  return regiao ? `Jogo ${codigo} · ${regiao}` : `Jogo ${codigo}`;
}

export function textoDaVaga(origem: unknown): string | null {
  if (!origem || typeof origem !== "object" || !("tipo" in origem)) return null;
  if ((origem as { tipo?: string }).tipo !== "SEM_PONTEIRO") return null;
  const rotulo = (origem as { rotulo?: string }).rotulo;
  return rotulo && rotulo.trim() ? rotulo : "Sem ponteiro";
}
