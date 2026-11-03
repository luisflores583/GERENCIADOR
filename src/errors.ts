export class SlotTakenError extends Error {
  constructor() {
    super('slot_taken');
    this.name = 'SlotTakenError';
  }
}

export class BookingNotFoundError extends Error {
  constructor() {
    super('booking_not_found');
    this.name = 'BookingNotFoundError';
  }
}

export class CalendarAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarAccessError';
  }
}
