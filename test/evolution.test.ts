import assert from 'node:assert/strict';
import test from 'node:test';
import { EvolutionClient, numberedMenu, parseWebhook, toEvolutionBody } from '../src/evolution';
import type { Outgoing } from '../src/types';

const list: Outgoing = {
  type: 'list',
  header: 'Consultório',
  body: 'Escolha um horário.',
  footer: 'seg a sex · 08:00–18:00',
  button: 'Ver horários',
  sectionTitle: 'Horários livres',
  rows: [{ id: 'slot:0', title: 'Qui 29/10 08:00', description: 'até 08:50' }],
};

test('lê MESSAGES_UPSERT de texto, lista e botão', () => {
  const messages = parseWebhook({
    event: 'MESSAGES_UPSERT',
    instance: 'clinica',
    data: [
      {
        key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'MSG1' },
        pushName: 'Maria',
        message: { conversation: 'Oi' },
        messageType: 'conversation',
      },
      {
        key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'MSG2' },
        pushName: 'Maria',
        message: {
          listResponseMessage: {
            title: 'Qui 29/10 08:00',
            singleSelectReply: { selectedRowId: 'slot:0' },
          },
        },
        messageType: 'listResponseMessage',
      },
      {
        key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'MSG3' },
        message: {
          buttonsResponseMessage: { selectedButtonId: 'confirm', selectedDisplayText: 'Confirmar' },
        },
      },
    ],
  });
  assert.equal(messages.length, 3);
  assert.equal(messages[0]?.kind, 'text');
  assert.equal(messages[0]?.text, 'Oi');
  assert.equal(messages[0]?.phone, '5511999999999');
  assert.equal(messages[0]?.profileName, 'Maria');
  assert.equal(messages[1]?.kind, 'interactive');
  assert.equal(messages[1]?.replyId, 'slot:0');
  assert.equal(messages[2]?.replyId, 'confirm');
  assert.equal(messages[2]?.replyTitle, 'Confirmar');
});

test('ignora o que o próprio bot enviou, grupos e outra instância', () => {
  assert.deepEqual(
    parseWebhook({
      event: 'messages.upsert',
      data: {
        key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: true, id: 'OUT' },
        message: { conversation: 'eco' },
      },
    }),
    [],
  );
  assert.deepEqual(
    parseWebhook({
      event: 'messages.upsert',
      data: {
        key: { remoteJid: '1203630@g.us', fromMe: false, id: 'GRP' },
        message: { conversation: 'oi' },
      },
    }),
    [],
  );
  assert.deepEqual(
    parseWebhook(
      {
        event: 'messages.upsert',
        instance: 'outra',
        data: {
          key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'X' },
          message: { extendedTextMessage: { text: 'oi' } },
        },
      },
      'clinica',
    ),
    [],
  );
  assert.deepEqual(parseWebhook({ event: 'messages.update', data: {} }), []);
});

test('monta sendText, sendList e sendButtons da Evolution API v2', () => {
  const text = toEvolutionBody('5511999999999', { type: 'text', body: 'Olá' });
  assert.equal(text.path, 'sendText');
  assert.deepEqual(text.body, { number: '5511999999999', text: 'Olá' });

  const sentList = toEvolutionBody('5511999999999', list);
  assert.equal(sentList.path, 'sendList');
  const sections = sentList.body.sections as { rows: { rowId: string }[] }[];
  assert.equal(sentList.body.buttonText, 'Ver horários');
  assert.equal(sections[0]?.rows[0]?.rowId, 'slot:0');

  const buttons = toEvolutionBody('5511999999999', {
    type: 'buttons',
    body: 'Confirmar?',
    buttons: [{ id: 'confirm', title: 'Confirmar' }],
  });
  assert.equal(buttons.path, 'sendButtons');
  const action = buttons.body.buttons as { type: string; id: string; displayText: string }[];
  assert.equal(action[0]?.type, 'reply');
  assert.equal(action[0]?.id, 'confirm');
  assert.equal(action[0]?.displayText, 'Confirmar');
});

test('se a lista falha, envia um menu numerado', async () => {
  const calls: { url: string; body: Record<string, unknown>; apikey?: string }[] = [];
  const client = new EvolutionClient(
    { mode: 'configured', baseUrl: 'http://evolution.local', instance: 'clinica', apiKey: 'secret' },
    async (url, init) => {
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const headers = init?.headers as Record<string, string>;
      calls.push({ url: String(url), body: payload, apikey: headers.apikey });
      if (String(url).includes('/sendList/')) return new Response('unsupported', { status: 400 });
      return new Response('{}', { status: 201 });
    },
  );
  await client.send('5511999999999', list);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, 'http://evolution.local/message/sendList/clinica');
  assert.equal(calls[0]?.apikey, 'secret');
  assert.equal(calls[1]?.url, 'http://evolution.local/message/sendText/clinica');
  assert.match(String(calls[1]?.body.text), /1\. Qui 29\/10 08:00/);
  assert.match(numberedMenu(list), /Responda com o número/);
});
