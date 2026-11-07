import { createHmac, timingSafeEqual } from "node:crypto";
import { ErroDeRegra } from "@/lib/erros";

export const AVISO_PAGAMENTO_NAO_CONFIGURADO = "O pagamento ainda não foi configurado.";

export const CAMINHO_WEBHOOK = "/api/pagamentos/mercadopago";

export type PreferenciaCriada = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
};

export type PagamentoRemoto = {
  id: string;
  status: string;
  external_reference: string | null;
};

export type ClienteMercadoPago = {
  criarPreferencia(token: string, corpo: Record<string, unknown>): Promise<PreferenciaCriada>;
  buscarPagamento(token: string, id: string): Promise<PagamentoRemoto>;
};

export function tokenDeAcesso(): string {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
}

export function chavePublica(): string {
  return process.env.MERCADO_PAGO_PUBLIC_KEY?.trim() ?? "";
}

export function segredoDoWebhook(): string {
  return process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? "";
}

export function pagamentoEstaConfigurado(): boolean {
  return tokenDeAcesso().length > 0;
}

export function pontoDeCheckout(preferencia: PreferenciaCriada, token: string): string {
  if (token.startsWith("TEST-") && preferencia.sandbox_init_point) return preferencia.sandbox_init_point;
  return preferencia.init_point;
}

export function efeitoDoStatus(
  atual: "AGUARDANDO" | "APROVADO" | "RECUSADO" | "CANCELADO",
  remoto: string,
): "repetir" | "aprovar" | "recusar" | "cancelar" | "aguardar" {
  if (atual === "APROVADO") return "repetir";
  if (remoto === "approved") return "aprovar";
  if (remoto === "rejected") return "recusar";
  if (remoto === "cancelled") return "cancelar";
  return "aguardar";
}

export function validarAssinaturaWebhook(entrada: {
  assinatura: string | null;
  requestId: string | null;
  dataId: string | null;
  segredo: string;
}): boolean {
  if (!entrada.assinatura || !entrada.requestId || !entrada.dataId || !entrada.segredo) return false;
  let ts = "";
  let v1 = "";
  for (const parte of entrada.assinatura.split(",")) {
    const [chave, ...resto] = parte.trim().split("=");
    const valor = resto.join("=").trim();
    if (chave === "ts") ts = valor;
    if (chave === "v1") v1 = valor;
  }
  if (!ts || !v1) return false;
  const id = /[a-z]/i.test(entrada.dataId) ? entrada.dataId.toLowerCase() : entrada.dataId;
  const manifesto = `id:${id};request-id:${entrada.requestId};ts:${ts};`;
  const calculado = createHmac("sha256", entrada.segredo).update(manifesto).digest("hex");
  const esquerda = Buffer.from(calculado);
  const direita = Buffer.from(v1);
  if (esquerda.length !== direita.length) return false;
  return timingSafeEqual(esquerda, direita);
}

export function idDaNotificacao(url: URL, corpo: unknown): string {
  const consulta = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (consulta) return consulta;
  if (corpo && typeof corpo === "object" && "data" in corpo) {
    const data = (corpo as { data?: { id?: string | number } }).data;
    if (data?.id != null) return String(data.id);
  }
  return "";
}

export function tipoDaNotificacao(url: URL, corpo: unknown): string {
  const consulta = url.searchParams.get("type") ?? url.searchParams.get("topic");
  if (consulta) return consulta;
  if (corpo && typeof corpo === "object" && "type" in corpo) {
    return String((corpo as { type?: string }).type ?? "");
  }
  return "";
}

const clienteHttp: ClienteMercadoPago = {
  async criarPreferencia(token, corpo) {
    return chamarMercadoPago(token, "/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(corpo),
    });
  },
  async buscarPagamento(token, id) {
    return chamarMercadoPago(token, `/v1/payments/${encodeURIComponent(id)}`, { method: "GET" });
  },
};

let clienteAtual: ClienteMercadoPago = clienteHttp;

export function usarClienteMercadoPago(cliente: ClienteMercadoPago) {
  clienteAtual = cliente;
}

export function clienteMercadoPago(): ClienteMercadoPago {
  return clienteAtual;
}

async function chamarMercadoPago(token: string, caminho: string, init: RequestInit) {
  const resposta = await fetch(`https://api.mercadopago.com${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!resposta.ok) {
    throw new ErroDeRegra("O Mercado Pago não concluiu o checkout. Tente de novo.");
  }
  return resposta.json() as Promise<PreferenciaCriada & PagamentoRemoto>;
}
