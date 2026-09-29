import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const existing = await prisma.service.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) return jsonError("Serviço não encontrado", 404);
  const body = await req.json().catch(() => null);
  const service = await prisma.service.update({
    where: { id },
    data: {
      name: body?.name != null ? String(body.name).trim() : undefined,
      description:
        body?.description !== undefined
          ? body.description
            ? String(body.description)
            : null
          : undefined,
      priceCents:
        body?.priceCents != null ? Math.round(Number(body.priceCents)) : undefined,
      durationMin:
        body?.durationMin != null ? Math.round(Number(body.durationMin)) : undefined,
      category:
        body?.category !== undefined
          ? body.category
            ? String(body.category)
            : null
          : undefined,
      active: body?.active != null ? Boolean(body.active) : undefined,
      imageUrl:
        body?.imageUrl !== undefined
          ? body.imageUrl
            ? String(body.imageUrl)
            : null
          : undefined,
      sortOrder: body?.sortOrder != null ? Number(body.sortOrder) : undefined,
    },
  });
  return jsonOk({ service });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const existing = await prisma.service.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) return jsonError("Serviço não encontrado", 404);
  await prisma.service.update({ where: { id }, data: { active: false } });
  return jsonOk({ ok: true });
}
