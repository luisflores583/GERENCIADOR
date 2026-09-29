import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const hours = await prisma.businessHour.findMany({
    where: {
      organizationId: session.organizationId,
      OR: [{ professionalId: session.professionalId }, { professionalId: null }],
    },
    orderBy: { weekday: "asc" },
  });
  const holidays = await prisma.holiday.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { date: "asc" },
  });
  return jsonOk({ hours, holidays });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  const items = Array.isArray(body?.hours) ? body.hours : null;
  if (!items) return jsonError("hours[] obrigatório");

  for (const h of items) {
    const weekday = Number(h.weekday);
    if (weekday < 0 || weekday > 6) continue;
    const existing = await prisma.businessHour.findFirst({
      where: {
        organizationId: session.organizationId,
        professionalId: session.professionalId,
        weekday,
      },
    });
    const data = {
      openTime: String(h.openTime || "09:00"),
      closeTime: String(h.closeTime || "18:00"),
      breakStart: h.breakStart ? String(h.breakStart) : null,
      breakEnd: h.breakEnd ? String(h.breakEnd) : null,
      closed: Boolean(h.closed),
    };
    if (existing) {
      await prisma.businessHour.update({ where: { id: existing.id }, data });
    } else {
      await prisma.businessHour.create({
        data: {
          organizationId: session.organizationId,
          professionalId: session.professionalId,
          weekday,
          ...data,
        },
      });
    }
  }
  return jsonOk({ ok: true });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  if (body?.holiday) {
    const date = String(body.holiday.date || "");
    const name = String(body.holiday.name || "Feriado");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError("Data inválida");
    const holiday = await prisma.holiday.upsert({
      where: {
        organizationId_date: { organizationId: session.organizationId, date },
      },
      create: { organizationId: session.organizationId, date, name },
      update: { name },
    });
    return jsonOk({ holiday }, { status: 201 });
  }
  return jsonError("Payload inválido");
}
