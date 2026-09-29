import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const clients = await prisma.client.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { appointments: true } },
      appointments: {
        where: { status: "COMPLETED" },
        select: { priceCents: true },
      },
    },
  });
  const data = clients.map((c) => ({
    ...c,
    totalSpentCents: c.appointments.reduce((s, a) => s + a.priceCents, 0),
    appointments: undefined,
  }));
  return jsonOk({ clients: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const phone = String(body?.phone || "").replace(/\D/g, "");
  const email = body?.email ? String(body.email).trim() : null;
  const notes = body?.notes ? String(body.notes) : null;
  if (!name || !phone) return jsonError("Nome e WhatsApp são obrigatórios");

  try {
    const client = await prisma.client.create({
      data: {
        organizationId: session.organizationId,
        name,
        phone,
        email,
        notes,
      },
    });
    return jsonOk({ client }, { status: 201 });
  } catch {
    return jsonError("Já existe cliente com este WhatsApp", 409);
  }
}
