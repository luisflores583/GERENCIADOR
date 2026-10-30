import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyEventList,
  applyFreeBusy,
  defaultConfig,
  extractBusy,
  handleTurn,
  parseIncoming,
  publicConfig,
  registerMessage,
  selectReminders,
} from './agenda-logic.mjs';

const NOW = '2026-11-01T15:00:00.000Z';
const PHONE = '5511999990000';

function clinicConfig(overrides = {}) {
  const config = defaultConfig();
  config.professionals = [
    { id: 'fisio-1', name: 'Dra. Ana Souza', calendarId: 'ana@group.calendar.google.com' },
  ];
  config.whatsappVerifyToken = 'token-de-teste';
  return { ...config, ...overrides, professionals: overrides.professionals || config.professionals };
}

function incoming(text, choiceId = '') {
  return {
    phone: PHONE,
    messageId: 'm-' + text + '-' + choiceId,
    profileName: 'Maria Perfil',
    silent: false,
    unsupported: false,
    text,
    choiceId,
  };
}

function run(config, steps, nowIso = NOW) {
  let session = null;
  let profile = null;
  const results = [];
  for (const step of steps) {
    const result = handleTurn({ config, session, profile, incoming: step, nowIso });
    session = result.session;
    profile = result.profile;
    results.push(result);
  }
  return { session, profile, results, last: results[results.length - 1] };
}

function rows(body) {
  return body.interactive.action.sections[0].rows;
}

function buttons(body) {
  return body.interactive.action.buttons.map((button) => button.reply);
}

function assertWhatsappLimits(body) {
  assert.equal(body.messaging_product, 'whatsapp');
  assert.equal(body.to, PHONE);
  if (body.type === 'text') {
    assert.ok(body.text.body.length <= 4096);
    return;
  }
  assert.equal(body.type, 'interactive');
  const interactive = body.interactive;
  assert.ok(interactive.body.text.length <= 1024);
  if (interactive.type === 'button') {
    assert.ok(interactive.action.buttons.length <= 3);
    for (const button of interactive.action.buttons) {
      assert.ok(button.reply.title.length <= 20);
      assert.ok(button.reply.id.length <= 256);
    }
  }
  if (interactive.type === 'list') {
    assert.ok(interactive.action.button.length <= 20);
    const listRows = interactive.action.sections[0].rows;
    assert.ok(listRows.length >= 1 && listRows.length <= 10);
    for (const row of listRows) {
      assert.ok(row.title.length <= 24);
      assert.ok(row.id.length <= 200);
      if (row.description) assert.ok(row.description.length <= 72);
    }
  }
}

test('menu de saudação tem 4 opções e não usa botão para 4 itens', () => {
  const result = handleTurn({
    config: clinicConfig(),
    session: null,
    profile: null,
    incoming: incoming('oi'),
    nowIso: NOW,
  });
  assert.equal(result.action, 'send');
  assert.equal(result.whatsappBody.interactive.type, 'list');
  assert.deepEqual(rows(result.whatsappBody).map((row) => row.id), ['agendar', 'remarcar', 'cancelar', 'meus']);
  assert.equal(result.whatsappBody.text, undefined);
  assert.ok(!result.whatsappBody.interactive.body.text.includes('Não entendi'));
  assertWhatsappLimits(result.whatsappBody);
});

test('resposta inválida volta ao menu', () => {
  const { last } = run(clinicConfig(), [incoming('banana')]);
  assert.match(last.whatsappBody.interactive.body.text, /Não entendi/);
  assert.match(last.whatsappBody.interactive.body.text, /Agendar/);
  assert.equal(last.session, null);
});

test('um fisioterapeuta pula a escolha e pede o tipo', () => {
  const { last } = run(clinicConfig(), [incoming('1')]);
  assert.equal(last.whatsappBody.interactive.type, 'button');
  assert.deepEqual(buttons(last.whatsappBody).map((button) => button.title), ['Avaliação', 'Retorno', 'Menu']);
  assert.equal(buttons(last.whatsappBody).length, 3);
});

