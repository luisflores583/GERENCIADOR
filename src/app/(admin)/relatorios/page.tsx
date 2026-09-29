"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/constants";

type Report = {
  revenueCents: number;
  appointmentsCompleted: number;
  topServices: Array<{ name: string; count: number; total: number }>;
  topClients: Array<{ name: string; count: number; total: number }>;
};

export default function RelatoriosPage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setReport(d.report));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Relatórios</h1>
          <p className="mt-1 text-sm text-ink-700/70">
            Faturamento e ranking do período
          </p>
        </div>
        <a className="btn-secondary" href="/api/reports?format=csv">
          Exportar CSV
        </a>
      </div>

      {!report ? (
        <p className="text-sm text-ink-700/60">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card-panel p-5">
              <p className="text-xs uppercase text-ink-700/60">Faturamento</p>
              <p className="mt-2 font-display text-3xl text-blush-700">
                {formatBRL(report.revenueCents)}
              </p>
            </div>
            <div className="card-panel p-5">
              <p className="text-xs uppercase text-ink-700/60">Atendimentos concluídos</p>
              <p className="mt-2 font-display text-3xl text-blush-700">
                {report.appointmentsCompleted}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card-panel p-5">
              <h2 className="font-display text-xl">Serviços mais realizados</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {report.topServices.map((s) => (
                  <li key={s.name} className="flex justify-between gap-2">
                    <span>
                      {s.name} · {s.count}x
                    </span>
                    <span>{formatBRL(s.total)}</span>
                  </li>
                ))}
                {!report.topServices.length && (
                  <li className="text-ink-700/60">Sem dados ainda.</li>
                )}
              </ul>
            </section>
            <section className="card-panel p-5">
              <h2 className="font-display text-xl">Clientes</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {report.topClients.map((c) => (
                  <li key={c.name} className="flex justify-between gap-2">
                    <span>
                      {c.name} · {c.count}x
                    </span>
                    <span>{formatBRL(c.total)}</span>
                  </li>
                ))}
                {!report.topClients.length && (
                  <li className="text-ink-700/60">Sem dados ainda.</li>
                )}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
