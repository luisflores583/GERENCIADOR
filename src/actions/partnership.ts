"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getActivePair } from "@/lib/data";
import { prisma } from "@/lib/prisma";

function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

export async function inviteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const targetId = String(formData.get("userId") ?? "");
  if (!targetId || targetId === user.id) fail("/atletas", "Escolha outro atleta.");

  const [mePair, target, targetPair, existing, outgoing] = await Promise.all([
    getActivePair(user.id),
    prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true } }),
    getActivePair(targetId),
    prisma.partnership.findFirst({
      where: {
        status: "pending",
        OR: [
          { inviterId: user.id, inviteeId: targetId },
          { inviterId: targetId, inviteeId: user.id },
        ],
      },
    }),
    prisma.partnership.findFirst({ where: { inviterId: user.id, status: "pending" } }),
  ]);

  if (!target) fail("/atletas", "Atleta não encontrado.");
  if (mePair) fail("/atletas", "Você já tem uma dupla ativa.");
  if (targetPair) fail("/atletas", `${target.name} já tem uma dupla ativa.`);
  if (existing) fail("/atletas", "Já existe um convite pendente entre vocês.");
  if (outgoing) fail("/atletas", "Cancele o convite pendente antes de convidar outra pessoa.");

  await prisma.partnership.create({
    data: { inviterId: user.id, inviteeId: targetId, status: "pending" },
  });

  revalidatePath("/atletas");
  revalidatePath("/dupla");
  revalidatePath("/inicio");
  redirect("/dupla?ok=convite");
}

export async function respondInviteAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "");

  try {
    await prisma.$transaction(async (tx) => {
      const invite = await tx.partnership.findUnique({ where: { id } });
      if (!invite || invite.status !== "pending") {
        throw new Error("Esse convite não está mais pendente.");
      }

      const isInvitee = invite.inviteeId === user.id;
      const isInviter = invite.inviterId === user.id;
      if (intent === "cancel") {
        if (!isInviter) throw new Error("Só quem convidou pode cancelar.");
        await tx.partnership.update({
          where: { id },
          data: { status: "cancelled", respondedAt: new Date() },
        });
        return;
      }

      if (!isInvitee) throw new Error("Só quem foi convidado pode responder.");
      if (intent === "decline") {
        await tx.partnership.update({
          where: { id },
          data: { status: "declined", respondedAt: new Date() },
        });
        return;
      }
      if (intent !== "accept") throw new Error("Resposta inválida.");

      const busy = await tx.partnership.findFirst({
        where: {
          status: "accepted",
          OR: [
            { inviterId: invite.inviterId },
            { inviteeId: invite.inviterId },
            { inviterId: invite.inviteeId },
            { inviteeId: invite.inviteeId },
          ],
        },
      });
      if (busy) throw new Error("Um de vocês já entrou em outra dupla.");

      await tx.partnership.update({
        where: { id },
        data: { status: "accepted", respondedAt: new Date() },
      });
      await tx.partnership.updateMany({
        where: {
          id: { not: id },
          status: "pending",
          OR: [
            { inviterId: invite.inviterId },
            { inviteeId: invite.inviterId },
            { inviterId: invite.inviteeId },
            { inviteeId: invite.inviteeId },
          ],
        },
        data: { status: "cancelled", respondedAt: new Date() },
      });
    });
  } catch (error) {
    fail("/dupla", error instanceof Error ? error.message : "Não foi possível responder ao convite.");
  }

  revalidatePath("/dupla");
  revalidatePath("/atletas");
  revalidatePath("/inicio");
  revalidatePath("/desafiar");
  redirect(intent === "accept" ? "/dupla?ok=aceito" : "/dupla?ok=atualizado");
}

export async function endPairAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const pair = await getActivePair(user.id);
  if (!pair) fail("/dupla", "Você não tem uma dupla ativa.");

  await prisma.$transaction([
    prisma.partnership.update({
      where: { id: pair.id },
      data: { status: "ended", respondedAt: new Date() },
    }),
    prisma.challenge.updateMany({
      where: {
        status: { in: ["pending", "countered"] },
        OR: [{ challengerPairId: pair.id }, { challengedPairId: pair.id }],
      },
      data: { status: "cancelled", awaiting: "none" },
    }),
  ]);

  revalidatePath("/dupla");
  revalidatePath("/atletas");
  revalidatePath("/inicio");
  revalidatePath("/desafios");
  revalidatePath("/agenda");
  redirect("/dupla?ok=encerrada");
}
