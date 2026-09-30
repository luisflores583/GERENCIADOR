import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD } from "../src/lib/constants";
import { hashPassword } from "../src/lib/password";
import { userCovers, type AvailabilitySlot } from "../src/lib/schedule";
import { formatSlot, spParts, upcomingSaoPaulo } from "../src/lib/time";

const prisma = new PrismaClient();

function weekly(days: number[], start: string, end: string): AvailabilitySlot[] {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return days.map((dayOfWeek) => ({
    dayOfWeek,
    startMin: startHour * 60 + startMinute,
    endMin: endHour * 60 + endMinute,
  }));
}

const PEOPLE = [
  {
    key: "ana",
    name: "Ana Souza",
    email: "ana.souza@arena.local",
    sports: ["Futebol", "Vôlei"],
    slots: [...weekly([1, 2, 3, 4, 5], "18:00", "22:00"), ...weekly([6], "08:00", "12:00")],
  },
  {
    key: "bruno",
    name: "Bruno Lima",
    email: "bruno.lima@arena.local",
    sports: ["Futebol", "Futsal"],
    slots: [...weekly([1, 2, 3, 4, 5], "19:00", "22:00"), ...weekly([6], "08:00", "13:00")],
  },
  {
    key: "carla",
    name: "Carla Mendes",
    email: "carla.mendes@arena.local",
    sports: ["Vôlei", "Tênis"],
    slots: [...weekly([2, 4], "18:00", "21:00"), ...weekly([6], "09:00", "14:00"), ...weekly([0], "10:00", "13:00")],
  },
  {
    key: "diego",
    name: "Diego Alves",
    email: "diego.alves@arena.local",
    sports: ["Vôlei", "Basquete"],
    slots: [...weekly([2, 4], "18:00", "21:30"), ...weekly([6], "08:00", "12:00"), ...weekly([0], "09:00", "14:00")],
  },
  {
    key: "elena",
    name: "Elena Costa",
    email: "elena.costa@arena.local",
    sports: ["Futsal", "Basquete"],
    slots: [...weekly([1, 2, 3, 4, 5], "18:00", "21:00"), ...weekly([0], "09:00", "12:00")],
  },
  {
    key: "felipe",
    name: "Felipe Rocha",
    email: "felipe.rocha@arena.local",
    sports: ["Futsal", "Futebol"],
    slots: [...weekly([1, 2, 3, 4], "19:00", "22:00"), ...weekly([6], "10:00", "16:00")],
  },
  {
    key: "gabriela",
    name: "Gabriela Nunes",
    email: "gabriela.nunes@arena.local",
    sports: ["Tênis", "Beach tennis"],
    slots: [...weekly([3, 5], "17:00", "21:00"), ...weekly([0], "08:00", "12:00")],
  },
  {
    key: "henrique",
    name: "Henrique Dias",
    email: "henrique.dias@arena.local",
    sports: ["Basquete", "Handebol"],
    slots: [...weekly([1, 3, 5], "18:00", "22:00")],
  },
  {
    key: "marina",
    name: "Marina Teixeira",
    email: "marina.teixeira@arena.local",
    sports: ["Beach tennis", "Vôlei"],
    slots: [...weekly([2, 4], "19:00", "22:00"), ...weekly([6], "09:00", "12:00")],
  },
  {
    key: "otavio",
    name: "Otávio Pires",
    email: "otavio.pires@arena.local",
    sports: ["Futebol", "Handebol"],
    slots: [...weekly([1, 2, 3, 4, 5], "18:00", "21:00"), ...weekly([0], "08:00", "11:00")],
  },
] as const;

function assertFits(label: string, slots: AvailabilitySlot[], start: Date, end: Date) {
  if (!userCovers(slots, start, end)) {
    throw new Error(`Seed inválido: ${label} não cobre ${formatSlot(start, end)}`);
  }
}

