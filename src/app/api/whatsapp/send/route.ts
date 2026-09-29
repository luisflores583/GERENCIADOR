import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  const to = String(body?.to || "").replace(/\D/g, "");
  const text = String(body?.body || "").trim();
  if (!to || !text) return jsonError("to e body obrigatórios");

  await prisma.whatsAppMessage.create({
    data: {
      organizationId: session.organizationId,
      phone: to,
      direction: "OUT",
      body: text,
    },
  });
  const result = await getWhatsAppProvider().send({ to, body: text });
  return jsonOk({ result });
}
