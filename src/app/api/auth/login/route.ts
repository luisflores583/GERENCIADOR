import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSessionCookie, clearSessionCookie, getSession } from "@/lib/auth";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!email || !password) return jsonError("Informe e-mail e senha");

  const user = await prisma.user.findFirst({
    where: { email, active: true },
    include: { professional: true },
  });
  if (!user) return jsonError("Credenciais inválidas", 401);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return jsonError("Credenciais inválidas", 401);
  if (!user.professional) return jsonError("Usuário sem profissional vinculado", 403);

  await setSessionCookie({
    userId: user.id,
    organizationId: user.organizationId,
    professionalId: user.professional.id,
    email: user.email,
    name: user.name,
  });

  return jsonOk({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      organizationId: user.organizationId,
      professionalId: user.professional.id,
    },
  });
}

export async function DELETE() {
  await clearSessionCookie();
  return jsonOk({ ok: true });
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  return jsonOk({ user: session });
}
