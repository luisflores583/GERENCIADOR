import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { formatSlotShort } from '../src/format';
import { filterFreeSlots, generateCandidateSlots, paginate, subtractBusy } from '../src/slots';
import { testClinic } from './helpers';

const zone = 'America/Sao_Paulo';

test('gera 12 sessões de 50 min em um dia útil, das 08:00 às 18:00', () => {
  const now = DateTime.fromISO('2026-10-29T07:00:00', { zone });
  const slots = generateCandidateSlots(now, testClinic());
  const thursday = slots.filter((slot) => slot.start.startsWith('2026-10-29'));
  assert.equal(thursday.length, 12);
  assert.equal(thursday[0]?.start, '2026-10-29T08:00:00-03:00');
  assert.equal(thursday[0]?.end, '2026-10-29T08:50:00-03:00');
  assert.equal(thursday[11]?.start, '2026-10-29T17:10:00-03:00');
  assert.equal(thursday[11]?.end, '2026-10-29T18:00:00-03:00');
  assert.equal(slots.length, 60);
  assert.equal(slots.some((slot) => slot.start.startsWith('2026-10-31')), false);
  assert.equal(slots.some((slot) => slot.start.startsWith('2026-11-01')), false);
  assert.equal(slots.some((slot) => slot.start.startsWith('2026-11-02')), true);
});

test('não oferece horário que já começou e respeita antecedência', () => {
  const now = DateTime.fromISO('2026-10-29T10:00:00', { zone });
  const slots = generateCandidateSlots(now, testClinic());
  const thursday = slots.filter((slot) => slot.start.startsWith('2026-10-29'));
  assert.equal(thursday[0]?.start, '2026-10-29T10:30:00-03:00');

  const withNotice = generateCandidateSlots(DateTime.fromISO('2026-10-29T07:30:00', { zone }), testClinic({ minNoticeMinutes: 60 }));
  const first = withNotice.find((slot) => slot.start.startsWith('2026-10-29'));
  assert.equal(first?.start, '2026-10-29T08:50:00-03:00');
});

test('horário e duração vêm da configuração', () => {
  const now = DateTime.fromISO('2026-10-29T07:00:00', { zone });
  const slots = generateCandidateSlots(now, testClinic({ open: '09:00', close: '10:00', sessionMinutes: 30 }));
  const thursday = slots.filter((slot) => slot.start.startsWith('2026-10-29'));
  assert.deepEqual(
    thursday.map((slot) => slot.start.slice(11, 16)),
    ['09:00', '09:30'],
  );
});

test('remove só o horário que conflita, inclusive quando o ocupado vem em UTC', () => {
  const now = DateTime.fromISO('2026-10-29T07:00:00', { zone });
  const slots = generateCandidateSlots(now, testClinic()).filter((slot) => slot.start.startsWith('2026-10-29'));
  const free = filterFreeSlots(slots, [{ start: '2026-10-29T11:00:00Z', end: '2026-10-29T11:50:00Z' }]);
  assert.equal(free.some((slot) => slot.start.startsWith('2026-10-29T08:00')), false);
  assert.equal(free[0]?.start, '2026-10-29T08:50:00-03:00');

  const touching = filterFreeSlots(slots, [{ start: '2026-10-29T10:00:00Z', end: '2026-10-29T11:00:00Z' }]);
  assert.equal(touching[0]?.start, '2026-10-29T08:00:00-03:00');
});

test('ao remarcar, o intervalo da própria sessão volta a ficar livre', () => {
  const busy = [{ start: '2026-10-29T08:00:00-03:00', end: '2026-10-29T09:40:00-03:00' }];
  const cut = { start: '2026-10-29T08:00:00-03:00', end: '2026-10-29T08:50:00-03:00' };
  const now = DateTime.fromISO('2026-10-29T07:00:00', { zone });
  const slots = generateCandidateSlots(now, testClinic()).filter((slot) => slot.start.startsWith('2026-10-29'));
  const free = filterFreeSlots(slots, subtractBusy(busy, cut));
  assert.equal(free.some((slot) => slot.start.startsWith('2026-10-29T08:00')), true);
  assert.equal(free.some((slot) => slot.start.startsWith('2026-10-29T08:50')), false);
  assert.equal(free.some((slot) => slot.start.startsWith('2026-10-29T09:40')), true);
});

test('a paginação da lista cabe em 10 linhas', () => {
  const items = Array.from({ length: 11 }, (_, index) => index);
  const first = paginate(items, 0);
  assert.equal(first.items.length, 8);
  assert.equal(first.hasNext, true);
  assert.equal(first.hasPrev, false);
  const second = paginate(items, 1);
  assert.deepEqual(second.items, [8, 9, 10]);
  assert.equal(second.hasPrev, true);
  assert.equal(paginate(items.slice(0, 10), 0).items.length, 10);
});

test('o título do horário cabe no limite do WhatsApp', () => {
  const label = formatSlotShort('2026-10-29T08:00:00-03:00', zone);
  assert.equal(label, 'Qui 29/10 08:00');
  assert.ok(label.length <= 24);
});
