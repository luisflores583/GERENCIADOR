import type { LadoChave } from "@/engine/dupla-eliminacao";
import { escolherInicio, ordenarFila, type LadoDaFila } from "@/engine/fila";

export type StatusOperacional =
  | "AGUARDANDO"
  | "PRONTA"
  | "AGENDADA"
  | "EM_ANDAMENTO"
  | "PAUSADA"
  | "CONCLUIDA"
  | "BYE"
  | "VAZIA"
  | "NAO_NECESSARIA";

export interface PartidaOperacional {
  id: string;
  status: StatusOperacional;
  chave: LadoChave;
  rodada: number;
  equipeAId: string | null;
  equipeBId: string | null;
  quadraId: string | null;
  prontaEm: number;
  inicioEm: number | null;
  fimEm: number | null;
  ladoFila?: LadoDaFila;
  ordem?: number;
}

export interface QuadraOperacional {
  id: string;
  habilitada: boolean;
  indisponivelAte: number | null;
}

const OCUPANDO = new Set<StatusOperacional>(["AGENDADA", "EM_ANDAMENTO", "PAUSADA"]);

function ladoEfetivo(partida: PartidaOperacional): LadoDaFila {
  if (partida.ladoFila) return partida.ladoFila;
  if (partida.chave === "VENCEDORES") return "VENCEDORES";
  if (partida.chave === "PERDEDORES") return "PERDEDORES";
  if (partida.chave === "FINAL" || partida.chave === "FINAL_EXTRA" || partida.chave === "SEMIFINAL") return "OUTRO";
  return "OUTRO";
}

function emDescanso(
  partidas: PartidaOperacional[],
  equipeId: string | null,
  agora: number,
  descansoMs: number,
): boolean {
  if (!equipeId || descansoMs <= 0) return false;
  let ultimoFim = 0;
  for (const partida of partidas) {
    if (partida.status !== "CONCLUIDA" || partida.fimEm == null) continue;
    if (partida.equipeAId === equipeId || partida.equipeBId === equipeId) {
      ultimoFim = Math.max(ultimoFim, partida.fimEm);
    }
  }
  return ultimoFim > 0 && agora - ultimoFim < descansoMs;
}

