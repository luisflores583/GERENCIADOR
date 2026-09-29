import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonOk, jsonError, unauthorized } from "@/lib/api";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const txs = await prisma.financialTransaction.findMany({
    where: {
      organizationId: session.organizationId,
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { occurredAt: "desc" },
    include: { appointment: { include: { client: true, service: true } } },
  });

  const income = txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amountCents, 0);
  const expense = txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amountCents, 0);

  return jsonOk({ transactions: txs, summary: { income, expense, balance: income - expense } });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  const type = String(body?.type || "");
  const description = String(body?.description || "").trim();
  const amountCents = Math.round(Number(body?.amountCents));
  if (!["INCOME", "EXPENSE"].includes(type) || !description || !Number.isFinite(amountCents)) {
    return jsonError("Tipo, descrição e valor são obrigatórios");
  }
  const tx = await prisma.financialTransaction.create({
    data: {
      organizationId: session.organizationId,
      type,
      category: body?.category ? String(body.category) : null,
      description,
      amountCents,
      paymentMethod: body?.paymentMethod ? String(body.paymentMethod) : null,
      occurredAt: body?.occurredAt ? new Date(body.occurredAt) : new Date(),
    },
  });
  return jsonOk({ transaction: tx }, { status: 201 });
}
