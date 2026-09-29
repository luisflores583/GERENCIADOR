import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const services = await prisma.service.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return jsonOk({ services });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const priceCents = Number(body?.priceCents);
  const durationMin = Number(body?.durationMin);
  if (!name || !Number.isFinite(priceCents) || !Number.isFinite(durationMin)) {
    return jsonError("Nome, preço e duração são obrigatórios");
  }
  const service = await prisma.service.create({
    data: {
      organizationId: session.organizationId,
      name,
      description: body?.description ? String(body.description) : null,
      priceCents: Math.round(priceCents),
      durationMin: Math.round(durationMin),
      category: body?.category ? String(body.category) : null,
      active: body?.active !== false,
      imageUrl: body?.imageUrl ? String(body.imageUrl) : null,
      sortOrder: Number(body?.sortOrder) || 0,
    },
  });
  return jsonOk({ service }, { status: 201 });
}