async function main() {
  await prisma.proposal.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.partnership.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.userSport.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = new Map<string, { id: string; slots: AvailabilitySlot[] }>();

  for (const person of PEOPLE) {
    const created = await prisma.user.create({
      data: {
        name: person.name,
        email: person.email,
        passwordHash,
        sports: { create: person.sports.map((sport) => ({ sport })) },
        availability: { create: person.slots.map((slot) => ({ ...slot })) },
      },
    });
    users.set(person.key, { id: created.id, slots: [...person.slots] });
  }

  const id = (key: string) => {
    const user = users.get(key);
    if (!user) throw new Error(key);
    return user.id;
  };

  const anaBruno = await prisma.partnership.create({
    data: { inviterId: id("ana"), inviteeId: id("bruno"), status: "accepted", respondedAt: new Date() },
  });
  const carlaDiego = await prisma.partnership.create({
    data: { inviterId: id("carla"), inviteeId: id("diego"), status: "accepted", respondedAt: new Date() },
  });
  const elenaFelipe = await prisma.partnership.create({
    data: { inviterId: id("elena"), inviteeId: id("felipe"), status: "accepted", respondedAt: new Date() },
  });
  await prisma.partnership.create({
    data: { inviterId: id("henrique"), inviteeId: id("gabriela"), status: "pending" },
  });

  const confirmedStart = upcomingSaoPaulo(6, 10, 0);
  const confirmedEnd = new Date(confirmedStart.getTime() + 90 * 60_000);
  const pendingStart = upcomingSaoPaulo(2, 19, 0);
  const pendingEnd = new Date(pendingStart.getTime() + 90 * 60_000);

  if (spParts(confirmedStart).dayOfWeek !== 6 || spParts(confirmedStart).hour !== 10) {
    throw new Error("Não foi possível calcular o sábado às 10h.");
  }
  if (spParts(pendingStart).dayOfWeek !== 2 || spParts(pendingStart).hour !== 19) {
    throw new Error("Não foi possível calcular a terça às 19h.");
  }

  for (const key of ["ana", "bruno", "carla", "diego"] as const) {
    assertFits(key, users.get(key)!.slots, confirmedStart, confirmedEnd);
  }
  for (const key of ["ana", "bruno", "elena", "felipe"] as const) {
    assertFits(key, users.get(key)!.slots, pendingStart, pendingEnd);
  }

  await prisma.challenge.create({
    data: {
      challengerPairId: anaBruno.id,
      challengedPairId: carlaDiego.id,
      sport: "Vôlei",
      court: "Quadra Central",
      startAt: confirmedStart,
      endAt: confirmedEnd,
      status: "accepted",
      awaiting: "none",
      proposals: {
        create: { pairId: anaBruno.id, startAt: confirmedStart, endAt: confirmedEnd },
      },
    },
  });

  await prisma.challenge.create({
    data: {
      challengerPairId: elenaFelipe.id,
      challengedPairId: anaBruno.id,
      sport: "Futsal",
      court: "Quadra 2",
      startAt: pendingStart,
      endAt: pendingEnd,
      status: "pending",
      awaiting: "challenged",
      proposals: {
        create: { pairId: elenaFelipe.id, startAt: pendingStart, endAt: pendingEnd },
      },
    },
  });

  const pairs = await prisma.partnership.count({ where: { status: "accepted" } });
  const pending = await prisma.challenge.count({ where: { status: "pending" } });
  const accepted = await prisma.challenge.count({ where: { status: "accepted" } });
  if (pairs < 2 || pending < 1 || accepted < 1) {
    throw new Error("Seed não criou o cenário de demonstração.");
  }

  console.log(`Duplas ativas: ${pairs}. Desafio pendente: ${formatSlot(pendingStart, pendingEnd)}. Confirmado: ${formatSlot(confirmedStart, confirmedEnd)}.`);
  console.log(`Senha de demonstração: ${DEMO_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
