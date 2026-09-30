"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { SPORTS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { mergeIntervals } from "@/lib/schedule";

export type FormState = { error: string };

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(24 * 60),
  endMin: z.number().int().min(0).max(24 * 60),
});

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Informe seu nome." };
  if (name.length > 80) return { error: "Use um nome mais curto." };

  const sports = formData
    .getAll("sports")
    .map(String)
    .filter((sport) => (SPORTS as readonly string[]).includes(sport));
  if (sports.length === 0) return { error: "Escolha pelo menos um esporte." };

  let rawSlots: unknown;
  try {
    rawSlots = JSON.parse(String(formData.get("slots") ?? "[]"));
  } catch {
    return { error: "Não foi possível ler a disponibilidade." };
  }
  const parsedSlots = z.array(slotSchema).max(28).safeParse(rawSlots);
  if (!parsedSlots.success) return { error: "Revise os horários da semana." };

  const cleaned = parsedSlots.data.filter((slot) => slot.endMin > slot.startMin && slot.startMin % 30 === 0 && slot.endMin % 30 === 0);
  const byDay = new Map<number, { start: number; end: number }[]>();
  for (const slot of cleaned) {
    const list = byDay.get(slot.dayOfWeek) ?? [];
    list.push({ start: slot.startMin, end: slot.endMin });
    byDay.set(slot.dayOfWeek, list);
  }
  const slots = [...byDay.entries()].flatMap(([dayOfWeek, intervals]) =>
    mergeIntervals(intervals).map((interval) => ({
      dayOfWeek,
      startMin: interval.start,
      endMin: interval.end,
    })),
  );

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { name } });
    await tx.userSport.deleteMany({ where: { userId: user.id } });
    if (sports.length > 0) {
      await tx.userSport.createMany({ data: sports.map((sport) => ({ userId: user.id, sport })) });
    }
    await tx.availability.deleteMany({ where: { userId: user.id } });
    if (slots.length > 0) {
      await tx.availability.createMany({ data: slots.map((slot) => ({ ...slot, userId: user.id })) });
    }
  });

  revalidatePath("/perfil");
  revalidatePath("/atletas");
  revalidatePath("/inicio");
  redirect("/inicio?ok=perfil");
}
