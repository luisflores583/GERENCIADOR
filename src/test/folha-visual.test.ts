import { describe, expect, it } from "vitest";
import { gradeDaFolha } from "@/components/folha-visual";

function codigosEsperados(quantidade: number) {
  return Array.from({ length: quantidade }, (_, indice) => String(indice + 1));
}

describe("chave visual da folha", () => {
  it("coloca cada jogo da tabela de 16 uma única vez, sem caixas sobrepostas", () => {
    const grade = gradeDaFolha("FOLHA_16");
    expect(grade.celulas.map((celula) => celula.codigo).sort((a, b) => Number(a) - Number(b))).toEqual(codigosEsperados(30));
    expect(grade.titulos).toContain("Perdedores");
    expect(grade.titulos).toContain("Vencedores");
    conferirGrade(grade.celulas, grade.linhas, grade.titulos.length);
  });

  it("coloca cada jogo da tabela de 32 uma única vez, sem caixas sobrepostas", () => {
    const grade = gradeDaFolha("FOLHA_32");
    expect(grade.celulas.map((celula) => celula.codigo).sort((a, b) => Number(a) - Number(b))).toEqual(codigosEsperados(62));
    expect(grade.titulos).toContain("Perdedores");
    expect(grade.titulos).toContain("Vencedores");
    expect(grade.celulas.find((celula) => celula.codigo === "14")?.abertura).toBe(true);
    expect(grade.celulas.find((celula) => celula.codigo === "41")).toBeTruthy();
    expect(grade.celulas.find((celula) => celula.codigo === "42")?.rotulo).toBe("Semifinalista A");
    expect(grade.celulas.find((celula) => celula.codigo === "44")?.rotulo).toBe("Semifinalista B");
    expect(grade.celulas.find((celula) => celula.codigo === "57")?.rotulo).toBe("Semifinalista C");
    expect(grade.celulas.find((celula) => celula.codigo === "58")?.rotulo).toBe("Semifinalista D");
    conferirGrade(grade.celulas, grade.linhas, grade.titulos.length);
  });
});

function conferirGrade(
  celulas: Array<{ codigo: string; coluna: number; linha: number; span: number }>,
  linhas: number,
  colunas: number,
) {
  const ocupadas = new Map<string, string>();
  for (const celula of celulas) {
    expect(celula.coluna).toBeGreaterThanOrEqual(1);
    expect(celula.coluna).toBeLessThanOrEqual(colunas);
    expect(celula.linha).toBeGreaterThanOrEqual(1);
    expect(celula.linha + celula.span - 1).toBeLessThanOrEqual(linhas);
    for (let linha = celula.linha; linha < celula.linha + celula.span; linha += 1) {
      const chave = `${celula.coluna}:${linha}`;
      expect(ocupadas.has(chave), `jogo ${celula.codigo} cruza ${ocupadas.get(chave)}`).toBe(false);
      ocupadas.set(chave, celula.codigo);
    }
  }
}
