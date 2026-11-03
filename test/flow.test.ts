import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { CalendarAccessError, SlotTakenError } from '../src/errors';
import { toEvolutionBody } from '../src/evolution';
import { handleMessage } from '../src/flow';
import { SqliteStore } from '../src/store';
import type { IncomingMessage, Outgoing, OutgoingList } from '../src/types';
import { assertSendable, FakeCalendar, testClinic } from './helpers';

const now = DateTime.fromISO('2026-10-29T07:00:00', { zone: 'America/Sao_Paulo' });
const phone = '5511999999999';
const slotA = { start: '2026-10-29T08:00:00-03:00', end: '2026-10-29T08:50:00-03:00' };
const slotB = { start: '2026-10-29T08:50:00-03:00', end: '2026-10-29T09:40:00-03:00' };

function text(body: string, id = 'm1'): IncomingMessage {
  return { messageId: id, phone, kind: 'text', text: body };
}

function reply(id: string, messageId: string): IncomingMessage {
  return { messageId, phone, kind: 'interactive', replyId: id, replyTitle: id };
}

async function setup() {
  const store = new SqliteStore(':memory:');
  const calendar = new FakeCalendar();
  calendar.slots = [slotA, slotB];
  const deps = { now: () => now, clinic: testClinic(), store, calendar };
  const send = async (message: IncomingMessage): Promise<Outgoing[]> => {
    const replies = await handleMessage(message, deps);
    assertSendable(replies);
    return replies;
  };
  return { store, calendar, send };
}

test('a saudação é uma lista e o tipo da sessão também', async () => {
  const { calendar, send, store } = await setup();
  const hello = await send(text('Oi!'));
  assert.equal(hello.length, 1);
  assert.equal(hello[0]?.type, 'list');
  const options = hello[0] as OutgoingList;
  assert.equal(options.button, 'Escolha uma opção');
  assert.equal(options.footer, 'Toque para selecionar um item.');
  assert.equal(options.sectionTitle, 'Opções');
  assert.match(options.body, /Como posso ajudar/);
  assert.doesNotMatch(options.body, /1 -|Ver opções|responda com o número/);
  assert.deepEqual(
    options.rows.map((row) => row.title),
    ['AGENDAR', 'REMARCAR', 'CANCELAR', 'VER MEUS HORÁRIOS'],
  );
  assert.deepEqual(
    options.rows.map((row) => row.id),
    ['book', 'reschedule', 'cancel', 'mine'],
  );
  const greeting = toEvolutionBody(phone, options);
  assert.equal(greeting.path, 'sendList');
  assert.equal(greeting.body.buttonText, 'Escolha uma opção');
  assert.equal(greeting.body.footerText, 'Toque para selecionar um item.');
  assert.equal(calendar.booked.length, 0);

  const typed = await send(text('1', 'm1b'));
  assert.equal(typed[0]?.type, 'list');
  assert.doesNotMatch(JSON.stringify(typed[0]), /1 - Agendar|Ver opções|responda com o número/);

  const types = await send(reply('book', 'm3'));
  assert.equal(types[0]?.type, 'list');
  const typeList = types[0] as OutgoingList;
  assert.match(typeList.body, /Qual é o tipo da sessão/);
  assert.deepEqual(
    typeList.rows.map((row) => row.id),
    ['type:avaliacao', 'type:retorno', 'menu'],
  );
  assert.deepEqual(
    typeList.rows.map((row) => row.title),
    ['AVALIAÇÃO (50 MIN)', 'RETORNO (50 MIN)', 'MENU'],
  );
  const typePayload = toEvolutionBody(phone, typeList);
  assert.equal(typePayload.path, 'sendList');
  assert.equal(typePayload.body.title, 'Escolha uma opção');
  assert.equal(typePayload.body.buttonText, 'Escolha uma opção');

  const ask = await send(reply('type:avaliacao', 'm3b'));
  assert.match(ask[0]?.type === 'text' ? ask[0].body : '', /Como você se chama/);

  const slotsMessage = await send(text('Maria Silva', 'm2'));
  assert.equal(slotsMessage[0]?.type, 'list');
  const slots = slotsMessage[0] as OutgoingList;
  assert.equal(slots.button, 'Escolha uma opção');
  assert.equal(slots.rows[0]?.id, 'slot:0');
  assert.equal(slots.rows[0]?.title, 'QUI 29/10 08:00');

  const confirm = await send(reply('slot:0', 'm4'));
  assert.equal(confirm[0]?.type, 'list');
  const confirmList = confirm[0] as OutgoingList;
  assert.deepEqual(
    confirmList.rows.map((row) => row.id),
    ['confirm', 'other', 'back'],
  );
  assert.match(confirmList.body, /Quinta-feira, 29\/10\/2026, às 08:00/);

  const done = await send(reply('confirm', 'm5'));
  assert.equal(calendar.booked.length, 1);
  assert.equal(calendar.booked[0]?.name, 'Maria Silva');
  assert.equal(calendar.booked[0]?.phone, phone);
  assert.equal(calendar.booked[0]?.messageId, 'm5');
  assert.equal(calendar.booked[0]?.sessionType, 'avaliacao');
  assert.match((done[0] as OutgoingList).body, /Sessão marcada/);
  assert.equal(store.getPatient(phone)?.name, 'Maria Silva');
  store.close();
});

