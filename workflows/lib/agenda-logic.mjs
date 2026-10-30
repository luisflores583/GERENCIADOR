/**
 * Regras do chatbot de agendamento (sem n8n, sem rede).
 * Horários em America/Sao_Paulo por padrão. Sem horário de verão desde 2019.
 */

export function defaultConfig() {
  return {
    _ajuda:
      'Edite este objeto no node Configuração do consultório. Não cole token de acesso aqui: o token fica na credencial WhatsApp Cloud API do n8n. Para outro fisioterapeuta, copie um item de professionals e mude id, name e calendarId.',
    clinicName: 'Consultório de Fisioterapia',
    timezone: 'America/Sao_Paulo',
    graphApiVersion: 'v21.0',
    whatsappPhoneNumberId: 'SEU_PHONE_NUMBER_ID',
    whatsappVerifyToken: 'TROQUE_ESTE_VERIFY_TOKEN',
    location: '',
    businessDays: [1, 2, 3, 4, 5],
    dayStart: '08:00',
    dayEnd: '18:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    slotMinutes: 50,
    minLeadMinutes: 60,
    daysAhead: 21,
    maxDatesInList: 8,
    lookupDays: 60,
    sessionTtlMinutes: 120,
    reminderMinutes: [1440, 60],
    reminderLookaheadHours: 26,
    reminderWindowMinutes: 70,
    eventTitlePrefix: 'Fisioterapia',
    professionals: [
      {
        id: 'fisio-1',
        name: 'Fisioterapeuta',
        calendarId: 'SEU_CALENDAR_ID@group.calendar.google.com',
      },
    ],
    sessionTypes: [
      { id: 'avaliacao', label: 'Avaliação', durationMinutes: 50 },
      { id: 'retorno', label: 'Retorno', durationMinutes: 50 },
    ],
  };
}

const WEEK_LONG = {
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
  6: 'sábado',
  7: 'domingo',
};
const WEEK_SHORT = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sáb', 7: 'dom' };
const WEEK_FROM_EN = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const MENU_WORDS = new Set([
  'menu',
  'inicio',
  'oi',
  'ola',
  'hey',
  'ei',
  'bom dia',
  'boa tarde',
  'boa noite',
  '0',
  'voltar',
  'recomecar',
  'comecar',
  'start',
  'ajuda',
]);

export function registerMessage(seen, messageId) {
  const list = Array.isArray(seen) ? seen.slice() : [];
  if (messageId && list.includes(messageId)) return { duplicate: true, seen: list };
  if (messageId) list.push(messageId);
  return { duplicate: false, seen: list.length > 400 ? list.slice(-400) : list };
}

export function publicConfig(config) {
  const copy = JSON.parse(JSON.stringify(config));
  delete copy.whatsappVerifyToken;
  return copy;
}

export function textBody(to, body) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: clip(body, 4096) },
  };
}

export function parseIncoming(request) {
  const body = request && request.body;
  if (!body || !Array.isArray(body.entry) || !body.entry.length) return null;
  const change = body.entry[0] && body.entry[0].changes && body.entry[0].changes[0];
  const value = change && change.value;
  if (!value || !Array.isArray(value.messages) || !value.messages.length) return null;
  const message = value.messages[0];
  const phone = digits(message.from);
  if (!phone) return null;
  const display = digits(value.metadata && value.metadata.display_phone_number);
  if (display && display === phone) return null;
  const profileName =
    (value.contacts && value.contacts[0] && value.contacts[0].profile && value.contacts[0].profile.name) || '';
  const messageId = message.id || '';
  if (message.type === 'reaction' || message.type === 'system') {
    return { phone, messageId, profileName, silent: true, unsupported: false, text: '', choiceId: '' };
  }
  if (message.type === 'text') {
    return {
      phone,
      messageId,
      profileName,
      silent: false,
      unsupported: false,
      text: String((message.text && message.text.body) || '').trim(),
      choiceId: '',
    };
  }
  if (message.type === 'interactive') {
    const interactive = message.interactive || {};
    if (interactive.type === 'button_reply' && interactive.button_reply) {
      return {
        phone,
        messageId,
        profileName,
        silent: false,
        unsupported: false,
        text: String(interactive.button_reply.title || '').trim(),
        choiceId: String(interactive.button_reply.id || ''),
      };
    }
    if (interactive.type === 'list_reply' && interactive.list_reply) {
      return {
        phone,
        messageId,
        profileName,
        silent: false,
        unsupported: false,
        text: String(interactive.list_reply.title || '').trim(),
        choiceId: String(interactive.list_reply.id || ''),
      };
    }
  }
  return { phone, messageId, profileName, silent: false, unsupported: true, text: '', choiceId: '' };
}

export function handleTurn({ config, session, profile, incoming, nowIso }) {
  const now = new Date(nowIso);
  const safeProfile = profile && profile.patientName ? { patientName: profile.patientName } : { patientName: null };
  if (!incoming || incoming.unsupported) {
    return menuReply(config, incoming && incoming.phone, safeProfile, nowIso, 'Envie uma mensagem de texto ou escolha uma opção do menu.');
  }
  let current = clone(session);
  if (current && isExpired(current, now, config)) current = null;
  if (!current) current = freshSession(nowIso);
  const choice = choiceOf(incoming);
  const phone = incoming.phone;

  if (!config.professionals || !config.professionals.length || !config.sessionTypes || !config.sessionTypes.length) {
    return sendText(config, phone, null, safeProfile, 'O consultório ainda não tem profissional ou tipo de sessão na configuração.');
  }

  if (current.step === 'ask_name') {
    return onAskName(config, current, safeProfile, incoming, choice, nowIso);
  }

  if (current.step === 'menu') {
    if (isMenuWord(choice)) return menuReply(config, phone, safeProfile, nowIso, null);
    const cmd = commandFrom(choice, true);
    if (cmd) return dispatch(config, safeProfile, phone, nowIso, cmd);
    return menuReply(config, phone, safeProfile, nowIso, 'Não entendi essa resposta. Vamos voltar ao menu.');
  }

  const local = handleStep(config, current, safeProfile, phone, choice, nowIso);
  if (local) return finish(local, config);
  const cmd = commandFrom(choice, false);
  if (cmd) return dispatch(config, safeProfile, phone, nowIso, cmd);
  if (isMenuWord(choice)) return menuReply(config, phone, safeProfile, nowIso, null);
  return menuReply(config, phone, safeProfile, nowIso, 'Não entendi essa resposta. Vamos voltar ao menu.');
}

