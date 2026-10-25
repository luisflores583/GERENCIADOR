import { describe, expect, it } from "vitest";
import { criarEstadoInicial, type EstadoChave, type PartidaMotor } from "@/engine/dupla-eliminacao";
import { rotuloDaPartida } from "@/engine/folha-16";
import { rotuloDaPartida32 } from "@/engine/folha-32";
import { apresentarChave, type PartidaNumeravel } from "@/engine/numeracao";

function ids(quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, indice) => `e${indice + 1}`);
}

function deEstado(estado: EstadoChave) {
  const partidas: PartidaNumeravel[] = estado.partidas.map((partida: PartidaMotor) => ({
    codigo: partida.id,
    chave: partida.chave,
    rodada: partida.rodada,
    posicao: partida.posicao,
    origemA: partida.origemA,
    origemB: partida.origemB,
    equipeAId: partida.equipeAId,
    equipeBId: partida.equipeBId,
    status: partida.status,
  }));
  return apresentarChave(partidas, estado.equipesIds.length, estado.modelo);
}

function numero(estado: EstadoChave, codigo: string): number | null {
  return deEstado(estado).porCodigo.get(codigo)?.numero ?? null;
}

describe("numeração da tabela incompleta", () => {
  it("mantém os números originais da tabela de 16 cheia", () => {
    const estado = criarEstadoInicial(ids(16), "FOLHA_16");
    const apresentada = deEstado(estado);
    expect(apresentada.cheia).toBe(true);
    for (const partida of estado.partidas) {
      const item = apresentada.porCodigo.get(partida.id);
      expect(item?.numero).toBe(Number(partida.id));
      expect(item?.rotulo).toBe(rotuloDaPartida(partida.id, partida.chave));
      expect(item?.classe).toBe("REAL");
    }
    expect(apresentada.porCodigo.get("9")?.vagaA).toBe("vencedor do jogo 1");
    expect(apresentada.porCodigo.get("10")?.vagaB).toBe("perdedor do jogo 2");
    expect(apresentada.porCodigo.get("29")?.rotulo).toBe("Jogo 29 · Finais · Série Prata");
    expect(apresentada.porCodigo.get("30")?.rotulo).toBe("Jogo 30 · Finais · Série Ouro");
  });

  it("mantém os números originais da tabela de 32 cheia", () => {
    const estado = criarEstadoInicial(ids(32), "FOLHA_32");
    const apresentada = deEstado(estado);
    expect(apresentada.cheia).toBe(true);
    expect(estado.partidas.map((partida) => partida.id)).toEqual(Array.from({ length: 62 }, (_, indice) => String(indice + 1)));
    for (const partida of estado.partidas) {
      const item = apresentada.porCodigo.get(partida.id);
      expect(item?.numero).toBe(Number(partida.id));
      expect(item?.rotulo).toBe(rotuloDaPartida32(partida.id, partida.chave));
    }
    expect(apresentada.porCodigo.get("18")?.vagaA).toBe("vencedor do jogo 1");
    expect(apresentada.porCodigo.get("17")?.vagaA).toBe("perdedor do jogo 1");
    expect(apresentada.porCodigo.get("41")?.vagaA).toBe("vencedor do jogo 25");
    expect(apresentada.porCodigo.get("41")?.vagaB).toBe("perdedor do jogo 28");
  });

  it("numera a abertura real de 12 equipes e deixa a folga sem número", () => {
    const estado = criarEstadoInicial(ids(12), "FOLHA_16");
    const apresentada = deEstado(estado);
    expect(apresentada.cheia).toBe(false);
    for (const codigo of ["1", "4", "5", "8"]) {
      const item = apresentada.porCodigo.get(codigo);
      expect(item?.classe).toBe("FOLGA");
      expect(item?.numero).toBeNull();
      expect(item?.rotulo).toBe("Folga");
      expect(item?.aparece).toBe(true);
      expect(item?.lado).toBe("ABERTURA");
    }
    expect(numero(estado, "2")).toBe(1);
    expect(numero(estado, "3")).toBe(2);
    expect(numero(estado, "6")).toBe(3);
    expect(numero(estado, "7")).toBe(4);
    expect(apresentada.porCodigo.get("2")?.rotulo).toBe("Jogo 1");
    expect(apresentada.porCodigo.get("9")?.numero).toBe(5);
    expect(apresentada.porCodigo.get("9")?.lado).toBe("VENCEDORES");
    expect(apresentada.porCodigo.get("9")?.vagaB).toBe("vencedor do jogo 1");
    expect(apresentada.porCodigo.get("10")?.numero).toBeNull();
    expect(apresentada.porCodigo.get("10")?.classe).toBe("FOLGA");
    expect(apresentada.porCodigo.get("10")?.aparece).toBe(false);
    expect(numero(estado, "11")).toBe(6);
    expect(numero(estado, "13")).toBe(7);
    expect(numero(estado, "15")).toBe(8);
    expect(apresentada.porCodigo.get("17")?.lado).toBe("PERDEDORES");
    expect(apresentada.porCodigo.get("17")?.vagaA).toBe("perdedor do jogo 7");
    expect(apresentada.porCodigo.get("17")?.vagaB).toBe("perdedor do jogo 1");
    expect(apresentada.porCodigo.get("29")?.rotulo).toContain("Série Prata");
    expect(apresentada.porCodigo.get("30")?.rotulo).toContain("Série Ouro");

    const reais = [...apresentada.porCodigo.values()].filter((item) => item.classe === "REAL");
    const numeros = reais.map((item) => item.numero).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numeros).toEqual(Array.from({ length: reais.length }, (_, indice) => indice + 1));
    expect([...apresentada.porCodigo.values()].some((item) => item.classe === "FOLGA" && item.numero != null)).toBe(false);
    expect(estado.partidas.map((partida) => partida.id)).toEqual(Array.from({ length: 30 }, (_, indice) => String(indice + 1)));
  });

  it("passa o número ao outro lado quando a etapa só tem folga", () => {
    const estado = criarEstadoInicial(ids(15), "FOLHA_16");
    expect(numero(estado, "1")).toBeNull();
    expect(numero(estado, "2")).toBe(1);
    expect(numero(estado, "8")).toBe(7);
    expect(numero(estado, "9")).toBe(8);
    expect(numero(estado, "10")).toBeNull();
    expect(numero(estado, "11")).toBe(9);
    expect(numero(estado, "12")).toBe(10);
    expect(deEstado(estado).porCodigo.get("12")?.lado).toBe("PERDEDORES");
    expect(deEstado(estado).porCodigo.get("11")?.lado).toBe("VENCEDORES");
  });

  it("numera a abertura real de 24 equipes na tabela de 32", () => {
    const estado = criarEstadoInicial(ids(24), "FOLHA_32");
    const apresentada = deEstado(estado);
    expect(apresentada.cheia).toBe(false);
    for (const codigo of ["1", "4", "5", "8", "9", "12", "13", "16"]) {
      expect(apresentada.porCodigo.get(codigo)?.numero).toBeNull();
      expect(apresentada.porCodigo.get(codigo)?.rotulo).toBe("Folga");
      expect(apresentada.porCodigo.get(codigo)?.lado).toBe("ABERTURA");
    }
    const abertura = ["2", "3", "6", "7", "10", "11", "14", "15"];
    abertura.forEach((codigo, indice) => {
      expect(numero(estado, codigo)).toBe(indice + 1);
      expect(apresentada.porCodigo.get(codigo)?.lado).toBe("ABERTURA");
    });
    expect(numero(estado, "18")).toBe(9);
    expect(apresentada.porCodigo.get("18")?.lado).toBe("VENCEDORES");
    expect(apresentada.porCodigo.get("18")?.vagaB).toBe("vencedor do jogo 1");
    expect(numero(estado, "17")).toBeNull();
    expect(numero(estado, "20")).toBe(10);
    expect(numero(estado, "19")).toBeNull();
    expect(apresentada.porCodigo.get("41")?.vagaA).toBe("perdedor do jogo 5");
    expect(apresentada.porCodigo.get("41")?.vagaB).toBe("perdedor do jogo 14");
    const jogo25 = [...apresentada.porCodigo.values()].find((item) => item.numero === 25);
    expect(jogo25?.codigo).not.toBe("25");
    expect(estado.partidas.find((partida) => partida.id === "14")?.origemA).toEqual({ tipo: "CABECA", cabeca: 23 });
    expect(estado.partidas.find((partida) => partida.id === "41")?.origemB).toEqual({ tipo: "PERDEDOR", partidaId: "28" });
  });

  it("numera a chave automática incompleta e preserva a cheia", () => {
    const cheia = deEstado(criarEstadoInicial(ids(4), "GENERICA"));
    expect(cheia.cheia).toBe(true);
    expect(cheia.porCodigo.get("V1-0")?.numero).toBeNull();
    expect(cheia.porCodigo.get("V1-0")?.rotulo).toBe("Chave dos vencedores · Rodada 1");
    expect([...cheia.porCodigo.values()].every((item) => item.classe === "REAL")).toBe(true);

    const estado = criarEstadoInicial(ids(3), "GENERICA");
    const apresentada = deEstado(estado);
    expect(apresentada.cheia).toBe(false);
    expect(apresentada.porCodigo.get("V1-0")?.classe).toBe("FOLGA");
    expect(apresentada.porCodigo.get("V1-0")?.numero).toBeNull();
    expect(apresentada.porCodigo.get("V1-0")?.rotulo).toBe("Folga");
    expect(apresentada.porCodigo.get("V1-1")?.numero).toBe(1);
    expect(apresentada.porCodigo.get("V1-1")?.lado).toBe("ABERTURA");
    expect(apresentada.porCodigo.get("V2-0")?.numero).toBe(2);
    expect(apresentada.porCodigo.get("V2-0")?.lado).toBe("VENCEDORES");
    expect(apresentada.porCodigo.get("P1-0")?.numero).toBeNull();
    expect(apresentada.porCodigo.get("V2-0")?.vagaB).toBe("vencedor do jogo 1");
    const reais = [...apresentada.porCodigo.values()].filter((item) => item.classe === "REAL");
    expect(reais.map((item) => item.numero).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: reais.length }, (_, indice) => indice + 1),
    );
  });
});
