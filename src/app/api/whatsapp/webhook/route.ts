import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleIncomingWhatsApp } from "@/lib/whatsapp/bot";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { jsonOk, jsonError } from "@/lib/api";

/** Verificação de webhook (estilo Meta) */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const settings = await prisma.whatsAppSettings.findFirst();
  if (mode === "subscribe" && token && settings && token === settings.verifyToken) {
    return new Response(challenge || "ok", { status: 200 });
  }
  // fallback: também aceita ?phone=&body= para teste rápido via GET
  const phone = searchParams.get("phone");
  const body = searchParams.get("body");
  if (phone && body) {
    const result = await handleIncomingWhatsApp({ phone, body });
    return jsonOk(result);
  }
  return jsonError("Token inválido", 403);
}

/** Webhook + simulador: { phone, body, organizationId? } */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) return jsonError("JSON inválido");

  // Formato Meta simplificado
  const metaText =
    payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
  const metaFrom =
    payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

  const phone = String(payload.phone || metaFrom || "").replace(/\D/g, "");
  const body = String(payload.body || payload.text || metaText || "").trim();

  if (!phone || !body) return jsonError("phone e body são obrigatórios");

  const result = await handleIncomingWhatsApp({
    phone,
    body,
    organizationId: payload.organizationId,
  });

  return jsonOk({
    ...result,
    provider: getWhatsAppProvider().name,
  });
}
