import assert from 'node:assert/strict';
import test from 'node:test';
import { EvolutionClient, parseWebhook, toEvolutionBody } from '../src/evolution';
import type { Outgoing } from '../src/types';

const list: Outgoing = {
  type: 'list',
  body: 'Escolha um horário.',
  footer: 'Toque para selecionar um item.',
  button: 'Escolha uma opção',
  sectionTitle: 'Horários',
  rows: [{ id: 'slot:0', title: 'QUI 29/10 08:00', description: 'até 08:50' }],
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
  assert.equal(messages[1]?.replyTitle, 'Qui 29/10 08:00');
  assert.equal(messages[2]?.replyId, 'confirm');
  assert.equal(messages[2]?.replyTitle, 'Confirmar');
});

test('lê o selectedRowId da lista mesmo fora de singleSelectReply', () => {
  const direct = parseWebhook({
    event: 'MESSAGES_UPSERT',
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'L1' },
      message: {
        listResponseMessage: { title: 'AGENDAR', selectedRowId: 'book' },
      },
      messageType: 'listResponseMessage',
    },
  });
  assert.equal(direct[0]?.kind, 'interactive');
  assert.equal(direct[0]?.replyId, 'book');
  assert.equal(direct[0]?.replyTitle, 'AGENDAR');

  const encoded = parseWebhook({
    event: 'messages.upsert',
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'L2' },
      message: {
        listResponseMessage: {
          title: 'AGENDAR',
          singleSelectReply: '{"selectedRowId":"book"}',
        },
      },
    },
  });
  assert.equal(encoded[0]?.replyId, 'book');

  const native = parseWebhook({
    event: 'messages.upsert',
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'L3' },
      message: {
        interactiveResponseMessage: {
          nativeFlowResponseMessage: {
            name: 'single_select',
            paramsJson: '{"selectedRowId":"reschedule","title":"REMARCAR"}',
          },
        },
      },
    },
  });
  assert.equal(native[0]?.replyId, 'reschedule');
  assert.equal(native[0]?.replyTitle, 'REMARCAR');
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

test('monta o sendList documentado pela Evolution API v2', () => {
  const text = toEvolutionBody('5511999999999', { type: 'text', body: 'Olá' });
  assert.equal(text.path, 'sendText');
  assert.deepEqual(text.body, { number: '5511999999999', text: 'Olá' });

  const sentList = toEvolutionBody('5511999999999', {
    type: 'list',
    body: 'Endereço está correto?',
    button: 'Escolha uma opção',
    sectionTitle: 'Opções',
    rows: [{ id: 'book', title: 'AGENDAR', description: '' }],
  });
  assert.equal(sentList.path, 'sendList');
  assert.deepEqual(sentList.body, {
    number: '5511999999999',
    title: 'Escolha uma opção',
    description: 'Endereço está correto?',
    buttonText: 'Escolha uma opção',
    footerText: 'Toque para selecionar um item.',
    sections: [
      {
        title: 'Opções',
        rows: [{ title: 'AGENDAR', description: '', rowId: 'book' }],
      },
    ],
  });
  assert.ok(String(sentList.body.buttonText).length <= 20);

  const withSlot = toEvolutionBody('5511999999999', list);
  assert.deepEqual(withSlot.body, {
    number: '5511999999999',
    title: 'Escolha uma opção',
    description: 'Escolha um horário.',
    buttonText: 'Escolha uma opção',
    footerText: 'Toque para selecionar um item.',
    sections: [
      {
        title: 'Horários',
        rows: [{ title: 'QUI 29/10 08:00', description: 'até 08:50', rowId: 'slot:0' }],
      },
    ],
  });
});

test('se a lista falha por instabilidade, tenta sendList de novo e não manda menu numerado', async () => {
  const calls: { url: string; body: Record<string, unknown>; apikey?: string }[] = [];
  let failures = 0;
  const client = new EvolutionClient(
    { mode: 'configured', baseUrl: 'http://evolution.local', instance: 'clinica', apiKey: 'secret' },
    async (url, init) => {
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const headers = init?.headers as Record<string, string>;
      calls.push({ url: String(url), body: payload, apikey: headers.apikey });
      if (String(url).includes('/sendList/') && failures === 0) {
        failures += 1;
        return new Response('{"message":"timeout"}', { status: 500 });
      }
      return new Response('{}', { status: 201 });
    },
  );
  await client.send('5511999999999', list);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, 'http://evolution.local/message/sendList/clinica');
  assert.equal(calls[1]?.url, 'http://evolution.local/message/sendList/clinica');
  assert.equal(calls[0]?.apikey, 'secret');
  assert.equal(calls[0]?.body.buttonText, 'Escolha uma opção');
  assert.equal(calls[1]?.body.buttonText, 'Escolha uma opção');
  assert.equal(calls.every((call) => !String(call.url).includes('/sendText/')), true);
});

test('se a lista falha duas vezes, o envio termina em erro', async () => {
  const client = new EvolutionClient(
    { mode: 'configured', baseUrl: 'http://evolution.local', instance: 'clinica', apiKey: 'secret' },
    async () => new Response('{"message":"timeout"}', { status: 500 }),
  );
  await assert.rejects(() => client.send('5511999999999', list), /timeout/);
});

test('um 400 do sendList é registrado e não conta como mensagem enviada', async () => {
  const calls: string[] = [];
  const errors: string[] = [];
  const original = console.error;
  console.error = (line?: unknown) => {
    errors.push(String(line));
  };
  const client = new EvolutionClient(
    { mode: 'configured', baseUrl: 'http://evolution.local', instance: 'clinica', apiKey: 'secret' },
    async (url) => {
      calls.push(String(url));
      return new Response('{"status":400,"message":["footerText should not be empty"]}', { status: 400 });
    },
  );
  try {
    await assert.rejects(
      () => client.send('5511999999999', list),
      /footerText should not be empty/,
    );
  } finally {
    console.error = original;
  }
  assert.deepEqual(calls, ['http://evolution.local/message/sendList/clinica']);
  assert.match(errors.join('\n'), /evolution_send/);
  assert.match(errors.join('\n'), /footerText should not be empty/);
});
