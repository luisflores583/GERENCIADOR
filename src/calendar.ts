import { DateTime } from 'luxon';
import type { ClinicConfig, GoogleConfig } from './config';
import { BookingNotFoundError, CalendarAccessError, SlotTakenError } from './errors';
import { createGoogleApi, statusOf, type GoogleCalendarApi } from './googleApi';
import { localDateTime } from './format';
import { calendarWindow, filterFreeSlots, generateCandidateSlots, normalizeBusy, sameInstant, subtractBusy } from './slots';
import type { AvailabilityReport, BookingRef, CalendarEventBody, CalendarPort, Slot } from './types';

export interface GoogleCalendarOptions {
  clinic: ClinicConfig;
  google: GoogleConfig;
  now?: () => DateTime;
  api?: GoogleCalendarApi;
}

export function createCalendar(options: {
  clinic: ClinicConfig;
  google: GoogleConfig;
  now?: () => DateTime;
}): CalendarPort {
  return new GoogleCalendar(options);
}

export class GoogleCalendar implements CalendarPort {
  private client: GoogleCalendarApi | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  private readonly now: () => DateTime;

  constructor(private readonly options: GoogleCalendarOptions) {
    this.now = options.now ?? (() => DateTime.now());
    if (options.api) this.client = options.api;
  }

  async inspect(): Promise<AvailabilityReport> {
    const loaded = await this.loadBusy();
    return {
      timezone: this.options.clinic.timezone,
      open: this.options.clinic.open,
      close: this.options.clinic.close,
      sessionMinutes: this.options.clinic.sessionMinutes,
      daysAhead: this.options.clinic.daysAhead,
      auth: this.options.google.mode,
      ...(this.options.google.mode === 'unconfigured' ? {} : { calendarId: this.options.google.calendarId }),
      busy: loaded.busy,
      slots: filterFreeSlots(generateCandidateSlots(this.now(), this.options.clinic), loaded.busy),
    };
  }

  async listFreeSlots(exclude?: Slot): Promise<Slot[]> {
    const loaded = await this.loadBusy();
    const busy = exclude ? subtractBusy(loaded.busy, exclude) : loaded.busy;
    return filterFreeSlots(generateCandidateSlots(this.now(), this.options.clinic), busy);
  }

  async listBookings(phone: string): Promise<BookingRef[]> {
    return this.run(async () => {
      const timeMin = this.now().toUTC().toISO({ suppressMilliseconds: true })!;
      const events = await this.api().listEvents({ phone, timeMin });
      return events
        .filter((event) => Date.parse(event.end) > this.now().toMillis())
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
        .map((event) => ({ eventId: event.eventId, start: event.start, end: event.end }));
    });
  }

  async findByMessageId(messageId: string): Promise<BookingRef | undefined> {
    return this.run(async () => {
      const events = await this.api().listEvents({ messageId });
      const found = events.find((event) => event.messageId === messageId);
      if (!found) return undefined;
      return { eventId: found.eventId, start: found.start, end: found.end };
    });
  }

  async book(input: { phone: string; name: string; slot: Slot; messageId: string }): Promise<{ eventId: string }> {
    return this.exclusive(() =>
      this.run(async () => {
        if (input.messageId) {
          const existing = await this.api().listEvents({ messageId: input.messageId });
          const already = existing.find((event) => event.messageId === input.messageId);
          if (already) return { eventId: already.eventId };
        }
        await this.assertOffered(input.slot);
        const eventId = await this.api().insertEvent(buildEventBody(input, this.options.clinic));
        return { eventId };
      }),
    );
  }

  async reschedule(input: { eventId: string; slot: Slot; phone: string; name: string }): Promise<void> {
    return this.exclusive(() =>
      this.run(async () => {
        const current = await this.api().getEvent(input.eventId);
        if (!current) throw new BookingNotFoundError();
        const slots = await this.listFreeSlots({ start: current.start, end: current.end });
        if (!slots.some((slot) => sameInstant(slot.start, input.slot.start))) throw new SlotTakenError();
        await this.api().patchEvent(input.eventId, buildEventBody({ ...input, messageId: current.messageId }, this.options.clinic));
      }),
    );
  }

  async cancel(eventId: string): Promise<void> {
    return this.exclusive(() =>
      this.run(async () => {
        try {
          await this.api().deleteEvent(eventId);
        } catch (err) {
          const status = statusOf(err);
          if (status === 404 || status === 410) return;
          throw err;
        }
      }),
    );
  }

  private async loadBusy(): Promise<{ busy: Slot[] }> {
    return this.run(async () => {
      const window = calendarWindow(this.now(), this.options.clinic);
      const result = await this.api().queryFreeBusy(window.timeMin, window.timeMax);
      if (result.error) {
        throw new CalendarAccessError(freeBusyHint(result.error));
      }
      return { busy: normalizeBusy(result.busy) };
    });
  }

  private async assertOffered(slot: Slot): Promise<void> {
    const slots = await this.listFreeSlots();
    if (!slots.some((candidate) => sameInstant(candidate.start, slot.start))) {
      throw new SlotTakenError();
    }
  }

  private api(): GoogleCalendarApi {
    if (this.client) return this.client;
    if (this.options.google.mode === 'unconfigured') {
      throw new CalendarAccessError(
        'Google Calendar não configurado. Defina GOOGLE_SERVICE_ACCOUNT_JSON e GOOGLE_CALENDAR_ID.',
      );
    }
    this.client = createGoogleApi(this.options.google, this.options.clinic.timezone);
    return this.client;
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof SlotTakenError || err instanceof BookingNotFoundError || err instanceof CalendarAccessError) {
        throw err;
      }
      throw mapGoogleError(err);
    }
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export function buildEventBody(
  input: { phone: string; name: string; slot: Slot; messageId?: string },
  clinic: ClinicConfig,
): CalendarEventBody {
  return {
    summary: `Fisioterapia — ${input.name}`,
    description: `Paciente: ${input.name}\nTelefone: ${input.phone}\nOrigem: WhatsApp`,
    start: localDateTime(input.slot.start, clinic.timezone),
    end: localDateTime(input.slot.end, clinic.timezone),
    timeZone: clinic.timezone,
    phone: input.phone,
    patientName: input.name,
    ...(input.messageId ? { messageId: input.messageId } : {}),
  };
}

function freeBusyHint(reason: string): string {
  if (reason.includes('notFound')) {
    return 'Agenda não encontrada. Confira GOOGLE_CALENDAR_ID e compartilhe a agenda com o e-mail da conta de serviço.';
  }
  return `A agenda recusou a consulta (${reason}). Confira o compartilhamento e o GOOGLE_CALENDAR_ID.`;
}

export function mapGoogleError(err: unknown): CalendarAccessError {
  const status = statusOf(err);
  if (status === 404) {
    return new CalendarAccessError(
      'Calendário não encontrado. Confira GOOGLE_CALENDAR_ID e se a agenda foi compartilhada com a conta de serviço.',
    );
  }
  if (status === 403) {
    return new CalendarAccessError(
      'Sem permissão para alterar a agenda. Compartilhe a agenda com o e-mail da conta de serviço, com permissão para fazer alterações nos eventos.',
    );
  }
  const message = err instanceof Error ? err.message : 'Falha ao falar com o Google Calendar.';
  return new CalendarAccessError(message);
}
