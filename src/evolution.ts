import { logger } from './logger';
import type { EvolutionConfig } from './config';
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

export interface EvolutionSender {
  send(to: string, message: Outgoing): Promise<void>;
  markRead(messageId: string): Promise<void>;
}

export function parseWebhook(body: unknown, expectedInstance?: string): IncomingMessage[] {
  if (!isRecord(body)) return [];
  const event = normalizeEvent(body.event);
  if (event !== 'messages.upsert') return [];
  if (expectedInstance && typeof body.instance === 'string' && body.instance !== expectedInstance) return [];

  const records = messageRecords(body.data);
  const messages: IncomingMessage[] = [];
  for (const record of records) {
    const parsed = parseRecord(record);
    if (parsed) messages.push(parsed);
  }
  return messages;
}

export function numberedMenu(message: Outgoing): string {
  if (message.type === 'text') return message.body;
  const options =
    message.type === 'buttons'
      ? message.buttons.map((button) => button.title)
      : message.rows.map((row) => (row.description ? `${row.title} — ${row.description}` : row.title));
  const lines = options.map((label, index) => `${index + 1}. ${label}`);
  const header = message.type === 'list' && message.header ? `${message.header}\n` : '';
  const footer = message.type === 'list' && message.footer ? `\n${message.footer}` : '';
  return `${header}${message.body}\n\n${lines.join('\n')}${footer}\n\nResponda com o número da opção.`;
}

