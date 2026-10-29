import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { parseWebhook, toWhatsAppPayload, verifyMetaSignature, WhatsAppClient } from '../src/whatsapp';
import type { Outgoing } from '../src/types';

test('lê texto e resposta de lista do webhook oficial', () => {
  const messages = parseWebhook({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              contacts: [{ wa_id: '5511999999999', profile: { name: 'Maria' } }],
              messages: [
                { from: '5511999999999', id: 'wamid.1', type: 'text', text: { body: 'Oi' } },
                {
                  from: '5511999999999',
                  id: 'wamid.2',
                  type: 'interactive',
                  interactive: { type: 'list_reply', list_reply: { id: 'slot:0', title: 'Qui 29/10 08:00' } },
                },
              ],
              statuses: [{ id: 'wamid.1', status: 'delivered' }],
            },
          },
        ],
      },
    ],
  });
  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.kind, 'text');
  assert.equal(messages[0]?.text, 'Oi');
  assert.equal(messages[0]?.profileName, 'Maria');
  assert.equal(messages[1]?.replyId, 'slot:0');
  assert.deepEqual(parseWebhook({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { statuses: [] } }] }] }), []);
});

test('monta lista e botões no formato da Cloud API', () => {
  const list: Outgoing = {
    type: 'list',
    header: 'Consultório',
    body: 'Escolha um horário.',
    footer: 'seg a sex · 08:00–18:00',
    button: 'Ver horários',
    sectionTitle: 'Horários livres',
    rows: [{ id: 'slot:0', title: 'Qui 29/10 08:00', description: 'até 08:50' }],
  };
  const payload = toWhatsAppPayload('5511999999999', list);
  assert.equal(payload.messaging_product, 'whatsapp');
  assert.equal(payload.type, 'interactive');
  const interactive = payload.interactive as { type: string; action: { button: string; sections: { rows: { id: string }[] }[] } };
  assert.equal(interactive.type, 'list');
  assert.equal(interactive.action.button, 'Ver horários');
  assert.equal(interactive.action.sections[0]?.rows[0]?.id, 'slot:0');

  const buttons = toWhatsAppPayload('5511999999999', {
    type: 'buttons',
    body: 'Confirmar?',
    buttons: [{ id: 'confirm', title: 'Confirmar' }],
  });
  const buttonInteractive = buttons.interactive as { type: string };
  assert.equal(buttonInteractive.type, 'button');
});

test('confere a assinatura do Meta e envia pela Graph API', async () => {
  const body = Buffer.from('{"ok":true}');
  const secret = 'app-secret';
  const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(verifyMetaSignature(body, signature, secret), true);
  assert.equal(verifyMetaSignature(body, signature, 'outro'), false);
  assert.equal(verifyMetaSignature(body, undefined, secret), false);

  const calls: { url: string; init: RequestInit }[] = [];
  const client = new WhatsAppClient(
    { verifyToken: 'v', accessToken: 'token', phoneNumberId: '123', apiVersion: 'v25.0' },
    async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response('{}', { status: 200 });
    },
  );
  await client.send('5511999999999', { type: 'text', body: 'Olá' });
  assert.equal(calls[0]?.url, 'https://graph.facebook.com/v25.0/123/messages');
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer token');
  const sent = JSON.parse(String(calls[0]?.init.body));
  assert.equal(sent.messaging_product, 'whatsapp');
  assert.equal(sent.to, '5511999999999');
  assert.equal(sent.text.body, 'Olá');
});
