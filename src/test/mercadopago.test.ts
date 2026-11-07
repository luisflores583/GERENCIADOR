import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cobraInscricao } from "@/lib/formatacao";
import { efeitoDoStatus, pontoDeCheckout, validarAssinaturaWebhook } from "@/server/mercadopago";

describe("Mercado Pago", () => {
  it("cobra só quando o valor é maior que zero", () => {
    expect(cobraInscricao(null)).toBe(false);
    expect(cobraInscricao(0)).toBe(false);
    expect(cobraInscricao(5000)).toBe(true);
  });

  it("valida a assinatura do webhook e recusa uma assinatura trocada", () => {
    const segredo = "segredo-de-teste";
    const dataId = "123456";
    const requestId = "req-1";
    const ts = "1704908010";
    const manifesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", segredo).update(manifesto).digest("hex");
    const entrada = { assinatura: `ts=${ts},v1=${v1}`, requestId, dataId, segredo };
    expect(validarAssinaturaWebhook(entrada)).toBe(true);
    expect(validarAssinaturaWebhook({ ...entrada, assinatura: `ts=${ts},v1=${"0".repeat(v1.length)}` })).toBe(false);
    expect(validarAssinaturaWebhook({ ...entrada, segredo: "" })).toBe(false);
  });

  it("não cobra de novo um pagamento já aprovado e libera nova tentativa depois da recusa", () => {
    expect(efeitoDoStatus("APROVADO", "approved")).toBe("repetir");
    expect(efeitoDoStatus("APROVADO", "rejected")).toBe("repetir");
    expect(efeitoDoStatus("AGUARDANDO", "approved")).toBe("aprovar");
    expect(efeitoDoStatus("AGUARDANDO", "rejected")).toBe("recusar");
    expect(efeitoDoStatus("RECUSADO", "approved")).toBe("aprovar");
    expect(efeitoDoStatus("AGUARDANDO", "cancelled")).toBe("cancelar");
    expect(efeitoDoStatus("AGUARDANDO", "pending")).toBe("aguardar");
  });

  it("usa o checkout de teste quando o token começa com TEST-", () => {
    const preferencia = {
      id: "pref",
      init_point: "https://www.mercadopago.com.br/checkout",
      sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout",
    };
    expect(pontoDeCheckout(preferencia, "TEST-token")).toBe(preferencia.sandbox_init_point);
    expect(pontoDeCheckout(preferencia, "APP_USR-token")).toBe(preferencia.init_point);
  });
});
