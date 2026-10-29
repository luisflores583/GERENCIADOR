import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { GoogleCalendar, buildEventBody } from '../src/calendar';
import { CalendarAccessError, SlotTakenError } from '../src/errors';
import type { GoogleCalendarApi } from '../src/googleApi';
import type { CalendarEventBody, GoogleEvent } from '../src/types';
import { testClinic } from './helpers';

const zone = 'America/Sao_Paulo';
const now = DateTime.fromISO('2026-10-29T07:00:00', { zone });
const slot = { start: '2026-10-29T08:00:00-03:00', end: '2026-10-29T08:50:00-03:00' };

function harness(overrides: Partial<GoogleCalendarApi> = {}): {
  calendar: GoogleCalendar;
  inserted: CalendarEventBody[];
  patched: CalendarEventBody[];
  deleted: string[];
} {
  const inserted: CalendarEventBody[] = [];
  const patched: CalendarEventBody[] = [];
  const deleted: string[] = [];
  const api: GoogleCalendarApi = {
    queryFreeBusy: async () => ({ busy: [] }),
    insertEvent: async (body) => {
      inserted.push(body);
      return 'evt-novo';
    },
    patchEvent: async (_eventId, body) => {
      patched.push(body);
    },
    deleteEvent: async (eventId) => {
      deleted.push(eventId);
    },
    listEvents: async () => [],
    getEvent: async () => undefined,
    ...overrides,
  };
  const calendar = new GoogleCalendar({
    clinic: testClinic(),
    google: { mode: 'service_account', keyFile: '/tmp/ausente.json', calendarId: 'agenda-clinica' },
    now: () => now,
    api,
  });
  return { calendar, inserted, patched, deleted };
}

test('o evento leva nome e telefone do paciente', () => {
  const body = buildEventBody({ phone: '5511999999999', name: 'Maria Silva', slot, messageId: 'wamid.1' }, testClinic());
  assert.equal(body.summary, 'Fisioterapia — Maria Silva');
  assert.match(body.description, /Paciente: Maria Silva/);
  assert.match(body.description, /Telefone: 5511999999999/);
  assert.equal(body.start, '2026-10-29T08:00:00');
  assert.equal(body.end, '2026-10-29T08:50:00');
  assert.equal(body.timeZone, zone);
  assert.equal(body.messageId, 'wamid.1');
});

test('cria o evento só quando o horário está livre', async () => {
  const free = harness();
  const created = await free.calendar.book({ phone: '5511999999999', name: 'Maria Silva', slot, messageId: 'wamid.1' });
  assert.equal(created.eventId, 'evt-novo');
  assert.equal(free.inserted.length, 1);
  assert.match(free.inserted[0]?.description ?? '', /5511999999999/);

  const busy = harness({
    queryFreeBusy: async () => ({ busy: [{ start: '2026-10-29T11:00:00Z', end: '2026-10-29T11:50:00Z' }] }),
  });
  await assert.rejects(
    busy.calendar.book({ phone: '5511999999999', name: 'Maria Silva', slot, messageId: 'wamid.2' }),
    SlotTakenError,
  );
  assert.equal(busy.inserted.length, 0);
});

test('não cria de novo se a mesma mensagem do WhatsApp já virou evento', async () => {
  const existing: GoogleEvent = {
    eventId: 'evt-existente',
    start: slot.start,
    end: slot.end,
    summary: 'Fisioterapia — Maria Silva',
    messageId: 'wamid.1',
  };
  const { calendar, inserted } = harness({
    listEvents: async () => [existing],
  });
  const created = await calendar.book({ phone: '5511999999999', name: 'Maria Silva', slot, messageId: 'wamid.1' });
  assert.equal(created.eventId, 'evt-existente');
  assert.equal(inserted.length, 0);
});

test('remarca para outro horário e cancela apagando o evento', async () => {
  const current: GoogleEvent = {
    eventId: 'evt-1',
    start: slot.start,
    end: slot.end,
    summary: 'Fisioterapia — Maria Silva',
    messageId: 'wamid.1',
  };
  const { calendar, patched, deleted } = harness({
    getEvent: async () => current,
    queryFreeBusy: async () => ({ busy: [{ start: slot.start, end: slot.end }] }),
  });
  const next = { start: '2026-10-29T08:50:00-03:00', end: '2026-10-29T09:40:00-03:00' };
  await calendar.reschedule({ eventId: 'evt-1', slot: next, phone: '5511999999999', name: 'Maria Silva' });
  assert.equal(patched.length, 1);
  assert.equal(patched[0]?.start, '2026-10-29T08:50:00');

  await calendar.cancel('evt-1');
  assert.deepEqual(deleted, ['evt-1']);
});

test('cancelar um evento que já saiu da agenda não falha', async () => {
  const { calendar } = harness({
    deleteEvent: async () => {
      const error = new Error('gone') as Error & { code?: number };
      error.code = 410;
      throw error;
    },
  });
  await calendar.cancel('evt-1');
});

test('erro de permissão vira orientação, sem despejar segredo', async () => {
  const { calendar } = harness({
    queryFreeBusy: async () => {
      const error = new Error('forbidden') as Error & { code?: number };
      error.code = 403;
      throw error;
    },
  });
  await assert.rejects(calendar.inspect(), (err: unknown) => {
    assert.ok(err instanceof CalendarAccessError);
    assert.match(err.message, /conta de serviço/);
    assert.doesNotMatch(err.message, /private_key/);
    return true;
  });
});

test('agenda não configurada explica o que falta', async () => {
  const calendar = new GoogleCalendar({
    clinic: testClinic(),
    google: { mode: 'unconfigured' },
    now: () => now,
  });
  await assert.rejects(calendar.inspect(), /GOOGLE_SERVICE_ACCOUNT_JSON/);
});
