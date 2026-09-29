import { prisma } from "./db";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  combineDateAndTime,
  parseTimeToMinutes,
  minutesToHHMM,
  toDateKey,
} from "./constants";

const SLOT_STEP = 15; // minutos

export type AvailabilityParams = {
  organizationId: string;
  professionalId: string;
  serviceId: string;
  dateKey: string; // YYYY-MM-DD
  excludeAppointmentId?: string;
};

export async function getAvailableSlots(params: AvailabilityParams) {
  const { organizationId, professionalId, serviceId, dateKey, excludeAppointmentId } =
    params;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, organizationId, active: true },
  });
  if (!service) {
    return { ok: false as const, error: "Serviço inválido ou inativo", slots: [] as string[] };
  }

  const holiday = await prisma.holiday.findFirst({
    where: { organizationId, date: dateKey },
  });
  if (holiday) {
    return { ok: true as const, slots: [] as string[], reason: `Feriado: ${holiday.name}` };
  }

  const date = combineDateAndTime(dateKey, "00:00");
  const weekday = date.getDay();

  const hours =
    (await prisma.businessHour.findFirst({
      where: { organizationId, professionalId, weekday },
    })) ||
    (await prisma.businessHour.findFirst({
      where: { organizationId, professionalId: null, weekday },
    }));

  if (!hours || hours.closed) {
    return { ok: true as const, slots: [] as string[], reason: "Fechado neste dia" };
  }

  const dayStart = combineDateAndTime(dateKey, hours.openTime);
  const dayEnd = combineDateAndTime(dateKey, hours.closeTime);

  const blocked = await prisma.blockedTime.findMany({
    where: {
      organizationId,
      OR: [{ professionalId }, { professionalId: null }],
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
    },
  });

  // dia inteiro bloqueado
  if (blocked.some((b) => b.allDay || (b.startAt <= dayStart && b.endAt >= dayEnd))) {
    return { ok: true as const, slots: [] as string[], reason: "Dia bloqueado" };
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      organizationId,
      professionalId,
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
  });

  const openMin = parseTimeToMinutes(hours.openTime);
  const closeMin = parseTimeToMinutes(hours.closeTime);
  const breakStart = hours.breakStart ? parseTimeToMinutes(hours.breakStart) : null;
  const breakEnd = hours.breakEnd ? parseTimeToMinutes(hours.breakEnd) : null;
  const duration = service.durationMin;

  const slots: string[] = [];
  for (let t = openMin; t + duration <= closeMin; t += SLOT_STEP) {
    const end = t + duration;
    // almoço
    if (
      breakStart != null &&
      breakEnd != null &&
      t < breakEnd &&
      end > breakStart
    ) {
      continue;
    }

    const startAt = combineDateAndTime(dateKey, minutesToHHMM(t));
    const endAt = combineDateAndTime(dateKey, minutesToHHMM(end));

    // passado
    if (startAt.getTime() < Date.now()) continue;

    const overlapsAppt = appointments.some(
      (a) => a.startAt < endAt && a.endAt > startAt
    );
    if (overlapsAppt) continue;

    const overlapsBlock = blocked.some(
      (b) => b.startAt < endAt && b.endAt > startAt
    );
    if (overlapsBlock) continue;

    slots.push(minutesToHHMM(t));
  }

  return { ok: true as const, slots, durationMin: duration, priceCents: service.priceCents };
}

export async function assertSlotAvailable(params: {
  organizationId: string;
  professionalId: string;
  serviceId: string;
  startAt: Date;
  excludeAppointmentId?: string;
}) {
  const dateKey = toDateKey(params.startAt);
  const hhmm = minutesToHHMM(
    params.startAt.getHours() * 60 + params.startAt.getMinutes()
  );
  const result = await getAvailableSlots({
    organizationId: params.organizationId,
    professionalId: params.professionalId,
    serviceId: params.serviceId,
    dateKey,
    excludeAppointmentId: params.excludeAppointmentId,
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  if (!result.slots.includes(hhmm)) {
    return { ok: false as const, error: "Horário indisponível" };
  }
  return {
    ok: true as const,
    endAt: new Date(params.startAt.getTime() + (result.durationMin || 0) * 60_000),
    priceCents: result.priceCents!,
    durationMin: result.durationMin!,
  };
}

export async function getAvailableDates(params: {
  organizationId: string;
  professionalId: string;
  serviceId: string;
  fromDateKey: string;
  days?: number;
}) {
  const days = params.days ?? 14;
  const [y, m, d] = params.fromDateKey.split("-").map(Number);
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(y, m - 1, d + i);
    const key = toDateKey(dt);
    const res = await getAvailableSlots({
      organizationId: params.organizationId,
      professionalId: params.professionalId,
      serviceId: params.serviceId,
      dateKey: key,
    });
    if (res.ok && res.slots.length > 0) dates.push(key);
  }
  return dates;
}
