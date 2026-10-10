import { ErroDeRegra } from "@/lib/erros";
import { validarPlacar, type RegrasPlacar } from "@/engine/placar";

export type LadoChave = "VENCEDORES" | "PERDEDORES" | "FINAL" | "FINAL_EXTRA";

export type StatusPartidaMotor =
  | "AGUARDANDO"
  | "PRONTA"
  | "BYE"
  | "VAZIA"
  | "CONCLUIDA"
  | "NAO_NECESSARIA";

export type Origem =
  | { tipo: "CABECA"; cabeca: number }
  | { tipo: "BYE" }
  | { tipo: "VENCEDOR"; partidaId: string }
  | { tipo: "PERDEDOR"; partidaId: string };

export interface PartidaMotor {
  id: string;
  chave: LadoChave;
  rodada: number;
  posicao: number;
  origemA: Origem;
  origemB: Origem;
  equipeAId: string | null;
  equipeBId: string | null;
  vencedorId: string | null;
  perdedorId: string | null;
  placarA: number | null;
  placarB: number | null;
  status: StatusPartidaMotor;
  ordemConclusao: number | null;
}

export interface EstadoChave {
  equipesIds: string[];
  partidas: PartidaMotor[];
  vitorias: Record<string, number>;
  derrotas: Record<string, number>;
  completa: boolean;
  campeaoId: string | null;
  viceId: string | null;
  sequencia: number;
}

export interface ResultadoRegistrado {
  partidaId: string;
  placarA: number;
  placarB: number;
  equipeAId: string;
  equipeBId: string;
}

type Resolvido = { tipo: "PENDENTE" } | { tipo: "BYE" } | { tipo: "EQUIPE"; id: string };

const ABERTAS = new Set<StatusPartidaMotor>(["AGUARDANDO", "PRONTA"]);

export function proximaPotenciaDe2(valor: number): number {
  let potencia = 1;
  while (potencia < valor) potencia <<= 1;
  return potencia;
}

export function ordemCabecas(tamanho: number): number[] {
  let sementes = [1, 2];
  while (sementes.length < tamanho) {
    const proximo: number[] = [];
    const limite = sementes.length * 2 + 1;
    for (const semente of sementes) proximo.push(semente, limite - semente);
    sementes = proximo;
  }
  return sementes;
}

function partidaBase(
  parcial: Pick<PartidaMotor, "id" | "chave" | "rodada" | "posicao" | "origemA" | "origemB">,
): PartidaMotor {
  return {
    ...parcial,
    equipeAId: null,
    equipeBId: null,
    vencedorId: null,
    perdedorId: null,
    placarA: null,
    placarB: null,
    status: "AGUARDANDO",
    ordemConclusao: null,
  };
}

function origemCabeca(cabeca: number, quantidade: number): Origem {
  if (cabeca > quantidade) return { tipo: "BYE" };
  return { tipo: "CABECA", cabeca };
}

function quantidadeNaChaveDePerdedores(potencia: number, rodada: number, ultima: number): number {
  if (rodada === ultima) return 1;
  const par = Math.ceil(rodada / 2);
  return potencia >> (par + 1);
}

