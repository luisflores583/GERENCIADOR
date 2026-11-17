import { describe, expect, it } from "vitest";
import { aplicarVitoria, criarEstadoInicial, type Origem, type PartidaMotor } from "@/engine/dupla-eliminacao";
import { construirFolha16 } from "@/engine/folha-16";
import { construirFolha32, rotuloDaPartida32, textoDaVaga } from "@/engine/folha-32";
import { campanhaDaEquipe } from "@/engine/classificacao";

function ids(quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, indice) => `e${indice + 1}`);
}

function jogo(partidas: PartidaMotor[], id: string): PartidaMotor {
  const partida = partidas.find((item) => item.id === id);
  if (!partida) throw new Error(`Jogo ${id} ausente`);
  return partida;
}

describe("tabela de até 32 times", () => {
  it("segue os 62 jogos do arquivo e preserva a folha de 16", () => {
    const partidas = construirFolha32();
    const codigos = partidas.map((partida) => partida.id);
    const esperados = Array.from({ length: 62 }, (_, indice) => String(indice + 1));
    expect(codigos).toEqual(esperados);
    expect(codigos).not.toContain("F1");
    expect(new Set(codigos).size).toBe(62);

    const estado = criarEstadoInicial(ids(32), "FOLHA_32");
    expect(estado.modelo).toBe("FOLHA_32");
    expect(estado.campeaoId).toBeNull();
    expect(estado.campeaoOuroId).toBeNull();
    expect(estado.campeaoPrataId).toBeNull();

    const folha16 = construirFolha16();
    expect(folha16).toHaveLength(30);
    expect(jogo(folha16, "1").chave).toBe("SEM_REGIAO");
    expect(jogo(folha16, "1").origemA).toEqual({ tipo: "CABECA", cabeca: 1 });
    expect(jogo(folha16, "1").origemB).toEqual({ tipo: "CABECA", cabeca: 16 });
    expect(jogo(folha16, "10").origemA).toEqual({ tipo: "PERDEDOR", partidaId: "1" });
    expect(jogo(partidas, "1").origemB).toEqual({ tipo: "CABECA", cabeca: 32 });
    expect(jogo(partidas, "10").origemA).toEqual({ tipo: "CABECA", cabeca: 19 });
  });

  it("coloca as equipes 1 a 32 nos jogos 1 a 16, com a equipe 23 no jogo 14", () => {
    const partidas = construirFolha32();
    const cabecas: Record<string, [number, number]> = {
      "1": [1, 32],
      "2": [17, 16],
      "3": [9, 24],
      "4": [25, 8],
      "5": [5, 28],
      "6": [21, 12],
      "7": [13, 20],
      "8": [29, 4],
      "9": [3, 30],
      "10": [19, 14],
      "11": [11, 22],
      "12": [27, 6],
      "13": [7, 26],
      "14": [23, 10],
      "15": [15, 18],
      "16": [31, 2],
    };
    for (const [id, [ladoA, ladoB]] of Object.entries(cabecas)) {
      const partida = jogo(partidas, id);
      expect(partida.origemA).toEqual({ tipo: "CABECA", cabeca: ladoA });
      expect(partida.origemB).toEqual({ tipo: "CABECA", cabeca: ladoB });
      expect(partida.chave).toBe("SEM_REGIAO");
    }
    const usadas = new Set(Object.values(cabecas).flat());
    expect(usadas.has(23)).toBe(true);
    expect([...usadas].filter((cabeca) => cabeca === 15)).toHaveLength(1);

    const estado = criarEstadoInicial(ids(32), "FOLHA_32");
    expect(jogo(estado.partidas, "1")).toMatchObject({ equipeAId: "e1", equipeBId: "e32", status: "PRONTA" });
    expect(jogo(estado.partidas, "2")).toMatchObject({ equipeAId: "e17", equipeBId: "e16" });
    expect(jogo(estado.partidas, "14")).toMatchObject({ equipeAId: "e23", equipeBId: "e10" });
    expect(jogo(estado.partidas, "15")).toMatchObject({ equipeAId: "e15", equipeBId: "e18" });
    expect(jogo(estado.partidas, "16")).toMatchObject({ equipeAId: "e31", equipeBId: "e2" });
  });

  it("liga os dois lados quando o arquivo cita os dois jogos", () => {
    const partidas = construirFolha32();
    const confirmadas: Array<[string, Origem, Origem]> = [
      ["17", { tipo: "PERDEDOR", partidaId: "1" }, { tipo: "PERDEDOR", partidaId: "2" }],
      ["18", { tipo: "VENCEDOR", partidaId: "1" }, { tipo: "VENCEDOR", partidaId: "2" }],
      ["19", { tipo: "PERDEDOR", partidaId: "3" }, { tipo: "PERDEDOR", partidaId: "4" }],
      ["20", { tipo: "VENCEDOR", partidaId: "3" }, { tipo: "VENCEDOR", partidaId: "4" }],
      ["21", { tipo: "PERDEDOR", partidaId: "5" }, { tipo: "PERDEDOR", partidaId: "6" }],
      ["22", { tipo: "VENCEDOR", partidaId: "5" }, { tipo: "VENCEDOR", partidaId: "6" }],
      ["23", { tipo: "PERDEDOR", partidaId: "7" }, { tipo: "PERDEDOR", partidaId: "8" }],
      ["24", { tipo: "VENCEDOR", partidaId: "7" }, { tipo: "VENCEDOR", partidaId: "8" }],
      ["25", { tipo: "PERDEDOR", partidaId: "9" }, { tipo: "PERDEDOR", partidaId: "10" }],
      ["26", { tipo: "VENCEDOR", partidaId: "9" }, { tipo: "VENCEDOR", partidaId: "10" }],
      ["27", { tipo: "PERDEDOR", partidaId: "11" }, { tipo: "PERDEDOR", partidaId: "12" }],
      ["28", { tipo: "VENCEDOR", partidaId: "11" }, { tipo: "VENCEDOR", partidaId: "12" }],
      ["29", { tipo: "PERDEDOR", partidaId: "13" }, { tipo: "PERDEDOR", partidaId: "14" }],
      ["30", { tipo: "VENCEDOR", partidaId: "13" }, { tipo: "VENCEDOR", partidaId: "14" }],
      ["31", { tipo: "PERDEDOR", partidaId: "15" }, { tipo: "PERDEDOR", partidaId: "16" }],
      ["32", { tipo: "VENCEDOR", partidaId: "15" }, { tipo: "VENCEDOR", partidaId: "16" }],
      ["33", { tipo: "VENCEDOR", partidaId: "17" }, { tipo: "PERDEDOR", partidaId: "20" }],
      ["34", { tipo: "VENCEDOR", partidaId: "18" }, { tipo: "VENCEDOR", partidaId: "20" }],
      ["35", { tipo: "VENCEDOR", partidaId: "19" }, { tipo: "PERDEDOR", partidaId: "22" }],
      ["36", { tipo: "VENCEDOR", partidaId: "22" }, { tipo: "VENCEDOR", partidaId: "24" }],
      ["37", { tipo: "VENCEDOR", partidaId: "21" }, { tipo: "PERDEDOR", partidaId: "24" }],
      ["38", { tipo: "VENCEDOR", partidaId: "26" }, { tipo: "VENCEDOR", partidaId: "28" }],
      ["39", { tipo: "VENCEDOR", partidaId: "23" }, { tipo: "PERDEDOR", partidaId: "26" }],
      ["40", { tipo: "VENCEDOR", partidaId: "30" }, { tipo: "VENCEDOR", partidaId: "32" }],
      ["41", { tipo: "VENCEDOR", partidaId: "25" }, { tipo: "PERDEDOR", partidaId: "28" }],
      ["42", { tipo: "VENCEDOR", partidaId: "34" }, { tipo: "VENCEDOR", partidaId: "36" }],
      ["43", { tipo: "VENCEDOR", partidaId: "27" }, { tipo: "PERDEDOR", partidaId: "30" }],
      ["44", { tipo: "VENCEDOR", partidaId: "38" }, { tipo: "VENCEDOR", partidaId: "40" }],
      ["45", { tipo: "VENCEDOR", partidaId: "29" }, { tipo: "PERDEDOR", partidaId: "32" }],
      ["46", { tipo: "VENCEDOR", partidaId: "31" }, { tipo: "PERDEDOR", partidaId: "18" }],
      ["47", { tipo: "VENCEDOR", partidaId: "33" }, { tipo: "VENCEDOR", partidaId: "35" }],
      ["48", { tipo: "VENCEDOR", partidaId: "37" }, { tipo: "VENCEDOR", partidaId: "39" }],
      ["49", { tipo: "VENCEDOR", partidaId: "41" }, { tipo: "VENCEDOR", partidaId: "43" }],
      ["50", { tipo: "VENCEDOR", partidaId: "45" }, { tipo: "VENCEDOR", partidaId: "46" }],
      ["51", { tipo: "VENCEDOR", partidaId: "47" }, { tipo: "PERDEDOR", partidaId: "38" }],
      ["52", { tipo: "VENCEDOR", partidaId: "48" }, { tipo: "PERDEDOR", partidaId: "40" }],
      ["53", { tipo: "PERDEDOR", partidaId: "34" }, { tipo: "VENCEDOR", partidaId: "49" }],
      ["54", { tipo: "PERDEDOR", partidaId: "36" }, { tipo: "VENCEDOR", partidaId: "50" }],
      ["55", { tipo: "VENCEDOR", partidaId: "51" }, { tipo: "VENCEDOR", partidaId: "52" }],
      ["56", { tipo: "VENCEDOR", partidaId: "53" }, { tipo: "VENCEDOR", partidaId: "54" }],
      ["57", { tipo: "PERDEDOR", partidaId: "42" }, { tipo: "VENCEDOR", partidaId: "55" }],
      ["58", { tipo: "VENCEDOR", partidaId: "56" }, { tipo: "PERDEDOR", partidaId: "44" }],
      ["59", { tipo: "VENCEDOR", partidaId: "44" }, { tipo: "VENCEDOR", partidaId: "57" }],
      ["60", { tipo: "VENCEDOR", partidaId: "42" }, { tipo: "VENCEDOR", partidaId: "58" }],
      ["61", { tipo: "PERDEDOR", partidaId: "59" }, { tipo: "PERDEDOR", partidaId: "60" }],
      ["62", { tipo: "VENCEDOR", partidaId: "59" }, { tipo: "VENCEDOR", partidaId: "60" }],
    ];
    for (const [id, ladoA, ladoB] of confirmadas) {
      const partida = jogo(partidas, id);
      expect(partida.origemA).toEqual(ladoA);
      expect(partida.origemB).toEqual(ladoB);
    }
    expect(jogo(partidas, "42").chave).toBe("SEMIFINALISTA_A");
    expect(jogo(partidas, "44").chave).toBe("SEMIFINALISTA_B");
    expect(jogo(partidas, "57").chave).toBe("SEMIFINALISTA_C");
    expect(jogo(partidas, "58").chave).toBe("SEMIFINALISTA_D");
    expect(rotuloDaPartida32("42", "SEMIFINALISTA_A")).toBe("Jogo 42 · Semifinalista A");
    expect(rotuloDaPartida32("61", "FINAL")).toBe("Jogo 61 · Finais");
    expect(rotuloDaPartida32("1", "SEM_REGIAO")).toBe("Jogo 1");
  });

  it("cria o jogo 41 e liga as semifinais pela fase", () => {
    const partidas = construirFolha32();
    expect(jogo(partidas, "41").origemA).toEqual({ tipo: "VENCEDOR", partidaId: "25" });
    expect(jogo(partidas, "41").origemB).toEqual({ tipo: "PERDEDOR", partidaId: "28" });
    expect(jogo(partidas, "41").chave).toBe("SEM_REGIAO");
    expect(jogo(partidas, "49").origemA).toEqual({ tipo: "VENCEDOR", partidaId: "41" });
    expect(partidas.some((partida) => partida.origemA.tipo === "PERDEDOR" && partida.origemA.partidaId === "41")).toBe(false);
    expect(partidas.some((partida) => partida.origemB.tipo === "PERDEDOR" && partida.origemB.partidaId === "41")).toBe(false);
    expect(jogo(partidas, "14").origemA).toEqual({ tipo: "CABECA", cabeca: 23 });
    expect(jogo(partidas, "14").origemB).toEqual({ tipo: "CABECA", cabeca: 10 });
    expect(jogo(partidas, "15").origemA).toEqual({ tipo: "CABECA", cabeca: 15 });
    expect(jogo(partidas, "15").origemB).toEqual({ tipo: "CABECA", cabeca: 18 });
    expect(jogo(partidas, "59").origemA).toEqual({ tipo: "VENCEDOR", partidaId: "44" });
    expect(jogo(partidas, "59").origemB).toEqual({ tipo: "VENCEDOR", partidaId: "57" });
    expect(jogo(partidas, "60").origemA).toEqual({ tipo: "VENCEDOR", partidaId: "42" });
    expect(jogo(partidas, "60").origemB).toEqual({ tipo: "VENCEDOR", partidaId: "58" });
    expect(textoDaVaga(jogo(partidas, "41").origemA)).toBeNull();
  });

  it("coloca no jogo 41 o vencedor do 25 e o perdedor do 28", () => {
    let estado = criarEstadoInicial(ids(32), "FOLHA_32");
    estado = aplicarVitoria(estado, "9", "e3").estado;
    estado = aplicarVitoria(estado, "10", "e19").estado;
    estado = aplicarVitoria(estado, "25", "e30").estado;
    estado = aplicarVitoria(estado, "11", "e11").estado;
    estado = aplicarVitoria(estado, "12", "e27").estado;
    estado = aplicarVitoria(estado, "28", "e27").estado;
    expect(jogo(estado.partidas, "41")).toMatchObject({ equipeAId: "e30", equipeBId: "e11", status: "PRONTA" });
    expect(jogo(estado.partidas, "49").equipeAId).toBeNull();
    const destinoDoPerdedor = estado.partidas.filter((partida) => {
      const lados = [partida.origemA, partida.origemB];
      return lados.some((origem) => origem.tipo === "PERDEDOR" && origem.partidaId === "41");
    });
    expect(destinoDoPerdedor).toEqual([]);
  });

  it("move vencedor e perdedor do jogo 1 para os jogos 18 e 17", () => {
    let estado = criarEstadoInicial(ids(32), "FOLHA_32");
    estado = aplicarVitoria(estado, "1", "e1").estado;
    expect(jogo(estado.partidas, "18")).toMatchObject({ equipeAId: "e1", equipeBId: null, status: "AGUARDANDO" });
    expect(jogo(estado.partidas, "17")).toMatchObject({ equipeAId: "e32", equipeBId: null, status: "AGUARDANDO" });
    expect(jogo(estado.partidas, "20").equipeAId).toBeNull();
    expect(estado.derrotas.e32).toBe(1);
    expect(estado.derrotas.e1).toBe(0);
    expect(jogo(estado.partidas, "59").status).toBe("AGUARDANDO");
    expect(jogo(estado.partidas, "59").equipeAId).toBeNull();
  });

  it("trata a vaga 32 vazia como folga e recusa a 33ª equipe", () => {
    const estado = criarEstadoInicial(ids(31), "FOLHA_32");
    const primeiro = jogo(estado.partidas, "1");
    expect(primeiro.status).toBe("BYE");
    expect(primeiro.vencedorId).toBe("e1");
    expect(campanhaDaEquipe(estado.partidas, "e1")).toEqual({ vitorias: 0, derrotas: 0 });
    expect(() => criarEstadoInicial(ids(33), "FOLHA_32")).toThrow(/32 equipes/);
  });
});