export function extractBusy(payloads) {
  const intervals = [];
  const list = Array.isArray(payloads) ? payloads : [payloads];
  for (const payload of list) {
    if (!payload || typeof payload !== 'object') continue;
    if (Array.isArray(payload.busy)) {
      for (const b of payload.busy) pushInterval(intervals, b);
    }
    if (payload.calendars && typeof payload.calendars === 'object') {
      for (const cal of Object.values(payload.calendars)) {
        if (cal && Array.isArray(cal.busy)) {
          for (const b of cal.busy) pushInterval(intervals, b);
        }
      }
    }
    if (payload.start && payload.end && !payload.calendars && !payload.kind) {
      pushInterval(intervals, payload);
    }
  }
  return intervals;
}

export function applyFreeBusy({ config, session, profile, phone, busy, nowIso, purpose, ignoreInterval }) {
  const current = clone(session) || freshSession(nowIso);
  const safeProfile = profile && profile.patientName ? { patientName: profile.patientName } : { patientName: null };
  const ignore = ignoreInterval || (current.ignoreStart ? { start: current.ignoreStart, end: current.ignoreEnd } : null);
  const freeBusy = subtractInterval(busy || [], ignore);

  if (purpose === 'offer_slots') {
    const ymd = parseYmd(current.date);
    const duration = Number(current.durationMinutes) || 50;
    const slots = ymd ? slotsForDate(config, ymd, duration, new Date(nowIso)) : [];
    const free = slots.filter((slot) => isFree(slot, freeBusy));
    if (!free.length) {
      const dates = upcomingDates(config, new Date(nowIso), duration);
      const next = withSession(current, nowIso, { step: 'pick_date', offeredDates: dates, offeredSlots: [], slotPage: 0, date: null });
      const body = dates.length
        ? 'Não há horários livres nesse dia.\n\n' + dateBody(config, dates)
        : 'Não há horários livres na agenda neste período. Responda MENU para voltar.';
      const whatsappBody = dates.length
        ? listMessage(phone, {
            header: config.clinicName,
            body,
            button: 'Ver dias',
            sectionTitle: 'Dias',
            rows: dates.map((d) => ({ id: d.id, title: d.title, description: d.description })),
          })
        : textBody(phone, body);
      return finish(sendPayload(config, phone, dates.length ? next : null, safeProfile, whatsappBody), config);
    }
    const offeredSlots = free.map((slot, index) => ({
      id: 'hora:' + index,
      start: slot.start,
      end: slot.end,
      title: formatTime(slot.start, config.timezone),
      description: 'até ' + formatTime(slot.end, config.timezone),
    }));
    const next = withSession(current, nowIso, { step: 'pick_time', offeredSlots, slotPage: 0 });
    return finish(sendPayload(config, phone, next, safeProfile, slotsPayload(phone, config, offeredSlots, 0)), config);
  }

  const slot = {
    start: current.slotStart,
    end: current.slotEnd,
    startMs: new Date(current.slotStart).getTime(),
    endMs: new Date(current.slotEnd).getTime(),
  };
  const leadMs = (Number(config.minLeadMinutes) || 0) * 60000;
  const stillFree = slot.startMs >= new Date(nowIso).getTime() + leadMs && isFree(slot, freeBusy);
  if (!stillFree) {
    const ymd = parseYmd(current.date);
    const duration = Number(current.durationMinutes) || 50;
    const slots = ymd ? slotsForDate(config, ymd, duration, new Date(nowIso)).filter((item) => isFree(item, freeBusy)) : [];
    if (!slots.length) {
      const dates = upcomingDates(config, new Date(nowIso), duration);
      const next = withSession(current, nowIso, {
        step: 'pick_date',
        offeredDates: dates,
        offeredSlots: [],
        slotStart: null,
        slotEnd: null,
        date: null,
      });
      const body = 'Esse horário acabou de ser ocupado e não restou outro neste dia.\n\n' + dateBody(config, dates);
      return finish(
        sendPayload(
          config,
          phone,
          dates.length ? next : null,
          safeProfile,
          dates.length
            ? listMessage(phone, {
                header: config.clinicName,
                body,
                button: 'Ver dias',
                sectionTitle: 'Dias',
                rows: dates.map((d) => ({ id: d.id, title: d.title, description: d.description })),
              })
            : textBody(phone, 'Esse horário acabou de ser ocupado. Responda MENU para voltar.'),
        ),
        config,
      );
    }
    const offeredSlots = slots.map((item, index) => ({
      id: 'hora:' + index,
      start: item.start,
      end: item.end,
      title: formatTime(item.start, config.timezone),
      description: 'até ' + formatTime(item.end, config.timezone),
    }));
    const next = withSession(current, nowIso, { step: 'pick_time', offeredSlots, slotPage: 0, slotStart: null, slotEnd: null });
    const payload = slotsPayload(phone, config, offeredSlots, 0, 'Esse horário acabou de ser ocupado.');
    return finish(sendPayload(config, phone, next, safeProfile, payload), config);
  }

  const drafted = draftEvent(config, current, safeProfile, phone);
  const when = whenLabel(drafted.start, drafted.end, config.timezone);
  const verb = purpose === 'recheck_update' ? 'Consulta remarcada.' : 'Consulta agendada.';
  const lines = [verb, '', drafted.summary.replace(config.eventTitlePrefix + ' — ', ''), when];
  if (config.location) lines.push(config.location);
  lines.push('', 'O horário fica ocupado na agenda, com lembrete para o consultório.', 'Se precisar remarcar ou cancelar, responda MENU.');
  return finish(
    {
      action: purpose === 'recheck_update' ? 'update_event' : 'create_event',
      phone,
      session: withSession(current, nowIso, { step: current.step }),
      profile: safeProfile,
      config: publicConfig(config),
      calendarId: drafted.calendarId,
      eventId: current.eventId,
      start: drafted.start,
      end: drafted.end,
      summary: drafted.summary,
      description: drafted.description,
      location: drafted.location,
      reminderMinutes: drafted.reminderMinutes,
      whatsappBody: textBody(phone, lines.join('\n')),
    },
    config,
  );
}

