import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { CalendarAccessError, SlotTakenError } from '../src/errors';
import { handleMessage } from '../src/flow';
import { SqliteStore } from '../src/store';
import type { IncomingMessage, Outgoing, OutgoingButtons, OutgoingList } from '../src/types';
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

test('pede o nome, depois mostra o menu e confirma a reserva', async () => {
  const { calendar, send, store } = await setup();
  const hello = await send(text('Oi!'));
  assert.equal(hello.length, 1);
  assert.match(hello[0]?.type === 'text' ? hello[0].body : '', /Como você se chama/);
  assert.equal(calendar.booked.length, 0);

  const menu = await send(text('Maria Silva', 'm2'));
  assert.equal(menu[0]?.type, 'buttons');
  const buttons = menu[0] as OutgoingButtons;
  assert.deepEqual(buttons.buttons.map((button) => button.title), ['Agendar', 'Remarcar', 'Cancelar']);
  assert.match(buttons.body, /Maria Silva/);
  assert.match(buttons.body, /50 minutos/);
  assert.match(buttons.body, /08:00/);

  const list = await send(reply('book', 'm3'));
  assert.equal(list[0]?.type, 'list');
  const rows = (list[0] as OutgoingList).rows;
  assert.equal(rows[0]?.id, 'slot:0');
  assert.equal(rows[0]?.title, 'Qui 29/10 08:00');

  const confirm = await send(reply('slot:0', 'm4'));
  assert.equal(confirm[0]?.type, 'buttons');
  assert.match((confirm[0] as OutgoingButtons).body, /Quinta-feira, 29\/10\/2026, às 08:00/);

  const done = await send(reply('confirm', 'm5'));
  assert.equal(calendar.booked.length, 1);
  assert.equal(calendar.booked[0]?.name, 'Maria Silva');
  assert.equal(calendar.booked[0]?.phone, phone);
  assert.equal(calendar.booked[0]?.messageId, 'm5');
  assert.match((done[0] as OutgoingButtons).body, /Sessão marcada/);
  assert.equal(store.getPatient(phone)?.name, 'Maria Silva');
  store.close();
});

test('no Baileys, o número 1 escolhe Agendar', async () => {
  const { send, store } = await setup();
  await send(text('Maria Silva', 'n1'));
  const list = await send(text('1', 'n2'));
  assert.equal(list[0]?.type, 'list');
  const picked = await send(text('1', 'n3'));
  assert.equal(picked[0]?.type, 'buttons');
  assert.match((picked[0] as OutgoingButtons).body, /08:00/);
  store.close();
});

test('quem escreve agendar antes do nome segue para os horários depois de se identificar', async () => {
  const { send, store } = await setup();
  const ask = await send(text('agendar', 'a1'));
  assert.match(ask[0]?.type === 'text' ? ask[0].body : '', /Como você se chama/);
  const next = await send(text('Ana Souza', 'a2'));
  assert.equal(next[0]?.type, 'text');
  assert.equal(next[1]?.type, 'list');
  store.close();
});

test('recusa nome curto ou comando e oferece outra página de horários', async () => {
  const { calendar, send, store } = await setup();
  calendar.slots = Array.from({ length: 12 }, (_, index) => ({
    start: `2026-10-29T08:${String(index).padStart(2, '0')}:00-03:00`,
    end: `2026-10-29T08:${String(index).padStart(2, '0')}:50-03:00`,
  }));
  await send(text('oi', 'b1'));
  const retry = await send(text('ok', 'b2'));
  assert.match(retry[0]?.type === 'text' ? retry[0].body : '', /Maria Silva/);
  await send(text('Ana Souza', 'b3'));
  const first = await send(text('agendar', 'b4'));
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
  await send(text('Maria Silva', 'c1'));
  await send(reply('book', 'c2'));
  await send(reply('slot:1', 'c3'));
  calendar.bookError = new SlotTakenError();
  const taken = await send(text('sim', 'c4'));
  assert.equal(taken[0]?.type, 'list');
  assert.match((taken[0] as OutgoingList).body, /acabou de ser preenchido/);

  calendar.bookError = null;
  calendar.listError = new CalendarAccessError('sem permissão');
  const failed = await send(text('agendar', 'c5'));
  assert.match((failed[0] as OutgoingButtons).body, /Não consegui acessar a agenda/);
  assert.doesNotMatch((failed[0] as OutgoingButtons).body, /sem permissão/);
  store.close();
});

test('remarca e cancela a sessão escolhida', async () => {
  const { calendar, send, store } = await setup();
  calendar.bookings = [
    { eventId: 'evt-a', start: slotA.start, end: slotA.end },
    { eventId: 'evt-b', start: slotB.start, end: slotB.end },
  ];
  await send(text('Maria Silva', 'd1'));

  const which = await send(text('remarcar', 'd2'));
  assert.equal(which[0]?.type, 'list');
  assert.match((which[0] as OutgoingList).body, /remarcar/);
  const options = await send(reply('booking:1', 'd3'));
  assert.equal(options[0]?.type, 'list');
  assert.equal(calendar.excluded[0]?.start, slotB.start);

  await send(reply('slot:0', 'd4'));
  const moved = await send(reply('confirm', 'd5'));
  assert.equal(calendar.rescheduled[0]?.eventId, 'evt-b');
  assert.equal(calendar.rescheduled[0]?.slot.start, slotA.start);
  assert.match((moved[0] as OutgoingButtons).body, /remarcada/);

  calendar.bookings = [{ eventId: 'evt-a', start: slotA.start, end: slotA.end }];
  const cancel = await send(text('cancelar', 'd6'));
  assert.match((cancel[0] as OutgoingButtons).body, /Cancelar a sessão/);
  const kept = await send(reply('cancel_no', 'd7'));
  assert.match((kept[0] as OutgoingButtons).body, /continua marcada/);
  assert.equal(calendar.cancelled.length, 0);

  await send(text('desmarcar', 'd8'));
  const removed = await send(text('sim, cancelar', 'd9'));
  assert.deepEqual(calendar.cancelled, ['evt-a']);
  assert.match((removed[0] as OutgoingButtons).body, /cancelada/);
  store.close();
});

test('sem sessão futura explica e uma imagem não vira nome', async () => {
  const { send, store } = await setup();
  const image = await send({ messageId: 'e1', phone, kind: 'unsupported' });
  assert.match(image[0]?.type === 'text' ? image[0].body : '', /não leio/);
  assert.match(image[0]?.type === 'text' ? image[0].body : '', /Como você se chama/);
  await send(text('Maria Silva', 'e2'));
  const none = await send(reply('reschedule', 'e3'));
  assert.match((none[0] as OutgoingButtons).body, /não tem sessão futura para remarcar/);
  const noneCancel = await send(reply('cancel', 'e4'));
  assert.match((noneCancel[0] as OutgoingButtons).body, /não tem sessão futura para cancelar/);
  store.close();
});

test('confirmação repetida da mesma mensagem não cria outra reserva', async () => {
  const { calendar, send, store } = await setup();
  await send(text('Maria Silva', 'f1'));
  await send(reply('book', 'f2'));
  await send(reply('slot:0', 'f3'));
  await send(reply('confirm', 'f4'));
  calendar.byMessage.set('f4', { eventId: 'evt-1', start: slotA.start, end: slotA.end });
  const again = await send(reply('confirm', 'f4'));
  assert.match((again[0] as OutgoingButtons).body, /Sessão marcada/);
  assert.equal(calendar.booked.length, 1);
  store.close();
});