test('a resposta da lista escolhe o tipo e o horário', async () => {
  const { send, store } = await setup();
  await send(text('oi', 'n1'));
  await send(reply('book', 'n2'));
  await send(reply('type:retorno', 'n2b'));
  const list = await send(text('Maria Silva', 'n2c'));
  assert.equal(list[0]?.type, 'list');
  assert.equal((list[0] as OutgoingList).button, 'Escolha uma opção');
  const picked = await send(reply('slot:0', 'n3'));
  assert.equal(picked[0]?.type, 'list');
  assert.match((picked[0] as OutgoingList).body, /08:00/);
  store.close();
});

test('quem escreve agendar escolhe o tipo e depois informa o nome', async () => {
  const { send, store } = await setup();
  const types = await send(text('agendar', 'a1'));
  assert.equal(types[0]?.type, 'list');
  assert.match((types[0] as OutgoingList).body, /tipo da sessão/);
  const ask = await send(reply('type:avaliacao', 'a2'));
  assert.match(ask[0]?.type === 'text' ? ask[0].body : '', /Como você se chama/);
  const next = await send(text('Ana Souza', 'a3'));
  assert.equal(next[0]?.type, 'list');
  assert.equal((next[0] as OutgoingList).rows[0]?.id, 'slot:0');
  store.close();
});

test('recusa nome curto ou comando e oferece outra página de horários', async () => {
  const { calendar, send, store } = await setup();
  calendar.slots = Array.from({ length: 12 }, (_, index) => ({
    start: `2026-10-29T08:${String(index).padStart(2, '0')}:00-03:00`,
    end: `2026-10-29T08:${String(index).padStart(2, '0')}:50-03:00`,
  }));
  await send(text('oi', 'b1'));
  await send(reply('book', 'b2'));
  await send(reply('type:avaliacao', 'b2b'));
  const retry = await send(text('ok', 'b3'));
  assert.match(retry[0]?.type === 'text' ? retry[0].body : '', /Maria Silva/);
  const first = await send(text('Ana Souza', 'b4'));
  const rows = (first[0] as OutgoingList).rows;
  assert.ok(rows.length <= 10);
  assert.equal(rows.at(-1)?.id, 'page:next');
  const second = await send(reply('page:next', 'b5'));
  const nextRows = (second[0] as OutgoingList).rows;
  assert.equal(nextRows[0]?.id, 'slot:8');
  assert.equal(nextRows.some((row) => row.id === 'page:prev'), true);
  store.close();
});