export function pairEvents(inputItems, expandedItems) {
  const events = [];
  const inputs = Array.isArray(inputItems) ? inputItems : [];
  const expanded = Array.isArray(expandedItems) ? expandedItems : [];
  for (const item of inputs) {
    const ev = item && item.json ? item.json : item;
    if (!ev || !ev.id || ev.status === 'cancelled') continue;
    if (ev.start && ev.start.date && !ev.start.dateTime) continue;
    let idx = 0;
    const paired = item && item.pairedItem;
    if (paired && typeof paired.item === 'number') idx = paired.item;
    if (Array.isArray(paired) && paired[0] && typeof paired[0].item === 'number') idx = paired[0].item;
    const srcRaw = expanded[idx] || expanded[0] || {};
    const src = srcRaw.json || srcRaw;
    events.push({
      id: ev.id,
      summary: ev.summary || '',
      description: ev.description || '',
      start: ev.start || null,
      end: ev.end || null,
      calendarId: field(ev.description, 'ID_CALENDARIO') || src.calendarId || '',
      professionalName: field(ev.description, 'Profissional') || src.professionalName || '',
    });
  }
  return events;
}

export function applyEventList({ config, phone, profile, events, nowIso, purpose }) {
  const safeProfile = profile && profile.patientName ? { patientName: profile.patientName } : { patientName: null };
  const nowMs = new Date(nowIso).getTime();
  const mine = (events || [])
    .filter((event) => eventPhone(event.description) === phone)
    .map((event) => ({ ...event, startMs: eventStartMs(event) }))
    .filter((event) => Number.isFinite(event.startMs) && event.startMs > nowMs)
    .sort((a, b) => a.startMs - b.startMs)
    .slice(0, 10);

  if (!mine.length) {
    const empty =
      purpose === 'list_for_view'
        ? 'Você não tem consultas futuras marcadas por aqui.\n\nResponda MENU para agendar.'
        : 'Não encontrei consulta futura para este telefone.\n\nSó aparecem horários marcados por este atendimento. Responda MENU para voltar.';
    return finish(sendText(config, phone, null, safeProfile, empty), config);
  }

  if (purpose === 'list_for_view') {
    const lines = ['Suas próximas consultas:', ''];
    mine.forEach((event, index) => {
      lines.push(index + 1 + '. ' + eventLine(config, event));
    });
    lines.push('', 'Para remarcar ou cancelar, responda MENU.');
    return finish(sendText(config, phone, null, safeProfile, lines.join('\n')), config);
  }

  const offeredEvents = mine.map((event, index) => ({
    id: 'evt:' + index,
    eventId: event.id,
    calendarId: event.calendarId,
    professionalName: event.professionalName,
    summary: event.summary,
    description: event.description,
    start: asIso(event.start),
    end: asIso(event.end),
    title: clip(formatDayShort(asIso(event.start), config.timezone) + ' ' + formatTime(asIso(event.start), config.timezone), 24),
    descriptionRow: clip(eventLine(config, event), 72),
  }));
  const step = purpose === 'list_for_cancel' ? 'pick_event_cancel' : 'pick_event_reschedule';
  const intro = purpose === 'list_for_cancel' ? 'Qual consulta você quer cancelar?' : 'Qual consulta você quer remarcar?';
  const session = withSession(freshSession(nowIso), nowIso, { step, offeredEvents, mode: purpose === 'list_for_cancel' ? 'cancel' : 'reschedule' });
  const body = intro + '\n\n' + offeredEvents.map((event, index) => index + 1 + ' - ' + event.descriptionRow).join('\n') + '\n\n0 - Menu';
  return finish(
    sendPayload(
      config,
      phone,
      session,
      safeProfile,
      listMessage(phone, {
        header: config.clinicName,
        body,
        button: 'Ver consultas',
        sectionTitle: 'Consultas',
        rows: offeredEvents.map((event) => ({ id: event.id, title: event.title, description: event.descriptionRow })),
      }),
    ),
    config,
  );
}

export function selectReminders({ config, events, nowIso, sent }) {
  const nowMs = new Date(nowIso).getTime();
  const leads = (config.reminderMinutes || [1440, 60]).map(Number);
  const windowMin = Number(config.reminderWindowMinutes) || 70;
  const nextSent = clone(sent || {});
  const messages = [];
  for (const event of events || []) {
    const phone = eventPhone(event.description);
    const startIso = asIso(event.start);
    const startMs = startIso ? new Date(startIso).getTime() : NaN;
    if (!phone || !Number.isFinite(startMs)) continue;
    const remainMin = (startMs - nowMs) / 60000;
    if (remainMin <= 0) continue;
    for (const lead of leads) {
      const kind = 'm' + lead;
      if (nextSent[event.id] && nextSent[event.id][kind]) continue;
      if (remainMin < lead - windowMin || remainMin > lead + windowMin) continue;
      messages.push({
        eventId: event.id,
        kind,
        phone,
        whatsappBody: textBody(phone, reminderText(config, event, lead)),
      });
      if (!nextSent[event.id]) nextSent[event.id] = {};
      nextSent[event.id][kind] = nowIso;
    }
  }
  const cutoff = nowMs - 3 * 86400000;
  for (const eventId of Object.keys(nextSent)) {
    const stamps = Object.values(nextSent[eventId] || {});
    const newest = stamps.reduce((max, iso) => Math.max(max, new Date(iso).getTime() || 0), 0);
    if (!newest || newest < cutoff) delete nextSent[eventId];
  }
  return { messages, sent: nextSent };
}

