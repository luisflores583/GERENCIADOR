"use client";

import { FormEvent, useEffect, useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/constants";

type Hour = {
  id?: string;
  weekday: number;
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  closed: boolean;
};

type Holiday = { id: string; date: string; name: string };

const emptyWeek = (): Hour[] =>
  WEEKDAY_LABELS.map((_, weekday) => ({
    weekday,
    openTime: "09:00",
    closeTime: "18:00",
    breakStart: "12:00",
    breakEnd: "13:00",
    closed: weekday === 0,
  }));

export default function HorariosPage() {
  const [hours, setHours] = useState<Hour[]>(emptyWeek());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "Feriado" });
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await fetch("/api/hours").then((r) => r.json());
    const base = emptyWeek();
    for (const h of data.hours || []) {
      base[h.weekday] = {
        weekday: h.weekday,
        openTime: h.openTime,
        closeTime: h.closeTime,
        breakStart: h.breakStart,
        breakEnd: h.breakEnd,
        closed: h.closed,
      };
    }
    setHours(base);
    setHolidays(data.holidays || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    if (!res.ok) {
      setMsg("Erro ao salvar");
      return;
    }
    setMsg("Horários salvos");
  }

  async function addHoliday(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holiday: holidayForm }),
    });
    setHolidayForm({ date: "", name: "Feriado" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Horários</h1>
        <p className="mt-1 text-sm text-ink-700/70">
          Funcionamento por dia, almoço e feriados
        </p>
      </div>

      <form onSubmit={save} className="card-panel space-y-3 p-5">
        {hours.map((h, i) => (
          <div
            key={h.weekday}
            className="grid gap-2 border-b border-[#f0e8e4] pb-3 sm:grid-cols-[120px_1fr_1fr_1fr_1fr_auto]"
          >
            <p className="self-center text-sm font-medium">{WEEKDAY_LABELS[h.weekday]}</p>
            <input
              className="input-field"
              type="time"
              value={h.openTime}
              disabled={h.closed}
              onChange={(e) => {
                const next = [...hours];
                next[i] = { ...h, openTime: e.target.value };
                setHours(next);
              }}
            />
            <input
              className="input-field"
              type="time"
              value={h.closeTime}
              disabled={h.closed}
              onChange={(e) => {
                const next = [...hours];
                next[i] = { ...h, closeTime: e.target.value };
                setHours(next);
              }}
            />
            <input
              className="input-field"
              type="time"
              value={h.breakStart || ""}
              disabled={h.closed}
              onChange={(e) => {
                const next = [...hours];
                next[i] = { ...h, breakStart: e.target.value || null };
                setHours(next);
              }}
              title="Início almoço"
            />
            <input
              className="input-field"
              type="time"
              value={h.breakEnd || ""}
              disabled={h.closed}
              onChange={(e) => {
                const next = [...hours];
                next[i] = { ...h, breakEnd: e.target.value || null };
                setHours(next);
              }}
              title="Fim almoço"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={h.closed}
                onChange={(e) => {
                  const next = [...hours];
                  next[i] = { ...h, closed: e.target.checked };
                  setHours(next);
                }}
              />
              Folga
            </label>
          </div>
        ))}
        <button className="btn-primary" type="submit">
          Salvar horários
        </button>
      </form>
      {msg && <p className="text-sm text-blush-700">{msg}</p>}

      <section className="card-panel p-5">
        <h2 className="font-display text-xl">Feriados</h2>
        <form onSubmit={addHoliday} className="mt-3 flex flex-wrap gap-2">
          <input
            type="date"
            className="input-field max-w-[180px]"
            required
            value={holidayForm.date}
            onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
          />
          <input
            className="input-field max-w-[220px]"
            value={holidayForm.name}
            onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
          />
          <button className="btn-secondary" type="submit">
            Adicionar
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {holidays.map((h) => (
            <li key={h.id}>
              {h.date} — {h.name}
            </li>
          ))}
          {!holidays.length && <li className="text-ink-700/60">Nenhum feriado.</li>}
        </ul>
      </section>
    </div>
  );
}
