import { describe, expect, it } from "vitest";
import { aplicarVitoria, criarEstadoInicial, type PartidaMotor } from "@/engine/dupla-eliminacao";
import {
  classificarLados,
  ordenarEntradas,
  partidaEntraNaFila,
  type EntradaDaFila,
} from "@/engine/fila";
import { rotuloDaPartida } from "@/engine/folha-16";
import { rotuloDaPartida32 } from "@/engine/folha-32";
import { distribuirQuadras, type PartidaOperacional, type QuadraOperacional } from "@/engine/quadras";

const QUADRA: QuadraOperacional = { id: "q1", habilitada: true, indisponivelAte: null };

function ids(quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, indice) => `e${indice + 1}`);
}

function entrada(partida: PartidaMotor, prontaEm: number, fimEm: number | null = null): EntradaDaFila {
  return {
    id: partida.id,
    codigo: partida.id,
    chave: partida.chave,
    rodada: partida.rodada,
    posicao: partida.posicao,
    origemA: partida.origemA,
    origemB: partida.origemB,
    status: partida.status,
    equipeAId: partida.equipeAId,
    equipeBId: partida.equipeBId,
    prontaEm,
    inicioEm: null,
    fimEm,
  };
}

function vencer(estado: ReturnType<typeof criarEstadoInicial>, partidaId: string) {
  const partida = estado.partidas.find((item) => item.id === partidaId);
  if (!partida?.equipeAId) throw new Error(`Jogo ${partidaId} sem adversários`);
  return aplicarVitoria(estado, partidaId, partida.equipeAId).estado;
}

function operacional(parcial: Partial<PartidaOperacional> & Pick<PartidaOperacional, "id" | "status">): PartidaOperacional {
  return {
    chave: "VENCEDORES",
    rodada: 1,
    equipeAId: `${parcial.id}-a`,
    equipeBId: `${parcial.id}-b`,
    quadraId: null,
    prontaEm: 1,
    inicioEm: null,
    fimEm: null,
    ...parcial,
  };
}