function handleStep(config, session, profile, phone, choice, nowIso) {
  if (session.step === 'pick_pro') {
    const pro = matchById(choice, config.professionals, 'pro:', session.offeredPros || config.professionals);
    if (!pro) return null;
    const next = withSession(session, nowIso, { professionalId: pro.id, step: 'pick_type' });
    return typePrompt(config, next, profile, phone, nowIso);
  }
  if (session.step === 'pick_type') {
    const type = matchType(choice, config.sessionTypes);
    if (!type) return null;
    const next = withSession(session, nowIso, {
      sessionTypeId: type.id,
      typeLabel: type.label,
      durationMinutes: Number(type.durationMinutes) || Number(config.slotMinutes) || 50,
    });
    if (!profile.patientName) {
      const asking = withSession(next, nowIso, { step: 'ask_name' });
      return sendText(config, phone, asking, profile, askNameText(null));
    }
    return datePrompt(config, next, profile, phone, nowIso);
  }
  if (session.step === 'pick_date') {
    if (choice.id === 'mais' || choice.norm === 'mais' || choice.norm === 'mais horarios') return null;
    const date = matchDate(choice, session.offeredDates || []);
    if (!date) return null;
      const pro = proById(config, session.professionalId);
      const next = withSession(session, nowIso, { date: date.date, step: 'pick_date' });
      const calendarId = session.eventCalendarId || (pro && pro.calendarId);
    const ymd = parseYmd(date.date);
    const nextDay = addCalendarDays(ymd, 1);
    return {
      action: 'freebusy',
      purpose: 'offer_slots',
      phone,
      session: next,
      profile,
      config: publicConfig(config),
      calendarId,
      timeMin: toOffsetIso(zonedLocalToUtc(ymd.year, ymd.month, ymd.day, 0, 0, config.timezone), config.timezone),
      timeMax: toOffsetIso(zonedLocalToUtc(nextDay.year, nextDay.month, nextDay.day, 0, 0, config.timezone), config.timezone),
      ignoreInterval: session.ignoreStart ? { start: session.ignoreStart, end: session.ignoreEnd } : null,
    };
  }
  if (session.step === 'pick_time') {
    const view = pageRows(session.offeredSlots || [], session.slotPage || 0);
    const moreIndex = view.more ? view.visible.length + 1 : null;
    if (choice.id === 'mais' || choice.norm === 'mais' || choice.norm === 'mais horarios' || (moreIndex && pickedIndex(choice) === moreIndex)) {
      const page = (session.slotPage || 0) + 1;
      const nextView = pageRows(session.offeredSlots || [], page);
      const nextPage = nextView.visible.length ? page : 0;
      const next = withSession(session, nowIso, { slotPage: nextPage });
      return sendPayload(config, phone, next, profile, slotsPayload(phone, config, session.offeredSlots || [], nextPage));
    }
    const slot = matchSlot(choice, session.offeredSlots || [], session.slotPage || 0);
    if (!slot) return null;
    if (session.mode === 'reschedule' && slot.start === session.ignoreStart) {
      return sendPayload(
        config,
        phone,
        withSession(session, nowIso, {}),
        profile,
        slotsPayload(phone, config, session.offeredSlots || [], session.slotPage || 0, 'Esse já é o horário da sua consulta.'),
      );
    }
    const step = session.mode === 'reschedule' ? 'confirm_reschedule' : 'confirm_book';
    const next = withSession(session, nowIso, { step, slotStart: slot.start, slotEnd: slot.end });
    return sendPayload(config, phone, next, profile, confirmPayload(config, phone, next, profile));
  }
  if (session.step === 'confirm_book' || session.step === 'confirm_reschedule') {
    if (isConfirm(choice)) {
      const pro = proById(config, session.professionalId);
      const purpose = session.step === 'confirm_reschedule' ? 'recheck_update' : 'recheck_create';
      return {
        action: 'freebusy',
        purpose,
        phone,
        session: withSession(session, nowIso, {}),
        profile,
        config: publicConfig(config),
        calendarId: session.eventCalendarId || (pro && pro.calendarId),
        timeMin: session.slotStart,
        timeMax: session.slotEnd,
        ignoreInterval: session.ignoreStart ? { start: session.ignoreStart, end: session.ignoreEnd } : null,
      };
    }
    if (choice.id === 'outro' || choice.norm === 'outro' || choice.norm === 'outro horario' || pickedIndex(choice) === 2) {
      if (session.offeredSlots && session.offeredSlots.length) {
        const next = withSession(session, nowIso, { step: 'pick_time', slotPage: 0, slotStart: null, slotEnd: null });
        return sendPayload(config, phone, next, profile, slotsPayload(phone, config, next.offeredSlots, 0));
      }
      return datePrompt(config, session, profile, phone, nowIso);
    }
    return null;
  }
  if (session.step === 'pick_event_cancel' || session.step === 'pick_event_reschedule') {
    const event = matchEvent(choice, session.offeredEvents || []);
    if (!event) return null;
    if (session.step === 'pick_event_cancel') {
      const next = withSession(session, nowIso, {
        step: 'confirm_cancel',
        eventId: event.eventId,
        eventCalendarId: event.calendarId,
        slotStart: event.start,
        slotEnd: event.end,
      });
      const body =
        'Cancelar esta consulta?\n\n' +
        event.descriptionRow +
        '\n\n1 - Confirmar cancelamento\n2 - Manter\n0 - Menu';
      return sendPayload(
        config,
        phone,
        next,
        profile,
        buttonMessage(phone, body, [
          { id: 'confirmar', title: 'Confirmar' },
          { id: 'manter', title: 'Manter' },
          { id: 'menu', title: 'Menu' },
        ]),
      );
    }
    return startReschedule(config, session, profile, phone, event, nowIso);
  }
  if (session.step === 'confirm_cancel') {
    if (isConfirm(choice) || choice.norm === 'cancelar') {
      const when = whenLabel(session.slotStart, session.slotEnd, config.timezone);
      return {
        action: 'delete_event',
        phone,
        session: withSession(session, nowIso, {}),
        profile,
        config: publicConfig(config),
        calendarId: session.eventCalendarId,
        eventId: session.eventId,
        whatsappBody: textBody(phone, 'Consulta cancelada.\n\n' + when + '\n\nSe quiser marcar outro horário, responda MENU.'),
      };
    }
    if (choice.id === 'manter' || choice.norm === 'manter' || choice.norm === 'nao' || pickedIndex(choice) === 2) {
      return menuReply(config, phone, profile, nowIso, 'A consulta foi mantida.');
    }
    return null;
  }
  return null;
}

function onAskName(config, session, profile, incoming, choice, nowIso) {
  if (isMenuWord(choice)) return menuReply(config, incoming.phone, profile, nowIso, null);
  const cmd = commandFrom(choice, false);
  if (cmd) return dispatch(config, profile, incoming.phone, nowIso, cmd);
  const name = cleanName(incoming.text);
  if (!name) {
    return sendText(config, incoming.phone, withSession(session, nowIso, { step: 'ask_name' }), profile, 'Preciso do nome completo do paciente, com pelo menos nome e sobrenome.\n\n' + askNameText(incoming.profileName));
  }
  const named = { patientName: name };
  return datePrompt(config, session, named, incoming.phone, nowIso);
}

