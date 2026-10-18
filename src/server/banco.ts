import { Prisma, type Partida, type StatusPartida } from "@prisma/client";
import type { EstadoChave, PartidaMotor } from "@/engine/dupla-eliminacao";
import { distribuirQuadras, type PartidaOperacional } from "@/engine/quadras";
import { ErroDeRegra } from "@/lib/erros";
import { prisma } from "@/server/db";

export type Tx = Prisma.TransactionClient;

export async function trancar<T>(torneioId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      const linhas = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Torneio" WHERE id = ${torneioId} FOR UPDATE
      `;
      if (linhas.length === 0) throw new ErroDeRegra("Torneio não encontrado.", 404);
      return fn(tx);
    },
    { timeout: 20000 },
  );
}

function mesclar(anterior: Partida | undefined, nova: PartidaMotor, agora: Date) {
  const base = {
    equipeAId: nova.equipeAId,
    equipeBId: nova.equipeBId,
    vencedorId: nova.vencedorId,
    perdedorId: nova.perdedorId,
    placarA: nova.placarA,
    placarB: nova.placarB,
    ordemConclusao: nova.ordemConclusao,
    origemA: nova.origemA as Prisma.InputJsonValue,
    origemB: nova.origemB as Prisma.InputJsonValue,
  };

  if (nova.status === "CONCLUIDA") {
    const igual =
      anterior?.status === "CONCLUIDA" &&
      anterior.vencedorId === nova.vencedorId &&
      anterior.placarA === nova.placarA &&
      anterior.placarB === nova.placarB &&
      anterior.equipeAId === nova.equipeAId &&
      anterior.equipeBId === nova.equipeBId;
    return {
      ...base,
      status: "CONCLUIDA" as StatusPartida,
      quadraId: anterior?.quadraId ?? null,
      prontaEm: anterior?.prontaEm ?? agora,
      inicioEm: anterior?.inicioEm ?? null,
      fimEm: igual ? (anterior?.fimEm ?? agora) : agora,
      registradaPorId: igual ? (anterior?.registradaPorId ?? null) : null,
    };
  }

  if (nova.status === "PRONTA") {
    const mesmas =
      anterior &&
      anterior.equipeAId === nova.equipeAId &&
      anterior.equipeBId === nova.equipeBId &&
      (["PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"] as StatusPartida[]).includes(anterior.status);
    if (mesmas && anterior) {
      return {
        ...base,
        status: anterior.status,
        quadraId: anterior.quadraId,
        prontaEm: anterior.prontaEm ?? agora,
        inicioEm: anterior.inicioEm,
        fimEm: null,
        registradaPorId: null,
      };
    }
    return {
      ...base,
      status: "PRONTA" as StatusPartida,
      quadraId: null,
      prontaEm: agora,
      inicioEm: null,
      fimEm: null,
      registradaPorId: null,
    };
  }

  return {
    ...base,
    status: nova.status as StatusPartida,
    quadraId: null,
    prontaEm: null,
    inicioEm: null,
    fimEm: null,
    registradaPorId: null,
    placarA: null,
    placarB: null,
    vencedorId: nova.status === "BYE" ? nova.vencedorId : null,
    perdedorId: null,
  };
}

export async function sincronizarChave(tx: Tx, torneioId: string, estado: EstadoChave, agora = new Date()) {
  const anteriores = await tx.partida.findMany({ where: { torneioId } });
  const porCodigo = new Map(anteriores.map((partida) => [partida.codigo, partida]));

  for (const partida of estado.partidas) {
    const anterior = porCodigo.get(partida.id);
    const dados = mesclar(anterior, partida, agora);
    if (!anterior) {
      await tx.partida.create({
        data: {
          torneioId,
          codigo: partida.id,
          chave: partida.chave,
          rodada: partida.rodada,
          posicao: partida.posicao,
          ...dados,
        },
      });
    } else {
      await tx.partida.update({ where: { id: anterior.id }, data: dados });
    }
  }

  for (const equipeId of estado.equipesIds) {
    const derrotas = estado.derrotas[equipeId] ?? 0;
    const vitorias = estado.vitorias[equipeId] ?? 0;
    const segueNaTabela = estado.partidas.some(
      (partida) =>
        (partida.status === "AGUARDANDO" || partida.status === "PRONTA") &&
        (partida.equipeAId === equipeId || partida.equipeBId === equipeId),
    );
    const status =
      equipeId === estado.campeaoOuroId
        ? "CAMPEA_OURO"
        : equipeId === estado.campeaoPrataId
          ? "CAMPEA_PRATA"
          : equipeId === estado.campeaoId
            ? "CAMPEA"
            : equipeId === estado.viceId
              ? "VICE"
              : derrotas >= 2 && !segueNaTabela
                ? "ELIMINADA"
                : "CONFIRMADA";
    await tx.equipe.update({
      where: { id: equipeId },
      data: { vitorias, derrotas, status },
    });
  }

  await tx.torneio.update({
    where: { id: torneioId },
    data: {
      campeaoEquipeId: estado.campeaoId,
      viceEquipeId: estado.viceId,
      campeaoOuroEquipeId: estado.campeaoOuroId,
      campeaoPrataEquipeId: estado.campeaoPrataId,
    },
  });
}

export async function distribuirTorneio(tx: Tx, torneioId: string, agora = new Date()) {
  const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
  if (torneio.status !== "EM_ANDAMENTO") return;

  const [partidas, vinculos] = await Promise.all([
    tx.partida.findMany({ where: { torneioId } }),
    tx.torneioQuadra.findMany({
      where: { torneioId, habilitada: true },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
    }),
  ]);

  const operacionais: PartidaOperacional[] = partidas.map((partida) => ({
    id: partida.id,
    status: partida.status,
    chave: partida.chave,
    rodada: partida.rodada,
    equipeAId: partida.equipeAId,
    equipeBId: partida.equipeBId,
    quadraId: partida.quadraId,
    prontaEm: partida.prontaEm?.getTime() ?? 0,
    inicioEm: partida.inicioEm?.getTime() ?? null,
    fimEm: partida.fimEm?.getTime() ?? null,
  }));

  const resultado = distribuirQuadras({
    partidas: operacionais,
    quadras: vinculos.map((vinculo) => ({
      id: vinculo.quadraId,
      habilitada: vinculo.habilitada,
      indisponivelAte: vinculo.indisponivelAte?.getTime() ?? null,
    })),
    agora: agora.getTime(),
    maxSimultaneas: torneio.quadrasSimultaneas,
    descansoMinutos: torneio.descansoMinutos,
  });

  for (const partida of resultado.partidas) {
    const atual = partidas.find((item) => item.id === partida.id);
    if (!atual || (atual.quadraId === partida.quadraId && atual.status === partida.status)) continue;
    await tx.partida.update({
      where: { id: partida.id },
      data: { quadraId: partida.quadraId, status: partida.status },
    });
  }

  await afirmarSemChoque(tx, torneioId);
}

async function afirmarSemChoque(tx: Tx, torneioId: string) {
  const ativas = await tx.partida.findMany({
    where: { torneioId, status: { in: ["AGENDADA", "EM_ANDAMENTO", "PAUSADA"] } },
    select: { id: true, quadraId: true, equipeAId: true, equipeBId: true, codigo: true },
  });
  const quadras = new Set<string>();
  const equipes = new Set<string>();
  for (const partida of ativas) {
    if (partida.quadraId) {
      if (quadras.has(partida.quadraId)) {
        throw new ErroDeRegra("A mesma quadra ficou reservada para dois jogos simultâneos.");
      }
      quadras.add(partida.quadraId);
    }
    for (const equipeId of [partida.equipeAId, partida.equipeBId]) {
      if (!equipeId) continue;
      if (equipes.has(equipeId)) {
        throw new ErroDeRegra("Uma equipe ficou escalada em dois jogos simultâneos.");
      }
      equipes.add(equipeId);
    }
  }
}

export function regrasDoTorneio(torneio: {
  pontosParaVencer: number;
  diferencaMinima: number;
  pontosMaximos: number | null;
}) {
  return {
    pontosParaVencer: torneio.pontosParaVencer,
    diferencaMinima: torneio.diferencaMinima,
    pontosMaximos: torneio.pontosMaximos,
  };
}
