import { COURTS } from "./constants";
import { durationMinutes, formatClock, formatDayHeading, saoPauloToUtc, spParts } from "./time";

export type Interval = { start: number; end: number };

export type AvailabilitySlot = {
  dayOfWeek: number;
  startMin: number;
  endMin: number;
};

export type BusyChallenge = {
  id: string;
  court: string;
  startAt: Date;
  endAt: Date;
  challengerPairId: string;
  challengedPairId: string;
  status: string;
};

export type SlotOption = {
  id: string;
  startIso: string;
  endIso: string;
  dayLabel: string;
  timeLabel: string;
  courts: string[];
};

const ACTIVE = new Set(["pending", "countered", "accepted"]);

export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const left of a) {
    for (const right of b) {
      const start = Math.max(left.start, right.start);
      const end = Math.min(left.end, right.end);
      if (end > start) out.push({ start, end });
    }
  }
  return mergeIntervals(out);
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) merged.push({ ...interval });
    else last.end = Math.max(last.end, interval.end);
  }
  return merged;
}

export function intersectAvailability(
  users: { availability: AvailabilitySlot[] }[],
  dayOfWeek: number,
): Interval[] {
  let current: Interval[] | null = null;
  for (const user of users) {
    const mine = user.availability
      .filter((slot) => slot.dayOfWeek === dayOfWeek)
      .map((slot) => ({ start: slot.startMin, end: slot.endMin }));
    current = current === null ? mergeIntervals(mine) : intersectIntervals(current, mine);
  }
  return current ?? [];
}

export function userCovers(slots: AvailabilitySlot[], start: Date, end: Date): boolean {
  const startParts = spParts(start);
  const endParts = spParts(end);
  if (startParts.dateKey !== endParts.dateKey) return false;
  return slots.some(
    (slot) =>
      slot.dayOfWeek === startParts.dayOfWeek &&
      slot.startMin <= startParts.minutes &&
      slot.endMin >= endParts.minutes,
  );
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function pairIsBusy(
  challenges: BusyChallenge[],
  start: Date,
  end: Date,
  pairIds: string[],
  ignoreId?: string,
): boolean {
  return challenges.some(
    (challenge) =>
      challenge.id !== ignoreId &&
      ACTIVE.has(challenge.status) &&
      rangesOverlap(start, end, challenge.startAt, challenge.endAt) &&
      (pairIds.includes(challenge.challengerPairId) || pairIds.includes(challenge.challengedPairId)),
  );
}

export function courtIsBusy(
  challenges: BusyChallenge[],
  start: Date,
  end: Date,
  court: string,
  ignoreId?: string,
): boolean {
  return challenges.some(
    (challenge) =>
      challenge.id !== ignoreId &&
      ACTIVE.has(challenge.status) &&
      challenge.court === court &&
      rangesOverlap(start, end, challenge.startAt, challenge.endAt),
  );
}

export function buildSlots(options: {
  users: { availability: AvailabilitySlot[] }[];
  challenges: BusyChallenge[];
  pairIds: string[];
  ignoreId?: string;
  days?: number;
  courts?: readonly string[];
  limit?: number;
}): SlotOption[] {
  const courts = options.courts ?? COURTS;
  const horizon = options.days ?? 14;
  const limit = options.limit ?? 36;
  const earliest = Date.now() + 30 * 60 * 1000;
  const today = spParts(new Date());
  const startDay = saoPauloToUtc(today.year, today.month, today.day, 0, 0);
  const results: SlotOption[] = [];

  for (let offset = 0; offset < horizon && results.length < limit; offset += 1) {
    const dayInstant = new Date(startDay.getTime() + offset * 86_400_000);
    const parts = spParts(dayInstant);
    const intervals = intersectAvailability(options.users, parts.dayOfWeek);
    for (const interval of intervals) {
      for (const duration of [60, 90]) {
        for (let minute = interval.start; minute + duration <= interval.end; minute += 30) {
          if (results.length >= limit) break;
          const start = saoPauloToUtc(
            parts.year,
            parts.month,
            parts.day,
            Math.floor(minute / 60),
            minute % 60,
          );
          const end = new Date(start.getTime() + duration * 60_000);
          if (start.getTime() < earliest) continue;
          if (pairIsBusy(options.challenges, start, end, options.pairIds, options.ignoreId)) continue;
          const freeCourts = courts.filter(
            (court) => !courtIsBusy(options.challenges, start, end, court, options.ignoreId),
          );
          if (freeCourts.length === 0) continue;
          const startIso = start.toISOString();
          const endIso = end.toISOString();
          results.push({
            id: `${startIso}|${endIso}`,
            startIso,
            endIso,
            dayLabel: formatDayHeading(start),
            timeLabel: `${formatClock(start)}–${formatClock(end)} · ${duration === 60 ? "1h" : "1h30"}`,
            courts: [...freeCourts],
          });
        }
      }
    }
  }

  return results;
}

export function slotFitsUsers(
  users: { availability: AvailabilitySlot[] }[],
  start: Date,
  end: Date,
): boolean {
  return users.every((user) => userCovers(user.availability, start, end));
}

export function assertDuration(start: Date, end: Date): number {
  const minutes = durationMinutes(start, end);
  if (![60, 90].includes(minutes)) {
    throw new Error("O jogo precisa durar 1 hora ou 1h30.");
  }
  const parts = spParts(start);
  if (parts.minute % 30 !== 0) {
    throw new Error("Escolha um horário de 30 em 30 minutos.");
  }
  if (start.getTime() < Date.now() + 5 * 60 * 1000) {
    throw new Error("Escolha um horário no futuro.");
  }
  return minutes;
}
