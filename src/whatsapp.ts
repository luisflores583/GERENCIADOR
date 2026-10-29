import crypto from 'node:crypto';
import type { WhatsAppConfig } from './config';
import type { IncomingMessage, Outgoing } from './types';

const LIMITS = {
  text: 4096,
  body: 1024,
  header: 60,
  footer: 60,
  buttonTitle: 20,
  buttonId: 256,
  listButton: 20,
  rowTitle: 24,
  rowDescription: 72,
  rowId: 200,
  rows: 10,
  buttons: 3,
};

export function verifyMetaSignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const receivedHex = header.slice('sha256='.length);
  if (!/^[0-9a-f]+$/i.test(receivedHex) || receivedHex.length % 2 !== 0) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest();
  const received = Buffer.from(receivedHex, 'hex');
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export function parseWebhook(body: unknown): IncomingMessage[] {
  const messages: IncomingMessage[] = [];
  if (!isRecord(body) || body.object !== 'whatsapp_business_account') return messages;
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      if (!isRecord(change) || !isRecord(change.value)) continue;
      const value = change.value;
      const rawMessages = Array.isArray(value.messages) ? value.messages : [];
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      for (const raw of rawMessages) {
        const parsed = parseMessage(raw, contacts);
        if (parsed) messages.push(parsed);
      }
    }
  }
  return messages;
}

export function toWhatsAppPayload(to: string, message: Outgoing): Record<string, unknown> {
  assertOutgoing(message);
  const base = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
  };
  if (message.type === 'text') {
    return { ...base, type: 'text', text: { preview_url: false, body: message.body } };
  }
  if (message.type === 'buttons') {
    return {
      ...base,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message.body },
        action: {
          buttons: message.buttons.map((button) => ({
            type: 'reply',
            reply: { id: button.id, title: button.title },
          })),
        },
      },
    };
  }
  return {
    ...base,
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(message.header ? { header: { type: 'text', text: message.header } } : {}),
      body: { text: message.body },
      ...(message.footer ? { footer: { text: message.footer } } : {}),
      action: {
        button: message.button,
        sections: [
          {
            title: message.sectionTitle,
            rows: message.rows.map((row) => ({
              id: row.id,
              title: row.title,
              ...(row.description ? { description: row.description } : {}),
            })),
          },
        ],
      },
    },
  };
}

export function assertOutgoing(message: Outgoing): void {
  if (message.type === 'text') {
    requireLength(message.body, 1, LIMITS.text, 'texto');
    return;
  }
  if (message.type === 'buttons') {
    requireLength(message.body, 1, LIMITS.body, 'corpo dos botões');
    if (message.buttons.length < 1 || message.buttons.length > LIMITS.buttons) {
      throw new Error('Uma mensagem de botões precisa ter de 1 a 3 botões.');
    }
    for (const button of message.buttons) {
      requireLength(button.title, 1, LIMITS.buttonTitle, `título do botão "${button.title}"`);
      requireLength(button.id, 1, LIMITS.buttonId, 'id do botão');
    }
    return;
  }
  requireLength(message.body, 1, LIMITS.body, 'corpo da lista');
  requireLength(message.button, 1, LIMITS.listButton, 'botão da lista');
  requireLength(message.sectionTitle, 1, 24, 'título da seção');
  if (message.header) requireLength(message.header, 1, LIMITS.header, 'cabeçalho');
  if (message.footer) requireLength(message.footer, 1, LIMITS.footer, 'rodapé');
  if (message.rows.length < 1 || message.rows.length > LIMITS.rows) {
    throw new Error('Uma lista do WhatsApp precisa ter de 1 a 10 linhas.');
  }
  for (const row of message.rows) {
    requireLength(row.title, 1, LIMITS.rowTitle, `título da linha "${row.title}"`);
    requireLength(row.id, 1, LIMITS.rowId, 'id da linha');
    if (row.description) requireLength(row.description, 1, LIMITS.rowDescription, 'descrição da linha');
  }
}

export interface WhatsAppSender {
  send(to: string, message: Outgoing): Promise<void>;
  markRead(messageId: string): Promise<void>;
}

export class WhatsAppClient implements WhatsAppSender {
  constructor(
    private readonly config: WhatsAppConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(to: string, message: Outgoing): Promise<void> {
    await this.post(toWhatsAppPayload(to, message));
  }

  async markRead(messageId: string): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  private async post(payload: Record<string, unknown>): Promise<void> {
    if (!this.config.accessToken || !this.config.phoneNumberId) {
      throw new Error('WhatsApp não configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.');
    }
    const version = this.config.apiVersion.replace(/^\/*/, '');
    const url = `https://graph.facebook.com/${version}/${this.config.phoneNumberId}/messages`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WhatsApp respondeu ${response.status}: ${text.slice(0, 300)}`);
    }
  }
}

function parseMessage(raw: unknown, contacts: unknown[]): IncomingMessage | undefined {
  if (!isRecord(raw)) return undefined;
  const phone = typeof raw.from === 'string' ? raw.from.replace(/\D/g, '') : '';
  const messageId = typeof raw.id === 'string' ? raw.id : '';
  if (!phone || !messageId) return undefined;
  const profileName = profileNameFor(contacts, phone);
  const base = { messageId, phone, ...(profileName ? { profileName } : {}) };

  if (raw.type === 'text' && isRecord(raw.text) && typeof raw.text.body === 'string') {
    return { ...base, kind: 'text', text: raw.text.body };
  }
  if (raw.type === 'interactive' && isRecord(raw.interactive)) {
    const interactive = raw.interactive;
    if (interactive.type === 'button_reply' && isRecord(interactive.button_reply)) {
      const id = stringValue(interactive.button_reply.id);
      const title = stringValue(interactive.button_reply.title);
      if (!id) return { ...base, kind: 'unsupported' };
      return { ...base, kind: 'interactive', replyId: id, ...(title ? { replyTitle: title, text: title } : {}) };
    }
    if (interactive.type === 'list_reply' && isRecord(interactive.list_reply)) {
      const id = stringValue(interactive.list_reply.id);
      const title = stringValue(interactive.list_reply.title);
      if (!id) return { ...base, kind: 'unsupported' };
      return { ...base, kind: 'interactive', replyId: id, ...(title ? { replyTitle: title, text: title } : {}) };
    }
    return { ...base, kind: 'unsupported' };
  }
  if (raw.type === 'button' && isRecord(raw.button)) {
    const id = stringValue(raw.button.payload) || stringValue(raw.button.text);
    const title = stringValue(raw.button.text);
    if (!id) return { ...base, kind: 'unsupported' };
    return { ...base, kind: 'interactive', replyId: id, ...(title ? { replyTitle: title, text: title } : {}) };
  }
  return { ...base, kind: 'unsupported' };
}

function profileNameFor(contacts: unknown[], phone: string): string | undefined {
  for (const contact of contacts) {
    if (!isRecord(contact) || contact.wa_id !== phone || !isRecord(contact.profile)) continue;
    if (typeof contact.profile.name === 'string' && contact.profile.name.trim()) {
      return contact.profile.name.trim();
    }
  }
  return undefined;
}

function requireLength(value: string, min: number, max: number, label: string): void {
  if (value.length < min || value.length > max) {
    throw new Error(`${label} deve ter entre ${min} e ${max} caracteres (tem ${value.length}).`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
