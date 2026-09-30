"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { COURTS, SPORTS, twoTeamsPhrase } from "@/lib/constants";
import {
  availabilityOf,
  commonSports,
  getActiveSquad,
  getChallenge,
  getSquadById,
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

async function requireSquad() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const squad = await getActiveSquad(user.id);
  if (!squad) return { user, squad: null as null };
  return { user, squad };
}

export async function createChallengeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { squad } = await requireSquad();
  if (!squad) return { error: "Forme uma dupla, um trio ou um quarteto antes de desafiar." };

  const adversaryId = String(formData.get("adversaryId") ?? "");
  const sport = String(formData.get("sport") ?? "");
  const court = String(formData.get("court") ?? "");
  const start = new Date(String(formData.get("start") ?? ""));
  const end = new Date(String(formData.get("end") ?? ""));

  if (!adversaryId) return { error: "Escolha a equipe adversária." };
  if (adversaryId === squad.id) return { error: "Escolha outra equipe." };
  if (!(SPORTS as readonly string[]).includes(sport)) return { error: "Escolha um esporte." };
  if (!(COURTS as readonly string[]).includes(court)) return { error: "Escolha o espaço da arena." };
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { error: "Escolha um horário." };

  const adversary = await getSquadById(adversaryId);
  if (!adversary || adversary.status !== "active") return { error: "Essa equipe não está ativa." };
  if (adversary.kind !== squad.kind) return { error: "Desafie uma equipe do mesmo formato." };
  if (!commonSports(squad, adversary).includes(sport)) {
    return { error: "As duas equipes precisam ter esse esporte em comum." };
  }

  try {
    assertDuration(start, end);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Horário inválido." };
  }

  const users = [...membersOf(squad), ...membersOf(adversary)];
  if (!slotFitsUsers(availabilityOf(users), start, end)) {
    return { error: `Esse horário não cabe na disponibilidade ${twoTeamsPhrase(squad.kind)}.` };
  }

  const busy = await prisma.challenge.findMany({
    where: { status: { in: ["pending", "countered", "accepted"] }, endAt: { gt: start } },
    select: {
      id: true,
      court: true,
      startAt: true,
      endAt: true,
      challengerSquadId: true,
      challengedSquadId: true,
      status: true,
    },
  });
  const squadIds = [squad.id, adversary.id];
  if (pairIsBusy(busy, start, end, squadIds)) {
    return { error: "Uma das equipes já tem compromisso nesse horário." };
  }
  if (courtIsBusy(busy, start, end, court)) {
    return { error: "Essa quadra já está reservada nesse horário." };
  }

  const challenge = await prisma.challenge.create({
    data: {
      challengerSquadId: squad.id,
      challengedSquadId: adversary.id,
      sport,
      court,
      startAt: start,
      endAt: end,
      status: "pending",
      awaiting: "challenged",
      proposals: { create: { squadId: squad.id, startAt: start, endAt: end } },
    },
  });

  touch();
  redirect(`/desafios/${challenge.id}?ok=enviado`);
}

export async function respondChallengeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { squad } = await requireSquad();
  if (!squad) return { error: "Você precisa de uma equipe ativa." };

  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const challenge = await getChallenge(id);
  if (!challenge) return { error: "Desafio não encontrado." };

  const role =
    challenge.challengerSquadId === squad.id ? "challenger" : challenge.challengedSquadId === squad.id ? "challenged" : null;
  if (!role) return { error: "Esse desafio não é da sua equipe." };
  if (challenge.status !== "pending" && challenge.status !== "countered") {
    return { error: "Esse desafio já foi encerrado." };
  }
  if (challenge.awaiting !== role) return { error: "Agora é a vez da outra equipe." };

  if (intent === "decline") {
    await prisma.challenge.update({
      where: { id },
      data: { status: "declined", awaiting: "none" },
    });
    touch();
    redirect("/desafios?ok=recusado");
  }

  if (intent === "accept") {
    const users = [...membersOf(challenge.challengerSquad), ...membersOf(challenge.challengedSquad)];
    if (!slotFitsUsers(availabilityOf(users), challenge.startAt, challenge.endAt)) {
      return { error: `Esse horário não cabe mais na disponibilidade ${twoTeamsPhrase(challenge.challengerSquad.kind)}.` };
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
        challengerSquadId: true,
        challengedSquadId: true,
        status: true,
      },
    });
    const squadIds = [challenge.challengerSquadId, challenge.challengedSquadId];
    if (pairIsBusy(busy, challenge.startAt, challenge.endAt, squadIds, id)) {
      return { error: "Uma das equipes já tem compromisso nesse horário." };
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

  const users = [...membersOf(challenge.challengerSquad), ...membersOf(challenge.challengedSquad)];
  if (!slotFitsUsers(availabilityOf(users), start, end)) {
    return { error: `Esse horário não cabe na disponibilidade ${twoTeamsPhrase(challenge.challengerSquad.kind)}.` };
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
      challengerSquadId: true,
      challengedSquadId: true,
      status: true,
    },
  });
  const squadIds = [challenge.challengerSquadId, challenge.challengedSquadId];
  if (pairIsBusy(busy, start, end, squadIds, id)) {
    return { error: "Uma das equipes já tem compromisso nesse horário." };
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
      proposals: { create: { squadId: squad.id, startAt: start, endAt: end } },
    },
  });

  touch();
  redirect(`/desafios/${id}?ok=contra`);
}