test('horário ocupado pede outra escolha; falha da agenda não quebra a conversa', async () => {
  const { calendar, send, store } = await setup();
  await send(text('oi', 'c1'));
  await send(reply('book', 'c1b'));
  await send(reply('type:avaliacao', 'c1c'));
  await send(text('Maria Silva', 'c1d'));
  await send(reply('slot:1', 'c3'));
  calendar.bookError = new SlotTakenError();
  const taken = await send(reply('confirm', 'c4'));
  assert.equal(taken[0]?.type, 'list');
  assert.match((taken[0] as OutgoingList).body, /acabou de ser preenchido/);

  calendar.bookError = null;
  calendar.listError = new CalendarAccessError('sem permissão');
  await send(reply('book', 'c5'));
  const failed = await send(reply('type:retorno', 'c5b'));
  assert.match((failed[0] as OutgoingList).body, /Não consegui acessar a agenda/);
  assert.doesNotMatch((failed[0] as OutgoingList).body, /sem permissão/);
  store.close();
});

test('remarca e cancela a sessão escolhida', async () => {
  const { calendar, send, store } = await setup();
  calendar.bookings = [
    { eventId: 'evt-a', start: slotA.start, end: slotA.end },
    { eventId: 'evt-b', start: slotB.start, end: slotB.end },
  ];
  const which = await send(reply('reschedule', 'd2'));
  assert.equal(which[0]?.type, 'list');
  assert.match((which[0] as OutgoingList).body, /remarcar/);
  const options = await send(reply('booking:1', 'd3'));
  assert.equal(options[0]?.type, 'list');
  assert.equal(calendar.excluded[0]?.start, slotB.start);

  await send(reply('slot:0', 'd4'));
  const askName = await send(reply('confirm', 'd5'));
  assert.match(askName[0]?.type === 'text' ? askName[0].body : '', /Como você se chama/);
  const moved = await send(text('Maria Silva', 'd5b'));
  assert.equal(calendar.rescheduled[0]?.eventId, 'evt-b');
  assert.equal(calendar.rescheduled[0]?.slot.start, slotA.start);
  assert.match((moved[0] as OutgoingList).body, /remarcada/);

  calendar.bookings = [{ eventId: 'evt-a', start: slotA.start, end: slotA.end }];
  const cancel = await send(text('cancelar', 'd6'));
  assert.match((cancel[0] as OutgoingList).body, /Cancelar a sessão/);
  const kept = await send(reply('cancel_no', 'd7'));
  assert.match((kept[0] as OutgoingList).body, /continua marcada/);
  assert.equal(calendar.cancelled.length, 0);

  await send(text('desmarcar', 'd8'));
  const removed = await send(text('sim, cancelar', 'd9'));
  assert.deepEqual(calendar.cancelled, ['evt-a']);
  assert.match((removed[0] as OutgoingList).body, /cancelada/);
  store.close();
});

test('sem sessão futura explica e uma imagem não vira nome', async () => {
  const { send, store } = await setup();
  const image = await send({ messageId: 'e1', phone, kind: 'unsupported' });
  assert.match(image[0]?.type === 'text' ? image[0].body : '', /não leio/);
  assert.equal(image[1]?.type, 'list');
  assert.doesNotMatch(JSON.stringify(image), /1 -|Ver opções|responda com o número/);
  const none = await send(reply('reschedule', 'e3'));
  assert.match((none[0] as OutgoingList).body, /não tem sessão futura para remarcar/);
  const noneCancel = await send(reply('cancel', 'e4'));
  assert.match((noneCancel[0] as OutgoingList).body, /não tem sessão futura para cancelar/);
  store.close();
});

test('confirmação repetida da mesma mensagem não cria outra reserva', async () => {
  const { calendar, send, store } = await setup();
  await send(text('oi', 'f0'));
  await send(reply('book', 'f1'));
  await send(reply('type:avaliacao', 'f1b'));
  await send(text('Maria Silva', 'f1c'));
  await send(reply('slot:0', 'f3'));
  await send(reply('confirm', 'f4'));
  calendar.byMessage.set('f4', { eventId: 'evt-1', start: slotA.start, end: slotA.end });
  const again = await send(reply('confirm', 'f4'));
  assert.match((again[0] as OutgoingList).body, /Sessão marcada/);
  assert.equal(calendar.booked.length, 1);
  store.close();
});
