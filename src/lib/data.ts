import { Prisma } from "@prisma/client";
import { formatById } from "./constants";
import { prisma } from "./prisma";

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  sports: { select: { sport: true } },
  availability: { select: { dayOfWeek: true, startMin: true, endMin: true } },
} satisfies Prisma.UserSelect;

export const squadInclude = {
  creator: { select: { id: true, name: true } },
  members: { include: { user: { select: publicUserSelect } } },
} satisfies Prisma.SquadInclude;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
export type SquadWithMembers = Prisma.SquadGetPayload<{ include: typeof squadInclude }>;

export function sportsOf(user: { sports: { sport: string }[] }): string[] {
  return user.sports.map((item) => item.sport).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function roster(squad: SquadWithMembers, statuses: string[] = ["accepted"]): SquadWithMembers["members"] {
  return squad.members
    .filter((member) => statuses.includes(member.status))
    .sort((a, b) => {
      if (a.userId === squad.creatorId) return -1;
      if (b.userId === squad.creatorId) return 1;
      return a.user.name.localeCompare(b.user.name, "pt-BR");
    });
}

export function membersOf(squad: SquadWithMembers): PublicUser[] {
  return roster(squad).map((member) => member.user);
}

export function sportsOfSquad(squad: SquadWithMembers): string[] {
  return [...new Set(membersOf(squad).flatMap((user) => sportsOf(user)))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

export function commonSports(a: SquadWithMembers, b: SquadWithMembers): string[] {
  const theirs = new Set(sportsOfSquad(b));
  return sportsOfSquad(a).filter((sport) => theirs.has(sport));
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function squadNames(squad: SquadWithMembers): string {
  return joinNames(roster(squad).map((member) => member.user.name));
}

export function squadTitle(squad: { kind: string }): string {
  return formatById(squad.kind).label;
}

export function occupiedCount(squad: SquadWithMembers): number {
  return squad.members.filter((member) => member.status === "accepted" || member.status === "pending").length;
}

export async function getActiveSquad(userId: string): Promise<SquadWithMembers | null> {
  const membership = await prisma.squadMember.findFirst({
    where: { userId, status: "accepted", squad: { status: "active" } },
    select: { squadId: true },
  });
  if (!membership) return null;
  return prisma.squad.findUnique({ where: { id: membership.squadId }, include: squadInclude });
}

export async function getFormingSquad(userId: string): Promise<SquadWithMembers | null> {
  return prisma.squad.findFirst({
    where: { creatorId: userId, status: "forming" },
    include: squadInclude,
  });
}

export async function getSquadById(id: string): Promise<SquadWithMembers | null> {
  return prisma.squad.findUnique({ where: { id }, include: squadInclude });
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
  challengerSquad: { include: squadInclude },
  challengedSquad: { include: squadInclude },
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
      challengerSquadId: true,
      challengedSquadId: true,
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
    case "active":
      return "Confirmado";
    case "forming":
      return "Formando";
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
