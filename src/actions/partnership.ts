"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { FORMATS, formatById, type FormatId } from "@/lib/constants";
import { getActiveSquad } from "@/lib/data";
import { prisma } from "@/lib/prisma";

function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function touch() {
  revalidatePath("/atletas");
  revalidatePath("/dupla");
  revalidatePath("/inicio");
  revalidatePath("/desafiar");
  revalidatePath("/desafios");
  revalidatePath("/agenda");
}

function isFormat(value: string): value is FormatId {
  return FORMATS.some((item) => item.id === value);
}

export async function inviteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const targetId = String(formData.get("userId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!targetId || targetId === user.id) fail("/atletas", "Escolha outro atleta.");

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true } });
  if (!target) fail("/atletas", "Atleta não encontrado.");

  try {
    await prisma.$transaction(async (tx) => {
      const active = await tx.squadMember.findFirst({
        where: { userId: user.id, status: "accepted", squad: { status: "active" } },
      });
      if (active) throw new Error("Você já tem uma equipe ativa.");

      const targetActive = await tx.squadMember.findFirst({
        where: { userId: targetId, status: "accepted", squad: { status: "active" } },
      });
      if (targetActive) throw new Error(`${target.name} já tem uma equipe ativa.`);

      const forming = await tx.squad.findFirst({
        where: { creatorId: user.id, status: "forming" },
        include: { members: true },
      });

      if (forming) {
        const size = formatById(forming.kind).size;
        const occupied = forming.members.filter((member) => member.status === "pending" || member.status === "accepted");
        if (occupied.some((member) => member.userId === targetId)) {
          throw new Error("Essa pessoa já foi convidada.");
        }
        if (occupied.length >= size) throw new Error("Essa equipe já está completa.");
        const declined = forming.members.find((member) => member.userId === targetId && member.status === "declined");
        if (declined) {
          await tx.squadMember.update({
            where: { id: declined.id },
            data: { status: "pending", respondedAt: null },
          });
        } else {
          await tx.squadMember.create({
            data: { squadId: forming.id, userId: targetId, status: "pending" },
          });
        }
        return;
      }

      if (!isFormat(kind)) throw new Error("Escolha dupla, trio ou quarteto.");
      await tx.squad.create({
        data: {
          kind,
          status: "forming",
          creatorId: user.id,
          members: {
            create: [
              { userId: user.id, status: "accepted", respondedAt: new Date() },
              { userId: targetId, status: "pending" },
            ],
          },
        },
      });
    });
  } catch (error) {
    fail("/atletas", error instanceof Error ? error.message : "Não foi possível enviar o convite.");
  }

  touch();
  redirect("/dupla?ok=convite");
}

export async function respondInviteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "");

  try {
    await prisma.$transaction(async (tx) => {
      const member = await tx.squadMember.findUnique({ where: { id }, include: { squad: true } });
      if (!member || member.squad.status !== "forming") {
        throw new Error("Esse convite não está mais pendente.");
      }

      if (intent === "cancel") {
        if (member.squad.creatorId !== user.id) throw new Error("Só quem convidou pode cancelar.");
        if (member.status !== "pending") throw new Error("Esse convite não está mais pendente.");
        await tx.squadMember.update({
          where: { id },
          data: { status: "cancelled", respondedAt: new Date() },
        });
        return;
      }

      if (member.userId !== user.id || member.status !== "pending") {
        throw new Error("Só quem foi convidado pode responder.");
      }
      if (intent === "decline") {
        await tx.squadMember.update({
          where: { id },
          data: { status: "declined", respondedAt: new Date() },
        });
        return;
      }
      if (intent !== "accept") throw new Error("Resposta inválida.");

      const mineActive = await tx.squadMember.findFirst({
        where: { userId: user.id, status: "accepted", squad: { status: "active" } },
      });
      if (mineActive) throw new Error("Você já tem uma equipe ativa.");

      const mineForming = await tx.squad.findFirst({
        where: { creatorId: user.id, status: "forming", id: { not: member.squadId } },
      });
      if (mineForming) throw new Error("Cancele a equipe que você está formando antes de aceitar outro convite.");

      await tx.squadMember.update({
        where: { id },
        data: { status: "accepted", respondedAt: new Date() },
      });
      await tx.squadMember.updateMany({
        where: { userId: user.id, status: "pending", id: { not: id } },
        data: { status: "cancelled", respondedAt: new Date() },
      });

      const acceptedCount = await tx.squadMember.count({
        where: { squadId: member.squadId, status: "accepted" },
      });
      if (acceptedCount >= formatById(member.squad.kind).size) {
        await tx.squad.update({ where: { id: member.squadId }, data: { status: "active" } });
        const accepted = await tx.squadMember.findMany({
          where: { squadId: member.squadId, status: "accepted" },
          select: { userId: true },
        });
        const userIds = accepted.map((item) => item.userId);
        await tx.squadMember.updateMany({
          where: { squadId: member.squadId, status: "pending" },
          data: { status: "cancelled", respondedAt: new Date() },
        });
        await tx.squadMember.updateMany({
          where: { userId: { in: userIds }, status: "pending", squadId: { not: member.squadId } },
          data: { status: "cancelled", respondedAt: new Date() },
        });
        const leftover = await tx.squad.findMany({
          where: { status: "forming", creatorId: { in: userIds }, id: { not: member.squadId } },
          select: { id: true },
        });
        if (leftover.length > 0) {
          const ids = leftover.map((item) => item.id);
          await tx.squad.updateMany({ where: { id: { in: ids } }, data: { status: "cancelled" } });
          await tx.squadMember.updateMany({
            where: { squadId: { in: ids }, status: "pending" },
            data: { status: "cancelled", respondedAt: new Date() },
          });
        }
      }
    });
  } catch (error) {
    fail("/dupla", error instanceof Error ? error.message : "Não foi possível responder ao convite.");
  }

  touch();
  redirect(intent === "accept" ? "/dupla?ok=aceito" : "/dupla?ok=atualizado");
}

export async function cancelSquadAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const forming = await prisma.squad.findFirst({ where: { creatorId: user.id, status: "forming" } });
  if (!forming) fail("/dupla", "Você não está formando uma equipe.");

  await prisma.$transaction([
    prisma.squad.update({ where: { id: forming.id }, data: { status: "cancelled" } }),
    prisma.squadMember.updateMany({
      where: { squadId: forming.id, status: "pending" },
      data: { status: "cancelled", respondedAt: new Date() },
    }),
  ]);

  touch();
  redirect("/dupla?ok=cancelada");
}

export async function endPairAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const squad = await getActiveSquad(user.id);
  if (!squad) fail("/dupla", "Você não tem uma equipe ativa.");

  await prisma.$transaction([
    prisma.squad.update({ where: { id: squad.id }, data: { status: "ended" } }),
    prisma.challenge.updateMany({
      where: {
        status: { in: ["pending", "countered"] },
        OR: [{ challengerSquadId: squad.id }, { challengedSquadId: squad.id }],
      },
      data: { status: "cancelled", awaiting: "none" },
    }),
  ]);

  touch();
  redirect("/dupla?ok=encerrada");
}