function dispatch(config, profile, phone, nowIso, cmd) {
  if (cmd === 'book') return finish(beginBook(config, profile, phone, nowIso), config);
  const purpose = cmd === 'reschedule' ? 'list_for_reschedule' : cmd === 'cancel' ? 'list_for_cancel' : 'list_for_view';
  return finish(beginList(config, profile, phone, nowIso, purpose), config);
}

function beginBook(config, profile, phone, nowIso) {
  const session = withSession(freshSession(nowIso), nowIso, { mode: 'book' });
  if (config.professionals.length > 1) {
    const offeredPros = config.professionals.slice(0, 10).map((pro) => ({
      id: 'pro:' + pro.id,
      proId: pro.id,
      title: clip(pro.name, 24),
      description: 'Agenda deste profissional',
    }));
    const next = withSession(session, nowIso, { step: 'pick_pro', offeredPros });
    const body =
      'Com quem você quer agendar?\n\n' +
      offeredPros.map((pro, index) => index + 1 + ' - ' + pro.title).join('\n') +
      '\n\n0 - Menu';
    return sendPayload(
      config,
      phone,
      next,
      profile,
      listMessage(phone, {
        header: config.clinicName,
        body,
        button: 'Ver profissionais',
        sectionTitle: 'Profissionais',
        rows: offeredPros.map((pro) => ({ id: pro.id, title: pro.title, description: pro.description })),
      }),
    );
  }
  const only = config.professionals[0];
  const next = withSession(session, nowIso, { professionalId: only.id, step: 'pick_type' });
  return typePrompt(config, next, profile, phone, nowIso);
}

function beginList(config, profile, phone, nowIso, purpose) {
  const now = new Date(nowIso);
  const timeMax = new Date(now.getTime() + (Number(config.lookupDays) || 60) * 86400000).toISOString();
  return {
    action: 'list_events',
    purpose,
    phone,
    session: null,
    profile,
    config: publicConfig(config),
    calendars: config.professionals.map((pro) => ({ id: pro.id, name: pro.name, calendarId: pro.calendarId })),
    calendarId: config.professionals[0] && config.professionals[0].calendarId,
    query: 'tel:' + phone,
    timeMin: now.toISOString(),
    timeMax,
  };
}

function typePrompt(config, session, profile, phone, nowIso) {
  const types = config.sessionTypes;
  const next = withSession(session, nowIso, { step: 'pick_type' });
  const lines = ['Qual é o tipo da sessão?', ''];
  types.forEach((type, index) => {
    lines.push(index + 1 + ' - ' + type.label + ' (' + type.durationMinutes + ' min)');
  });
  lines.push('0 - Menu');
  if (types.length <= 2) {
    const buttons = types.map((type) => ({ id: 'tipo:' + type.id, title: clip(type.label, 20) }));
    buttons.push({ id: 'menu', title: 'Menu' });
    return sendPayload(config, phone, next, profile, buttonMessage(phone, lines.join('\n'), buttons));
  }
  return sendPayload(
    config,
    phone,
    next,
    profile,
    listMessage(phone, {
      header: config.clinicName,
      body: lines.join('\n'),
      button: 'Ver tipos',
      sectionTitle: 'Sessões',
      rows: types.map((type) => ({
        id: 'tipo:' + type.id,
        title: clip(type.label, 24),
        description: type.durationMinutes + ' min',
      })),
    }),
  );
}

function datePrompt(config, session, profile, phone, nowIso) {
  const duration = Number(session.durationMinutes) || 50;
  const dates = upcomingDates(config, new Date(nowIso), duration);
  if (!dates.length) {
    return sendText(config, phone, null, profile, 'Não há dias com horário livre no período configurado. Responda MENU para voltar.');
  }
  const next = withSession(session, nowIso, { step: 'pick_date', offeredDates: dates, date: null, slotStart: null, slotEnd: null });
  return sendPayload(
    config,
    phone,
    next,
    profile,
    listMessage(phone, {
      header: config.clinicName,
      body: dateBody(config, dates),
      button: 'Ver dias',
      sectionTitle: 'Dias',
      rows: dates.map((date) => ({ id: date.id, title: date.title, description: date.description })),
    }),
  );
}

function startReschedule(config, session, profile, phone, event, nowIso) {
  const pro = proForEvent(config, event);
  const typeLabel = field(event.description, 'Tipo') || 'Retorno';
  const known = config.sessionTypes.find((type) => norm(type.label) === norm(typeLabel));
  const startMs = new Date(event.start).getTime();
  const endMs = new Date(event.end).getTime();
  const duration = Number.isFinite(endMs - startMs) && endMs > startMs ? Math.round((endMs - startMs) / 60000) : (known && known.durationMinutes) || 50;
  const patient = field(event.description, 'Paciente');
  const named = patient ? { patientName: patient } : profile;
  const next = withSession(freshSession(nowIso), nowIso, {
    mode: 'reschedule',
    professionalId: pro.id,
    sessionTypeId: known ? known.id : null,
    typeLabel,
    durationMinutes: duration,
    eventId: event.eventId,
    eventCalendarId: pro.calendarId,
    ignoreStart: event.start,
    ignoreEnd: event.end,
  });
  return datePrompt(config, next, named, phone, nowIso);
}

function confirmPayload(config, phone, session, profile) {
  const pro = proById(config, session.professionalId);
  const when = whenLabel(session.slotStart, session.slotEnd, config.timezone);
  const lines = [
    session.mode === 'reschedule' ? 'Confira a remarcação:' : 'Confira o agendamento:',
    '',
    'Paciente: ' + (profile.patientName || ''),
    'Profissional: ' + ((pro && pro.name) || 'Fisioterapeuta'),
    'Tipo: ' + (session.typeLabel || 'Sessão') + ' (' + session.durationMinutes + ' min)',
    'Quando: ' + when,
  ];
  if (config.location) lines.push('Local: ' + config.location);
  lines.push('', 'A consulta só entra na agenda depois que você confirmar.', '1 - Confirmar', '2 - Outro horário', '0 - Menu');
  return buttonMessage(phone, lines.join('\n'), [
    { id: 'confirmar', title: 'Confirmar' },
    { id: 'outro', title: 'Outro horário' },
    { id: 'menu', title: 'Menu' },
  ]);
}

