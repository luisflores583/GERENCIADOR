import { describe, expect, it } from "vitest";
import { construirFolha16 } from "@/engine/folha-16";
import { construirFolha32 } from "@/engine/folha-32";
import { gradeDaFolha, ligacoesDaFolha, tracadosDasLigacoes } from "@/components/folha-visual";

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

  it("separa os traços para um caminho não ficar em cima do outro", () => {
    conferirTracadosSeparados("FOLHA_16");
    conferirTracadosSeparados("FOLHA_32");
  });
});

function conferirTracadosSeparados(modelo: "FOLHA_16" | "FOLHA_32") {
  const { caixas, altura } = caixasSinteticas(modelo);
  const tracados = tracadosDasLigacoes(modelo, caixas, altura);
  expect(tracados).toHaveLength(ligacoesDaFolha(modelo).length);
  const segmentos = tracados.flatMap((traco) => segmentosDoTraco(traco.d));
  for (let indice = 0; indice < segmentos.length; indice += 1) {
    for (let outro = indice + 1; outro < segmentos.length; outro += 1) {
      expect(sobrepoem(segmentos[indice], segmentos[outro]), `${modelo} ${indice} ${outro}`).toBe(false);
    }
    for (const caixa of caixas.values()) {
      expect(atravessaCaixa(segmentos[indice], caixa), modelo).toBe(false);
    }
  }
}

function caixasSinteticas(modelo: "FOLHA_16" | "FOLHA_32") {
  const grade = gradeDaFolha(modelo);
  const larguras = grade.colunas.split(" ").map((valor) => Number.parseFloat(valor) * 16);
  const intervaloX = 8.5 * 16;
  const alturaLinha = 3 * 16;
  const intervaloY = 8;
  const recuoX = 6 * 16;
  const recuoY = 11 * 16;
  const alturaCaixa = 50;
  const caixas = new Map<string, { left: number; right: number; top: number; bottom: number; width: number; height: number }>();
  for (const celula of grade.celulas) {
    let left = recuoX;
    for (let coluna = 0; coluna < celula.coluna - 1; coluna += 1) left += larguras[coluna] + intervaloX;
    const width = larguras[celula.coluna - 1];
    const topoDaCelula = recuoY + (celula.linha - 1) * (alturaLinha + intervaloY);
    const alturaDaCelula = celula.span * alturaLinha + (celula.span - 1) * intervaloY;
    const top = topoDaCelula + (alturaDaCelula - alturaCaixa) / 2;
    caixas.set(celula.codigo, { left, right: left + width, top, bottom: top + alturaCaixa, width, height: alturaCaixa });
  }
  const altura = recuoY + grade.linhas * alturaLinha + (grade.linhas - 1) * intervaloY + recuoY;
  return { caixas, altura };
}

function segmentosDoTraco(d: string) {
  const partes = d.trim().split(/\s+/);
  let x = 0;
  let y = 0;
  const segmentos: Array<{ direcao: "H" | "V"; a: number; b: number; fixo: number }> = [];
  for (let indice = 0; indice < partes.length; indice += 1) {
    if (partes[indice] === "M") {
      x = Number(partes[indice + 1]);
      y = Number(partes[indice + 2]);
      indice += 2;
    } else if (partes[indice] === "H") {
      const proximo = Number(partes[indice + 1]);
      segmentos.push({ direcao: "H", a: x, b: proximo, fixo: y });
      x = proximo;
      indice += 1;
    } else if (partes[indice] === "V") {
      const proximo = Number(partes[indice + 1]);
      segmentos.push({ direcao: "V", a: y, b: proximo, fixo: x });
      y = proximo;
      indice += 1;
    }
  }
  return segmentos;
}

function sobrepoem(
  um: { direcao: "H" | "V"; a: number; b: number; fixo: number },
  outro: { direcao: "H" | "V"; a: number; b: number; fixo: number },
) {
  if (um.direcao !== outro.direcao || Math.abs(um.fixo - outro.fixo) >= 6) return false;
  const inicio = Math.max(Math.min(um.a, um.b), Math.min(outro.a, outro.b));
  const fim = Math.min(Math.max(um.a, um.b), Math.max(outro.a, outro.b));
  return fim - inicio > 3;
}

function atravessaCaixa(
  segmento: { direcao: "H" | "V"; a: number; b: number; fixo: number },
  caixa: { left: number; right: number; top: number; bottom: number },
) {
  if (segmento.direcao === "H") {
    const inicio = Math.max(Math.min(segmento.a, segmento.b), caixa.left + 2);
    const fim = Math.min(Math.max(segmento.a, segmento.b), caixa.right - 2);
    return fim - inicio > 1 && segmento.fixo > caixa.top + 2 && segmento.fixo < caixa.bottom - 2;
  }
  const inicio = Math.max(Math.min(segmento.a, segmento.b), caixa.top + 2);
  const fim = Math.min(Math.max(segmento.a, segmento.b), caixa.bottom - 2);
  return fim - inicio > 1 && segmento.fixo > caixa.left + 2 && segmento.fixo < caixa.right - 2;
}

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