export function construirPartidas(quantidadeEquipes: number): PartidaMotor[] {
  const potencia = proximaPotenciaDe2(quantidadeEquipes);
  const rodadasVencedores = Math.log2(potencia);
  const partidas: PartidaMotor[] = [];
  const cabecas = ordemCabecas(potencia);

  for (let rodada = 1; rodada <= rodadasVencedores; rodada++) {
    const quantidade = potencia >> rodada;
    for (let indice = 0; indice < quantidade; indice++) {
      const origemA =
        rodada === 1
          ? origemCabeca(cabecas[indice * 2]!, quantidadeEquipes)
          : { tipo: "VENCEDOR" as const, partidaId: `V${rodada - 1}-${indice * 2}` };
      const origemB =
        rodada === 1
          ? origemCabeca(cabecas[indice * 2 + 1]!, quantidadeEquipes)
          : { tipo: "VENCEDOR" as const, partidaId: `V${rodada - 1}-${indice * 2 + 1}` };
      partidas.push(
        partidaBase({
          id: `V${rodada}-${indice}`,
          chave: "VENCEDORES",
          rodada,
          posicao: indice,
          origemA,
          origemB,
        }),
      );
    }
  }

  if (rodadasVencedores === 1) {
    partidas.push(
      partidaBase({
        id: "F1",
        chave: "FINAL",
        rodada: 1,
        posicao: 0,
        origemA: { tipo: "VENCEDOR", partidaId: "V1-0" },
        origemB: { tipo: "PERDEDOR", partidaId: "V1-0" },
      }),
    );
  } else {
    const ultima = 2 * rodadasVencedores - 2;
    for (let rodada = 1; rodada <= ultima; rodada++) {
      const quantidade = quantidadeNaChaveDePerdedores(potencia, rodada, ultima);
      for (let indice = 0; indice < quantidade; indice++) {
        let origemA: Origem;
        let origemB: Origem;
        if (rodada === 1) {
          origemA = { tipo: "PERDEDOR", partidaId: `V1-${indice * 2}` };
          origemB = { tipo: "PERDEDOR", partidaId: `V1-${indice * 2 + 1}` };
        } else if (rodada === ultima) {
          origemA = { tipo: "VENCEDOR", partidaId: `P${rodada - 1}-0` };
          origemB = { tipo: "PERDEDOR", partidaId: `V${rodadasVencedores}-0` };
        } else if (rodada % 2 === 0) {
          const rodadaVencedores = rodada / 2 + 1;
          const quedas = potencia >> rodadaVencedores;
          origemA = { tipo: "VENCEDOR", partidaId: `P${rodada - 1}-${indice}` };
          origemB = { tipo: "PERDEDOR", partidaId: `V${rodadaVencedores}-${quedas - 1 - indice}` };
        } else {
          origemA = { tipo: "VENCEDOR", partidaId: `P${rodada - 1}-${indice * 2}` };
          origemB = { tipo: "VENCEDOR", partidaId: `P${rodada - 1}-${indice * 2 + 1}` };
        }
        partidas.push(
          partidaBase({
            id: `P${rodada}-${indice}`,
            chave: "PERDEDORES",
            rodada,
            posicao: indice,
            origemA,
            origemB,
          }),
        );
      }
    }
    partidas.push(
      partidaBase({
        id: "F1",
        chave: "FINAL",
        rodada: 1,
        posicao: 0,
        origemA: { tipo: "VENCEDOR", partidaId: `V${rodadasVencedores}-0` },
        origemB: { tipo: "VENCEDOR", partidaId: `P${ultima}-0` },
      }),
    );
  }

  partidas.push(
    partidaBase({
      id: "F2",
      chave: "FINAL_EXTRA",
      rodada: 2,
      posicao: 0,
      origemA: { tipo: "VENCEDOR", partidaId: "F1" },
      origemB: { tipo: "PERDEDOR", partidaId: "F1" },
    }),
  );

  return partidas;
}

function mapa(partidas: PartidaMotor[]): Map<string, PartidaMotor> {
  return new Map(partidas.map((partida) => [partida.id, partida]));
}

function resolverOrigem(origem: Origem, partidas: Map<string, PartidaMotor>, equipesIds: string[]): Resolvido {
  if (origem.tipo === "BYE") return { tipo: "BYE" };
  if (origem.tipo === "CABECA") {
    if (origem.cabeca > equipesIds.length) return { tipo: "BYE" };
    const equipeId = equipesIds[origem.cabeca - 1];
    if (!equipeId) return { tipo: "BYE" };
    return { tipo: "EQUIPE", id: equipeId };
  }

  const origemPartida = partidas.get(origem.partidaId);
  if (!origemPartida) return { tipo: "PENDENTE" };

  if (origem.tipo === "VENCEDOR") {
    if (origemPartida.status === "CONCLUIDA" || origemPartida.status === "BYE") {
      return origemPartida.vencedorId ? { tipo: "EQUIPE", id: origemPartida.vencedorId } : { tipo: "BYE" };
    }
    if (origemPartida.status === "VAZIA" || origemPartida.status === "NAO_NECESSARIA") return { tipo: "BYE" };
    return { tipo: "PENDENTE" };
  }

  if (origemPartida.status === "CONCLUIDA") {
    return origemPartida.perdedorId ? { tipo: "EQUIPE", id: origemPartida.perdedorId } : { tipo: "BYE" };
  }
  if (
    origemPartida.status === "BYE" ||
    origemPartida.status === "VAZIA" ||
    origemPartida.status === "NAO_NECESSARIA"
  ) {
    return { tipo: "BYE" };
  }
  return { tipo: "PENDENTE" };
}

