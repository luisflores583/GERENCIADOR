import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classificar, montarResumo, situacaoDaEquipe } from "@/engine/classificacao";
import {
  aplicarResultado,
  auditarEstado,
  criarEstadoInicial,
  descreverEstado,
  planejarCorrecao,
  reexecutar,
  type EstadoChave,
  type PartidaMotor,
  type ResultadoRegistrado,
} from "@/engine/dupla-eliminacao";
import { REGRAS_PADRAO, validarPlacar } from "@/engine/placar";
import { afirmarMesmoTorneio, pode } from "@/engine/permissoes";
import { distribuirQuadras, validarTrocaDeQuadra, type PartidaOperacional, type QuadraOperacional } from "@/engine/quadras";
import { embaralhar, sortearEquipes, tamanhoDaEquipe, validarElenco } from "@/engine/sorteio";
import { assinar, publicar } from "@/engine/tempo-real";

const REGRAS = REGRAS_PADRAO;

function ids(quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, indice) => `eq${indice + 1}`);
}

function simular(
  quantidade: number,
  escolher: (partida: PartidaMotor) => "A" | "B",
): EstadoChave {
  let estado = criarEstadoInicial(ids(quantidade));
  let passos = 0;
  while (!estado.completa) {
    if (++passos > 500) {
      throw new Error(`Torneio de ${quantidade} não terminou.\n${descreverEstado(estado)}`);
    }
    const prontas = estado.partidas.filter((partida) => partida.status === "PRONTA");
    if (prontas.length === 0) {
      throw new Error(`Torneio de ${quantidade} parou sem partida pronta.\n${descreverEstado(estado)}`);
    }
    const partida = prontas[0]!;
    const lado = escolher(partida);
    const placarA = lado === "A" ? 21 : 16;
    const placarB = lado === "A" ? 16 : 21;
    try {
      estado = aplicarResultado(estado, partida.id, placarA, placarB, REGRAS).estado;
    } catch (erro) {
      throw new Error(
        `Torneio de ${quantidade} falhou em ${partida.id}: ${erro instanceof Error ? erro.message : erro}`,
      );
    }
  }
  auditarEstado(estado);
  return estado;
}

function jogarAte(estado: EstadoChave, limite: number, escolher: (partida: PartidaMotor) => "A" | "B" = () => "A") {
  const resultados: ResultadoRegistrado[] = [];
  let atual = estado;
  let passos = 0;
  while (resultados.length < limite) {
    if (++passos > 500) throw new Error(`Não houve partidas suficientes.\n${descreverEstado(atual)}`);
    const partida = atual.partidas.find((item) => item.status === "PRONTA");
    if (!partida || !partida.equipeAId || !partida.equipeBId) {
      throw new Error(`Sem partida pronta.\n${descreverEstado(atual)}`);
    }
    const lado = escolher(partida);
    const placarA = lado === "A" ? 21 : 15;
    const placarB = lado === "A" ? 15 : 21;
    resultados.push({
      partidaId: partida.id,
      placarA,
      placarB,
      equipeAId: partida.equipeAId,
      equipeBId: partida.equipeBId,
    });
    atual = aplicarResultado(atual, partida.id, placarA, placarB, REGRAS).estado;
  }
  return { estado: atual, resultados };
}

function partidaOp(
  parcial: Pick<PartidaOperacional, "id" | "status" | "equipeAId" | "equipeBId"> &
    Partial<PartidaOperacional>,
): PartidaOperacional {
  return {
    chave: "VENCEDORES",
    rodada: 1,
    quadraId: null,
    prontaEm: 1,
    inicioEm: null,
    fimEm: null,
    ...parcial,
  };
}

