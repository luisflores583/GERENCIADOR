"use client";

import { FormEvent, useEffect, useState } from "react";
import { PAYMENT_LABELS, formatBRL, formatDateTime } from "@/lib/constants";

type Tx = {
  id: string;
  type: string;
  description: string;
  amountCents: number;
  paymentMethod: string | null;
  occurredAt: string;
};

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [form, setForm] = useState({
    type: "EXPENSE",
    description: "",
    amount: "",
    paymentMethod: "PIX",
  });

  async function load() {
    const data = await fetch("/api/financial").then((r) => r.json());
    setTransactions(data.transactions || []);
    setSummary(data.summary || { income: 0, expense: 0, balance: 0 });
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/financial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        description: form.description,
        amountCents: Math.round(Number(form.amount.replace(",", ".")) * 100),
        paymentMethod: form.paymentMethod,
      }),
    });
    setForm({ type: "EXPENSE", description: "", amount: "", paymentMethod: "PIX" });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/financial/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Financeiro</h1>
        <p className="mt-1 text-sm text-ink-700/70">Receitas, despesas e saldos</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-panel p-4">
          <p className="text-xs uppercase text-ink-700/60">Receitas</p>
          <p className="mt-1 font-display text-2xl text-emerald-700">
            {formatBRL(summary.income)}
          </p>
        </div>
        <div className="card-panel p-4">
          <p className="text-xs uppercase text-ink-700/60">Despesas</p>
          <p className="mt-1 font-display text-2xl text-red-700">
            {formatBRL(summary.expense)}
          </p>
        </div>
        <div className="card-panel p-4">
          <p className="text-xs uppercase text-ink-700/60">Saldo</p>
          <p className="mt-1 font-display text-2xl text-blush-700">
            {formatBRL(summary.balance)}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card-panel grid gap-3 p-5 sm:grid-cols-4">
        <div>
          <label className="label-field">Tipo</label>
          <select
            className="input-field"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
          </select>
        </div>
        <div>
          <label className="label-field">Descrição</label>
          <input
            className="input-field"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Valor (R$)</label>
          <input
            className="input-field"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Pagamento</label>
          <select
            className="input-field"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          >
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary sm:col-span-4 sm:w-fit" type="submit">
          Lançar
        </button>
      </form>

      <div className="card-panel divide-y divide-[#efe7e3]">
        {transactions.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{t.description}</p>
              <p className="text-sm text-ink-700/70">
                {t.type === "INCOME" ? "Receita" : "Despesa"} ·{" "}
                {PAYMENT_LABELS[t.paymentMethod || ""] || t.paymentMethod || "—"} ·{" "}
                {formatDateTime(t.occurredAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p
                className={`font-medium ${
                  t.type === "INCOME" ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {t.type === "INCOME" ? "+" : "-"}
                {formatBRL(t.amountCents)}
              </p>
              <button className="btn-secondary !py-1 text-xs" onClick={() => remove(t.id)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
        {!transactions.length && (
          <p className="p-4 text-sm text-ink-700/60">Nenhum lançamento.</p>
        )}
      </div>
    </div>
  );
}