export function toEvolutionBody(to: string, message: Outgoing): { path: string; body: Record<string, unknown> } {
  assertOutgoing(message);
  if (message.type === 'text') {
    return { path: 'sendText', body: { number: to, text: message.body } };
  }
  if (message.type === 'buttons') {
    const title = firstLine(message.body);
    return {
      path: 'sendButtons',
      body: {
        number: to,
        title,
        description: message.body,
        footer: '',
        buttons: message.buttons.map((button) => ({
          type: 'reply',
          displayText: button.title,
          id: button.id,
        })),
      },
    };
  }
  return {
    path: 'sendList',
    body: {
      number: to,
      title: (message.header || message.sectionTitle).slice(0, LIMITS.header),
      description: message.body,
      buttonText: message.button,
      footerText: message.footer || ' ',
      sections: [
        {
          title: message.sectionTitle,
          rows: message.rows.map((row) => ({
            title: row.title,
            rowId: row.id,
            ...(row.description ? { description: row.description } : {}),
          })),
        },
      ],
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
    throw new Error('Uma lista precisa ter de 1 a 10 linhas.');
  }
  for (const row of message.rows) {
    requireLength(row.title, 1, LIMITS.rowTitle, `título da linha "${row.title}"`);
    requireLength(row.id, 1, LIMITS.rowId, 'id da linha');
    if (row.description) requireLength(row.description, 1, LIMITS.rowDescription, 'descrição da linha');
  }
}

export class EvolutionClient implements EvolutionSender {
  constructor(
    private readonly config: EvolutionConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(to: string, message: Outgoing): Promise<void> {
    const target = toEvolutionBody(to, message);
    if (message.type === 'text') {
      await this.post(target.path, target.body);
      return;
    }
    try {
      await this.post(target.path, target.body);
    } catch (err) {
      logger.warn('evolution_interactive', {
        path: target.path,
        message: err instanceof Error ? err.message : String(err),
      });
      await this.post('sendText', { number: to, text: numberedMenu(message) });
    }
  }

  async markRead(_messageId: string): Promise<void> {
    return undefined;
  }

  private async post(path: string, body: Record<string, unknown>): Promise<void> {
    if (this.config.mode !== 'configured') {
      throw new Error('Evolution API não configurada. Defina EVOLUTION_API_URL, EVOLUTION_INSTANCE e EVOLUTION_API_KEY.');
    }
    const url = `${this.config.baseUrl}/message/${path}/${encodeURIComponent(this.config.instance)}`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        apikey: this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Evolution API respondeu ${response.status}: ${text.slice(0, 300)}`);
    }
  }
}

function parseRecord(record: Record<string, unknown>): IncomingMessage | undefined {
  const key = isRecord(record.key) ? record.key : undefined;
  if (!key || key.fromMe === true) return undefined;
  const remoteJid = stringValue(key.remoteJid);
  if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) return undefined;
  const phone = phoneFrom(key, record);
  const messageId = stringValue(key.id);
  if (!phone || !messageId) return undefined;

  const profileName = stringValue(record.pushName);
  const base = { messageId, phone, ...(profileName ? { profileName } : {}) };
  const message = unwrapMessage(isRecord(record.message) ? record.message : {});
  const reply = interactiveReply(message);
  if (reply) {
    return {
      ...base,
      kind: 'interactive',
      replyId: reply.id,
      ...(reply.title ? { replyTitle: reply.title, text: reply.title } : {}),
    };
  }
  const text = textOf(message);
  if (text) return { ...base, kind: 'text', text };
  if (Object.keys(message).length === 0) return undefined;
  return { ...base, kind: 'unsupported' };
}

function messageRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  if (Array.isArray(data.messages)) return data.messages.filter(isRecord);
  if (isRecord(data.key) || isRecord(data.message)) return [data];
  return [];
}

function interactiveReply(message: Record<string, unknown>): { id: string; title?: string } | undefined {
  const list = isRecord(message.listResponseMessage) ? message.listResponseMessage : undefined;
  const selected = list && isRecord(list.singleSelectReply) ? list.singleSelectReply : undefined;
  const rowId = stringValue(selected?.selectedRowId);
  if (rowId) return { id: rowId, ...(stringValue(list?.title) ? { title: stringValue(list?.title) } : {}) };

  const buttons = isRecord(message.buttonsResponseMessage) ? message.buttonsResponseMessage : undefined;
  const buttonId = stringValue(buttons?.selectedButtonId);
  if (buttonId) {
    const title = stringValue(buttons?.selectedDisplayText);
    return { id: buttonId, ...(title ? { title } : {}) };
  }

  const template = isRecord(message.templateButtonReplyMessage) ? message.templateButtonReplyMessage : undefined;
  const templateId = stringValue(template?.selectedId);
  if (templateId) {
    const title = stringValue(template?.selectedDisplayText);
    return { id: templateId, ...(title ? { title } : {}) };
  }

  const interactive = isRecord(message.interactiveResponseMessage) ? message.interactiveResponseMessage : undefined;
  const native = interactive && isRecord(interactive.nativeFlowResponseMessage) ? interactive.nativeFlowResponseMessage : undefined;
  const params = stringValue(native?.paramsJson);
  if (params) {
    try {
      const parsed = JSON.parse(params) as unknown;
      if (isRecord(parsed) && typeof parsed.id === 'string' && parsed.id) {
        const title = typeof parsed.title === 'string' ? parsed.title : '';
        return { id: parsed.id, ...(title ? { title } : {}) };
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function textOf(message: Record<string, unknown>): string {
  if (typeof message.conversation === 'string') return message.conversation;
  const extended = isRecord(message.extendedTextMessage) ? message.extendedTextMessage : undefined;
  if (typeof extended?.text === 'string') return extended.text;
  return '';
}

function unwrapMessage(message: Record<string, unknown>): Record<string, unknown> {
  const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'editedMessage'];
  for (const wrapper of wrappers) {
    const inner = message[wrapper];
    if (isRecord(inner) && isRecord(inner.message)) return unwrapMessage(inner.message);
  }
  return message;
}

function phoneFrom(key: Record<string, unknown>, record: Record<string, unknown>): string {
  const candidates = [key.remoteJid, key.remoteJidAlt, record.sender];
  for (const candidate of candidates) {
    const value = stringValue(candidate);
    if (!value.includes('@s.whatsapp.net') && !/^\d+$/.test(value)) continue;
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) return digits;
  }
  return '';
}

function normalizeEvent(event: unknown): string {
  return typeof event === 'string' ? event.trim().toLowerCase().replaceAll('_', '.') : '';
}

function firstLine(body: string): string {
  const line = body.split('\n').find((part) => part.trim())?.trim() ?? 'Atendimento';
  return line.slice(0, LIMITS.header);
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