function assinatura(partida: PartidaMotor): string {
  return [
    partida.status,
    partida.equipeAId,
    partida.equipeBId,
    partida.vencedorId,
    partida.perdedorId,
    partida.placarA,
    partida.placarB,
  ].join("|");
}

function aplicarResolucao(partida: PartidaMotor, ladoA: Resolvido, ladoB: Resolvido): void {
  partida.equipeAId = ladoA.tipo === "EQUIPE" ? ladoA.id : null;
  partida.equipeBId = ladoB.tipo === "EQUIPE" ? ladoB.id : null;
  partida.placarA = null;
  partida.placarB = null;
  partida.ordemConclusao = null;

  if (ladoA.tipo === "PENDENTE" || ladoB.tipo === "PENDENTE") {
    partida.status = "AGUARDANDO";
    partida.vencedorId = null;
    partida.perdedorId = null;
    return;
  }
  if (ladoA.tipo === "BYE" && ladoB.tipo === "BYE") {
    partida.status = "VAZIA";
    partida.vencedorId = null;
    partida.perdedorId = null;
    return;
  }
  if (ladoA.tipo === "EQUIPE" && ladoB.tipo === "BYE") {
    partida.status = "BYE";
    partida.vencedorId = ladoA.id;
    partida.perdedorId = null;
    return;
  }
  if (ladoA.tipo === "BYE" && ladoB.tipo === "EQUIPE") {
    partida.status = "BYE";
    partida.vencedorId = ladoB.id;
    partida.perdedorId = null;
    return;
  }
  if (ladoA.tipo === "EQUIPE" && ladoB.tipo === "EQUIPE") {
    if (ladoA.id === ladoB.id) {
      throw new ErroDeRegra(`A partida ${partida.id} recebeu a mesma equipe nos dois lados.`);
    }
    partida.status = "PRONTA";
    partida.vencedorId = null;
    partida.perdedorId = null;
  }
}

function recomputar(estado: EstadoChave): void {
  const vitorias: Record<string, number> = {};
  const derrotas: Record<string, number> = {};
  for (const equipeId of estado.equipesIds) {
    vitorias[equipeId] = 0;
    derrotas[equipeId] = 0;
  }
  for (const partida of estado.partidas) {
    if (partida.status !== "CONCLUIDA" || !partida.vencedorId || !partida.perdedorId) continue;
    vitorias[partida.vencedorId] = (vitorias[partida.vencedorId] ?? 0) + 1;
    derrotas[partida.perdedorId] = (derrotas[partida.perdedorId] ?? 0) + 1;
  }
  estado.vitorias = vitorias;
  estado.derrotas = derrotas;
}

function atualizarCampeao(estado: EstadoChave): void {
  const final = estado.partidas.find((partida) => partida.id === "F1");
  const extra = estado.partidas.find((partida) => partida.id === "F2");
  if (extra?.status === "CONCLUIDA" && extra.vencedorId && extra.perdedorId) {
    estado.completa = true;
    estado.campeaoId = extra.vencedorId;
    estado.viceId = extra.perdedorId;
    return;
  }
  if (
    final?.status === "CONCLUIDA" &&
    extra?.status === "NAO_NECESSARIA" &&
    final.vencedorId &&
    final.perdedorId
  ) {
    estado.completa = true;
    estado.campeaoId = final.vencedorId;
    estado.viceId = final.perdedorId;
    return;
  }
  estado.completa = false;
  estado.campeaoId = null;
  estado.viceId = null;
}

export function descreverEstado(estado: EstadoChave): string {
  const linhas = estado.partidas.map(
    (partida) =>
      `${partida.id} ${partida.status} ${partida.equipeAId ?? "—"} x ${partida.equipeBId ?? "—"} ${partida.placarA ?? ""}-${partida.placarB ?? ""}`,
  );
  return linhas.join("\n");
}