export function distribuirQuadras(entrada: {
  partidas: readonly PartidaOperacional[];
  quadras: readonly QuadraOperacional[];
  agora: number;
  maxSimultaneas: number;
  descansoMinutos: number;
}): { partidas: PartidaOperacional[]; fila: string[] } {
  const partidas = entrada.partidas.map((partida) => ({ ...partida }));
  const quadrasOcupadas = new Set(
    partidas.filter((partida) => OCUPANDO.has(partida.status) && partida.quadraId).map((partida) => partida.quadraId!),
  );
  const equipesOcupadas = new Set<string>();
  for (const partida of partidas) {
    if (!OCUPANDO.has(partida.status)) continue;
    if (partida.equipeAId) equipesOcupadas.add(partida.equipeAId);
    if (partida.equipeBId) equipesOcupadas.add(partida.equipeBId);
  }

  const ativas = partidas.filter((partida) => OCUPANDO.has(partida.status)).length;
  const quadrasLivres = entrada.quadras.filter((quadra) => {
    if (!quadra.habilitada || quadrasOcupadas.has(quadra.id)) return false;
    if (quadra.indisponivelAte != null && quadra.indisponivelAte > entrada.agora) return false;
    return true;
  });
  const vagas = Math.max(0, Math.min(entrada.maxSimultaneas - ativas, quadrasLivres.length));
  const descansoMs = entrada.descansoMinutos * 60_000;

  const candidatasBase = partidas.filter(
    (partida) => partida.status === "PRONTA" && partida.equipeAId && partida.equipeBId && !partida.quadraId,
  );
  const itens = candidatasBase.map((partida) => ({
    partida,
    id: partida.id,
    prontaEm: partida.prontaEm,
    rodada: partida.rodada,
    ordem: partida.ordem ?? partida.rodada * 1000,
    lado: ladoEfetivo(partida),
  }));
  const ocupando = partidas.filter((partida) => OCUPANDO.has(partida.status)).map((partida) => ({ lado: ladoEfetivo(partida) }));
  let ultimo: { lado: LadoDaFila; quando: number } | null = null;
  for (const partida of partidas) {
    const lado = ladoEfetivo(partida);
    if (lado !== "VENCEDORES" && lado !== "PERDEDORES") continue;
    const quando = OCUPANDO.has(partida.status)
      ? (partida.inicioEm ?? partida.prontaEm)
      : partida.status === "CONCLUIDA" && partida.fimEm != null
        ? partida.fimEm
        : null;
    if (quando == null) continue;
    if (!ultimo || quando >= ultimo.quando) ultimo = { lado, quando };
  }
  const inicio = escolherInicio(
    itens.filter((item) => item.lado === "VENCEDORES"),
    itens.filter((item) => item.lado === "PERDEDORES"),
    ocupando,
    ultimo?.lado ?? null,
  );
  const candidatas = ordenarFila(itens, inicio).map((item) => item.partida);

  let atribuidas = 0;
  const fila: string[] = [];
  for (const partida of candidatas) {
    const ocupada =
      equipesOcupadas.has(partida.equipeAId!) || equipesOcupadas.has(partida.equipeBId!);
    const descanso =
      emDescanso(partidas, partida.equipeAId, entrada.agora, descansoMs) ||
      emDescanso(partidas, partida.equipeBId, entrada.agora, descansoMs);
    if (atribuidas >= vagas || ocupada || descanso || quadrasLivres.length === 0) {
      fila.push(partida.id);
      continue;
    }
    const quadra = quadrasLivres.shift()!;
    partida.quadraId = quadra.id;
    partida.status = "AGENDADA";
    equipesOcupadas.add(partida.equipeAId!);
    equipesOcupadas.add(partida.equipeBId!);
    atribuidas += 1;
  }

  return { partidas, fila };
}

export function validarTrocaDeQuadra(entrada: {
  partidas: readonly PartidaOperacional[];
  partidaId: string;
  quadraId: string;
  quadras: readonly QuadraOperacional[];
  agora: number;
}): { ok: true } | { ok: false; erro: string } {
  const partida = entrada.partidas.find((item) => item.id === entrada.partidaId);
  if (!partida) return { ok: false, erro: "Partida não encontrada." };
  if (!["PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"].includes(partida.status)) {
    return { ok: false, erro: "Só é possível trocar a quadra de uma partida ainda não concluída." };
  }
  if (!partida.equipeAId || !partida.equipeBId) {
    return { ok: false, erro: "A partida ainda não tem os dois adversários." };
  }
  const quadra = entrada.quadras.find((item) => item.id === entrada.quadraId);
  if (!quadra || !quadra.habilitada) return { ok: false, erro: "Esta quadra não está habilitada no torneio." };
  if (quadra.indisponivelAte != null && quadra.indisponivelAte > entrada.agora) {
    return { ok: false, erro: "Esta quadra está indisponível no momento." };
  }
  if (partida.quadraId === quadra.id && OCUPANDO.has(partida.status)) return { ok: true };

  const conflitoQuadra = entrada.partidas.find(
    (item) =>
      item.id !== partida.id &&
      item.quadraId === quadra.id &&
      OCUPANDO.has(item.status),
  );
  if (conflitoQuadra) return { ok: false, erro: "Esta quadra já está reservada para outra partida." };

  const conflitoEquipe = entrada.partidas.find((item) => {
    if (item.id === partida.id || !OCUPANDO.has(item.status)) return false;
    return (
      item.equipeAId === partida.equipeAId ||
      item.equipeBId === partida.equipeAId ||
      item.equipeAId === partida.equipeBId ||
      item.equipeBId === partida.equipeBId
    );
  });
  if (conflitoEquipe) {
    return { ok: false, erro: "Uma das equipes já está em outra quadra neste momento." };
  }

  return { ok: true };
}
