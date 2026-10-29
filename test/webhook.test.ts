import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { loadConfig } from '../src/config';
import { CalendarAccessError } from '../src/errors';
import { createApp } from '../src/server';
import { SqliteStore } from '../src/store';
import { FakeCalendar, FakeWhatsApp, testClinic } from './helpers';

async function withApp(
  options: { secret?: string; checkToken?: string; verifyToken?: string },
  fn: (base: string, ctx: { whatsapp: FakeWhatsApp; calendar: FakeCalendar; store: SqliteStore }) => Promise<void>,
): Promise<void> {
  const config = loadConfig({});
  config.clinic = testClinic();
  config.whatsapp.verifyToken = options.verifyToken ?? 'segredo';
  if (options.secret) config.whatsapp.appSecret = options.secret;
  if (options.checkToken) config.checkToken = options.checkToken;
  const store = new SqliteStore(':memory:');
  const calendar = new FakeCalendar();
  const whatsapp = new FakeWhatsApp();
  const app = createApp({ config, store, calendar, whatsapp });
  const server = app.listen(0);
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`, { whatsapp, calendar, store });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    store.close();
  }
}

test('verifica o webhook e recebe a primeira mensagem', async () => {
  await withApp({}, async (base, { whatsapp }) => {
    const denied = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=123`);
    assert.equal(denied.status, 403);

    const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=segredo&hub.challenge=98765`);
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), '98765');

    const health = await fetch(`${base}/health`);
    assert.equal((await health.json()).ok, true);

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: '5511888777666', id: 'wamid.abc', type: 'text', text: { body: 'Olá' } }],
              },
            },
          ],
        },
      ],
    };
    const first = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(first.status, 200);
    assert.equal(whatsapp.sent.length, 1);
    assert.match(whatsapp.sent[0]?.message.type === 'text' ? whatsapp.sent[0].message.body : '', /Como você se chama/);

    const duplicate = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(duplicate.status, 200);
    assert.equal(whatsapp.sent.length, 1);
  });
});

test('rejeita assinatura inválida e reenvia a resposta se o envio falhar', async () => {
  const secret = 'app-secret';
  await withApp({ secret }, async (base, { whatsapp }) => {
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{ from: '5511888777666', id: 'wamid.z', type: 'text', text: { body: 'oi' } }] } }] }],
    });
    const bad = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=00' },
      body: payload,
    });
    assert.equal(bad.status, 403);
    assert.equal(whatsapp.sent.length, 0);

    const signature = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
    whatsapp.fail = true;
    const failed = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
      body: payload,
    });
    assert.equal(failed.status, 500);

    whatsapp.fail = false;
    const retried = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
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
