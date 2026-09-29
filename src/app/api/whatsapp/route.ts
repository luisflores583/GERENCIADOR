import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, unauthorized } from "@/lib/api";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const settings = await prisma.whatsAppSettings.findUnique({
    where: { organizationId: session.organizationId },
  });
  const messages = await prisma.whatsAppMessage.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const sessions = await prisma.whatsAppSession.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return jsonOk({ settings, messages, sessions });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const settings = await prisma.whatsAppSettings.upsert({
    where: { organizationId: session.organizationId },
    create: {
      organizationId: session.organizationId,
      welcomeMessage: body.welcomeMessage || undefined,
      humanHandoffNote: body.humanHandoffNote || undefined,
      verifyToken: body.verifyToken || "manicure-verify",
      active: body.active !== false,
      provider: body.provider || "mock",
    },
    update: {
      welcomeMessage: body.welcomeMessage != null ? String(body.welcomeMessage) : undefined,
      humanHandoffNote:
        body.humanHandoffNote != null ? String(body.humanHandoffNote) : undefined,
      verifyToken: body.verifyToken != null ? String(body.verifyToken) : undefined,
      active: body.active != null ? Boolean(body.active) : undefined,
      provider: body.provider != null ? String(body.provider) : undefined,
    },
  });
  return jsonOk({ settings });
}
