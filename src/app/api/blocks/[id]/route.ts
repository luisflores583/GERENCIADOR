import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const existing = await prisma.blockedTime.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) return jsonError("Bloqueio não encontrado", 404);
  await prisma.blockedTime.delete({ where: { id } });
  return jsonOk({ ok: true });
}
