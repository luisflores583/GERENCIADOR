import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, unauthorized } from "@/lib/api";
import { ACTIVE_APPOINTMENT_STATUSES, APPOINTMENT_STATUS } from "@/lib/constants";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const todayAppts = await prisma.appointment.findMany({
    where: {
      organizationId: session.organizationId,
      startAt: { gte: start, lte: end },
    },
    include: { client: true, service: true },
    orderBy: { startAt: "asc" },
  });

  const upcoming = await prisma.appointment.findMany({
    where: {
      organizationId: session.organizationId,
      startAt: { gt: end },
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
    },
    include: { client: true, service: true },
    orderBy: { startAt: "asc" },
    take: 5,
  });

  const expectedRevenue = todayAppts
    .filter((a) =>
      [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_PROGRESS, APPOINTMENT_STATUS.COMPLETED].includes(
        a.status as typeof APPOINTMENT_STATUS.SCHEDULED
      )
    )
    .reduce((s, a) => s + a.priceCents, 0);

  const byStatus = todayAppts.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const unread = await prisma.notification.count({
    where: { organizationId: session.organizationId, read: false },
  });

  const notifications = await prisma.notification.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return jsonOk({
    today: todayAppts,
    upcoming,
    expectedRevenueCents: expectedRevenue,
    byStatus,
    unreadNotifications: unread,
    notifications,
  });
}
