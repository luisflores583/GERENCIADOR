import { WEEKDAYS } from "./constants";

export const TZ = "America/Sao_Paulo";

export type SpParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
  minutes: number;
  dateKey: string;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function spParts(date: Date): SpParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute,
    dayOfWeek: WEEKDAY_INDEX[parts.weekday] ?? 0,
    minutes: hour * 60 + minute,
    dateKey: `${parts.year}-${parts.month}-${String(parts.day).padStart(2, "0")}`,
  };
}

export function saoPauloToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const asIfUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const adjust = (instant: number) => {
    const local = spParts(new Date(instant));
    const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);
    return asIfUtc.getTime() - (wall - instant);
  };
  const first = adjust(asIfUtc.getTime());
  return new Date(adjust(first));
}

export function formatMin(total: number): string {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function weekdayLabel(day: number): string {
  return WEEKDAYS.find((item) => item.value === day)?.label ?? "Dia";
}

export function weekdayShort(day: number): string {
  return WEEKDAYS.find((item) => item.value === day)?.short ?? "";
}

export function formatDayHeading(date: Date): string {
  const raw = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatClock(date: Date): string {
  const parts = spParts(date);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatSlot(start: Date, end: Date): string {
  return `${formatDayHeading(start)} · ${formatClock(start)}–${formatClock(end)}`;
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${formatClock(start)}–${formatClock(end)}`;
}

export function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export function durationLabel(minutes: number): string {
  if (minutes === 60) return "1 hora";
  if (minutes === 90) return "1h30";
  if (minutes % 60 === 0) return `${minutes / 60} horas`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h${String(rest).padStart(2, "0")}` : `${rest} min`;
}

export function upcomingSaoPaulo(dayOfWeek: number, hour: number, minute: number): Date {
  const today = spParts(new Date());
  const add = (dayOfWeek - today.dayOfWeek + 7) % 7;
  const base = saoPauloToUtc(today.year, today.month, today.day, hour, minute);
  let date = new Date(base.getTime() + add * 86_400_000);
  if (date.getTime() < Date.now() + 60 * 60 * 1000) {
    date = new Date(date.getTime() + 7 * 86_400_000);
  }
  return date;
}

export function timeChoices(): { value: number; label: string }[] {
  const choices: { value: number; label: string }[] = [];
  for (let minute = 6 * 60; minute <= 23 * 60; minute += 30) {
    choices.push({ value: minute, label: formatMin(minute) });
  }
  return choices;
}
