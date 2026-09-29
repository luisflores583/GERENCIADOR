import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSlotAvailable } from "@/lib/availability";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const appointment = await prisma.appointment.findFirst({
    where: { id, organizationId: session.organizationId },
    include: { client: true, service: true, professional: true },
  });
  if (!appointment) return jsonError("Agendamento não encontrado", 404);
  return jsonOk({ appointment });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const existing = await prisma.appointment.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) return jsonError("Agendamento não encontrado", 404);

  const body = await req.json().catch(() => null);
  const status = body?.status ? String(body.status) : undefined;
  const serviceId = body?.serviceId ? String(body.serviceId) : existing.serviceId;
  const startAt = body?.startAt ? new Date(body.startAt) : existing.startAt;
  const paymentMethod = body?.paymentMethod
    ? String(body.paymentMethod)
    : undefined;

  let endAt = existing.endAt;
  let priceCents = existing.priceCents;

  const timeOrServiceChanged =
    serviceId !== existing.serviceId ||
    startAt.getTime() !== existing.startAt.getTime();

  if (timeOrServiceChanged) {
    const check = await assertSlotAvailable({
      organizationId: session.organizationId,
      professionalId: existing.professionalId,
      serviceId,
      startAt,
      excludeAppointmentId: id,
    });
    if (!check.ok) return jsonError(check.error);
    endAt = check.endAt;
    priceCents = check.priceCents;
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      serviceId,
      startAt,
      endAt,
      priceCents,
      status,
      notes: body?.notes !== undefined ? (body.notes ? String(body.notes) : null) : undefined,
      paymentMethod,
      ...(status === APPOINTMENT_STATUS.CANCELED_CLIENT ||
      status === APPOINTMENT_STATUS.CANCELED_PRO
        ? { canceledAt: new Date(), cancelReason: body?.cancelReason ? String(body.cancelReason) : null }
        : {}),
    },
    include: { client: true, service: true },
  });

  // Receita automática ao concluir/pagar
  if (
    status === APPOINTMENT_STATUS.COMPLETED &&
    existing.status !== APPOINTMENT_STATUS.COMPLETED
  ) {
    const method = paymentMethod || appointment.paymentMethod || "PIX";
    await prisma.appointment.update({
      where: { id },
      data: { paidAt: new Date(), paymentMethod: method },
    });
    const already = await prisma.financialTransaction.findFirst({
      where: { appointmentId: id, type: "INCOME" },
    });
    if (!already) {
      await prisma.financialTransaction.create({
        data: {
          organizationId: session.organizationId,
          appointmentId: id,
          type: "INCOME",
          category: "Serviço",
          description: `${appointment.service.name} — ${appointment.client.name}`,
          amountCents: appointment.priceCents,
          paymentMethod: method,
          occurredAt: new Date(),
        },
      });
    }
  }

  return jsonOk({ appointment });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const existing = await prisma.appointment.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) return jsonError("Agendamento não encontrado", 404);
  await prisma.appointment.update({
    where: { id },
    data: {
      status: APPOINTMENT_STATUS.CANCELED_PRO,
      canceledAt: new Date(),
      cancelReason: "Cancelado pelo painel",
    },
  });
  return jsonOk({ ok: true });
}
