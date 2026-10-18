import { describe, expect, it } from "vitest";
import {
  aplicarResultado,
  aplicarVitoria,
  criarEstadoInicial,
  planejarCorrecaoDeVencedor,
  reexecutar,
  type Origem,
  type PartidaMotor,
} from "@/engine/dupla-eliminacao";
import {
  JOGOS_SEM_DESTINO_DE_PERDEDOR,
  JOGOS_SEM_DESTINO_DE_VENCEDOR,
  construirFolha16,
} from "@/engine/folha-16";
import { embaralhar, ordenarRanking, ordemDasVagas } from "@/engine/sorteio";

const REGRAS = { pontosParaVencer: 21, diferencaMinima: 2, pontosMaximos: null };

function ids(quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, indice) => `e${indice + 1}`);
}

function origemIgual(origem: Origem, esperada: Origem): boolean {
  return JSON.stringify(origem) === JSON.stringify(esperada);
}

function jogo(partidas: PartidaMotor[], id: string): PartidaMotor {
  const partida = partidas.find((item) => item.id === id);
  if (!partida) throw new Error(`Jogo ${id} ausente`);
  return partida;
}

describe("tabela de até 16 times", () => {
  it("cria trinta códigos únicos e não chama a chave genérica", () => {
    const partidas = construirFolha16();
    const codigos = partidas.map((partida) => partida.id);
    expect(codigos).toHaveLength(30);
    expect(new Set(codigos).size).toBe(30);
    expect(codigos).toEqual(Array.from({ length: 30 }, (_, indice) => String(indice + 1)));
    expect(codigos).not.toContain("F1");
    expect(codigos).not.toContain("V1-0");

    const estado = criarEstadoInicial(ids(16), "FOLHA_16");
    expect(estado.modelo).toBe("FOLHA_16");
    expect(estado.partidas.map((partida) => partida.id)).toEqual(codigos);
    expect(estado.campeaoId).toBeNull();
    expect(estado.campeaoOuroId).toBeNull();
    expect(estado.campeaoPrataId).toBeNull();
  });

  it("mantém a chave automática para os outros torneios", () => {
    const generica = criarEstadoInicial(ids(8));
    expect(generica.modelo).toBe("GENERICA");
    expect(generica.partidas.some((partida) => partida.id === "F1")).toBe(true);
    expect(generica.partidas.some((partida) => partida.id === "F2")).toBe(true);
    expect(generica.partidas).toHaveLength(15);
    expect(() => criarEstadoInicial(ids(17), "FOLHA_16")).toThrow(/16 equipes/);
  });

  it("aponta cada origem confirmada para um jogo real e deixa sem ponteiro a ponta não descrita", () => {
    const partidas = construirFolha16();
    const idsJogos = new Set(partidas.map((partida) => partida.id));

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
      expect(origemIgual(partida.origemA, { tipo: "CABECA", cabeca: ladoA })).toBe(true);
      expect(origemIgual(partida.origemB, { tipo: "CABECA", cabeca: ladoB })).toBe(true);
      expect(partida.chave).toBe("SEM_REGIAO");
    }

    expect(jogo(partidas, "9").chave).toBe("VENCEDORES");
    expect(jogo(partidas, "10").chave).toBe("PERDEDORES");
    expect(jogo(partidas, "21").chave).toBe("SEMIFINALISTA_A");
    expect(jogo(partidas, "23").chave).toBe("SEMIFINALISTA_B");
    expect(jogo(partidas, "25").chave).toBe("SEMIFINALISTA_C");
    expect(jogo(partidas, "26").chave).toBe("SEMIFINALISTA_D");
    expect(jogo(partidas, "27").chave).toBe("SEMIFINAL");
    expect(jogo(partidas, "29").chave).toBe("FINAL");
    expect(jogo(partidas, "17").chave).toBe("SEM_REGIAO");
    expect(jogo(partidas, "22").chave).toBe("SEM_REGIAO");

    for (const partida of partidas) {
      for (const origem of [partida.origemA, partida.origemB]) {
        if (origem.tipo === "CABECA") {
          expect(origem.cabeca).toBeGreaterThanOrEqual(1);
          expect(origem.cabeca).toBeLessThanOrEqual(16);
          continue;
        }
        expect(origem.tipo === "VENCEDOR" || origem.tipo === "PERDEDOR").toBe(true);
        if (origem.tipo === "VENCEDOR" || origem.tipo === "PERDEDOR") {
          expect(idsJogos.has(origem.partidaId)).toBe(true);
          if (origem.tipo === "PERDEDOR") {
            expect(JOGOS_SEM_DESTINO_DE_PERDEDOR).not.toContain(origem.partidaId);
          }
          if (origem.tipo === "VENCEDOR") {
            expect(JOGOS_SEM_DESTINO_DE_VENCEDOR).not.toContain(origem.partidaId);
          }
        }
      }
    }

    const citados = partidas.flatMap((partida) => [partida.origemA, partida.origemB]);
    for (const id of JOGOS_SEM_DESTINO_DE_PERDEDOR) {
      expect(citados.some((origem) => origem.tipo === "PERDEDOR" && origem.partidaId === id)).toBe(false);
    }
    for (const id of JOGOS_SEM_DESTINO_DE_VENCEDOR) {
      expect(citados.some((origem) => origem.tipo === "VENCEDOR" && origem.partidaId === id)).toBe(false);
    }
  });

  it("coloca Dupla 01 na cabeça 1 e mantém a ordem recebida", () => {
    const duplas = Array.from({ length: 16 }, (_, indice) => `Dupla ${String(indice + 1).padStart(2, "0")}`);
    const estado = criarEstadoInicial(duplas, "FOLHA_16");
    const esperados: Record<string, [string, string]> = {
      "1": ["Dupla 01", "Dupla 16"],
      "2": ["Dupla 09", "Dupla 08"],
      "3": ["Dupla 05", "Dupla 12"],
      "4": ["Dupla 04", "Dupla 13"],
      "5": ["Dupla 03", "Dupla 14"],
      "6": ["Dupla 06", "Dupla 11"],
      "7": ["Dupla 07", "Dupla 10"],
      "8": ["Dupla 15", "Dupla 02"],
    };
    for (const [id, [ladoA, ladoB]] of Object.entries(esperados)) {
      const partida = jogo(estado.partidas, id);
      expect(partida.equipeAId).toBe(ladoA);
      expect(partida.equipeBId).toBe(ladoB);
    }

    const foraDeOrdem = [
      { id: "z-dupla-12", nome: "Dupla 01" },
      { id: "a-dupla-04", nome: "Dupla 16" },
      { id: "m-dupla-09", nome: "Dupla 02" },
    ];
    const ordem = ordenarRanking(foraDeOrdem, {});
    expect(ordem).toEqual(["z-dupla-12", "a-dupla-04", "m-dupla-09"]);
    expect(ordem).not.toEqual([...foraDeOrdem].sort((a, b) => a.id.localeCompare(b.id)).map((equipe) => equipe.id));
    expect(ordem).not.toEqual([...foraDeOrdem].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((equipe) => equipe.id));
    expect(ordemDasVagas(foraDeOrdem, "ALEATORIO", 99)).toEqual(embaralhar(ordem, 99));
    expect(ordemDasVagas(foraDeOrdem, "RANKING", 99)).toEqual(ordem);
  });

  it("preenche as vagas pelo ranking e embaralha no modo aleatório", () => {
    const equipes = Array.from({ length: 16 }, (_, indice) => ({ id: `Dupla ${String(indice + 1).padStart(2, "0")}` }));
    expect(ordenarRanking(equipes, {})).toEqual(equipes.map((equipe) => equipe.id));

    const posicoes: Record<string, number | null> = {};
    posicoes["Dupla 16"] = 1;
    const ranking = ordenarRanking(equipes, posicoes);
    expect(ranking[0]).toBe("Dupla 16");
    expect(ranking.slice(1)).toEqual(equipes.slice(0, 15).map((equipe) => equipe.id));

    const estado = criarEstadoInicial(ranking, "FOLHA_16");
    expect(jogo(estado.partidas, "1").equipeAId).toBe("Dupla 16");
    expect(jogo(estado.partidas, "1").equipeBId).toBe("Dupla 15");
    expect(jogo(estado.partidas, "2").equipeAId).toBe("Dupla 08");
    expect(jogo(estado.partidas, "2").equipeBId).toBe("Dupla 07");

    const aleatorio = ordemDasVagas(equipes, "ALEATORIO", 99);
    expect(aleatorio).toEqual(embaralhar(equipes.map((equipe) => equipe.id), 99));
    expect(new Set(aleatorio)).toEqual(new Set(equipes.map((equipe) => equipe.id)));
    expect(() => ordenarRanking(equipes, { "Dupla 01": 1, "Dupla 02": 1 })).toThrow(/repetida/);
    expect(() => ordenarRanking(equipes, { "Dupla 01": 17 })).toThrow(/fora da lista/);
  });

  it("move vencedor e perdedor só para os destinos transcritos e a correção usa a mesma tabela", () => {
    let estado = criarEstadoInicial(ids(16), "FOLHA_16");
    const abertura = jogo(estado.partidas, "1");
    expect(abertura.equipeAId).toBe("e1");
    expect(abertura.equipeBId).toBe("e16");
    expect(jogo(estado.partidas, "8").equipeAId).toBe("e15");
    expect(jogo(estado.partidas, "8").equipeBId).toBe("e2");

    estado = aplicarResultado(estado, "1", 21, 15, REGRAS).estado;
    const nove = jogo(estado.partidas, "9");
    const dez = jogo(estado.partidas, "10");
    expect(nove.equipeAId).toBe("e1");
    expect(dez.equipeAId).toBe("e16");
    const outros = estado.partidas.filter((partida) => partida.id !== "1" && partida.id !== "9" && partida.id !== "10");
    for (const partida of outros) {
      expect(partida.equipeAId).not.toBe("e1");
      expect(partida.equipeBId).not.toBe("e1");
      expect(partida.equipeAId).not.toBe("e16");
      expect(partida.equipeBId).not.toBe("e16");
    }

    estado = aplicarResultado(estado, "2", 21, 15, REGRAS).estado;
    expect(jogo(estado.partidas, "10").status).toBe("PRONTA");
    estado = aplicarResultado(estado, "10", 21, 12, REGRAS).estado;
    const dezessete = jogo(estado.partidas, "17");
    expect(dezessete.equipeBId).toBe("e16");
    const perdedorDoDez = jogo(estado.partidas, "10").perdedorId;
    for (const partida of estado.partidas) {
      if (partida.id === "2" || partida.id === "10") continue;
      expect(partida.equipeAId).not.toBe(perdedorDoDez);
      expect(partida.equipeBId).not.toBe(perdedorDoDez);
    }

    const corrigido = reexecutar(
      ids(16),
      [{ partidaId: "1", placarA: 15, placarB: 21, equipeAId: "e1", equipeBId: "e16" }],
      REGRAS,
      { modelo: "FOLHA_16" },
    );
    expect(corrigido.estado.partidas.map((partida) => partida.id)).toEqual(
      Array.from({ length: 30 }, (_, indice) => String(indice + 1)),
    );
    expect(jogo(corrigido.estado.partidas, "9").equipeAId).toBe("e16");
    expect(jogo(corrigido.estado.partidas, "10").equipeAId).toBe("e1");
  });

  it("registra só a vitória, avança a folha e não conta a mesma confirmação duas vezes", () => {
    const inicial = criarEstadoInicial(ids(16), "FOLHA_16");
    const primeira = aplicarVitoria(inicial, "1", "e1");
    expect(primeira.idempotente).toBe(false);
    expect(jogo(primeira.estado.partidas, "1").placarA).toBeNull();
    expect(jogo(primeira.estado.partidas, "1").placarB).toBeNull();
    expect(jogo(primeira.estado.partidas, "1").vencedorId).toBe("e1");
    expect(jogo(primeira.estado.partidas, "9").equipeAId).toBe("e1");
    expect(jogo(primeira.estado.partidas, "10").equipeAId).toBe("e16");
    expect(primeira.estado.vitorias.e1).toBe(1);
    expect(primeira.estado.derrotas.e16).toBe(1);

    const repetida = aplicarVitoria(primeira.estado, "1", "e1");
    expect(repetida.idempotente).toBe(true);
    expect(repetida.estado.vitorias).toEqual(primeira.estado.vitorias);
    expect(repetida.estado).toBe(primeira.estado);
    expect(() => aplicarVitoria(primeira.estado, "1", "e16")).toThrow(/já foi confirmada/i);

    const repetidaNaFolha = reexecutar(
      ids(16),
      [
        { partidaId: "1", placarA: null, placarB: null, equipeAId: "e1", equipeBId: "e16", vencedorId: "e1" },
        { partidaId: "1", placarA: null, placarB: null, equipeAId: "e1", equipeBId: "e16", vencedorId: "e1" },
      ],
      REGRAS,
      { modelo: "FOLHA_16" },
    );
    expect(repetidaNaFolha.estado.vitorias.e1).toBe(1);
    expect(jogo(repetidaNaFolha.estado.partidas, "9").equipeAId).toBe("e1");

    const plano = planejarCorrecaoDeVencedor(
      ids(16),
      [{ partidaId: "1", placarA: null, placarB: null, equipeAId: "e1", equipeBId: "e16", vencedorId: "e1" }],
      "1",
      "e1",
      REGRAS,
      "FOLHA_16",
    );
    expect(plano.idempotente).toBe(true);
    const corrigido = planejarCorrecaoDeVencedor(
      ids(16),
      [{ partidaId: "1", placarA: null, placarB: null, equipeAId: "e1", equipeBId: "e16", vencedorId: "e1" }],
      "1",
      "e16",
      REGRAS,
      "FOLHA_16",
    );
    expect(corrigido.idempotente).toBe(false);
    expect(jogo(corrigido.estado!.partidas, "9").equipeAId).toBe("e16");
    expect(jogo(corrigido.estado!.partidas, "10").equipeAId).toBe("e1");
    expect(corrigido.estado!.vitorias.e16).toBe(1);
    expect(corrigido.estado!.vitorias.e1 ?? 0).toBe(0);
  });

  it("entrega a série Prata ao vencedor do jogo 29 e a série Ouro ao vencedor do jogo 30", () => {
    let estado = criarEstadoInicial(ids(16), "FOLHA_16");
    let guarda = 0;
    while (guarda < 40) {
      const pronta = estado.partidas.find((partida) => partida.status === "PRONTA");
      if (!pronta) break;
      estado = aplicarResultado(estado, pronta.id, 21, 15, REGRAS).estado;
      guarda += 1;
    }
    const prata = jogo(estado.partidas, "29");
    const ouro = jogo(estado.partidas, "30");
    expect(prata.status).toBe("CONCLUIDA");
    expect(ouro.status).toBe("CONCLUIDA");
    expect(estado.campeaoPrataId).toBe(prata.vencedorId);
    expect(estado.campeaoOuroId).toBe(ouro.vencedorId);
    expect(estado.campeaoPrataId).not.toBe(estado.campeaoOuroId);
    expect(estado.campeaoId).toBeNull();
    expect(estado.viceId).toBeNull();
    expect(estado.completa).toBe(true);
  });
});
