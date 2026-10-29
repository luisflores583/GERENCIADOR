import { DateTime } from 'luxon';
import type { ClinicConfig } from './config';
import { BookingNotFoundError, CalendarAccessError, SlotTakenError } from './errors';
import {
  digits,
  firstName,
  formatSlotLong,
  formatSlotShort,
  formatTime,
  normalize,
  parsePatientName,
  scheduleFooter,
  weekdayPhrase,
} from './format';
import { logger, maskPhone } from './logger';
import { paginate, sameInstant } from './slots';
import type { Store } from './store';
import type {
  BookingRef,
  CalendarPort,
  FlowAction,
  IncomingMessage,
  Outgoing,
  Session,
  Slot,
} from './types';

export interface FlowDeps {
  now: () => DateTime;
  clinic: ClinicConfig;
  store: Store;
  calendar: CalendarPort;
}

const MENU_BUTTONS = [
  { id: 'book', title: 'Agendar' },
  { id: 'reschedule', title: 'Remarcar' },
  { id: 'cancel', title: 'Cancelar' },
] as const;

export async function handleMessage(message: IncomingMessage, deps: FlowDeps): Promise<Outgoing[]> {
  const phone = digits(message.phone);
  if (phone.length < 8 || phone.length > 15) return [];

  const clinic = deps.clinic;
  let patient = deps.store.getPatient(phone);
  let session = deps.store.getSession(phone) ?? freshSession(phone, deps.now());
  let intent = toIntent(message);

  const save = (): void => {
    session.updatedAt = deps.now().toISO() ?? new Date().toISOString();
    deps.store.saveSession(session);
  };

  const menu = (body: string): Outgoing => ({
    type: 'buttons',
    body,
    buttons: MENU_BUTTONS.map((button) => ({ ...button })),
  });

  function resetFlow(): void {
    session.step = 'menu';
    session.action = undefined;
    session.queuedAction = undefined;
    session.offeredSlots = undefined;
    session.page = 0;
    session.pendingSlot = undefined;
    session.offeredBookings = undefined;
    session.selectedEventId = undefined;
  }

  function showMenu(body: string): Outgoing[] {
    resetFlow();
    save();
    return [menu(body)];
  }

  const shortMenu = (name: string): string => `Olá, ${firstName(name)}! O que você quer fazer?`;

  async function showSlots(intro?: string): Promise<Outgoing[]> {
    const exclude = excludeSlot();
    let slots: Slot[];
    try {
      slots = await deps.calendar.listFreeSlots(exclude);
    } catch (err) {
      return calendarFailure(err);
    }
    if (exclude) slots = slots.filter((slot) => !sameInstant(slot.start, exclude.start));
    session.offeredSlots = slots;
    session.page = 0;
    session.pendingSlot = undefined;
    if (slots.length === 0) {
      const empty =
        session.action === 'reschedule'
          ? 'Não há outros horários livres nos próximos dias. Tente de novo mais tarde.'
          : `Não há horários livres nos próximos ${clinic.daysAhead} dias (${weekdayPhrase(clinic.weekdays)}). Tente de novo mais tarde.`;
      return showMenu(intro ? `${intro}\n\n${empty}` : empty);
    }
    session.step = 'choosing_slot';
    save();
    return [renderSlotList(intro)];
  }

  function excludeSlot(): Slot | undefined {
    if (session.action !== 'reschedule' || !session.selectedEventId) return undefined;
    return session.offeredBookings?.find((booking) => booking.eventId === session.selectedEventId);
  }

  function renderSlotList(intro?: string): Outgoing {
    const slots = session.offeredSlots ?? [];
    const page = paginate(slots, session.page ?? 0);
    session.page = page.page;
    const rows = page.items.map((slot, index) => ({
      id: `slot:${page.offset + index}`,
      title: formatSlotShort(slot.start, clinic.timezone),
      description: `até ${formatTime(slot.end, clinic.timezone)}`,
    }));
    if (page.hasPrev) rows.push({ id: 'page:prev', title: 'Anteriores', description: 'Página anterior' });
    if (page.hasNext) rows.push({ id: 'page:next', title: 'Mais horários', description: 'Próxima página' });
    const paging = page.hasPrev || page.hasNext ? `\nPágina ${page.page + 1}.` : '';
    const base = `Escolha um horário livre. A sessão dura ${clinic.sessionMinutes} minutos.`;
    return {
      type: 'list',
      header: clinic.name.slice(0, 60),
      body: `${intro ? `${intro}\n\n` : ''}${base}${paging}`,
      footer: scheduleFooter(clinic),
      button: 'Ver horários',
      sectionTitle: 'Horários livres',
      rows,
    };
  }

  function renderBookingList(body: string): Outgoing {
    const bookings = (session.offeredBookings ?? []).slice(0, 10);
    return {
      type: 'list',
      header: clinic.name.slice(0, 60),
      body,
      footer: scheduleFooter(clinic),
      button: 'Ver sessões',
      sectionTitle: 'Suas sessões',
      rows: bookings.map((booking, index) => ({
        id: `booking:${index}`,
        title: formatSlotShort(booking.start, clinic.timezone),
        description: 'Toque para escolher',
      })),
    };
  }

  function calendarFailure(err: unknown): Outgoing[] {
    if (!(err instanceof CalendarAccessError)) throw err;
    logger.error('calendar_access', {
      phone: maskPhone(phone),
      message: err.message,
    });
    return showMenu('Não consegui acessar a agenda agora. Tente de novo em alguns minutos.');
  }

  async function startBook(intro?: string): Promise<Outgoing[]> {
    session.action = 'book';
    session.selectedEventId = undefined;
    session.offeredBookings = undefined;
    return showSlots(intro);
  }

  async function startReschedule(): Promise<Outgoing[]> {
    let bookings: BookingRef[];
    try {
      bookings = await deps.calendar.listBookings(phone);
    } catch (err) {
      return calendarFailure(err);
    }
    if (bookings.length === 0) {
      return showMenu('Você não tem sessão futura para remarcar.');
    }
    session.action = 'reschedule';
    session.offeredBookings = bookings;
    if (bookings.length === 1) {
      session.selectedEventId = bookings[0]!.eventId;
      return showSlots(`Vamos remarcar a sessão de ${formatSlotLong(bookings[0]!.start, clinic.timezone)}.`);
    }
    session.step = 'choosing_booking';
    session.selectedEventId = undefined;
    save();
    return [renderBookingList('Qual sessão você quer remarcar?')];
  }

  async function startCancel(): Promise<Outgoing[]> {
    let bookings: BookingRef[];
    try {
      bookings = await deps.calendar.listBookings(phone);
    } catch (err) {
      return calendarFailure(err);
    }
    if (bookings.length === 0) {
      return showMenu('Você não tem sessão futura para cancelar.');
    }
    session.action = 'cancel';
    session.offeredBookings = bookings;
    if (bookings.length === 1) {
      session.selectedEventId = bookings[0]!.eventId;
      session.step = 'confirming_cancel';
      save();
      return [confirmCancel(bookings[0]!)];
    }
    session.step = 'choosing_booking';
    session.selectedEventId = undefined;
    save();
    return [renderBookingList('Qual sessão você quer cancelar?')];
  }

  function confirmCancel(booking: BookingRef): Outgoing {
    return {
      type: 'buttons',
      body: `Cancelar a sessão de ${formatSlotLong(booking.start, clinic.timezone)}? Esse horário volta a ficar livre.`,
      buttons: [
        { id: 'cancel_yes', title: 'Sim, cancelar' },
        { id: 'cancel_no', title: 'Manter sessão' },
      ],
    };
  }

  function confirmSlot(slot: Slot): Outgoing {
    const when = formatSlotLong(slot.start, clinic.timezone);
    const body =
      session.action === 'reschedule'
        ? `Remarcar para ${when}? A sessão atual passa para esse horário.`
        : `Posso reservar ${when} para ${patient?.name}? A sessão dura ${clinic.sessionMinutes} minutos.`;
    return {
      type: 'buttons',
      body,
      buttons: [
        { id: 'confirm', title: 'Confirmar' },
        { id: 'other', title: 'Outro horário' },
        { id: 'back', title: 'Voltar' },
      ],
    };
  }

  async function chooseSlot(): Promise<Outgoing[]> {
    if (!session.offeredSlots?.length) return showSlots();
    const selectedId = replyIdOf(intent);
    if (selectedId === 'page:next' || selectedId === 'page:prev') {
      session.page = (session.page ?? 0) + (selectedId === 'page:next' ? 1 : -1);
      const list = renderSlotList();
      save();
      return [list];
    }
    const index = indexFrom(selectedId, 'slot:');
    const slot = index === undefined ? undefined : session.offeredSlots?.[index];
    if (!slot) {
      if (!session.offeredSlots?.length) return showSlots('Toque em Ver horários e escolha um horário da lista.');
      return [renderSlotList('Toque em Ver horários e escolha um horário da lista.')];
    }
    session.pendingSlot = slot;
    session.step = 'confirming_booking';
    save();
    return [confirmSlot(slot)];
  }

  async function chooseBooking(): Promise<Outgoing[]> {
    if (!session.offeredBookings?.length) {
      return session.action === 'cancel' ? startCancel() : startReschedule();
    }
    const index = indexFrom(replyIdOf(intent), 'booking:');
    const booking = index === undefined ? undefined : session.offeredBookings?.[index];
    if (!booking) {
      const verb = session.action === 'cancel' ? 'cancelar' : 'remarcar';
      return [renderBookingList(`Toque em Ver sessões e escolha qual sessão ${verb}.`)];
    }
    session.selectedEventId = booking.eventId;
    if (session.action === 'cancel') {
      session.step = 'confirming_cancel';
      save();
      return [confirmCancel(booking)];
    }
    return showSlots();
  }

  async function answerBooking(choice: 'confirm' | 'other' | 'back'): Promise<Outgoing[]> {
    if (choice === 'back') return showMenu(patient ? shortMenu(patient.name) : 'O que você quer fazer?');
    if (choice === 'other') return showSlots();
    const slot = session.pendingSlot;
    if (!slot || !patient) return startBook();
    try {
      if (session.action === 'reschedule') {
        if (!session.selectedEventId) return startReschedule();
        await deps.calendar.reschedule({
          eventId: session.selectedEventId,
          slot,
          phone,
          name: patient.name,
        });
        return showMenu(`Pronto, ${firstName(patient.name)}! Sessão remarcada para ${formatSlotLong(slot.start, clinic.timezone)}.`);
      }
      await deps.calendar.book({ phone, name: patient.name, slot, messageId: message.messageId });
      return showMenu(
        `Pronto, ${firstName(patient.name)}! Sessão marcada para ${formatSlotLong(slot.start, clinic.timezone)}. Se precisar, remarque ou cancele por aqui.`,
      );
    } catch (err) {
      if (err instanceof SlotTakenError) {
        return showSlots('Esse horário acabou de ser preenchido. Escolha outro, por favor.');
      }
      if (err instanceof BookingNotFoundError) {
        return showMenu('Não encontrei mais essa sessão na agenda. Ela pode ter sido cancelada.');
      }
      return calendarFailure(err);
    }
  }

  async function answerCancel(choice: 'yes' | 'no'): Promise<Outgoing[]> {
    const booking = session.offeredBookings?.find((item) => item.eventId === session.selectedEventId);
    if (choice === 'no') {
      const kept = booking
        ? `Tudo bem. A sessão de ${formatSlotLong(booking.start, clinic.timezone)} continua marcada.`
        : 'Tudo bem. A sessão continua marcada.';
      return showMenu(kept);
    }
    if (!session.selectedEventId) return startCancel();
    try {
      await deps.calendar.cancel(session.selectedEventId);
      const when = booking ? formatSlotLong(booking.start, clinic.timezone) : 'escolhida';
      return showMenu(`Sessão de ${when} cancelada. O horário foi liberado.`);
    } catch (err) {
      if (err instanceof BookingNotFoundError) {
        return showMenu('Essa sessão já não está na agenda.');
      }
      return calendarFailure(err);
    }
  }

  if (intent.kind === 'unsupported') {
    const hint = 'Consigo responder texto e os botões desta conversa. Áudio, imagem e figurinha eu não leio.';
    if (!patient) {
      session.step = 'awaiting_name';
      save();
      return [{ type: 'text', body: `${hint}\n\n${askName(clinic)}` }];
    }
    return [{ type: 'text', body: hint }, menu(shortMenu(patient.name))];
  }

  if (!patient) {
    if (intent.kind === 'text' && intent.text) {
      const name = parsePatientName(intent.text);
      if (name) {
        patient = { phone, name, updatedAt: deps.now().toISO() ?? new Date().toISOString() };
        deps.store.savePatient(patient);
        const queued = session.queuedAction;
        session.queuedAction = undefined;
        const welcome = welcomeText(clinic, name);
        if (queued === 'book') return [{ type: 'text', body: welcome }, ...(await startBook())];
        if (queued === 'reschedule') return [{ type: 'text', body: welcome }, ...(await startReschedule())];
        if (queued === 'cancel') return [{ type: 'text', body: welcome }, ...(await startCancel())];
        return showMenu(welcome);
      }
      if (session.step === 'awaiting_name') {
        const queued = queueable(intent);
        if (queued) session.queuedAction = queued;
        save();
        return [{ type: 'text', body: 'Não consegui usar esse nome. Envie seu nome e sobrenome, por exemplo: Maria Silva.' }];
      }
    }
    const queued = queueable(intent);
    session.step = 'awaiting_name';
    if (queued) session.queuedAction = queued;
    save();
    return [{ type: 'text', body: askName(clinic) }];
  }

  const known = patient;
  intent = withNumberChoice(intent, session);

  if (replyIdOf(intent) === 'confirm' && session.step !== 'confirming_booking') {
    try {
      const existing = await deps.calendar.findByMessageId(message.messageId);
      if (existing) {
        return showMenu(
          `Pronto, ${firstName(known.name)}! Sessão marcada para ${formatSlotLong(existing.start, clinic.timezone)}. Se precisar, remarque ou cancele por aqui.`,
        );
      }
    } catch (err) {
      logger.warn('confirmacao_idempotente', { message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (session.step === 'confirming_booking') {
    const choice = bookingChoice(intent);
    if (choice) return answerBooking(choice);
  }
  if (session.step === 'confirming_cancel') {
    const choice = cancelChoice(intent);
    if (choice) return answerCancel(choice);
  }

  const global = globalAction(intent);
  if (global === 'menu') return showMenu(shortMenu(known.name));
  if (global === 'book') return startBook();
  if (global === 'reschedule') return startReschedule();
  if (global === 'cancel') return startCancel();

  switch (session.step) {
    case 'choosing_slot':
      return chooseSlot();
    case 'confirming_booking':
      return session.pendingSlot ? [confirmSlot(session.pendingSlot)] : startBook();
    case 'choosing_booking':
      return chooseBooking();
    case 'confirming_cancel': {
      const booking = session.offeredBookings?.find((item) => item.eventId === session.selectedEventId);
      return booking ? [confirmCancel(booking)] : startCancel();
    }
    default:
      return showMenu(
        `Não entendi, ${firstName(known.name)}. Responda com o número da opção ou escreva: agendar, remarcar ou cancelar.`,
      );
  }
}

function freshSession(phone: string, now: DateTime): Session {
  return {
    phone,
    step: 'menu',
    updatedAt: now.toISO() ?? new Date().toISOString(),
  };
}

function askName(clinic: ClinicConfig): string {
  return `Olá! Aqui é o atendimento do ${clinic.name}. Vou te ajudar a marcar, remarcar ou cancelar sua sessão de fisioterapia.\n\nComo você se chama? Envie nome e sobrenome.`;
}

function welcomeText(clinic: ClinicConfig, name: string): string {
  return `Prazer, ${name}! Aqui é o atendimento do ${clinic.name}.\n\nAs sessões duram ${clinic.sessionMinutes} minutos, das ${clinic.open} às ${clinic.close} (${weekdayPhrase(clinic.weekdays)}).\n\nO que você quer fazer?`;
}

type Intent =
  | { kind: 'unsupported' }
  | { kind: 'text'; text: string; normalized: string }
  | { kind: 'reply'; replyId: string; title?: string };

function toIntent(message: IncomingMessage): Intent {
  if (message.kind === 'unsupported') return { kind: 'unsupported' };
  if (message.kind === 'interactive' && message.replyId) {
    return { kind: 'reply', replyId: message.replyId, ...(message.replyTitle ? { title: message.replyTitle } : {}) };
  }
  const text = message.text?.trim() ?? '';
  return { kind: 'text', text, normalized: normalize(text) };
}

function globalAction(intent: Intent): FlowAction | 'menu' | undefined {
  if (intent.kind === 'unsupported') return undefined;
  if (intent.kind === 'reply') {
    if (intent.replyId === 'book') return 'book';
    if (intent.replyId === 'reschedule') return 'reschedule';
    if (intent.replyId === 'cancel') return 'cancel';
    if (intent.replyId === 'menu' || intent.replyId === 'back') return 'menu';
    return undefined;
  }
  if (['agendar', 'marcar'].includes(intent.normalized)) return 'book';
  if (['remarcar', 'reagendar'].includes(intent.normalized)) return 'reschedule';
  if (['cancelar', 'desmarcar'].includes(intent.normalized)) return 'cancel';
  if (['menu', 'inicio', 'voltar', 'oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'ajuda', 'comecar'].includes(intent.normalized)) {
    return 'menu';
  }
  return undefined;
}

function queueable(intent: Intent): FlowAction | undefined {
  const action = globalAction(intent);
  return action && action !== 'menu' ? action : undefined;
}

function bookingChoice(intent: Intent): 'confirm' | 'other' | 'back' | undefined {
  if (intent.kind === 'reply') {
    if (intent.replyId === 'confirm') return 'confirm';
    if (intent.replyId === 'other') return 'other';
    if (intent.replyId === 'back') return 'back';
    return undefined;
  }
  if (intent.kind !== 'text') return undefined;
  if (['sim', 'confirmar', 'confirma', 'ok', 'pode'].includes(intent.normalized)) return 'confirm';
  if (['outro', 'outro horario', 'trocar'].includes(intent.normalized)) return 'other';
  if (['voltar', 'menu', 'inicio'].includes(intent.normalized)) return 'back';
  return undefined;
}

function cancelChoice(intent: Intent): 'yes' | 'no' | undefined {
  if (intent.kind === 'reply') {
    if (intent.replyId === 'cancel_yes') return 'yes';
    if (intent.replyId === 'cancel_no') return 'no';
    return undefined;
  }
  if (intent.kind !== 'text') return undefined;
  if (['sim', 'confirmar', 'confirma', 'pode', 'cancelar', 'desmarcar', 'sim cancelar'].includes(intent.normalized)) return 'yes';
  if (['nao', 'manter', 'manter sessao', 'voltar', 'menu'].includes(intent.normalized)) return 'no';
  return undefined;
}

function replyIdOf(intent: Intent): string | undefined {
  return intent.kind === 'reply' ? intent.replyId : undefined;
}

function withNumberChoice(intent: Intent, session: Session): Intent {
  if (intent.kind !== 'text' || !/^\d{1,2}$/.test(intent.normalized)) return intent;
  const choice = Number(intent.normalized);
  const replyId = replyIdForNumber(session, choice);
  return replyId ? { kind: 'reply', replyId } : intent;
}

function replyIdForNumber(session: Session, choice: number): string | undefined {
  if (choice < 1) return undefined;
  if (session.step === 'menu') return ['book', 'reschedule', 'cancel'][choice - 1];
  if (session.step === 'confirming_booking') return ['confirm', 'other', 'back'][choice - 1];
  if (session.step === 'confirming_cancel') return ['cancel_yes', 'cancel_no'][choice - 1];
  if (session.step === 'choosing_booking') {
    const total = Math.min(session.offeredBookings?.length ?? 0, 10);
    return choice <= total ? `booking:${choice - 1}` : undefined;
  }
  if (session.step === 'choosing_slot') {
    const page = paginate(session.offeredSlots ?? [], session.page ?? 0);
    const ids = page.items.map((_, index) => `slot:${page.offset + index}`);
    if (page.hasPrev) ids.push('page:prev');
    if (page.hasNext) ids.push('page:next');
    return ids[choice - 1];
  }
  return undefined;
}

function indexFrom(replyId: string | undefined, prefix: string): number | undefined {
  if (!replyId?.startsWith(prefix)) return undefined;
  const value = Number(replyId.slice(prefix.length));
  if (!Number.isInteger(value) || value < 0) return undefined;
  return value;
}
