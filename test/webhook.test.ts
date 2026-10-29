import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { loadConfig } from '../src/config';
import { CalendarAccessError } from '../src/errors';
import { createApp } from '../src/server';
import { SqliteStore } from '../src/store';
import { FakeCalendar, FakeWhatsApp, testClinic } from './helpers';

async function withApp(
  options: { checkToken?: string; instance?: string },
  fn: (base: string, ctx: { whatsapp: FakeWhatsApp; calendar: FakeCalendar; store: SqliteStore }) => Promise<void>,
): Promise<void> {
  const config = loadConfig({});
  config.clinic = testClinic();
  if (options.instance) {
    config.evolution = { mode: 'configured', baseUrl: 'http://evolution.local', instance: options.instance, apiKey: 'secret' };
  }
  if (options.checkToken) config.checkToken = options.checkToken;
  const store = new SqliteStore(':memory:');
  const calendar = new FakeCalendar();
  const whatsapp = new FakeWhatsApp();
  const app = createApp({ config, store, calendar, evolution: whatsapp });
  const server = app.listen(0);
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`, { whatsapp, calendar, store });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    store.close();
  }
}

function upsert(id: string, text: string, instance = 'clinica') {
  return {
    event: 'messages.upsert',
    instance,
    data: {
      key: { remoteJid: '5511888777666@s.whatsapp.net', fromMe: false, id },
      pushName: 'João',
      message: { conversation: text },
      messageType: 'conversation',
    },
  };
}

test('recebe MESSAGES_UPSERT e ignora repetição e mensagem da própria instância', async () => {
  await withApp({ instance: 'clinica' }, async (base, { whatsapp }) => {
    const info = await fetch(`${base}/webhook`);
    assert.equal(info.status, 200);
    assert.equal(((await info.json()) as { event: string }).event, 'MESSAGES_UPSERT');

    const health = await fetch(`${base}/health`);
    assert.equal((await health.json()).ok, true);

    const first = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upsert('MSG1', 'Olá')),
    });
    assert.equal(first.status, 200);
    assert.equal(whatsapp.sent.length, 1);
    assert.match(whatsapp.sent[0]?.message.type === 'text' ? whatsapp.sent[0].message.body : '', /Como você se chama/);

    const duplicate = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upsert('MSG1', 'Olá')),
    });
    assert.equal(duplicate.status, 200);
    assert.equal(whatsapp.sent.length, 1);

    const own = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'MESSAGES_UPSERT',
        instance: 'clinica',
        data: {
          key: { remoteJid: '5511888777666@s.whatsapp.net', fromMe: true, id: 'OUT' },
          message: { conversation: 'eco' },
        },
      }),
    });
    assert.equal(own.status, 200);
    assert.equal(whatsapp.sent.length, 1);

    const other = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upsert('MSG2', 'oi', 'outra')),
    });
    assert.equal(other.status, 200);
    assert.equal(whatsapp.sent.length, 1);
  });
});

test('se o envio falha, a Evolution pode repetir a mesma mensagem', async () => {
  await withApp({}, async (base, { whatsapp }) => {
    const payload = JSON.stringify(upsert('MSGZ', 'oi'));
    whatsapp.fail = true;
    const failed = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    assert.equal(failed.status, 500);

    whatsapp.fail = false;
    const retried = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    assert.equal(retried.status, 200);
    assert.equal(whatsapp.sent.length, 1);
  });
});

test('a rota de disponibilidade não manda WhatsApp', async () => {
  await withApp({ checkToken: 'interno' }, async (base, { calendar, whatsapp }) => {
    const denied = await fetch(`${base}/api/calendar/availability`);
    assert.equal(denied.status, 401);

    calendar.slots = [{ start: '2026-10-29T08:00:00-03:00', end: '2026-10-29T08:50:00-03:00' }];
    const ok = await fetch(`${base}/api/calendar/availability`, { headers: { Authorization: 'Bearer interno' } });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { slots: unknown[] };
    assert.equal(body.slots.length, 1);
    assert.equal(whatsapp.sent.length, 0);

    calendar.listError = new CalendarAccessError('Arquivo da conta de serviço não encontrado em /tmp/sa.json.');
    const down = await fetch(`${base}/api/calendar/availability`, { headers: { Authorization: 'Bearer interno' } });
    assert.equal(down.status, 503);
    assert.match(((await down.json()) as { error: string }).error, /conta de serviço/);
  });
});