test('dois fisioterapeutas pedem a escolha do profissional', () => {
  const config = clinicConfig({
    professionals: [
      { id: 'fisio-1', name: 'Dra. Ana Souza', calendarId: 'ana@group.calendar.google.com' },
      { id: 'fisio-2', name: 'Dr. Bruno Lima', calendarId: 'bruno@group.calendar.google.com' },
    ],
  });
  const { last } = run(config, [incoming('agendar')]);
  assert.equal(last.whatsappBody.interactive.type, 'list');
  assert.deepEqual(rows(last.whatsappBody).map((row) => row.title), ['Dra. Ana Souza', 'Dr. Bruno Lima']);
});

test('segunda livre gera 10 horários de 50 min fora do almoço', () => {
  const config = clinicConfig();
  const booked = run(config, [incoming('agendar'), incoming('1'), incoming('Maria Silva')]);
  const dates = booked.last;
  assert.equal(dates.session.step, 'pick_date');
  assert.equal(rows(dates.whatsappBody)[0].title, 'seg 02/11');
  assert.ok(rows(dates.whatsappBody).every((row) => !row.title.startsWith('sáb') && !row.title.startsWith('dom')));

  const picked = handleTurn({
    config,
    session: dates.session,
    profile: booked.profile,
    incoming: incoming('1'),
    nowIso: NOW,
  });
  assert.equal(picked.action, 'freebusy');
  assert.equal(picked.purpose, 'offer_slots');
  assert.notEqual(picked.action, 'create_event');

  const slots = applyFreeBusy({
    config,
    session: picked.session,
    profile: booked.profile,
    phone: PHONE,
    busy: [],
    nowIso: NOW,
    purpose: 'offer_slots',
  });
  const titles = rows(slots.whatsappBody).map((row) => row.title);
  assert.deepEqual(titles, ['08:00', '08:50', '09:40', '10:30', '13:00', '13:50', '14:40', '15:30', '16:20', '17:10']);
  assert.ok(!titles.includes('11:20'));
  assert.ok(!titles.includes('12:00'));
  assert.match(rows(slots.whatsappBody).at(-1).description, /18:00/);
  assertWhatsappLimits(slots.whatsappBody);
});

test('ocupado some da lista e a borda exata continua livre', () => {
  const config = clinicConfig();
  const { session, profile } = run(config, [incoming('agendar'), incoming('avaliação'), incoming('Maria Silva'), incoming('seg 02/11')]);
  assert.equal(session.date, '2026-11-02');
  const slots = applyFreeBusy({
    config,
    session,
    profile,
    phone: PHONE,
    busy: [{ start: '2026-11-02T08:00:00-03:00', end: '2026-11-02T08:50:00-03:00' }],
    nowIso: NOW,
    purpose: 'offer_slots',
  });
  const titles = rows(slots.whatsappBody).map((row) => row.title);
  assert.ok(!titles.includes('08:00'));
  assert.ok(titles.includes('08:50'));
});

test('horário passado não é oferecido', () => {
  const config = clinicConfig();
  const mondayNoon = '2026-11-02T15:30:00.000Z';
  const { session, profile } = run(config, [incoming('agendar'), incoming('1'), incoming('Maria Silva'), incoming('1')], mondayNoon);
  const slots = applyFreeBusy({
    config,
    session,
    profile,
    phone: PHONE,
    busy: [],
    nowIso: mondayNoon,
    purpose: 'offer_slots',
  });
  const titles = rows(slots.whatsappBody).map((row) => row.title);
  assert.ok(!titles.includes('08:00'));
  assert.ok(!titles.includes('13:00'));
  assert.equal(titles[0], '13:50');
});

