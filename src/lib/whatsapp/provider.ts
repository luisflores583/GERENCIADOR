export type OutboundMessage = {
  to: string;
  body: string;
};

export interface WhatsAppProvider {
  name: string;
  send(message: OutboundMessage): Promise<{ id: string; ok: boolean }>;
}

/** Adapter mock — registra envios no console e retorna sucesso. */
export class MockWhatsAppProvider implements WhatsAppProvider {
  name = "mock";
  sent: OutboundMessage[] = [];

  async send(message: OutboundMessage) {
    this.sent.push(message);
    console.log(`[WhatsApp:mock] → ${message.to}: ${message.body.slice(0, 120)}`);
    return { id: `mock_${Date.now()}`, ok: true };
  }
}

let provider: WhatsAppProvider = new MockWhatsAppProvider();

export function getWhatsAppProvider() {
  return provider;
}

export function setWhatsAppProvider(p: WhatsAppProvider) {
  provider = p;
}