export function auditarEstado(estado: EstadoChave): void {
  const ids = estado.partidas.map((partida) => partida.id);
  if (new Set(ids).size !== ids.length) {
    throw new ErroDeRegra("A chave contém partidas duplicadas.");
  }

  const abertas = new Map<string, string[]>();
  let concluidas = 0;

  for (const partida of estado.partidas) {
    if (partida.equipeAId && partida.equipeAId === partida.equipeBId) {
      throw new ErroDeRegra(`A partida ${partida.id} tem a mesma equipe nos dois lados.`);
    }
    if (partida.status === "CONCLUIDA") {
      concluidas += 1;
      if (!partida.equipeAId || !partida.equipeBId || !partida.vencedorId || !partida.perdedorId) {
        throw new ErroDeRegra(`A partida ${partida.id} foi concluída sem os dois adversários.`);
      }
      const lados = new Set([partida.equipeAId, partida.equipeBId]);
      if (!lados.has(partida.vencedorId) || !lados.has(partida.perdedorId) || partida.vencedorId === partida.perdedorId) {
        throw new ErroDeRegra(`O resultado da partida ${partida.id} é inconsistente.`);
      }
    }
    if ((partida.status === "PRONTA" || partida.status === "BYE") && !partida.equipeAId && !partida.equipeBId) {
      throw new ErroDeRegra(`A partida ${partida.id} não tem adversário definido.`);
    }
    if (partida.status === "PRONTA" && (!partida.equipeAId || !partida.equipeBId)) {
      throw new ErroDeRegra(`A partida ${partida.id} está pronta sem os dois adversários.`);
    }
    if (ABERTAS.has(partida.status)) {
      for (const equipeId of [partida.equipeAId, partida.equipeBId]) {
        if (!equipeId) continue;
        const lista = abertas.get(equipeId) ?? [];
        lista.push(partida.id);
        abertas.set(equipeId, lista);
      }
    }
  }

  const somaDerrotas = estado.equipesIds.reduce((soma, equipeId) => soma + (estado.derrotas[equipeId] ?? 0), 0);
  if (somaDerrotas !== concluidas) {
    throw new ErroDeRegra(`As derrotas (${somaDerrotas}) não correspondem às partidas concluídas (${concluidas}).`);
  }

  for (const equipeId of estado.equipesIds) {
    const derrotas = estado.derrotas[equipeId] ?? 0;
    if (derrotas >= 2 && abertas.has(equipeId)) {
      throw new ErroDeRegra(
        `A equipe eliminada ${equipeId} foi escalada em ${abertas.get(equipeId)!.join(", ")}.`,
      );
    }
  }

  for (const [equipeId, partidas] of abertas) {
    if (partidas.length > 1) {
      throw new ErroDeRegra(`A equipe ${equipeId} está em mais de uma partida ao mesmo tempo: ${partidas.join(", ")}.`);
    }
  }

  const final = estado.partidas.find((partida) => partida.id === "F1");
  const extra = estado.partidas.find((partida) => partida.id === "F2");
  if (!final || !extra) throw new ErroDeRegra("A final do torneio não foi gerada.");

  if (final.status === "CONCLUIDA" && final.vencedorId && final.vencedorId === final.equipeAId) {
    if (extra.status !== "NAO_NECESSARIA") {
      throw new ErroDeRegra("A equipe invicta venceu a final, mas a final extra não foi dispensada.");
    }
  }
  if (final.status === "CONCLUIDA" && final.vencedorId && final.vencedorId === final.equipeBId) {
    if (extra.status !== "PRONTA" && extra.status !== "CONCLUIDA") {
      throw new ErroDeRegra("A final extra deveria estar liberada depois da vitória da chave dos perdedores.");
    }
  }

  if (estado.completa) {
    if (!estado.campeaoId || !estado.viceId) throw new ErroDeRegra("O campeão ainda não está definido.");
    for (const equipeId of estado.equipesIds) {
      const derrotas = estado.derrotas[equipeId] ?? 0;
      if (equipeId === estado.campeaoId) {
        if (derrotas > 1) throw new ErroDeRegra("O campeão acumulou mais de uma derrota.");
      } else if (derrotas !== 2) {
        throw new ErroDeRegra(`A equipe ${equipeId} terminou com ${derrotas} derrota(s), e não com duas.`);
      }
    }
    return;
  }

  for (const equipeId of estado.equipesIds) {
    const derrotas = estado.derrotas[equipeId] ?? 0;
    if (derrotas < 2 && !abertas.has(equipeId)) {
      throw new ErroDeRegra(`A equipe ${equipeId} ficou sem partida antes de sofrer duas derrotas.`);
    }
  }
}