describe("critérios de aceitação", () => {
  it("critério 01 — cria torneio de duplas com equipes formadas", () => {
    expect(tamanhoDaEquipe("DUPLA")).toBe(2);
    expect(validarElenco("DUPLA", 2).ok).toBe(true);
    expect(validarElenco("DUPLA", 1).ok).toBe(false);
    expect(validarElenco("DUPLA", 3).ok).toBe(false);
    const estado = criarEstadoInicial(["sol", "mare"]);
    expect(estado.partidas.some((partida) => partida.chave === "VENCEDORES")).toBe(true);
    expect(estado.partidas.some((partida) => partida.chave === "FINAL")).toBe(true);
  });

  it("critério 02 — cria torneio de trios com equipes formadas", () => {
    expect(tamanhoDaEquipe("TRIO")).toBe(3);
    expect(validarElenco("TRIO", 3).ok).toBe(true);
    expect(validarElenco("TRIO", 2).ok).toBe(false);
    const estado = simular(3, () => "A");
    expect(estado.completa).toBe(true);
    expect(estado.equipesIds).toHaveLength(3);
  });

  it("critério 03 — cria torneio de quartetos com equipes formadas", () => {
    expect(tamanhoDaEquipe("QUARTETO")).toBe(4);
    expect(validarElenco("QUARTETO", 4).ok).toBe(true);
    expect(validarElenco("QUARTETO", 3).ok).toBe(false);
    const estado = simular(4, () => "A");
    expect(estado.campeaoId).toBeTruthy();
  });

  it("critério 04 — sorteia equipes a partir de inscrições individuais, sem descartar sobra", () => {
    const atletas = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const sorteio = sortearEquipes({
      atletaIds: atletas,
      formato: "DUPLA",
      semente: 42,
      autorizarIncompleta: false,
    });
    expect(sorteio.ok).toBe(true);
    if (!sorteio.ok) return;
    expect(sorteio.equipes).toHaveLength(4);
    expect(sorteio.equipes.every((equipe) => equipe.atletaIds.length === 2)).toBe(true);
    const repetido = sortearEquipes({
      atletaIds: atletas,
      formato: "DUPLA",
      semente: 42,
      autorizarIncompleta: false,
    });
    expect(repetido).toEqual(sorteio);

    const sobra = sortearEquipes({
      atletaIds: ["a", "b", "c", "d", "e"],
      formato: "DUPLA",
      semente: 7,
      autorizarIncompleta: false,
    });
    expect(sobra.ok).toBe(false);
    if (sobra.ok) return;
    expect(sobra.sobra).toBe(1);
    expect(sobra.alternativas.length).toBeGreaterThanOrEqual(3);
    expect(sobra.mensagem.toLowerCase()).toContain("ninguém foi excluído");
  });

  it("critério 05 — valida a quantidade de integrantes e só aceita incompleta com autorização", () => {
    expect(validarElenco("DUPLA", 2).ok).toBe(true);
    expect(validarElenco("TRIO", 3).ok).toBe(true);
    expect(validarElenco("QUARTETO", 4).ok).toBe(true);
    expect(validarElenco("DUPLA", 1, false).ok).toBe(false);
    expect(validarElenco("DUPLA", 1, true).ok).toBe(true);

    const autorizado = sortearEquipes({
      atletaIds: ["a", "b", "c", "d", "e"],
      formato: "DUPLA",
      semente: 9,
      autorizarIncompleta: true,
    });
    expect(autorizado.ok).toBe(true);
    if (!autorizado.ok) return;
    expect(autorizado.equipes).toHaveLength(3);
    expect(autorizado.equipes.filter((equipe) => equipe.incompleta)).toHaveLength(1);
    expect(autorizado.equipes.flatMap((equipe) => equipe.atletaIds).sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("critério 06 — sorteia a primeira rodada uma única vez e sem repetir equipe", () => {
    const equipes = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ordem = embaralhar(equipes, 99);
    expect(ordem).toHaveLength(8);
    expect(new Set(ordem).size).toBe(8);
    expect(embaralhar(equipes, 99)).toEqual(ordem);

    const estado = criarEstadoInicial(ordem);
    const primeira = estado.partidas.filter((partida) => partida.chave === "VENCEDORES" && partida.rodada === 1);
    const presentes = primeira.flatMap((partida) => [partida.equipeAId, partida.equipeBId]).filter(Boolean);
    expect(new Set(presentes).size).toBe(presentes.length);
    expect(primeira.every((partida) => partida.status === "PRONTA" || partida.status === "BYE")).toBe(true);
  });

  it("critério 07 — distribui jogos entre duas ou mais quadras e mantém a fila", () => {
    const quadras: QuadraOperacional[] = [
      { id: "q1", habilitada: true, indisponivelAte: null },
      { id: "q2", habilitada: true, indisponivelAte: null },
    ];
    const partidas = ["m1", "m2", "m3", "m4"].map((id, indice) =>
      partidaOp({
        id,
        status: "PRONTA",
        equipeAId: `a${indice}`,
        equipeBId: `b${indice}`,
        prontaEm: indice + 1,
      }),
    );
    const distribuicao = distribuirQuadras({
      partidas,
      quadras,
      agora: 100,
      maxSimultaneas: 2,
      descansoMinutos: 0,
    });
    const agendadas = distribuicao.partidas.filter((partida) => partida.status === "AGENDADA");
    expect(agendadas).toHaveLength(2);
    expect(new Set(agendadas.map((partida) => partida.quadraId)).size).toBe(2);
    expect(distribuicao.fila).toHaveLength(2);
  });

  it("critério 08 — confirma resultado e libera o próximo confronto sem esperar a rodada inteira", () => {
    let estado = criarEstadoInicial(ids(8));
    const alimentamSemi = ["V1-0", "V1-1"];
    for (const id of alimentamSemi) {
      const partida = estado.partidas.find((item) => item.id === id)!;
      estado = aplicarResultado(estado, id, 21, 15, REGRAS).estado;
      expect(partida.equipeAId).toBeTruthy();
    }
    const semi = estado.partidas.find((partida) => partida.id === "V2-0")!;
    const outraSemi = estado.partidas.find((partida) => partida.id === "V2-1")!;
    const aindaNaRodada = estado.partidas.filter(
      (partida) => partida.id === "V1-2" || partida.id === "V1-3",
    );
    expect(semi.status).toBe("PRONTA");
    expect(semi.equipeAId).toBeTruthy();
    expect(semi.equipeBId).toBeTruthy();
    expect(outraSemi.status).not.toBe("CONCLUIDA");
    expect(aindaNaRodada.every((partida) => partida.status === "PRONTA")).toBe(true);
  });

  it("critério 09 — transfere quem perde a primeira vez para a chave dos perdedores", () => {
    let estado = criarEstadoInicial(ids(8));
    const partida = estado.partidas.find((item) => item.id === "V1-0")!;
    const perdedor = partida.equipeBId!;
    estado = aplicarResultado(estado, "V1-0", 21, 12, REGRAS).estado;
    expect(estado.derrotas[perdedor]).toBe(1);
    expect(situacaoDaEquipe(perdedor, 1, null, null)).toBe("UMA_DERROTA");
    const naChaveDosPerdedores = estado.partidas.some(
      (item) =>
        item.chave === "PERDEDORES" &&
        (item.equipeAId === perdedor || item.equipeBId === perdedor || item.vencedorId === perdedor),
    );
    expect(naChaveDosPerdedores).toBe(true);
  });

  it("critério 10 — elimina a equipe na segunda derrota e não a escala de novo", () => {
    const estado = simular(4, (partida) => (partida.chave === "PERDEDORES" ? "A" : "A"));
    const eliminadas = estado.equipesIds.filter((equipeId) => (estado.derrotas[equipeId] ?? 0) >= 2);
    expect(eliminadas.length).toBe(estado.equipesIds.length - 1);
    for (const equipeId of eliminadas) {
      const escalada = estado.partidas.some(
        (partida) =>
          (partida.status === "PRONTA" || partida.status === "AGUARDANDO") &&
          (partida.equipeAId === equipeId || partida.equipeBId === equipeId),
      );
      expect(escalada).toBe(false);
    }
  });

  it("critério 11 — libera a quadra quando a partida termina", () => {
    const quadras: QuadraOperacional[] = [{ id: "q1", habilitada: true, indisponivelAte: null }];
    const antes = [
      partidaOp({
        id: "m1",
        status: "EM_ANDAMENTO",
        equipeAId: "a",
        equipeBId: "b",
        quadraId: "q1",
        inicioEm: 10,
      }),
      partidaOp({ id: "m2", status: "PRONTA", equipeAId: "c", equipeBId: "d", prontaEm: 11 }),
    ];
    const ocupada = distribuirQuadras({
      partidas: antes,
      quadras,
      agora: 20,
      maxSimultaneas: 1,
      descansoMinutos: 0,
    });
    expect(ocupada.partidas.find((partida) => partida.id === "m2")?.quadraId).toBeNull();

    const depois = distribuirQuadras({
      partidas: [
        { ...antes[0]!, status: "CONCLUIDA", fimEm: 30 },
        antes[1]!,
      ],
      quadras,
      agora: 40,
      maxSimultaneas: 1,
      descansoMinutos: 0,
    });
    const liberada = depois.partidas.find((partida) => partida.id === "m2")!;
    expect(liberada.quadraId).toBe("q1");
    expect(liberada.status).toBe("AGENDADA");
  });

  it("critério 12 — impede a mesma equipe e a mesma quadra em dois jogos simultâneos", () => {
    const quadras: QuadraOperacional[] = [
      { id: "q1", habilitada: true, indisponivelAte: null },
      { id: "q2", habilitada: true, indisponivelAte: null },
    ];
    const distribuicao = distribuirQuadras({
      partidas: [
        partidaOp({
          id: "m1",
          status: "EM_ANDAMENTO",
          equipeAId: "a",
          equipeBId: "b",
          quadraId: "q1",
        }),
        partidaOp({ id: "m2", status: "PRONTA", equipeAId: "a", equipeBId: "c", prontaEm: 2 }),
        partidaOp({ id: "m3", status: "PRONTA", equipeAId: "e", equipeBId: "f", prontaEm: 3 }),
      ],
      quadras,
      agora: 50,
      maxSimultaneas: 2,
      descansoMinutos: 0,
    });
    const segunda = distribuicao.partidas.find((partida) => partida.id === "m2")!;
    const terceira = distribuicao.partidas.find((partida) => partida.id === "m3")!;
    expect(segunda.quadraId).toBeNull();
    expect(terceira.quadraId).toBe("q2");
    expect(distribuicao.fila).toContain("m2");

    const trocaInvalida = validarTrocaDeQuadra({
      partidas: distribuicao.partidas,
      partidaId: "m3",
      quadraId: "q1",
      quadras,
      agora: 50,
    });
    expect(trocaInvalida.ok).toBe(false);

    const trocaValida = validarTrocaDeQuadra({
      partidas: [
        partidaOp({ id: "m1", status: "CONCLUIDA", equipeAId: "a", equipeBId: "b", quadraId: "q1", fimEm: 10 }),
        partidaOp({ id: "m3", status: "AGENDADA", equipeAId: "e", equipeBId: "f", quadraId: "q2" }),
      ],
      partidaId: "m3",
      quadraId: "q1",
      quadras,
      agora: 80,
    });
    expect(trocaValida.ok).toBe(true);

    const indisponivel = validarTrocaDeQuadra({
      partidas: [partidaOp({ id: "m3", status: "PRONTA", equipeAId: "e", equipeBId: "f" })],
      partidaId: "m3",
      quadraId: "q2",
      quadras: [
        quadras[0]!,
        { id: "q2", habilitada: true, indisponivelAte: 200 },
      ],
      agora: 80,
    });
    expect(indisponivel.ok).toBe(false);
  });

  it("critério 13 — atualiza o resumo do painel e publica o evento ao vivo", () => {
    const estado = criarEstadoInicial(ids(4));
    const antes = montarResumo(estado);
    const partida = estado.partidas.find((item) => item.status === "PRONTA")!;
    const perdedor = partida.equipeBId!;
    const depoisEstado = aplicarResultado(estado, partida.id, 21, 18, REGRAS).estado;
    const depois = montarResumo(depoisEstado);
    const partidaAntes = antes.partidas.find((item) => item.id === partida.id)!;
    const partidaDepois = depois.partidas.find((item) => item.id === partida.id)!;
    expect(partidaAntes.placarA).toBeNull();
    expect(partidaDepois.placarA).toBe(21);
    expect(partidaDepois.status).toBe("CONCLUIDA");
    expect(depois.equipes.find((equipe) => equipe.id === perdedor)?.situacao).toBe("UMA_DERROTA");

    const recebidos: string[] = [];
    const cancelar = assinar("torneio-painel", (evento) => recebidos.push(evento.tipo));
    publicar("torneio-painel", "resultado");
    cancelar();
    publicar("torneio-painel", "ignorado");
    expect(recebidos).toEqual(["resultado"]);
  });

  it("critério 14 — disputa a final e a final extra sem declarar campeão cedo", () => {
    let estado = criarEstadoInicial(ids(8));
    let guard = 0;
    while (estado.partidas.find((partida) => partida.id === "F1")?.status !== "PRONTA") {
      if (++guard > 400) throw new Error(descreverEstado(estado));
      const partida = estado.partidas.find((item) => item.status === "PRONTA" && item.id !== "F1");
      if (!partida) throw new Error(descreverEstado(estado));
      estado = aplicarResultado(estado, partida.id, 21, 14, REGRAS).estado;
    }
    const final = estado.partidas.find((partida) => partida.id === "F1")!;
    expect(estado.completa).toBe(false);
    expect(estado.campeaoId).toBeNull();
    expect(estado.derrotas[final.equipeAId!]).toBe(0);
    expect(estado.derrotas[final.equipeBId!]).toBe(1);

    estado = aplicarResultado(estado, "F1", 12, 21, REGRAS).estado;
    const extra = estado.partidas.find((partida) => partida.id === "F2")!;
    expect(estado.completa).toBe(false);
    expect(estado.campeaoId).toBeNull();
    expect(extra.status).toBe("PRONTA");
    expect(new Set([extra.equipeAId, extra.equipeBId])).toEqual(new Set([final.equipeAId, final.equipeBId]));

    estado = aplicarResultado(estado, "F2", 21, 19, REGRAS).estado;
    expect(estado.completa).toBe(true);
    expect(estado.campeaoId).toBe(extra.equipeAId);
    expect(estado.derrotas[estado.campeaoId!]).toBe(1);
    expect(classificar(estado)[0]?.equipeId).toBe(estado.campeaoId);
    expect(classificar(estado)[1]?.equipeId).toBe(estado.viceId);
  });

  it("critério 15 — corrige um resultado e só recalcula dependências confirmadas depois da confirmação", () => {
    const inicial = criarEstadoInicial(ids(8));
    const jogado = jogarAte(inicial, 5);
    const primeiro = jogado.resultados[0]!;
    expect(jogado.estado.partidas.find((partida) => partida.id === "V2-0")?.status).toBe("CONCLUIDA");
    const invertidoA = primeiro.placarA === 21 ? 15 : 21;
    const invertidoB = primeiro.placarB === 15 ? 21 : 15;
    const plano = planejarCorrecao(
      inicial.equipesIds,
      jogado.resultados,
      primeiro.partidaId,
      invertidoA,
      invertidoB,
      REGRAS,
    );
    expect(plano.idempotente).toBe(false);
    expect(plano.precisaConfirmacao).toBe(true);
    expect(plano.invalidados.length).toBeGreaterThan(0);

    const mesmo = planejarCorrecao(
      inicial.equipesIds,
      jogado.resultados,
      primeiro.partidaId,
      primeiro.placarA,
      primeiro.placarB,
      REGRAS,
    );
    expect(mesmo.idempotente).toBe(true);

    const aplicado = reexecutar(
      inicial.equipesIds,
      jogado.resultados.map((resultado) =>
        resultado.partidaId === primeiro.partidaId
          ? { ...resultado, placarA: invertidoA, placarB: invertidoB }
          : resultado,
      ),
      REGRAS,
    );
    auditarEstado(aplicado.estado);
    const somaVitorias = Object.values(aplicado.estado.vitorias).reduce((soma, valor) => soma + valor, 0);
    const concluidas = aplicado.estado.partidas.filter((partida) => partida.status === "CONCLUIDA").length;
    expect(somaVitorias).toBe(concluidas);
    expect(aplicado.invalidados.map((item) => item.partidaId)).not.toContain(primeiro.partidaId);
  });

  it("critério 16 — não duplica partida nem contabiliza a vitória duas vezes", () => {
    const estado = criarEstadoInicial(ids(6));
    const idsPartidas = estado.partidas.map((partida) => partida.id);
    expect(new Set(idsPartidas).size).toBe(idsPartidas.length);
    const partida = estado.partidas.find((item) => item.status === "PRONTA")!;
    const primeira = aplicarResultado(estado, partida.id, 21, 19, REGRAS);
    const segunda = aplicarResultado(primeira.estado, partida.id, 21, 19, REGRAS);
    expect(segunda.idempotente).toBe(true);
    expect(segunda.estado.vitorias).toEqual(primeira.estado.vitorias);
    expect(segunda.estado.derrotas).toEqual(primeira.estado.derrotas);
    expect(segunda.estado.partidas.map((item) => item.id)).toEqual(idsPartidas);
    expect(() => aplicarResultado(primeira.estado, partida.id, 21, 10, REGRAS)).toThrow(/já foi confirmado/i);
  });

  it("critério 17 — completa chaves cujo número de equipes não é potência de dois", () => {
    for (const quantidade of [3, 5, 6, 7, 9, 12]) {
      const invicta = simular(quantidade, () => "A");
      const comReset = simular(quantidade, (partida) => (partida.id === "F1" || partida.id === "F2" ? "B" : "A"));
      expect(invicta.completa, `invicta ${quantidade}`).toBe(true);
      expect(invicta.derrotas[invicta.campeaoId!]).toBe(0);
      expect(invicta.partidas.find((partida) => partida.id === "F2")?.status).toBe("NAO_NECESSARIA");
      expect(comReset.completa, `reset ${quantidade}`).toBe(true);
      expect(comReset.derrotas[comReset.campeaoId!]).toBe(1);
      expect(comReset.partidas.find((partida) => partida.id === "F2")?.status).toBe("CONCLUIDA");
    }
  });

  it("critério 18 — layout responsivo, viewport e alvos de toque", () => {
    const botao = readFileSync("src/components/botao.tsx", "utf8");
    const painel = readFileSync("src/components/painel-ao-vivo.tsx", "utf8");
    const chave = readFileSync("src/components/chave-visual.tsx", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const campo = readFileSync("src/components/campo.tsx", "utf8");
    expect(botao).toContain("min-h-14");
    expect(botao).toContain("text-base");
    expect(painel).toMatch(/sm:|md:|lg:/);
    expect(chave).toContain("overflow-x-auto");
    expect(layout).toContain("device-width");
    expect(layout).toContain('lang="pt-BR"');
    expect(campo).toContain("text-base");
    expect(layout).toContain("min-h-14");
  });

  it("critério 19 — separa permissões de administrador e atleta", () => {
    expect(pode("ADMIN", "resultado.confirmar")).toBe(true);
    expect(pode("ADMIN", "resultado.corrigir")).toBe(true);
    expect(pode("ADMIN", "torneio.finalizar")).toBe(true);
    expect(pode("ADMIN", "sorteio.confirmar")).toBe(true);
    expect(pode("ATLETA", "resultado.confirmar")).toBe(false);
    expect(pode("ATLETA", "resultado.corrigir")).toBe(false);
    expect(pode("ATLETA", "torneio.criar")).toBe(false);
    expect(pode("ATLETA", "inscricao.criar")).toBe(true);
    expect(pode("ATLETA", "perfil.editar")).toBe(true);
    expect(pode("ATLETA", "chave.ver")).toBe(true);
    expect(pode("ADMIN", "perfil.editar")).toBe(false);
  });

  it("critério 20 — isola torneios, equipes e resultados", () => {
    const primeiro = criarEstadoInicial(["a1", "a2", "a3", "a4"]);
    const segundo = criarEstadoInicial(["b1", "b2", "b3", "b4"]);
    const partida = primeiro.partidas.find((item) => item.status === "PRONTA")!;
    const alterado = aplicarResultado(primeiro, partida.id, 21, 11, REGRAS).estado;
    expect(segundo).toEqual(criarEstadoInicial(["b1", "b2", "b3", "b4"]));
    expect(alterado.derrotas).not.toEqual(segundo.derrotas);
    expect(() => afirmarMesmoTorneio("torneio-a", "torneio-b")).toThrow(/não pertence/i);
    expect(() => afirmarMesmoTorneio("torneio-a", "torneio-a")).not.toThrow();
    expect(validarPlacar(21, 19, REGRAS).ok).toBe(true);
    expect(validarPlacar(21, 20, REGRAS).ok).toBe(false);
    expect(validarPlacar(15, 14, { pontosParaVencer: 15, diferencaMinima: 2, pontosMaximos: 17 }).ok).toBe(false);
    expect(validarPlacar(17, 16, { pontosParaVencer: 15, diferencaMinima: 2, pontosMaximos: 17 }).ok).toBe(true);
  });

  it("simula torneios de 2 a 16 equipes com resultados variados", () => {
    for (let quantidade = 2; quantidade <= 16; quantidade++) {
      simular(quantidade, () => "A");
      simular(quantidade, () => "B");
      simular(quantidade, (partida) => (partida.posicao % 2 === 0 ? "A" : "B"));
    }
  });
});