function slotsPayload(phone, config, offeredSlots, page, prefix) {
  const view = pageRows(offeredSlots, page);
  const lines = [];
  if (prefix) lines.push(prefix, '');
  lines.push('Horários livres:');
  lines.push('');
  view.visible.forEach((slot, index) => {
    lines.push(index + 1 + ' - ' + slot.title + ' às ' + slot.description.replace('até ', ''));
  });
  if (view.more) lines.push(view.visible.length + 1 + ' - Mais horários');
  lines.push('0 - Menu');
  const rows = view.visible.map((slot) => ({ id: slot.id, title: slot.title, description: slot.description }));
  if (view.more) rows.push({ id: 'mais', title: 'Mais horários', description: 'Ver os próximos' });
  return listMessage(phone, {
    header: config.clinicName,
    body: lines.join('\n'),
    button: 'Ver horários',
    sectionTitle: 'Livres',
    rows,
  });
}

function draftEvent(config, session, profile, phone) {
  const fromConfig = proById(config, session.professionalId);
  const pro = {
    id: (fromConfig && fromConfig.id) || session.professionalId || 'fisio-1',
    name: (fromConfig && fromConfig.name) || 'Fisioterapeuta',
    calendarId: session.eventCalendarId || (fromConfig && fromConfig.calendarId),
  };
  const typeLabel = session.typeLabel || 'Sessão';
  const summary = config.eventTitlePrefix + ' — ' + profile.patientName + ' (' + typeLabel + ')';
  const description = [
    'Paciente: ' + profile.patientName,
    'Telefone: ' + phone,
    'ID_PACIENTE: tel:' + phone,
    'Tipo: ' + typeLabel,
    'Profissional: ' + pro.name,
    'ID_PROFISSIONAL: ' + pro.id,
    'ID_CALENDARIO: ' + pro.calendarId,
    'Duração: ' + session.durationMinutes + ' min',
    'Canal: WhatsApp',
  ].join('\n');
  const reminders = reminderPair(config);
  return {
    summary,
    description,
    start: session.slotStart,
    end: session.slotEnd,
    calendarId: pro.calendarId,
    location: config.location || '',
    reminderMinutes: reminders,
  };
}

function reminderPair(config) {
  const list = Array.isArray(config.reminderMinutes) && config.reminderMinutes.length ? config.reminderMinutes.map(Number) : [1440, 60];
  if (list.length === 1) list.push(list[0]);
  return [list[0], list[1]];
}

function reminderText(config, event, lead) {
  const startIso = asIso(event.start);
  const endIso = asIso(event.end) || startIso;
  const when = whenLabel(startIso, endIso, config.timezone);
  const patient = field(event.description, 'Paciente');
  const tipo = field(event.description, 'Tipo');
  const pro = field(event.description, 'Profissional');
  const head = lead >= 120 ? 'Lembrete: você tem atendimento amanhã no ' + config.clinicName + '.' : 'Lembrete: seu atendimento no ' + config.clinicName + ' é daqui a cerca de 1 hora.';
  return [head, '', [patient, tipo && pro ? tipo + ' com ' + pro : tipo || pro].filter(Boolean).join('\n'), when, '', 'Se precisar remarcar ou cancelar, responda aqui.'].join('\n');
}

function upcomingDates(config, now, durationMinutes) {
  const today = localDateParts(now, config.timezone);
  const dates = [];
  const horizon = Number(config.daysAhead) || 21;
  const limit = Math.min(Number(config.maxDatesInList) || 8, 10);
  for (let offset = 0; offset <= horizon && dates.length < limit; offset += 1) {
    const ymd = addCalendarDays(today, offset);
    const weekday = weekdayOfLocalDate(ymd.year, ymd.month, ymd.day, config.timezone);
    if (!(config.businessDays || []).includes(weekday)) continue;
    const slots = slotsForDate(config, ymd, durationMinutes, now);
    if (!slots.length) continue;
    dates.push({
      id: 'data:' + ymdString(ymd),
      date: ymdString(ymd),
      title: WEEK_SHORT[weekday] + ' ' + pad(ymd.day) + '/' + pad(ymd.month),
      description: 'Horários de ' + durationMinutes + ' min',
    });
  }
  return dates;
}

function slotsForDate(config, ymd, durationMinutes, now) {
  const duration = Number(durationMinutes) || Number(config.slotMinutes) || 50;
  const step = Math.max(Number(config.slotMinutes) || duration, duration);
  const windows = [
    [parseMinutes(config.dayStart), parseMinutes(config.lunchStart)],
    [parseMinutes(config.lunchEnd), parseMinutes(config.dayEnd)],
  ];
  const lead = new Date(now.getTime() + (Number(config.minLeadMinutes) || 0) * 60000);
  const slots = [];
  for (const [open, close] of windows) {
    if (!(open < close)) continue;
    for (let minute = open; minute + duration <= close; minute += step) {
      const start = zonedLocalToUtc(ymd.year, ymd.month, ymd.day, Math.floor(minute / 60), minute % 60, config.timezone);
      const end = new Date(start.getTime() + duration * 60000);
      if (start < lead) continue;
      slots.push({
        start: toOffsetIso(start, config.timezone),
        end: toOffsetIso(end, config.timezone),
        startMs: start.getTime(),
        endMs: end.getTime(),
      });
    }
  }
  return slots;
}

function dateBody(config, dates) {
  const lines = ['Escolha o dia:', ''];
  dates.forEach((date, index) => lines.push(index + 1 + ' - ' + date.title));
  lines.push('0 - Menu');
  lines.push('', config.clinicName + ' · seg a sex, ' + config.dayStart + '–' + config.dayEnd + ', almoço ' + config.lunchStart + '–' + config.lunchEnd + '.');
  return lines.join('\n');
}

function menuReply(config, phone, profile, nowIso, prefix) {
  const lines = [];
  if (prefix) lines.push(prefix, '');
  lines.push('Olá! Aqui é o atendimento do ' + config.clinicName + '.');
  lines.push('');
  lines.push('Como posso ajudar?');
  lines.push('1 - Agendar');
  lines.push('2 - Remarcar');
  lines.push('3 - Cancelar');
  lines.push('4 - Ver meus horários');
  lines.push('');
  lines.push('Toque em Ver opções ou responda com o número.');
  return sendPayload(
    config,
    phone,
    null,
    profile,
    listMessage(phone, {
      header: config.clinicName,
      body: lines.join('\n'),
      button: 'Ver opções',
      sectionTitle: 'Atendimento',
      rows: [
        { id: 'agendar', title: 'Agendar', description: 'Marcar avaliação ou retorno' },
        { id: 'remarcar', title: 'Remarcar', description: 'Mudar data ou horário' },
        { id: 'cancelar', title: 'Cancelar', description: 'Desmarcar uma consulta' },
        { id: 'meus', title: 'Meus horários', description: 'Ver próximas consultas' },
      ],
    }),
  );
}

