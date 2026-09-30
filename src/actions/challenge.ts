"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { COURTS, SPORTS } from "@/lib/constants";
import {
  availabilityOf,
  commonSports,
  getActivePair,
  getChallenge,
  getPairById,
  membersOf,
} from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { assertDuration, courtIsBusy, pairIsBusy, slotFitsUsers } from "@/lib/schedule";

export type FormState = { error: string };

function touch() {
  revalidatePath("/inicio");
  revalidatePath("/desafios");
  revalidatePath("/desafiar");
  revalidatePath("/agenda");
}

async function requirePair() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const pair = await getActivePair(user.id);
  if (!pair) return { user, pair: null as null };
  return { user, pair };
}

export async function createChallengeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { pair } = await requirePair();
  if (!pair) return { error: "Forme uma dupla antes de desafiar." };

  const adversaryId = String(formData.get("adversaryId") ?? "");
  const sport = String(formData.get("sport") ?? "");
  const court = String(formData.get("court") ?? "");
  const start = new Date(String(formData.get("start") ?? ""));
  const end = new Date(String(formData.get("end") ?? ""));

  if (!adversaryId) return { error: "Escolha a dupla adversária." };
  if (adversaryId === pair.id) return { error: "Escolha outra dupla." };
  if (!(SPORTS as readonly string[]).includes(sport)) return { error: "Escolha um esporte." };
  if (!(COURTS as readonly string[]).includes(court)) return { error: "Escolha o espaço da arena." };
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { error: "Escolha um horário." };

  const adversary = await getPairById(adversaryId);
  if (!adversary || adversary.status !== "accepted") return { error: "Essa dupla não está ativa." };
  if (!commonSports(pair, adversary).includes(sport)) {
    return { error: "As duas duplas precisam ter esse esporte em comum." };
  }

  try {
    assertDuration(start, end);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Horário inválido." };
  }

  const users = [...membersOf(pair), ...membersOf(adversary)];
  if (!slotFitsUsers(availabilityOf(users), start, end)) {
    return { error: "Esse horário não cabe na disponibilidade das duas duplas." };
  }

  const busy = await prisma.challenge.findMany({
    where: { status: { in: ["pending", "countered", "accepted"] }, endAt: { gt: start } },
    select: {
      id: true,
      court: true,
      startAt: true,
      endAt: true,
      challengerPairId: true,
      challengedPairId: true,
      status: true,
    },
  });
  const pairIds = [pair.id, adversary.id];
  if (pairIsBusy(busy, start, end, pairIds)) {
    return { error: "Uma das duplas já tem compromisso nesse horário." };
  }
  if (courtIsBusy(busy, start, end, court)) {
    return { error: "Essa quadra já está reservada nesse horário." };
  }

  const challenge = await prisma.challenge.create({
    data: {
      challengerPairId: pair.id,
      challengedPairId: adversary.id,
      sport,
      court,
      startAt: start,
      endAt: end,
      status: "pending",
      awaiting: "challenged",
      proposals: { create: { pairId: pair.id, startAt: start, endAt: end } },
    },
  });

  touch();
  redirect(`/desafios/${challenge.id}?ok=enviado`);
}

export async function respondChallengeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { pair } = await requirePair();
  if (!pair) return { error: "Você precisa de uma dupla ativa." };

  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const challenge = await getChallenge(id);
  if (!challenge) return { error: "Desafio não encontrado." };

  const role =
    challenge.challengerPairId === pair.id ? "challenger" : challenge.challengedPairId === pair.id ? "challenged" : null;
  if (!role) return { error: "Esse desafio não é da sua dupla." };
  if (challenge.status !== "pending" && challenge.status !== "countered") {
    return { error: "Esse desafio já foi encerrado." };
  }
  if (challenge.awaiting !== role) return { error: "Agora é a vez da outra dupla." };

  if (intent === "decline") {
    await prisma.challenge.update({
      where: { id },
      data: { status: "declined", awaiting: "none" },
    });
    touch();
    redirect("/desafios?ok=recusado");
  }

  if (intent === "accept") {
    const users = [...membersOf(challenge.challengerPair), ...membersOf(challenge.challengedPair)];
    if (!slotFitsUsers(availabilityOf(users), challenge.startAt, challenge.endAt)) {
      return { error: "Esse horário não cabe mais na disponibilidade das duplas." };
    }
    const busy = await prisma.challenge.findMany({
      where: {
        id: { not: id },
        status: { in: ["pending", "countered", "accepted"] },
        endAt: { gt: challenge.startAt },
      },
      select: {
        id: true,
        court: true,
        startAt: true,
        endAt: true,
        challengerPairId: true,
        challengedPairId: true,
        status: true,
      },
    });
    const pairIds = [challenge.challengerPairId, challenge.challengedPairId];
    if (pairIsBusy(busy, challenge.startAt, challenge.endAt, pairIds, id)) {
      return { error: "Uma das duplas já tem compromisso nesse horário." };
    }
    if (courtIsBusy(busy, challenge.startAt, challenge.endAt, challenge.court, id)) {
      return { error: "Essa quadra já está reservada nesse horário." };
    }

    await prisma.challenge.update({
      where: { id },
      data: { status: "accepted", awaiting: "none" },
    });
    touch();
    redirect("/agenda?ok=confirmado");
  }

  if (intent !== "counter") return { error: "Resposta inválida." };

  const start = new Date(String(formData.get("start") ?? ""));
  const end = new Date(String(formData.get("end") ?? ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Escolha outro horário." };
  }
  if (start.getTime() === challenge.startAt.getTime() && end.getTime() === challenge.endAt.getTime()) {
    return { error: "Proponha um horário diferente." };
  }

  try {
    assertDuration(start, end);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Horário inválido." };
  }

  const users = [...membersOf(challenge.challengerPair), ...membersOf(challenge.challengedPair)];
  if (!slotFitsUsers(availabilityOf(users), start, end)) {
    return { error: "Esse horário não cabe na disponibilidade das duas duplas." };
  }

  const busy = await prisma.challenge.findMany({
    where: {
      id: { not: id },
      status: { in: ["pending", "countered", "accepted"] },
      endAt: { gt: start },
    },
    select: {
      id: true,
      court: true,
      startAt: true,
      endAt: true,
      challengerPairId: true,
      challengedPairId: true,
      status: true,
    },
  });
  const pairIds = [challenge.challengerPairId, challenge.challengedPairId];
  if (pairIsBusy(busy, start, end, pairIds, id)) {
    return { error: "Uma das duplas já tem compromisso nesse horário." };
  }
  if (courtIsBusy(busy, start, end, challenge.court, id)) {
    return { error: "Essa quadra já está reservada nesse horário." };
  }

  const nextAwaiting = role === "challenger" ? "challenged" : "challenger";
  await prisma.challenge.update({
    where: { id },
    data: {
      startAt: start,
      endAt: end,
      status: "countered",
      awaiting: nextAwaiting,
      proposals: { create: { pairId: pair.id, startAt: start, endAt: end } },
    },
  });

  touch();
  redirect(`/desafios/${id}?ok=contra`);
}
