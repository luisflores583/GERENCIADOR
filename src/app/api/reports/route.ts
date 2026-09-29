import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, unauthorized } from "@/lib/api";
import { APPOINTMENT_STATUS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format");

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(to) : new Date();

  const completed = await prisma.appointment.findMany({
    where: {
      organizationId: session.organizationId,
      status: APPOINTMENT_STATUS.COMPLETED,
      startAt: { gte: fromDate, lte: toDate },
    },
    include: { service: true, client: true },
  });

  const revenue = completed.reduce((s, a) => s + a.priceCents, 0);
  const byService = new Map<string, { name: string; count: number; total: number }>();
  const byClient = new Map<string, { name: string; count: number; total: number }>();

  for (const a of completed) {
    const s = byService.get(a.serviceId) || { name: a.service.name, count: 0, total: 0 };
    s.count += 1;
    s.total += a.priceCents;
    byService.set(a.serviceId, s);

    const c = byClient.get(a.clientId) || { name: a.client.name, count: 0, total: 0 };
    c.count += 1;
    c.total += a.priceCents;
    byClient.set(a.clientId, c);
  }

  const report = {
    from: fromDate,
    to: toDate,
    revenueCents: revenue,
    appointmentsCompleted: completed.length,
    topServices: [...byService.values()].sort((a, b) => b.count - a.count),
    topClients: [...byClient.values()].sort((a, b) => b.total - a.total),
  };

  if (format === "csv") {
    const lines = [
      "data,cliente,servico,valor_centavos,status",
      ...completed.map(
        (a) =>
          `${a.startAt.toISOString()},${JSON.stringify(a.client.name)},${JSON.stringify(a.service.name)},${a.priceCents},${a.status}`
      ),
    ];
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="relatorio.csv"',
      },
    });
  }

  return jsonOk({ report });
}
