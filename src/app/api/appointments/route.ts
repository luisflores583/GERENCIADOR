import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSlotAvailable } from "@/lib/availability";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");

  const appointments = await prisma.appointment.findMany({
    where: {
      organizationId: session.organizationId,
      ...(from || to
        ? {
            startAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(status ? { status } : {}),
    },
    include: {
      client: true,
      service: true,
      professional: true,
    },
    orderBy: { startAt: "asc" },
  });
  return jsonOk({ appointments });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  const clientId = String(body?.clientId || "");
  const serviceId = String(body?.serviceId || "");
  const startAt = body?.startAt ? new Date(body.startAt) : null;
  if (!clientId || !serviceId || !startAt || Number.isNaN(startAt.getTime())) {
    return jsonError("Cliente, serviço e horário são obrigatórios");
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: session.organizationId },
  });
  if (!client) return jsonError("Cliente inválido");

  const check = await assertSlotAvailable({
    organizationId: session.organizationId,
    professionalId: session.professionalId,
    serviceId,
    startAt,
  });
  if (!check.ok) return jsonError(check.error);

  const appointment = await prisma.appointment.create({
    data: {
      organizationId: session.organizationId,
      professionalId: session.professionalId,
      clientId,
      serviceId,
      startAt,
      endAt: check.endAt,
      status: APPOINTMENT_STATUS.SCHEDULED,
      priceCents: check.priceCents,
      notes: body?.notes ? String(body.notes) : null,
      source: "ADMIN",
    },
    include: { client: true, service: true },
  });
  return jsonOk({ appointment }, { status: 201 });
}
