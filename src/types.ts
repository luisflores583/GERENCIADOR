export interface Slot {
  start: string;
  end: string;
}

export interface Patient {
  phone: string;
  name: string;
  updatedAt: string;
}

export type Step =
  | 'awaiting_name'
  | 'menu'
  | 'choosing_slot'
  | 'confirming_booking'
  | 'choosing_booking'
  | 'confirming_cancel';

export type FlowAction = 'book' | 'reschedule' | 'cancel';

export interface BookingRef {
  eventId: string;
  start: string;
  end: string;
}

export interface Session {
  phone: string;
  step: Step;
  action?: FlowAction;
  queuedAction?: FlowAction;
  offeredSlots?: Slot[];
  page?: number;
  pendingSlot?: Slot;
  offeredBookings?: BookingRef[];
  selectedEventId?: string;
  updatedAt: string;
}

export interface OutgoingText {
  type: 'text';
  body: string;
}

export interface OutgoingButtons {
  type: 'buttons';
  body: string;
  buttons: { id: string; title: string }[];
}

export interface OutgoingList {
  type: 'list';
  header?: string;
  body: string;
  footer?: string;
  button: string;
  sectionTitle: string;
  rows: { id: string; title: string; description?: string }[];
}

export type Outgoing = OutgoingText | OutgoingButtons | OutgoingList;

export interface IncomingMessage {
  messageId: string;
  phone: string;
  profileName?: string;
  kind: 'text' | 'interactive' | 'unsupported';
  text?: string;
  replyId?: string;
  replyTitle?: string;
}

export interface CalendarEventBody {
  summary: string;
  description: string;
  start: string;
  end: string;
  timeZone: string;
  phone: string;
  patientName: string;
  messageId?: string;
}

export interface GoogleEvent {
  eventId: string;
  start: string;
  end: string;
  summary: string;
  phone?: string;
  messageId?: string;
}

export interface AvailabilityReport {
  timezone: string;
  open: string;
  close: string;
  sessionMinutes: number;
  daysAhead: number;
  auth: 'service_account' | 'oauth' | 'unconfigured';
  calendarId?: string;
  busy: Slot[];
  slots: Slot[];
}

export interface CalendarPort {
  inspect(): Promise<AvailabilityReport>;
  listFreeSlots(exclude?: Slot): Promise<Slot[]>;
  listBookings(phone: string): Promise<BookingRef[]>;
  findByMessageId(messageId: string): Promise<BookingRef | undefined>;
  book(input: { phone: string; name: string; slot: Slot; messageId: string }): Promise<{ eventId: string }>;
  reschedule(input: { eventId: string; slot: Slot; phone: string; name: string }): Promise<void>;
  cancel(eventId: string): Promise<void>;
}