test('só cria o evento depois do resumo confirmado, com nome, telefone e lembrete', () => {
  const config = clinicConfig({ location: 'Rua das Flores, 10' });
  let state = run(config, [incoming('agendar'), incoming('2'), incoming('Maria Silva'), incoming('1')]);
  const offered = applyFreeBusy({
    config,
    session: state.last.session,
    profile: state.profile,
    phone: PHONE,
    busy: [],
    nowIso: NOW,
    purpose: 'offer_slots',
  });
  const chosen = handleTurn({
    config,
    session: offered.session,
    profile: state.profile,
    incoming: incoming('08:00', 'hora:0'),
    nowIso: NOW,
  });
  assert.equal(chosen.action, 'send');
  assert.equal(chosen.session.step, 'confirm_book');
  assert.match(chosen.whatsappBody.interactive.body.text, /Maria Silva/);
  assert.match(chosen.whatsappBody.interactive.body.text, /só entra na agenda depois/);
  assert.equal(buttons(chosen.whatsappBody).length, 3);

  const confirmed = handleTurn({
    config,
    session: chosen.session,
    profile: state.profile,
    incoming: incoming('Confirmar', 'confirmar'),
    nowIso: NOW,
  });
  assert.equal(confirmed.action, 'freebusy');
  assert.equal(confirmed.purpose, 'recheck_create');
  assert.notEqual(confirmed.action, 'create_event');

  const taken = applyFreeBusy({
    config,
    session: confirmed.session,
    profile: state.profile,
    phone: PHONE,
    busy: [{ start: confirmed.timeMin, end: confirmed.timeMax }],
    nowIso: NOW,
    purpose: 'recheck_create',
  });
  assert.equal(taken.action, 'send');
  assert.match(taken.whatsappBody.interactive.body.text, /acabou de ser ocupado/);

  const created = applyFreeBusy({
    config,
    session: confirmed.session,
    profile: state.profile,
    phone: PHONE,
    busy: [],
    nowIso: NOW,
    purpose: 'recheck_create',
  });
  assert.equal(created.action, 'create_event');
  assert.match(created.summary, /Maria Silva/);
  assert.match(created.summary, /Retorno/);
  assert.match(created.description, /Telefone: 5511999990000/);
  assert.match(created.description, /ID_PACIENTE: tel:5511999990000/);
  assert.equal(created.location, 'Rua das Flores, 10');
  assert.deepEqual(created.reminderMinutes, [1440, 60]);
  assert.equal(created.calendarId, 'ana@group.calendar.google.com');
  assert.match(created.whatsappBody.text.body, /Consulta agendada/);
});

test('calendarId placeholder não chama a agenda', () => {
  const { last } = run(defaultConfig(), [incoming('meus horarios')]);
  assert.equal(last.action, 'send');
  assert.match(last.whatsappBody.text.body, /calendarId/);
  assert.equal(publicConfig(defaultConfig()).whatsappVerifyToken, undefined);
});

test('cancelar localiza pelo telefone e só apaga depois da confirmação', () => {
  const config = clinicConfig();
  const start = '2026-11-03T11:00:00.000Z';
  const end = '2026-11-03T11:50:00.000Z';
  const description = [
    'Paciente: Maria Silva',
    'Telefone: ' + PHONE,
    'ID_PACIENTE: tel:' + PHONE,
    'Tipo: Avaliação',
    'Profissional: Dra. Ana Souza',
    'ID_PROFISSIONAL: fisio-1',
    'ID_CALENDARIO: ana@group.calendar.google.com',
  ].join('\n');
  const listed = handleTurn({
    config,
    session: null,
    profile: { patientName: 'Maria Silva' },
    incoming: incoming('cancelar'),
    nowIso: NOW,
  });
  assert.equal(listed.action, 'list_events');
  const shown = applyEventList({
    config,
    phone: PHONE,
    profile: listed.profile,
    nowIso: NOW,
    purpose: 'list_for_cancel',
    events: [
      {
        id: 'evt-old',
        summary: 'outro',
        description: 'ID_PACIENTE: tel:5500000000000',
        start: { dateTime: start },
        end: { dateTime: end },
        calendarId: 'ana@group.calendar.google.com',
      },
      {
        id: 'evt-mine',
        summary: 'Fisioterapia — Maria Silva (Avaliação)',
        description,
        start: { dateTime: start },
        end: { dateTime: end },
        calendarId: 'ana@group.calendar.google.com',
      },
    ],
  });
  assert.equal(rows(shown.whatsappBody).length, 1);
  const picked = handleTurn({
    config,
    session: shown.session,
    profile: shown.profile,
    incoming: incoming('1'),
    nowIso: NOW,
  });
  assert.equal(picked.action, 'send');
  assert.equal(picked.session.step, 'confirm_cancel');
  const removed = handleTurn({
    config,
    session: picked.session,
    profile: picked.profile,
    incoming: incoming('sim'),
    nowIso: NOW,
  });
  assert.equal(removed.action, 'delete_event');
  assert.equal(removed.eventId, 'evt-mine');
  assert.equal(removed.calendarId, 'ana@group.calendar.google.com');
  assert.match(removed.whatsappBody.text.body, /cancelada/);
});