function sendText(config, phone, session, profile, body) {
  return sendPayload(config, phone, session, profile, textBody(phone, body));
}

function sendPayload(config, phone, session, profile, whatsappBody) {
  return {
    action: 'send',
    phone,
    session: session && session.step && session.step !== 'menu' ? session : null,
    profile,
    config: publicConfig(config),
    whatsappBody,
  };
}

function finish(result, config) {
  if (!result || result.action === 'send' || result.action === 'ignore') return result;
  const ids = [];
  if (result.calendarId) ids.push(result.calendarId);
  for (const calendar of result.calendars || []) ids.push(calendar.calendarId);
  if (!ids.length || ids.some(isPlaceholderCalendar)) {
    return sendText(
      config,
      result.phone,
      null,
      result.profile,
      'Ainda não consigo ver a agenda do consultório.\n\nQuem administra o n8n precisa preencher o calendarId no node "Configuração do consultório".\n\nResponda MENU quando estiver pronto.',
    );
  }
  return result;
}

function eventLine(config, event) {
  const start = asIso(event.start);
  const end = asIso(event.end);
  const tipo = field(event.description, 'Tipo');
  const pro = field(event.description, 'Profissional') || event.professionalName;
  return whenLabel(start, end, config.timezone) + (tipo || pro ? ' · ' + [tipo, pro].filter(Boolean).join(' com ') : '');
}

function askNameText(profileName) {
  const hint = profileName ? '\n\nSe estiver certo, pode responder: ' + profileName : '';
  return 'Qual é o nome completo do paciente?' + hint + '\n\nPara voltar, responda MENU.';
}

function isConfirm(choice) {
  return choice.id === 'confirmar' || choice.norm === 'confirmar' || choice.norm === 'sim' || pickedIndex(choice) === 1;
}

function commandFrom(choice, allowNumbers) {
  if (choice.id === 'agendar' || ['agendar', 'marcar', 'marcacao'].includes(choice.norm)) return 'book';
  if (choice.id === 'remarcar' || ['remarcar', 'reagendar'].includes(choice.norm)) return 'reschedule';
  if (choice.id === 'cancelar' || choice.id === 'desmarcar' || ['cancelar', 'desmarcar'].includes(choice.norm)) return 'cancel';
  if (choice.id === 'meus' || ['meus', 'meus horarios', 'ver', 'ver horarios', 'ver meus horarios', 'agenda'].includes(choice.norm)) return 'view';
  if (allowNumbers) {
    const n = pickedIndex(choice);
    if (n === 1) return 'book';
    if (n === 2) return 'reschedule';
    if (n === 3) return 'cancel';
    if (n === 4) return 'view';
  }
  return null;
}

function isMenuWord(choice) {
  return choice.id === 'menu' || MENU_WORDS.has(choice.norm);
}

function choiceOf(incoming) {
  return {
    id: String(incoming.choiceId || ''),
    text: String(incoming.text || '').trim(),
    norm: norm(incoming.text || incoming.choiceId || ''),
  };
}

function matchType(choice, types) {
  if (choice.id.startsWith('tipo:')) return types.find((type) => choice.id === 'tipo:' + type.id) || null;
  const n = pickedIndex(choice);
  if (n && types[n - 1]) return types[n - 1];
  return types.find((type) => choice.norm === norm(type.label) || choice.norm === norm(type.id)) || null;
}

function matchById(choice, professionals, prefix, offered) {
  const list = offered && offered.length ? offered : professionals.map((pro) => ({ id: prefix + pro.id, proId: pro.id }));
  let found = null;
  if (choice.id.startsWith(prefix)) found = list.find((item) => item.id === choice.id);
  if (!found) {
    const n = pickedIndex(choice);
    if (n && list[n - 1]) found = list[n - 1];
  }
  if (!found) return null;
  const id = found.proId || String(found.id).replace(prefix, '');
  return professionals.find((pro) => pro.id === id) || null;
}

function matchDate(choice, offered) {
  if (choice.id.startsWith('data:')) return offered.find((date) => date.id === choice.id) || null;
  const n = pickedIndex(choice);
  if (n && offered[n - 1]) return offered[n - 1];
  return offered.find((date) => norm(date.title) === choice.norm) || null;
}

function matchSlot(choice, offered, page) {
  const view = pageRows(offered, page);
  if (choice.id.startsWith('hora:')) return offered.find((slot) => slot.id === choice.id) || null;
  const n = pickedIndex(choice);
  if (n && view.visible[n - 1]) return view.visible[n - 1];
  return null;
}

function matchEvent(choice, offered) {
  if (choice.id.startsWith('evt:')) return offered.find((event) => event.id === choice.id) || null;
  const n = pickedIndex(choice);
  if (n && offered[n - 1]) return offered[n - 1];
  return null;
}

function pageRows(items, page) {
  const size = items.length > 10 ? 9 : 10;
  const start = Math.max(0, page) * size;
  const visible = items.slice(start, start + size);
  return { visible, more: start + size < items.length };
}

function cleanName(text) {
  const name = String(text || '').replace(/\s+/g, ' ').trim();
  if (name.length < 5 || name.length > 80) return '';
  if (!/[A-Za-zÀ-ÿ]/.test(name)) return '';
  if (!name.includes(' ')) return '';
  const asChoice = choiceOf({ text: name, choiceId: '' });
  if (commandFrom(asChoice, false) || isMenuWord(asChoice)) return '';
  return name;
}

function proById(config, id) {
  return (config.professionals || []).find((pro) => pro.id === id) || null;
}

function proForEvent(config, event) {
  const id = field(event.description, 'ID_PROFISSIONAL');
  const calendarId = field(event.description, 'ID_CALENDARIO') || event.calendarId;
  const known =
    (config.professionals || []).find((pro) => pro.id === id) ||
    (config.professionals || []).find((pro) => pro.calendarId === calendarId);
  return {
    id: (known && known.id) || id || 'evento',
    name: (known && known.name) || field(event.description, 'Profissional') || event.professionalName || 'Fisioterapeuta',
    calendarId: calendarId || (known && known.calendarId) || '',
  };
}

