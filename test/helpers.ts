import type { ClinicConfig } from '../src/config';
import type { BookingRef, CalendarPort, Outgoing, Slot } from '../src/types';
import type { WhatsAppSender } from '../src/whatsapp';
import { toWhatsAppPayload } from '../src/whatsapp';

export function testClinic(overrides: Partial<ClinicConfig> = {}): ClinicConfig {
  return {
    name: 'Consultório de Fisioterapia',
    timezone: 'America/Sao_Paulo',
    open: '08:00',
    close: '18:00',
    sessionMinutes: 50,
    daysAhead: 7,
    weekdays: [1, 2, 3, 4, 5],
    minNoticeMinutes: 0,
    ...overrides,
  };
}

export function assertSendable(replies: Outgoing[]): void {
  for (const reply of replies) {
    toWhatsAppPayload('5511999999999', reply);
  }
}

export class FakeCalendar implements CalendarPort {
  slots: Slot[] = [];
  bookings: BookingRef[] = [];
  booked: { phone: string; name: string; slot: Slot; messageId: string }[] = [];
  rescheduled: { eventId: string; slot: Slot; phone: string; name: string }[] = [];
  cancelled: string[] = [];
  excluded: Slot[] = [];
  byMessage = new Map<string, BookingRef>();
  listError: Error | null = null;
  bookError: Error | null = null;

  async inspect() {
    if (this.listError) throw this.listError;
    return {
      timezone: 'America/Sao_Paulo',
      open: '08:00',
      close: '18:00',
      sessionMinutes: 50,
      daysAhead: 7,
      auth: 'service_account' as const,
      calendarId: 'agenda-teste',
      busy: [],
      slots: this.slots,
    };
  }

  async listFreeSlots(exclude?: Slot): Promise<Slot[]> {
    if (exclude) this.excluded.push(exclude);
    if (this.listError) throw this.listError;
    return this.slots;
  }

  async listBookings(): Promise<BookingRef[]> {
    if (this.listError) throw this.listError;
    return this.bookings;
  }

  async findByMessageId(messageId: string): Promise<BookingRef | undefined> {
    return this.byMessage.get(messageId);
  }

  async book(input: { phone: string; name: string; slot: Slot; messageId: string }): Promise<{ eventId: string }> {
    this.booked.push(input);
    if (this.bookError) throw this.bookError;
    return { eventId: 'evt-1' };
  }

  async reschedule(input: { eventId: string; slot: Slot; phone: string; name: string }): Promise<void> {
    this.rescheduled.push(input);
    if (this.bookError) throw this.bookError;
  }

  async cancel(eventId: string): Promise<void> {
    this.cancelled.push(eventId);
    if (this.bookError) throw this.bookError;
  }
}

export class FakeWhatsApp implements WhatsAppSender {
  sent: { to: string; message: Outgoing }[] = [];
  fail = false;

  async send(to: string, message: Outgoing): Promise<void> {
    if (this.fail) throw new Error('rede');
    this.sent.push({ to, message });
  }

  async markRead(): Promise<void> {}
}