test('remarcar atualiza o mesmo evento e devolve o horário atual como livre', () => {
  const config = clinicConfig();
  const start = '2026-11-02T11:00:00.000Z';
  const end = '2026-11-02T11:50:00.000Z';
  const description = [
    'Paciente: Maria Silva',
    'ID_PACIENTE: tel:' + PHONE,
    'Tipo: Avaliação',
    'Profissional: Dra. Ana Souza',
    'ID_PROFISSIONAL: fisio-1',
    'ID_CALENDARIO: ana@group.calendar.google.com',
  ].join('\n');
  const shown = applyEventList({
    config,
    phone: PHONE,
    profile: { patientName: 'Maria Silva' },
    nowIso: NOW,
    purpose: 'list_for_reschedule',
    events: [
      {
        id: 'evt-mine',
        description,
        start: { dateTime: start },
        end: { dateTime: end },
        calendarId: 'ana@group.calendar.google.com',
      },
    ],
  });
  const picked = handleTurn({
    config,
    session: shown.session,
    profile: shown.profile,
    incoming: incoming('', 'evt:0'),
    nowIso: NOW,
  });
  assert.equal(picked.session.step, 'pick_date');
  assert.equal(picked.session.eventId, 'evt-mine');
  const day = handleTurn({
    config,
    session: picked.session,
    profile: picked.profile,
    incoming: incoming('1'),
    nowIso: NOW,
  });
  assert.equal(day.action, 'freebusy');
  const slots = applyFreeBusy({
    config,
    session: day.session,
    profile: picked.profile,
    phone: PHONE,
    busy: [{ start, end }],
    nowIso: NOW,
    purpose: 'offer_slots',
    ignoreInterval: day.ignoreInterval,
  });
  assert.ok(rows(slots.whatsappBody).some((row) => row.title === '08:00'));
  const chosen = handleTurn({
    config,
    session: slots.session,
    profile: picked.profile,
    incoming: incoming('2'),
    nowIso: NOW,
  });
  assert.equal(chosen.session.step, 'confirm_reschedule');
  const recheck = handleTurn({
    config,
    session: chosen.session,
    profile: picked.profile,
    incoming: incoming('1'),
    nowIso: NOW,
  });
  assert.equal(recheck.purpose, 'recheck_update');
  const updated = applyFreeBusy({
    config,
    session: recheck.session,
    profile: picked.profile,
    phone: PHONE,
    busy: [],
    nowIso: NOW,
    purpose: 'recheck_update',
    ignoreInterval: recheck.ignoreInterval,
  });
  assert.equal(updated.action, 'update_event');
  assert.equal(updated.eventId, 'evt-mine');
  assert.match(updated.whatsappBody.text.body, /remarcada/);
});

test('nome curto pede de novo e não volta ao menu', () => {
  const config = clinicConfig();
  const { last, session } = run(config, [incoming('agendar'), incoming('1'), incoming('Ana')]);
  assert.equal(session.step, 'ask_name');
  assert.match(last.whatsappBody.text.body, /nome completo/);
});

