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

const nights = weekly([1, 2, 3, 4, 5], "18:00", "22:00");
const saturday = weekly([6], "08:00", "13:00");

const PEOPLE = [
  { key: "ana", name: "Ana Souza", email: "ana.souza@arena.local", sports: ["Vôlei", "Beach tennis"], slots: [...nights, ...saturday] },
  { key: "bruno", name: "Bruno Lima", email: "bruno.lima@arena.local", sports: ["Vôlei", "Futevôlei"], slots: [...nights, ...saturday] },
  { key: "paula", name: "Paula Ribeiro", email: "paula.ribeiro@arena.local", sports: ["Vôlei", "Beach tennis"], slots: [...nights, ...saturday] },
  { key: "ricardo", name: "Ricardo Nunes", email: "ricardo.nunes@arena.local", sports: ["Vôlei", "Futevôlei"], slots: [...nights, ...saturday] },
  { key: "carla", name: "Carla Mendes", email: "carla.mendes@arena.local", sports: ["Vôlei", "Beach tennis"], slots: nights },
  { key: "diego", name: "Diego Alves", email: "diego.alves@arena.local", sports: ["Vôlei", "Futevôlei"], slots: nights },
  { key: "elena", name: "Elena Costa", email: "elena.costa@arena.local", sports: ["Beach tennis", "Futevôlei"], slots: nights },
  { key: "felipe", name: "Felipe Rocha", email: "felipe.rocha@arena.local", sports: ["Futevôlei", "Vôlei"], slots: nights },
  { key: "gabriela", name: "Gabriela Nunes", email: "gabriela.nunes@arena.local", sports: ["Beach tennis", "Vôlei"], slots: nights },
  { key: "henrique", name: "Henrique Dias", email: "henrique.dias@arena.local", sports: ["Vôlei", "Futevôlei"], slots: nights },
  { key: "marina", name: "Marina Teixeira", email: "marina.teixeira@arena.local", sports: ["Beach tennis", "Futevôlei"], slots: [...weekly([2, 4], "19:00", "22:00"), ...weekly([6], "09:00", "12:00")] },
  { key: "otavio", name: "Otávio Pires", email: "otavio.pires@arena.local", sports: ["Futevôlei", "Vôlei"], slots: [...weekly([1, 2, 3, 4, 5], "18:00", "21:00"), ...weekly([0], "08:00", "11:00")] },
  { key: "sofia", name: "Sofia Lima", email: "sofia.lima@arena.local", sports: ["Vôlei", "Beach tennis"], slots: [...weekly([3, 5], "17:00", "21:00"), ...weekly([6], "09:00", "13:00")] },
  { key: "tiago", name: "Tiago Melo", email: "tiago.melo@arena.local", sports: ["Futevôlei", "Beach tennis"], slots: [...weekly([1, 3, 5], "18:00", "22:00"), ...weekly([0], "09:00", "12:00")] },
  { key: "lucas", name: "Lucas Mendes", email: "lucas.mendes@arena.local", sports: ["Vôlei", "Futevôlei"], slots: weekly([1, 2, 3, 4, 5], "19:00", "22:00") },
  { key: "iara", name: "Iara Costa", email: "iara.costa@arena.local", sports: ["Beach tennis", "Vôlei"], slots: [...weekly([2, 4], "18:00", "21:00"), ...weekly([6], "08:00", "12:00")] },
  { key: "camila", name: "Camila Rocha", email: "camila.rocha@arena.local", sports: ["Vôlei", "Beach tennis", "Futevôlei"], slots: [...nights, ...weekly([0], "09:00", "12:00")] },
] as const;

function assertFits(label: string, slots: AvailabilitySlot[], start: Date, end: Date) {
  if (!userCovers(slots, start, end)) {
    throw new Error(`Seed inválido: ${label} não cobre ${formatSlot(start, end)}`);
  }
}

async function main() {
  await prisma.proposal.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.squadMember.deleteMany();
  await prisma.squad.deleteMany();
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

  async function createSquad(kind: string, status: "active" | "forming", creator: string, others: { key: string; status: "accepted" | "pending" }[]) {
    return prisma.squad.create({
      data: {
        kind,
        status,
        creatorId: id(creator),
        members: {
          create: [
            { userId: id(creator), status: "accepted", respondedAt: new Date() },
            ...others.map((other) => ({
              userId: id(other.key),
              status: other.status,
              respondedAt: other.status === "accepted" ? new Date() : null,
            })),
          ],
        },
      },
    });
  }

  const anaBruno = await createSquad("dupla", "active", "ana", [{ key: "bruno", status: "accepted" }]);
  const paulaRicardo = await createSquad("dupla", "active", "paula", [{ key: "ricardo", status: "accepted" }]);
  const carlaTrio = await createSquad("trio", "active", "carla", [
    { key: "diego", status: "accepted" },
    { key: "elena", status: "accepted" },
  ]);
  const felipeTrio = await createSquad("trio", "active", "felipe", [
    { key: "gabriela", status: "accepted" },
    { key: "henrique", status: "accepted" },
  ]);
  await createSquad("quarteto", "active", "marina", [
    { key: "otavio", status: "accepted" },
    { key: "sofia", status: "accepted" },
    { key: "tiago", status: "accepted" },
  ]);
  await createSquad("dupla", "forming", "lucas", [{ key: "iara", status: "pending" }]);

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

  for (const key of ["ana", "bruno", "paula", "ricardo"] as const) {
    assertFits(key, users.get(key)!.slots, confirmedStart, confirmedEnd);
  }
  for (const key of ["carla", "diego", "elena", "felipe", "gabriela", "henrique"] as const) {
    assertFits(key, users.get(key)!.slots, pendingStart, pendingEnd);
  }

  await prisma.challenge.create({
    data: {
      challengerSquadId: anaBruno.id,
      challengedSquadId: paulaRicardo.id,
      sport: "Vôlei",
      court: "Quadra Central",
      startAt: confirmedStart,
      endAt: confirmedEnd,
      status: "accepted",
      awaiting: "none",
      proposals: { create: { squadId: anaBruno.id, startAt: confirmedStart, endAt: confirmedEnd } },
    },
  });

  await prisma.challenge.create({
    data: {
      challengerSquadId: felipeTrio.id,
      challengedSquadId: carlaTrio.id,
      sport: "Beach tennis",
      court: "Quadra de Areia",
      startAt: pendingStart,
      endAt: pendingEnd,
      status: "pending",
      awaiting: "challenged",
      proposals: { create: { squadId: felipeTrio.id, startAt: pendingStart, endAt: pendingEnd } },
    },
  });

  const active = await prisma.squad.count({ where: { status: "active" } });
  const duplas = await prisma.squad.count({ where: { status: "active", kind: "dupla" } });
  const trios = await prisma.squad.count({ where: { status: "active", kind: "trio" } });
  const quartetos = await prisma.squad.count({ where: { status: "active", kind: "quarteto" } });
  const pending = await prisma.challenge.count({ where: { status: "pending" } });
  const accepted = await prisma.challenge.count({ where: { status: "accepted" } });
  if (active < 5 || duplas < 2 || trios < 2 || quartetos < 1 || pending < 1 || accepted < 1) {
    throw new Error("Seed não criou dupla, trio e quarteto.");
  }

  console.log(`Equipes ativas: ${active}. Pendente: ${formatSlot(pendingStart, pendingEnd)}. Confirmado: ${formatSlot(confirmedStart, confirmedEnd)}.`);
  console.log(`Senha de demonstração: ${DEMO_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
