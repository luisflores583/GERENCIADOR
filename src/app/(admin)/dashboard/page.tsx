"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL, formatTime, STATUS_LABELS } from "@/lib/constants";

type Dash = {
  today: Array<{
    id: string;
    startAt: string;
    status: string;
    priceCents: number;
    client: { name: string };
    service: { name: string };
  }>;
  upcoming: Array<{
    id: string;
    startAt: string;
    client: { name: string };
    service: { name: string };
  }>;
  expectedRevenueCents: number;
  byStatus: Record<string, number>;
  notifications: Array<{ id: string; title: string; body: string; createdAt: string }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) {
    return <p className="text-sm text-ink-700/60">Carregando dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">Hoje</h1>
        <p className="mt-1 text-sm text-ink-700/70">
          Visão rápida da agenda e do faturamento previsto
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-panel p-5">
          <p className="text-xs uppercase tracking-wide text-ink-700/60">Agendamentos</p>
          <p className="mt-2 font-display text-3xl text-blush-700">{data.today.length}</p>
        </div>
        <div className="card-panel p-5">
          <p className="text-xs uppercase tracking-wide text-ink-700/60">Faturamento previsto</p>
          <p className="mt-2 font-display text-3xl text-blush-700">
            {formatBRL(data.expectedRevenueCents)}
          </p>
        </div>
        <div className="card-panel p-5">
          <p className="text-xs uppercase tracking-wide text-ink-700/60">Confirmados</p>
          <p className="mt-2 font-display text-3xl text-blush-700">
            {data.byStatus.CONFIRMED || 0}
          </p>
        </div>
      </div>

      <section className="card-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Agenda de hoje</h2>
          <Link href="/agenda" className="text-sm text-blush-700 underline">
            Ver agenda
          </Link>
        </div>
        {data.today.length === 0 ? (
          <p className="text-sm text-ink-700/60">Nenhum horário hoje.</p>
        ) : (
          <ul className="divide-y divide-[#efe7e3]">
            {data.today.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{a.client.name}</p>
                  <p className="text-sm text-ink-700/70">
                    {formatTime(a.startAt)} · {a.service.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-700/60">
                    {STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] || a.status}
                  </p>
                  <p className="text-sm font-medium">{formatBRL(a.priceCents)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-panel p-5">
          <h2 className="font-display text-xl">Próximos</h2>
          <ul className="mt-3 space-y-2">
            {data.upcoming.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-medium">{a.client.name}</span> — {a.service.name}
                <span className="block text-ink-700/60">
                  {new Date(a.startAt).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
            {!data.upcoming.length && (
              <li className="text-sm text-ink-700/60">Sem próximos agendamentos.</li>
            )}
          </ul>
        </section>
        <section className="card-panel p-5">
          <h2 className="font-display text-xl">Avisos</h2>
          <ul className="mt-3 space-y-3">
            {data.notifications.map((n) => (
              <li key={n.id} className="text-sm">
                <p className="font-medium">{n.title}</p>
                <p className="text-ink-700/70">{n.body}</p>
              </li>
            ))}
            {!data.notifications.length && (
              <li className="text-sm text-ink-700/60">Nenhum aviso.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
