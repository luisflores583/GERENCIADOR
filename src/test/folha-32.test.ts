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

function origem(partida: PartidaMotor, lado: "A" | "B"): Origem {
  return lado === "A" ? partida.origemA : partida.origemB;
}

describe("tabela de até 32 times", () => {
  it("cria os trinta jogos do arquivo e preserva a folha de 16", () => {
    const partidas = construirFolha32();
    const codigos = partidas.map((partida) => partida.id);
    expect(codigos).toEqual(Array.from({ length: 30 }, (_, indice) => String(indice + 1)));
    expect(new Set(codigos).size).toBe(30);
    expect(codigos).not.toContain("F1");

    const estado = criarEstadoInicial(ids(16), "FOLHA_32");
    expect(estado.modelo).toBe("FOLHA_32");
    expect(estado.partidas.map((partida) => partida.id)).toEqual(codigos);
    expect(estado.campeaoId).toBeNull();
    expect(estado.campeaoOuroId).toBeNull();
    expect(estado.campeaoPrataId).toBeNull();

    const folha16 = construirFolha16();
    expect(jogo(folha16, "1").chave).toBe("SEM_REGIAO");
    expect(jogo(folha16, "10").origemA).toEqual({ tipo: "PERDEDOR", partidaId: "1" });
    expect(jogo(partidas, "1").chave).toBe("VENCEDORES");
    expect(jogo(partidas, "10").origemA).toEqual({ tipo: "VENCEDOR", partidaId: "3" });
  });

  it("coloca as equipes 1 a 16 nos jogos 1 a 8", () => {
    const partidas = construirFolha32();
    const cabecas: Record<string, [number, number]> = {
      "1": [1, 16],
      "2": [9, 8],
      "3": [5, 12],
      "4": [4, 13],
      "5": [3, 14],
      "6": [6, 11],
      "7": [7, 10],
      "8": [15, 2],
    };
    for (const [id, [ladoA, ladoB]] of Object.entries(cabecas)) {
      const partida = jogo(partidas, id);
      expect(partida.origemA).toEqual({ tipo: "CABECA", cabeca: ladoA });
      expect(partida.origemB).toEqual({ tipo: "CABECA", cabeca: ladoB });
      expect(partida.chave).toBe("VENCEDORES");
    }

    const estado = criarEstadoInicial(ids(16), "FOLHA_32");
    expect(jogo(estado.partidas, "1").equipeAId).toBe("e1");
    expect(jogo(estado.partidas, "1").equipeBId).toBe("e16");
    expect(jogo(estado.partidas, "2").equipeAId).toBe("e9");
    expect(jogo(estado.partidas, "2").equipeBId).toBe("e8");
    expect(jogo(estado.partidas, "8").equipeAId).toBe("e15");
    expect(jogo(estado.partidas, "8").equipeBId).toBe("e2");
  });

  it("liga só as pontas nomeadas com número de jogo", () => {
    const partidas = construirFolha32();
    const confirmadas: Array<[string, "A" | "B", Origem]> = [
      ["9", "A", { tipo: "VENCEDOR", partidaId: "1" }],
      ["9", "B", { tipo: "VENCEDOR", partidaId: "2" }],
      ["10", "A", { tipo: "VENCEDOR", partidaId: "3" }],
      ["10", "B", { tipo: "VENCEDOR", partidaId: "4" }],
      ["11", "A", { tipo: "VENCEDOR", partidaId: "5" }],
      ["11", "B", { tipo: "VENCEDOR", partidaId: "6" }],
      ["12", "A", { tipo: "VENCEDOR", partidaId: "7" }],
      ["12", "B", { tipo: "VENCEDOR", partidaId: "8" }],
      ["13", "A", { tipo: "VENCEDOR", partidaId: "9" }],
      ["13", "B", { tipo: "VENCEDOR", partidaId: "10" }],
      ["14", "A", { tipo: "VENCEDOR", partidaId: "11" }],
      ["14", "B", { tipo: "VENCEDOR", partidaId: "12" }],
      ["15", "A", { tipo: "VENCEDOR", partidaId: "13" }],
      ["15", "B", { tipo: "VENCEDOR", partidaId: "14" }],
      ["16", "A", { tipo: "VENCEDOR", partidaId: "15" }],
      ["17", "A", { tipo: "PERDEDOR", partidaId: "1" }],
      ["17", "B", { tipo: "PERDEDOR", partidaId: "2" }],
      ["18", "A", { tipo: "PERDEDOR", partidaId: "3" }],
      ["18", "B", { tipo: "PERDEDOR", partidaId: "4" }],
      ["19", "A", { tipo: "PERDEDOR", partidaId: "5" }],
      ["19", "B", { tipo: "PERDEDOR", partidaId: "6" }],
      ["20", "A", { tipo: "PERDEDOR", partidaId: "7" }],
      ["20", "B", { tipo: "PERDEDOR", partidaId: "8" }],
      ["21", "A", { tipo: "VENCEDOR", partidaId: "17" }],
      ["21", "B", { tipo: "PERDEDOR", partidaId: "9" }],
      ["22", "A", { tipo: "VENCEDOR", partidaId: "18" }],
      ["22", "B", { tipo: "PERDEDOR", partidaId: "10" }],
      ["23", "A", { tipo: "VENCEDOR", partidaId: "19" }],
      ["23", "B", { tipo: "PERDEDOR", partidaId: "11" }],
      ["24", "A", { tipo: "VENCEDOR", partidaId: "20" }],
      ["24", "B", { tipo: "PERDEDOR", partidaId: "12" }],
      ["25", "B", { tipo: "VENCEDOR", partidaId: "21" }],
      ["26", "B", { tipo: "VENCEDOR", partidaId: "24" }],
      ["29", "A", { tipo: "PERDEDOR", partidaId: "27" }],
      ["29", "B", { tipo: "PERDEDOR", partidaId: "28" }],
      ["30", "A", { tipo: "VENCEDOR", partidaId: "27" }],
      ["30", "B", { tipo: "VENCEDOR", partidaId: "28" }],
    ];
    for (const [id, lado, esperada] of confirmadas) {
      expect(origem(jogo(partidas, id), lado)).toEqual(esperada);
    }

    const semPonteiro: Array<[string, "A" | "B", string]> = [
      ["16", "B", "Sem ponteiro"],
      ["25", "A", "Semifinalista C"],
      ["26", "A", "Semifinalista D"],
      ["27", "A", "Semifinalista B"],
      ["27", "B", "Semifinalista C"],
      ["28", "A", "Semifinalista A"],
      ["28", "B", "Semifinalista D"],
    ];
    for (const [id, lado, rotulo] of semPonteiro) {
      expect(origem(jogo(partidas, id), lado)).toEqual({ tipo: "SEM_PONTEIRO", rotulo });
    }
    expect(textoDaVaga(jogo(partidas, "28").origemA)).toBe("Semifinalista A");
    expect(textoDaVaga(jogo(partidas, "1").origemA)).toBeNull();
    expect(rotuloDaPartida32("29", "FINAL")).toBe("Jogo 29 · Finais · Disputa de 3º lugar");
    expect(rotuloDaPartida32("30", "FINAL")).toBe("Jogo 30 · Finais · Final");
    expect(rotuloDaPartida32("17", "PERDEDORES")).toBe("Jogo 17 · Perdedores");
  });

  it("move vencedor e perdedor do jogo 1 e deixa a ponta solta sem folga", () => {
    let estado = criarEstadoInicial(ids(16), "FOLHA_32");
    estado = aplicarVitoria(estado, "1", "e1").estado;
    const nove = jogo(estado.partidas, "9");
    const dezessete = jogo(estado.partidas, "17");
    const dez = jogo(estado.partidas, "10");
    expect(nove.equipeAId).toBe("e1");
    expect(nove.equipeBId).toBeNull();
    expect(nove.status).toBe("AGUARDANDO");
    expect(dezessete.equipeAId).toBe("e16");
    expect(dezessete.status).toBe("AGUARDANDO");
    expect(dez.equipeAId).toBeNull();
    expect(dez.equipeBId).toBeNull();

    const dezesseis = jogo(estado.partidas, "16");
    expect(dezesseis.status).toBe("AGUARDANDO");
    expect(dezesseis.equipeAId).toBeNull();
    expect(dezesseis.equipeBId).toBeNull();
    expect(jogo(estado.partidas, "27").status).toBe("AGUARDANDO");
    expect(jogo(estado.partidas, "27").equipeAId).toBeNull();
    expect(estado.derrotas.e16).toBe(1);
    expect(estado.derrotas.e1).toBe(0);
  });

  it("trata vaga vazia da equipe 16 como folga e não soma derrota", () => {
    const estado = criarEstadoInicial(ids(15), "FOLHA_32");
    const primeiro = jogo(estado.partidas, "1");
    expect(primeiro.status).toBe("BYE");
    expect(primeiro.vencedorId).toBe("e1");
    expect(primeiro.perdedorId).toBeNull();
    const campanha = campanhaDaEquipe(estado.partidas, "e1");
    expect(campanha.derrotas).toBe(0);
    expect(campanha.vitorias).toBe(0);
    expect(() => criarEstadoInicial(ids(17), "FOLHA_32")).toThrow(/16 equipes/);
  });
});
