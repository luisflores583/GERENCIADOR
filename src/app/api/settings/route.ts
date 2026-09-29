import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const professional = await prisma.professional.findFirst({
    where: { id: session.professionalId, organizationId: session.organizationId },
    include: { organization: true, user: { select: { email: true, name: true } } },
  });
  if (!professional) return jsonError("Perfil não encontrado", 404);
  return jsonOk({ professional });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  const professional = await prisma.professional.update({
    where: { id: session.professionalId },
    data: {
      displayName: body?.displayName != null ? String(body.displayName) : undefined,
      phone: body?.phone !== undefined ? (body.phone ? String(body.phone) : null) : undefined,
      bio: body?.bio !== undefined ? (body.bio ? String(body.bio) : null) : undefined,
      cancellationHours:
        body?.cancellationHours != null ? Number(body.cancellationHours) : undefined,
    },
  });
  if (body?.name || body?.organizationName) {
    if (body.name) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { name: String(body.name) },
      });
    }
    if (body.organizationName) {
      await prisma.organization.update({
        where: { id: session.organizationId },
        data: { name: String(body.organizationName) },
      });
    }
  }
  return jsonOk({ professional });
}
