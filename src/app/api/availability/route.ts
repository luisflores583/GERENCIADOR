import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getAvailableSlots, getAvailableDates } from "@/lib/availability";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");
  const dates = searchParams.get("dates");
  if (!serviceId) return jsonError("serviceId obrigatório");

  if (dates === "1") {
    const from = date || new Date().toISOString().slice(0, 10);
    const list = await getAvailableDates({
      organizationId: session.organizationId,
      professionalId: session.professionalId,
      serviceId,
      fromDateKey: from,
      days: Number(searchParams.get("days") || 14),
    });
    return jsonOk({ dates: list });
  }

  if (!date) return jsonError("date obrigatório (YYYY-MM-DD)");
  const result = await getAvailableSlots({
    organizationId: session.organizationId,
    professionalId: session.professionalId,
    serviceId,
    dateKey: date,
  });
  return jsonOk(result);
}
