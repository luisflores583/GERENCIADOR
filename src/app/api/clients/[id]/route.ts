import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const client = await prisma.client.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      appointments: {
        include: { service: true },
        orderBy: { startAt: "desc" },
        take: 50,
      },
    },
  });
  if (!client) return jsonError("Cliente não encontrado", 404);
  return jsonOk({ client });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const existing = await prisma.client.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) return jsonError("Cliente não encontrado", 404);

  const client = await prisma.client.update({
    where: { id },
    data: {
      name: body?.name != null ? String(body.name).trim() : undefined,
      phone: body?.phone != null ? String(body.phone).replace(/\D/g, "") : undefined,
      email: body?.email !== undefined ? (body.email ? String(body.email) : null) : undefined,
      notes: body?.notes !== undefined ? (body.notes ? String(body.notes) : null) : undefined,
    },
  });
  return jsonOk({ client });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const existing = await prisma.client.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) return jsonError("Cliente não encontrado", 404);
  await prisma.client.delete({ where: { id } });
  return jsonOk({ ok: true });
}