function propagar(estado: EstadoChave): void {
  const partidas = mapa(estado.partidas);
  const limite = estado.partidas.length + 4;
  for (let passo = 0; passo < limite; passo++) {
    let mudou = false;
    for (const partida of estado.partidas) {
      if (partida.status === "CONCLUIDA" || partida.status === "BYE" || partida.status === "VAZIA") continue;
      if (partida.status === "NAO_NECESSARIA" && partida.id !== "F2") continue;

      if (partida.id === "F2") {
        const final = partidas.get("F1");
        const antes = assinatura(partida);
        if (!final || final.status !== "CONCLUIDA") {
          partida.status = "AGUARDANDO";
          partida.equipeAId = null;
          partida.equipeBId = null;
          partida.vencedorId = null;
          partida.perdedorId = null;
          partida.placarA = null;
          partida.placarB = null;
        } else if (final.vencedorId && final.vencedorId === final.equipeAId) {
          partida.status = "NAO_NECESSARIA";
          partida.equipeAId = null;
          partida.equipeBId = null;
          partida.vencedorId = null;
          partida.perdedorId = null;
          partida.placarA = null;
          partida.placarB = null;
        } else {
          const ladoA = resolverOrigem(partida.origemA, partidas, estado.equipesIds);
          const ladoB = resolverOrigem(partida.origemB, partidas, estado.equipesIds);
          aplicarResolucao(partida, ladoA, ladoB);
        }
        if (assinatura(partida) !== antes) mudou = true;
        continue;
      }

      if (partida.status === "NAO_NECESSARIA") continue;
      const antes = assinatura(partida);
      const ladoA = resolverOrigem(partida.origemA, partidas, estado.equipesIds);
      const ladoB = resolverOrigem(partida.origemB, partidas, estado.equipesIds);
      aplicarResolucao(partida, ladoA, ladoB);
      if (assinatura(partida) !== antes) mudou = true;
    }
    if (!mudou) break;
    if (passo === limite - 1) {
      throw new ErroDeRegra(`A propagação da chave não estabilizou.\n${descreverEstado(estado)}`);
    }
  }

  recomputar(estado);
  atualizarCampeao(estado);
  try {
    auditarEstado(estado);
  } catch (erro) {
    if (erro instanceof ErroDeRegra) {
      erro.message = `${erro.message}\n${descreverEstado(estado)}`;
    }
    throw erro;
  }
}

export function criarEstadoInicial(equipesIds: readonly string[]): EstadoChave {
  if (equipesIds.length < 2) {
    throw new ErroDeRegra("São necessárias pelo menos duas equipes confirmadas para o sorteio.");
  }
  if (equipesIds.length > 128) {
    throw new ErroDeRegra("Este chaveamento aceita no máximo 128 equipes.");
  }
  if (new Set(equipesIds).size !== equipesIds.length) {
    throw new ErroDeRegra("Há equipes repetidas no sorteio dos confrontos.");
  }

  const estado: EstadoChave = {
    equipesIds: [...equipesIds],
    partidas: construirPartidas(equipesIds.length),
    vitorias: {},
    derrotas: {},
    completa: false,
    campeaoId: null,
    viceId: null,
    sequencia: 0,
  };
  propagar(estado);
  return estado;
}

