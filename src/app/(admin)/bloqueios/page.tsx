"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/constants";

type Block = {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  allDay: boolean;
};

export default function BloqueiosPage() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [form, setForm] = useState({
    startAt: "",
    endAt: "",
    reason: "",
    allDay: false,
  });

  async function load() {
    const data = await fetch("/api/blocks").then((r) => r.json());
    setBlocks(data.blocks || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ startAt: "", endAt: "", reason: "", allDay: false });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/blocks/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Bloqueios</h1>
        <p className="mt-1 text-sm text-ink-700/70">
          Periodos indisponíveis na agenda
        </p>
      </div>

      <form onSubmit={onSubmit} className="card-panel grid gap-3 p-5 sm:grid-cols-2">
        <div>
          <label className="label-field">Início</label>
          <input
            type="datetime-local"
            className="input-field"
            required
            value={form.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Fim</label>
          <input
            type="datetime-local"
            className="input-field"
            required
            value={form.endAt}
            onChange={(e) => setForm({ ...form, endAt: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label-field">Motivo</label>
          <input
            className="input-field"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
          />
          Dia inteiro
        </label>
        <button className="btn-primary sm:justify-self-start" type="submit">
          Bloquear
        </button>
      </form>

      <div className="card-panel divide-y divide-[#efe7e3]">
        {blocks.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">
                {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
              </p>
              <p className="text-sm text-ink-700/70">
                {b.reason || "Sem motivo"} {b.allDay ? "· dia inteiro" : ""}
              </p>
            </div>
            <button className="btn-secondary !py-1.5 text-xs" onClick={() => remove(b.id)}>
              Remover
            </button>
          </div>
        ))}
        {!blocks.length && (
          <p className="p-4 text-sm text-ink-700/60">Nenhum bloqueio.</p>
        )}
      </div>
    </div>
  );
}
