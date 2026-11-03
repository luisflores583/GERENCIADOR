import { DateTime } from 'luxon';
import type { ClinicConfig } from './config';
import { parseClock } from './config';
import type { Slot } from './types';

export function calendarWindow(now: DateTime, clinic: ClinicConfig): { timeMin: string; timeMax: string } {
  const start = now.setZone(clinic.timezone).startOf('day');
  const end = start.plus({ days: clinic.daysAhead });
  return {
    timeMin: start.toUTC().toISO({ suppressMilliseconds: true })!,
    timeMax: end.toUTC().toISO({ suppressMilliseconds: true })!,
  };
}

export function generateCandidateSlots(now: DateTime, clinic: ClinicConfig): Slot[] {
  const zone = clinic.timezone;
  const localNow = now.setZone(zone);
  const open = parseClock(clinic.open, 'CLINIC_OPEN');
  const close = parseClock(clinic.close, 'CLINIC_CLOSE');
  const earliest = localNow.plus({ minutes: clinic.minNoticeMinutes });
  const startDay = localNow.startOf('day');
  const slots: Slot[] = [];

  for (let dayOffset = 0; dayOffset < clinic.daysAhead; dayOffset += 1) {
    const day = startDay.plus({ days: dayOffset });
    if (!clinic.weekdays.includes(day.weekday)) continue;
    let cursor = day.set({ hour: open.hour, minute: open.minute, second: 0, millisecond: 0 });
    const endOfDay = day.set({ hour: close.hour, minute: close.minute, second: 0, millisecond: 0 });
    while (cursor.plus({ minutes: clinic.sessionMinutes }) <= endOfDay) {
      const end = cursor.plus({ minutes: clinic.sessionMinutes });
      if (cursor.toMillis() >= earliest.toMillis()) {
        slots.push({
          start: cursor.toISO({ suppressMilliseconds: true })!,
          end: end.toISO({ suppressMilliseconds: true })!,
        });
      }
      cursor = end;
    }
  }

  return slots;
}

export function overlaps(a: Slot, b: Slot): boolean {
  const startA = Date.parse(a.start);
  const endA = Date.parse(a.end);
  const startB = Date.parse(b.start);
  const endB = Date.parse(b.end);
  if ([startA, endA, startB, endB].some((value) => Number.isNaN(value))) return false;
  return startA < endB && endA > startB;
}

export function sameInstant(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b);
}

export function normalizeBusy(busy: { start?: string | null; end?: string | null }[]): Slot[] {
  const intervals: Slot[] = [];
  for (const block of busy) {
    if (!block.start || !block.end) continue;
    if (Date.parse(block.end) <= Date.parse(block.start)) continue;
    intervals.push({ start: block.start, end: block.end });
  }
  return intervals;
}

export function subtractBusy(busy: Slot[], cut: Slot): Slot[] {
  const cutStart = Date.parse(cut.start);
  const cutEnd = Date.parse(cut.end);
  if (Number.isNaN(cutStart) || Number.isNaN(cutEnd) || cutEnd <= cutStart) return busy.slice();

  const result: Slot[] = [];
  for (const block of busy) {
    const blockStart = Date.parse(block.start);
    const blockEnd = Date.parse(block.end);
    if (Number.isNaN(blockStart) || Number.isNaN(blockEnd)) continue;
    if (cutEnd <= blockStart || cutStart >= blockEnd) {
      result.push(block);
      continue;
    }
    if (cutStart > blockStart) result.push({ start: block.start, end: cut.start });
    if (cutEnd < blockEnd) result.push({ start: cut.end, end: block.end });
  }
  return result;
}

export function filterFreeSlots(slots: Slot[], busy: Slot[]): Slot[] {
  return slots.filter((slot) => !busy.some((block) => overlaps(slot, block)));
}

export function paginate<T>(items: T[], page: number, maxRows = 10): {
  page: number;
  items: T[];
  offset: number;
  hasPrev: boolean;
  hasNext: boolean;
} {
  if (items.length <= maxRows) {
    return { page: 0, items: items.slice(), offset: 0, hasPrev: false, hasNext: false };
  }
  const size = maxRows - 2;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const safe = Math.max(0, Math.min(page, pages - 1));
  const offset = safe * size;
  return {
    page: safe,
    items: items.slice(offset, offset + size),
    offset,
    hasPrev: safe > 0,
    hasNext: offset + size < items.length,
  };
}