describe("fila equilibrada", () => {
  it("mantém o número da folha e os confrontos 14 e 41", () => {
    expect(rotuloDaPartida("1", "SEM_REGIAO")).toBe("Jogo 1");
    expect(rotuloDaPartida("2", "SEM_REGIAO")).toBe("Jogo 2");
    expect(rotuloDaPartida32("14", "SEM_REGIAO")).toBe("Jogo 14");
    expect(rotuloDaPartida32("41", "SEM_REGIAO")).toBe("Jogo 41");

    const folha32 = criarEstadoInicial(ids(32), "FOLHA_32");
    const jogo14 = folha32.partidas.find((partida) => partida.id === "14")!;
    const jogo41 = folha32.partidas.find((partida) => partida.id === "41")!;
    expect(jogo14.origemA).toEqual({ tipo: "CABECA", cabeca: 23 });
    expect(jogo14.origemB).toEqual({ tipo: "CABECA", cabeca: 10 });
    expect(jogo41.origemA).toEqual({ tipo: "VENCEDOR", partidaId: "25" });
    expect(jogo41.origemB).toEqual({ tipo: "PERDEDOR", partidaId: "28" });
  });

  it("classifica os lados da folha de 16, da de 32 e da chave automática", () => {
    const folha16 = classificarLados(criarEstadoInicial(ids(16), "FOLHA_16").partidas);
    expect(folha16.get("2")).toBe("VENCEDORES");
    expect(folha16.get("9")).toBe("VENCEDORES");
    expect(folha16.get("10")).toBe("PERDEDORES");
    expect(folha16.get("17")).toBe("PERDEDORES");
    expect(folha16.get("21")).toBe("VENCEDORES");
    expect(folha16.get("22")).toBe("PERDEDORES");
    expect(folha16.get("27")).toBe("OUTRO");
    expect(folha16.get("30")).toBe("OUTRO");

    const folha32 = classificarLados(criarEstadoInicial(ids(32), "FOLHA_32").partidas);
    expect(folha32.get("14")).toBe("VENCEDORES");
    expect(folha32.get("17")).toBe("PERDEDORES");
    expect(folha32.get("18")).toBe("VENCEDORES");
    expect(folha32.get("41")).toBe("PERDEDORES");
    expect(folha32.get("42")).toBe("VENCEDORES");
    expect(folha32.get("59")).toBe("OUTRO");

    const generica = classificarLados(criarEstadoInicial(ids(8)).partidas);
    expect(generica.get("V1-0")).toBe("VENCEDORES");
    expect(generica.get("P1-0")).toBe("PERDEDORES");
    expect(generica.get("F1")).toBe("OUTRO");
  });

  it("deixa a folga e quem espera adversário fora da fila", () => {
    const estado = criarEstadoInicial(ids(12), "FOLHA_16");
    const fila = ordenarEntradas(estado.partidas.map((partida) => entrada(partida, 1)));
    expect(fila.map((partida) => partida.codigo)).toEqual(["2", "3", "6", "7"]);
    expect(fila.every((partida) => partidaEntraNaFila(partida.status, partida.equipeAId, partida.equipeBId))).toBe(true);
    expect(estado.partidas.filter((partida) => partida.status === "BYE").map((partida) => partida.id).sort()).toEqual([
      "1",
      "4",
      "5",
      "8",
    ]);
  });

  it("alterna os lados na tabela de 16 quando os dois já têm adversário", () => {
    let estado = criarEstadoInicial(ids(12), "FOLHA_16");
    for (const id of ["2", "3", "6", "7", "9", "13"]) estado = vencer(estado, id);

    const prontas = new Map(
      estado.partidas.filter((partida) => partida.status === "PRONTA").map((partida) => [partida.id, partida]),
    );
    expect(prontas.has("17")).toBe(true);
    expect(prontas.has("19")).toBe(true);
    expect(prontas.has("11")).toBe(true);
    expect(prontas.has("15")).toBe(true);

    const fila = ordenarEntradas(
      estado.partidas.map((partida) =>
        entrada(partida, partida.status === "CONCLUIDA" ? 1 : prontas.has(partida.id) && Number(partida.id) > 16 ? 3 : 2, partida.status === "CONCLUIDA" ? Number(partida.id) : null),
      ),
    );
    expect(fila.map((partida) => partida.codigo)).toEqual(["17", "11", "19", "15"]);

    const lados = classificarLados(estado.partidas);
    expect(fila.map((partida) => lados.get(partida.codigo))).toEqual([
      "PERDEDORES",
      "VENCEDORES",
      "PERDEDORES",
      "VENCEDORES",
    ]);
    const esperando = estado.partidas.filter((partida) => partida.status === "AGUARDANDO").map((partida) => partida.id);
    expect(fila.some((partida) => esperando.includes(partida.codigo))).toBe(false);
  });

  it("alterna a chave automática e a tabela de 32 sem furar a espera", () => {
    let generica = criarEstadoInicial(ids(8));
    generica = vencer(generica, "V1-0");
    generica = vencer(generica, "V1-1");
    const filaGenerica = ordenarEntradas(
      generica.partidas.map((partida) => {
        const antiga = partida.id === "V1-2" || partida.id === "V1-3";
        return entrada(
          partida,
          partida.status === "CONCLUIDA" ? 1 : antiga ? 1 : 5,
          partida.status === "CONCLUIDA" ? 4 : null,
        );
      }),
    );
    expect(filaGenerica.map((partida) => partida.codigo)).toEqual(["P1-0", "V1-2", "V1-3", "V2-0"]);
    const ladosGenerica = classificarLados(generica.partidas);
    expect(filaGenerica.map((partida) => ladosGenerica.get(partida.codigo))).toEqual([
      "PERDEDORES",
      "VENCEDORES",
      "VENCEDORES",
      "VENCEDORES",
    ]);

    const folha32 = criarEstadoInicial(ids(24), "FOLHA_32");
    const lados = classificarLados(folha32.partidas);
    const prontas = folha32.partidas.filter((partida) => partida.status === "PRONTA");
    const fila32 = ordenarEntradas(folha32.partidas.map((partida) => entrada(partida, 1)));
    expect(fila32.every((partida) => partida.status === "PRONTA")).toBe(true);
    expect(lados.get(fila32[0]!.codigo)).toBe("VENCEDORES");
    expect(prontas.some((partida) => lados.get(partida.id) === "PERDEDORES")).toBe(false);

    const ajustes = new Map([
      ["18", { prontaEm: 8, equipeAId: "a", equipeBId: "b" }],
      ["42", { prontaEm: 8, equipeAId: "c", equipeBId: "d" }],
      ["17", { prontaEm: 2, equipeAId: "e", equipeBId: "f" }],
      ["41", { prontaEm: 9, equipeAId: "g", equipeBId: "h" }],
    ]);
    const manual = folha32.partidas.map((partida) => {
      const ajuste = ajustes.get(partida.id);
      if (!ajuste) return { ...entrada(partida, 1), status: "AGUARDANDO", equipeAId: null, equipeBId: null };
      return { ...entrada(partida, ajuste.prontaEm), status: "PRONTA", equipeAId: ajuste.equipeAId, equipeBId: ajuste.equipeBId };
    });
    expect(ordenarEntradas(manual).map((partida) => partida.codigo)).toEqual(["17", "18", "41", "42"]);
  });

  it("entrega a próxima quadra ao lado que está esperando", () => {
    const distribuicao = distribuirQuadras({
      partidas: [
        operacional({
          id: "w0",
          status: "CONCLUIDA",
          ladoFila: "VENCEDORES",
          fimEm: 50,
          prontaEm: 1,
        }),
        operacional({ id: "w1", status: "PRONTA", ladoFila: "VENCEDORES", prontaEm: 10, ordem: 11 }),
        operacional({
          id: "l1",
          status: "PRONTA",
          chave: "PERDEDORES",
          ladoFila: "PERDEDORES",
          prontaEm: 40,
          ordem: 17,
        }),
        operacional({
          id: "espera",
          status: "AGUARDANDO",
          chave: "PERDEDORES",
          ladoFila: "PERDEDORES",
          equipeBId: null,
          prontaEm: 0,
          ordem: 1,
        }),
        operacional({
          id: "folga",
          status: "BYE",
          equipeBId: null,
          ladoFila: "VENCEDORES",
          prontaEm: 0,
          ordem: 1,
        }),
      ],
      quadras: [QUADRA],
      agora: 80,
      maxSimultaneas: 1,
      descansoMinutos: 0,
    });
    expect(distribuicao.partidas.find((partida) => partida.id === "l1")?.status).toBe("AGENDADA");
    expect(distribuicao.fila).toEqual(["w1"]);
    expect(distribuicao.fila).not.toContain("espera");
    expect(distribuicao.fila).not.toContain("folga");

    const duas = distribuirQuadras({
      partidas: [
        operacional({ id: "w1", status: "PRONTA", ladoFila: "VENCEDORES", prontaEm: 1, ordem: 11 }),
        operacional({ id: "w2", status: "PRONTA", ladoFila: "VENCEDORES", prontaEm: 1, ordem: 15 }),
        operacional({ id: "l1", status: "PRONTA", chave: "PERDEDORES", ladoFila: "PERDEDORES", prontaEm: 1, ordem: 17 }),
        operacional({ id: "l2", status: "PRONTA", chave: "PERDEDORES", ladoFila: "PERDEDORES", prontaEm: 1, ordem: 19 }),
      ],
      quadras: [QUADRA, { id: "q2", habilitada: true, indisponivelAte: null }],
      agora: 10,
      maxSimultaneas: 2,
      descansoMinutos: 0,
    });
    const agendadas = duas.partidas.filter((partida) => partida.status === "AGENDADA").map((partida) => partida.id);
    expect(agendadas).toEqual(["w1", "l1"]);
    expect(duas.fila).toEqual(["w2", "l2"]);
  });
});
