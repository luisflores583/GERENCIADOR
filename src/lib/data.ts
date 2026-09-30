import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  sports: { select: { sport: true } },
  availability: { select: { dayOfWeek: true, startMin: true, endMin: true } },
} satisfies Prisma.UserSelect;

export const pairInclude = {
  inviter: { select: publicUserSelect },
  invitee: { select: publicUserSelect },
} satisfies Prisma.PartnershipInclude;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
export type PairWithMembers = Prisma.PartnershipGetPayload<{ include: typeof pairInclude }>;

export function sportsOf(user: { sports: { sport: string }[] }): string[] {
  return user.sports.map((item) => item.sport).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function sportsOfPair(pair: PairWithMembers): string[] {
  return [...new Set([...sportsOf(pair.inviter), ...sportsOf(pair.invitee)])].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

export function commonSports(a: PairWithMembers, b: PairWithMembers): string[] {
  const theirs = new Set(sportsOfPair(b));
  return sportsOfPair(a).filter((sport) => theirs.has(sport));
}

export function pairNames(pair: { inviter: { name: string }; invitee: { name: string } }): string {
  return `${pair.inviter.name} e ${pair.invitee.name}`;
}

export function otherMember(pair: PairWithMembers, userId: string): PublicUser {
  return pair.inviter.id === userId ? pair.invitee : pair.inviter;
}

export function membersOf(pair: PairWithMembers): PublicUser[] {
  return [pair.inviter, pair.invitee];
}

export async function getActivePair(userId: string): Promise<PairWithMembers | null> {
  return prisma.partnership.findFirst({
    where: {
      status: "accepted",
      OR: [{ inviterId: userId }, { inviteeId: userId }],
    },
    include: pairInclude,
  });
}

export async function getPairById(id: string): Promise<PairWithMembers | null> {
  return prisma.partnership.findUnique({ where: { id }, include: pairInclude });
}

export function availabilityOf(users: PublicUser[]) {
  return users.map((user) => ({
    availability: user.availability.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startMin: slot.startMin,
      endMin: slot.endMin,
    })),
  }));
}

const challengeInclude = {
  challengerPair: { include: pairInclude },
  challengedPair: { include: pairInclude },
  proposals: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ChallengeInclude;

export type ChallengeDetails = Prisma.ChallengeGetPayload<{ include: typeof challengeInclude }>;

export async function getChallenge(id: string): Promise<ChallengeDetails | null> {
  return prisma.challenge.findUnique({ where: { id }, include: challengeInclude });
}

export async function listOpenChallenges() {
  return prisma.challenge.findMany({
    where: { status: { in: ["pending", "countered", "accepted"] }, endAt: { gt: new Date() } },
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
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "countered":
      return "Contraproposta";
    case "accepted":
      return "Confirmado";
    case "declined":
      return "Recusado";
    case "cancelled":
      return "Cancelado";
    case "ended":
      return "Encerrada";
    default:
      return status;
  }
}