function eventPhone(description) {
  const tagged = field(description, 'ID_PACIENTE').replace(/^tel:/i, '');
  if (digits(tagged)) return digits(tagged);
  return digits(field(description, 'Telefone'));
}

function eventStartMs(event) {
  const iso = asIso(event.start);
  if (!iso || (event.start && event.start.date && !event.start.dateTime)) return NaN;
  return new Date(iso).getTime();
}

function field(description, name) {
  const prefix = name + ':';
  for (const line of String(description || '').split(/\r?\n/)) {
    if (line.startsWith(prefix)) return line.slice(prefix.length).trim();
  }
  return '';
}

function subtractInterval(busy, ignore) {
  if (!ignore || !ignore.start || !ignore.end) return busy || [];
  const i0 = new Date(ignore.start).getTime();
  const i1 = new Date(ignore.end).getTime();
  const out = [];
  for (const block of busy || []) {
    const b0 = new Date(block.start).getTime();
    const b1 = new Date(block.end).getTime();
    if (!(b0 < i1 && b1 > i0)) {
      out.push(block);
      continue;
    }
    if (b0 < i0) out.push({ start: block.start, end: ignore.start });
    if (b1 > i1) out.push({ start: ignore.end, end: block.end });
  }
  return out;
}

function isFree(slot, busy) {
  return !(busy || []).some((block) => slot.startMs < new Date(block.end).getTime() && slot.endMs > new Date(block.start).getTime());
}

function pushInterval(intervals, block) {
  const start = asIso(block && (block.start || block.from));
  const end = asIso(block && (block.end || block.to));
  if (start && end) intervals.push({ start, end });
}

function asIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value.dateTime) return value.dateTime;
  if (value.date) return value.date;
  return null;
}

function isPlaceholderCalendar(id) {
  const value = String(id || '').trim();
  if (!value) return true;
  if (value.includes('SEU_CALENDAR_ID')) return true;
  if (value.includes('COLOQUE_')) return true;
  return false;
}

function isExpired(session, now, config) {
  if (!session || !session.updatedAt) return false;
  const ttl = (Number(config.sessionTtlMinutes) || 120) * 60000;
  return now.getTime() - new Date(session.updatedAt).getTime() > ttl;
}

function freshSession(nowIso) {
  return {
    step: 'menu',
    mode: null,
    professionalId: null,
    sessionTypeId: null,
    typeLabel: null,
    durationMinutes: null,
    date: null,
    slotStart: null,
    slotEnd: null,
    eventId: null,
    eventCalendarId: null,
    ignoreStart: null,
    ignoreEnd: null,
    offeredDates: [],
    offeredSlots: [],
    offeredEvents: [],
    offeredPros: [],
    slotPage: 0,
    updatedAt: nowIso,
  };
}

function withSession(session, nowIso, patch) {
  return { ...session, ...patch, updatedAt: nowIso };
}

function listMessage(to, { header, body, button, sectionTitle, rows }) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: clip(body, 1024) },
      footer: { text: 'Responda com o número se preferir' },
      action: {
        button: clip(button, 20),
        sections: [
          {
            title: clip(sectionTitle || 'Opções', 24),
            rows: rows.slice(0, 10).map((row) => {
              const item = { id: clip(String(row.id), 200), title: clip(row.title, 24) };
              if (row.description) item.description = clip(row.description, 72);
              return item;
            }),
          },
        ],
      },
    },
  };
  if (header) payload.interactive.header = { type: 'text', text: clip(header, 60) };
  return payload;
}

function buttonMessage(to, body, buttons) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: clip(body, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((button) => ({
          type: 'reply',
          reply: { id: clip(String(button.id), 256), title: clip(button.title, 20) },
        })),
      },
    },
  };
}

function whenLabel(startIso, endIso, timeZone) {
  return formatLong(startIso, timeZone) + ', ' + formatTime(startIso, timeZone) + ' às ' + formatTime(endIso, timeZone);
}

function formatLong(iso, timeZone) {
  const ymd = localDateParts(new Date(iso), timeZone);
  const weekday = weekdayOfLocalDate(ymd.year, ymd.month, ymd.day, timeZone);
  return WEEK_LONG[weekday] + ', ' + pad(ymd.day) + '/' + pad(ymd.month) + '/' + ymd.year;
}

function formatDayShort(iso, timeZone) {
  const ymd = localDateParts(new Date(iso), timeZone);
  return pad(ymd.day) + '/' + pad(ymd.month);
}

function formatTime(iso, timeZone) {
  const parts = zonedParts(new Date(iso), timeZone);
  return pad(Number(parts.hour)) + ':' + pad(Number(parts.minute));
}

function localDateParts(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function weekdayOfLocalDate(year, month, day, timeZone) {
  const instant = zonedLocalToUtc(year, month, day, 12, 0, timeZone);
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(instant);
  return WEEK_FROM_EN[short];
}

function addCalendarDays(parts, days) {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function ymdString(ymd) {
  return ymd.year + '-' + pad(ymd.month) + '-' + pad(ymd.day);
}

function parseYmd(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function parseMinutes(hm) {
  const [hour, minute] = String(hm || '0:0').split(':').map(Number);
  return hour * 60 + minute;
}

function zonedLocalToUtc(year, month, day, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = timeZoneOffsetMs(timeZone, guess);
  const utc = new Date(guess.getTime() - offset);
  const offset2 = timeZoneOffsetMs(timeZone, utc);
  if (offset2 !== offset) return new Date(guess.getTime() - offset2);
  return utc;
}

function timeZoneOffsetMs(timeZone, date) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - date.getTime();
}

function toOffsetIso(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  const offset = timeZoneOffsetMs(timeZone, date);
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const hours = Math.floor(abs / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  return (
    parts.year +
    '-' +
    parts.month +
    '-' +
    parts.day +
    'T' +
    parts.hour +
    ':' +
    parts.minute +
    ':' +
    parts.second +
    sign +
    pad(hours) +
    ':' +
    pad(minutes)
  );
}

function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = part.value;
  }
  if (out.hour === '24') out.hour = '00';
  return out;
}

function pickedIndex(choice) {
  if (/^\d{1,2}$/.test(choice.text)) return Number(choice.text);
  return null;
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function clip(value, max) {
  const text = String(value || '');
  return text.length <= max ? text : text.slice(0, max);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
