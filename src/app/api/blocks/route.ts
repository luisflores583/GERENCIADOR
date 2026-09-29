import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const blocks = await prisma.blockedTime.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { startAt: "desc" },
  });
  return jsonOk({ blocks });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  const startAt = body?.startAt ? new Date(body.startAt) : null;
  const endAt = body?.endAt ? new Date(body.endAt) : null;
  if (!startAt || !endAt || endAt <= startAt) return jsonError("Período inválido");
  const block = await prisma.blockedTime.create({
    data: {
      organizationId: session.organizationId,
      professionalId: session.professionalId,
      startAt,
      endAt,
      reason: body?.reason ? String(body.reason) : null,
      allDay: Boolean(body?.allDay),
    },
  });
  return jsonOk({ block }, { status: 201 });
}