export function aplicarResultado(
  estado: EstadoChave,
  partidaId: string,
  placarA: number,
  placarB: number,
  regras: RegrasPlacar,
): { estado: EstadoChave; idempotente: boolean } {
  const atual = estado.partidas.find((partida) => partida.id === partidaId);
  if (!atual) throw new ErroDeRegra("Partida não encontrada.");
  if (atual.status === "CONCLUIDA") {
    if (atual.placarA === placarA && atual.placarB === placarB) {
      return { estado, idempotente: true };
    }
    throw new ErroDeRegra("O resultado já foi confirmado. Use a correção para alterar o placar.", 409, "JA_CONFIRMADO");
  }
  if (atual.status !== "PRONTA" || !atual.equipeAId || !atual.equipeBId) {
    throw new ErroDeRegra("A partida ainda não tem os dois adversários definidos.");
  }

  const validacao = validarPlacar(placarA, placarB, regras);
  if (!validacao.ok) throw new ErroDeRegra(validacao.erro);

  const proximo = structuredClone(estado) as EstadoChave;
  const partida = proximo.partidas.find((item) => item.id === partidaId)!;
  const vencedorId = validacao.vencedor === "A" ? partida.equipeAId! : partida.equipeBId!;
  const perdedorId = vencedorId === partida.equipeAId ? partida.equipeBId! : partida.equipeAId!;
  partida.status = "CONCLUIDA";
  partida.placarA = placarA;
  partida.placarB = placarB;
  partida.vencedorId = vencedorId;
  partida.perdedorId = perdedorId;
  partida.ordemConclusao = proximo.sequencia + 1;
  proximo.sequencia += 1;
  propagar(proximo);
  return { estado: proximo, idempotente: false };
}

export function reexecutar(
  equipesIds: readonly string[],
  resultados: readonly ResultadoRegistrado[],
  regras: RegrasPlacar,
  opcoes?: { estrito?: boolean },
): { estado: EstadoChave; aplicados: ResultadoRegistrado[]; invalidados: ResultadoRegistrado[] } {
  let estado = criarEstadoInicial(equipesIds);
  const aplicados: ResultadoRegistrado[] = [];
  const invalidados: ResultadoRegistrado[] = [];

  for (const resultado of resultados) {
    const partida = estado.partidas.find((item) => item.id === resultado.partidaId);
    const compativel =
      partida?.status === "PRONTA" &&
      partida.equipeAId === resultado.equipeAId &&
      partida.equipeBId === resultado.equipeBId;
    if (!compativel) {
      if (opcoes?.estrito) {
        throw new ErroDeRegra("Não foi possível aplicar o resultado sem quebrar o chaveamento.");
      }
      invalidados.push(resultado);
      continue;
    }
    estado = aplicarResultado(estado, resultado.partidaId, resultado.placarA, resultado.placarB, regras).estado;
    aplicados.push(resultado);
  }

  return { estado, aplicados, invalidados };
}

export function planejarCorrecao(
  equipesIds: readonly string[],
  resultados: readonly ResultadoRegistrado[],
  partidaId: string,
  placarA: number,
  placarB: number,
  regras: RegrasPlacar,
):
  | { idempotente: true; precisaConfirmacao: false; invalidados: ResultadoRegistrado[]; estado: null }
  | { idempotente: false; precisaConfirmacao: boolean; invalidados: ResultadoRegistrado[]; estado: EstadoChave } {
  const indice = resultados.findIndex((resultado) => resultado.partidaId === partidaId);
  if (indice < 0) throw new ErroDeRegra("Esta partida não tem um resultado confirmado para corrigir.");
  const atual = resultados[indice]!;
  if (atual.placarA === placarA && atual.placarB === placarB) {
    return { idempotente: true, precisaConfirmacao: false, invalidados: [], estado: null };
  }
  const validacao = validarPlacar(placarA, placarB, regras);
  if (!validacao.ok) throw new ErroDeRegra(validacao.erro);

  const alterados = resultados.map((resultado, posicao) =>
    posicao === indice ? { ...resultado, placarA, placarB } : resultado,
  );
  const replay = reexecutar(equipesIds, alterados, regras);
  return {
    idempotente: false,
    precisaConfirmacao: replay.invalidados.length > 0,
    invalidados: replay.invalidados,
    estado: replay.estado,
  };
}

export function nomeDaFase(chave: LadoChave, rodada: number, rodadasVencedores: number): string {
  if (chave === "FINAL") return "Final";
  if (chave === "FINAL_EXTRA") return "Final extra";
  if (chave === "VENCEDORES") {
    if (rodada === rodadasVencedores) return "Final da chave dos vencedores";
    return `Chave dos vencedores · Rodada ${rodada}`;
  }
  return `Chave dos perdedores · Rodada ${rodada}`;
}

export function rodadasDaChaveDeVencedores(quantidadeEquipes: number): number {
  return Math.log2(proximaPotenciaDe2(Math.max(2, quantidadeEquipes)));
}
