export interface RegrasPlacar {
  pontosParaVencer: number;
  diferencaMinima: number;
  pontosMaximos: number | null;
}

export const REGRAS_PADRAO: RegrasPlacar = {
  pontosParaVencer: 21,
  diferencaMinima: 2,
  pontosMaximos: null,
};

export type ValidacaoPlacar =
  | { ok: true; vencedor: "A" | "B" }
  | { ok: false; erro: string };

export function validarPlacar(placarA: number, placarB: number, regras: RegrasPlacar): ValidacaoPlacar {
  if (!Number.isInteger(placarA) || !Number.isInteger(placarB) || placarA < 0 || placarB < 0) {
    return { ok: false, erro: "O placar deve ser formado por números inteiros não negativos." };
  }
  if (placarA === placarB) {
    return { ok: false, erro: "O placar não pode terminar empatado." };
  }

  const maior = Math.max(placarA, placarB);
  const menor = Math.min(placarA, placarB);
  const diferenca = maior - menor;
  const vencedor = placarA > placarB ? "A" : "B";

  if (regras.pontosMaximos != null && maior > regras.pontosMaximos) {
    return { ok: false, erro: "O placar ultrapassa o limite de pontos deste torneio." };
  }

  if (regras.pontosMaximos != null && maior === regras.pontosMaximos) {
    if (diferenca < 1) return { ok: false, erro: "Placar inválido no limite de pontos." };
    return { ok: true, vencedor };
  }

  if (maior < regras.pontosParaVencer) {
    return {
      ok: false,
      erro: `É preciso atingir ${regras.pontosParaVencer} pontos para vencer a partida.`,
    };
  }

  if (diferenca < regras.diferencaMinima) {
    return {
      ok: false,
      erro: `A diferença mínima neste torneio é de ${regras.diferencaMinima} pontos.`,
    };
  }

  return { ok: true, vencedor };
}
