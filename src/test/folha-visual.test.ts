import { describe, expect, it } from "vitest";
import { construirFolha16 } from "@/engine/folha-16";
import { construirFolha32 } from "@/engine/folha-32";
import { gradeDaFolha, ligacoesDaFolha } from "@/components/folha-visual";

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

  it("desenha só as ligações já escritas, dos dois lados, até as finais", () => {
    conferirLigacoes("FOLHA_16", construirFolha16());
    conferirLigacoes("FOLHA_32", construirFolha32());

    const dezesseis = ligacoesDaFolha("FOLHA_16");
    expect(dezesseis.filter((ligacao) => ligacao.para === "9").map(rotulo).sort()).toEqual(["VENCEDOR 1", "VENCEDOR 2"]);
    expect(dezesseis.filter((ligacao) => ligacao.para === "10").map(rotulo).sort()).toEqual(["PERDEDOR 1", "PERDEDOR 2"]);
    expect(dezesseis.filter((ligacao) => ligacao.para === "29").map(rotulo).sort()).toEqual(["PERDEDOR 27", "PERDEDOR 28"]);
    expect(dezesseis.filter((ligacao) => ligacao.para === "30").map(rotulo).sort()).toEqual(["VENCEDOR 27", "VENCEDOR 28"]);

    const trintaEDois = ligacoesDaFolha("FOLHA_32");
    expect(trintaEDois.filter((ligacao) => ligacao.para === "41").map(rotulo).sort()).toEqual(["PERDEDOR 28", "VENCEDOR 25"]);
    expect(trintaEDois.filter((ligacao) => ligacao.para === "59").map(rotulo).sort()).toEqual(["VENCEDOR 44", "VENCEDOR 57"]);
    expect(trintaEDois.filter((ligacao) => ligacao.para === "60").map(rotulo).sort()).toEqual(["VENCEDOR 42", "VENCEDOR 58"]);
    expect(trintaEDois.some((ligacao) => ligacao.de === "41" && ligacao.tipo === "PERDEDOR")).toBe(false);
  });
});

function rotulo(ligacao: { tipo: string; de: string }) {
  return `${ligacao.tipo} ${ligacao.de}`;
}

function conferirLigacoes(modelo: "FOLHA_16" | "FOLHA_32", partidas: ReturnType<typeof construirFolha16>) {
  const esperadas: string[] = [];
  for (const partida of partidas) {
    const lados = [
      ["A", partida.origemA],
      ["B", partida.origemB],
    ] as const;
    for (const [lado, origem] of lados) {
      if (origem.tipo === "VENCEDOR" || origem.tipo === "PERDEDOR") {
        esperadas.push(`${origem.tipo}:${origem.partidaId}->${partida.id}:${lado}`);
      }
    }
  }
  const desenhadas = ligacoesDaFolha(modelo).map((ligacao) => `${ligacao.tipo}:${ligacao.de}->${ligacao.para}:${ligacao.lado}`);
  expect(desenhadas.sort()).toEqual(esperadas.sort());
  expect(new Set(desenhadas).size).toBe(esperadas.length);
}

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