test('seleção expirada não confirma horário antigo', () => {
  const config = clinicConfig();
  const session = {
    step: 'confirm_book',
    mode: 'book',
    professionalId: 'fisio-1',
    typeLabel: 'Avaliação',
    durationMinutes: 50,
    slotStart: '2026-11-02T11:00:00.000Z',
    slotEnd: '2026-11-02T11:50:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  };
  const result = handleTurn({
    config,
    session,
    profile: { patientName: 'Maria Silva' },
    incoming: incoming('confirmar'),
    nowIso: NOW,
  });
  assert.equal(result.action, 'send');
  assert.notEqual(result.action, 'freebusy');
});

test('webhook de status é ignorado e mensagem duplicada é marcada', () => {
  assert.equal(parseIncoming({ body: { entry: [{ changes: [{ value: { statuses: [{ id: '1' }] } }] }] } }), null);
  const parsed = parseIncoming({
    body: {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ profile: { name: 'Maria' }, wa_id: PHONE }],
                messages: [{ from: PHONE, id: 'wamid.1', type: 'text', text: { body: 'oi' } }],
              },
            },
          ],
        },
      ],
    },
  });
  assert.equal(parsed.text, 'oi');
  assert.equal(parsed.phone, PHONE);
  const first = registerMessage([], 'wamid.1');
  const second = registerMessage(first.seen, 'wamid.1');
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
});

test('free/busy cru da API vira intervalos', () => {
  const busy = extractBusy([
    {
      kind: 'calendar#freeBusy',
      calendars: {
        'ana@group.calendar.google.com': {
          busy: [{ start: '2026-11-02T11:00:00Z', end: '2026-11-02T11:50:00Z' }],
        },
      },
    },
  ]);
  assert.equal(busy.length, 1);
});

test('lembrete de 24h e de 1h, sem evento de outro telefone', () => {
  const config = clinicConfig();
  const description = 'Paciente: Maria Silva\nID_PACIENTE: tel:' + PHONE + '\nTipo: Retorno\nProfissional: Dra. Ana Souza';
  const in24h = new Date(new Date(NOW).getTime() + 24 * 3600000).toISOString();
  const in1h = new Date(new Date(NOW).getTime() + 60 * 60000).toISOString();
  const in3h = new Date(new Date(NOW).getTime() + 3 * 3600000).toISOString();
  const end = (iso) => new Date(new Date(iso).getTime() + 50 * 60000).toISOString();
  const { messages, sent } = selectReminders({
    config,
    nowIso: NOW,
    sent: {},
    events: [
      { id: 'a', description, start: { dateTime: in24h }, end: { dateTime: end(in24h) } },
      { id: 'b', description, start: { dateTime: in1h }, end: { dateTime: end(in1h) } },
      { id: 'c', description, start: { dateTime: in3h }, end: { dateTime: end(in3h) } },
      { id: 'd', description: 'sem telefone', start: { dateTime: in1h }, end: { dateTime: end(in1h) } },
    ],
  });
  assert.equal(messages.length, 2);
  assert.match(messages.find((item) => item.eventId === 'a').whatsappBody.text.body, /amanhã/);
  assert.match(messages.find((item) => item.eventId === 'b').whatsappBody.text.body, /1 hora/);
  const again = selectReminders({
    config,
    nowIso: NOW,
    sent,
    events: [{ id: 'a', description, start: { dateTime: in24h }, end: { dateTime: end(in24h) } }],
  });
  assert.equal(again.messages.length, 0);
});

test('mais de 10 horários pagina em lista de no máximo 10 linhas', () => {
  const config = clinicConfig({ slotMinutes: 20, sessionTypes: [{ id: 'retorno', label: 'Retorno', durationMinutes: 20 }] });
  const { session, profile, last } = run(config, [incoming('agendar'), incoming('1'), incoming('Maria Silva'), incoming('1')]);
  assert.equal(last.action, 'freebusy');
  const slots = applyFreeBusy({
    config,
    session,
    profile,
    phone: PHONE,
    busy: [],
    nowIso: NOW,
    purpose: 'offer_slots',
  });
  assertWhatsappLimits(slots.whatsappBody);
  assert.equal(rows(slots.whatsappBody).at(-1).id, 'mais');
  const next = handleTurn({
    config,
    session: slots.session,
    profile,
    incoming: incoming('10'),
    nowIso: NOW,
  });
  assert.equal(next.session.slotPage, 1);
  assert.notEqual(rows(next.whatsappBody)[0].title, rows(slots.whatsappBody)[0].title);
});
