import { NextResponse } from "next/server";
import { aplicarNotificacaoDePagamento } from "@/server/pagamentos";
import { idDaNotificacao, segredoDoWebhook, tipoDaNotificacao, validarAssinaturaWebhook } from "@/server/mercadopago";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const bruto = await request.text();
  let corpo: unknown = null;
  if (bruto) {
    try {
      corpo = JSON.parse(bruto);
    } catch {
      corpo = null;
    }
  }
  const segredo = segredoDoWebhook();
  if (!segredo) return NextResponse.json({ erro: "Webhook sem segredo." }, { status: 401 });
  const dataId = idDaNotificacao(url, corpo);
  const valida = validarAssinaturaWebhook({
    assinatura: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    segredo,
  });
  if (!valida) return NextResponse.json({ erro: "Assinatura inválida." }, { status: 401 });
  const tipo = tipoDaNotificacao(url, corpo);
  if (tipo && tipo !== "payment") return NextResponse.json({ ok: true });
  if (!dataId) return NextResponse.json({ ok: true });
  await aplicarNotificacaoDePagamento(dataId);
  return NextResponse.json({ ok: true });
}
