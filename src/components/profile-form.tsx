"use client";

import { useActionState, useState } from "react";
import { saveProfileAction, type FormState } from "@/actions/profile";
import { SPORTS, WEEKDAYS } from "@/lib/constants";
import { timeChoices } from "@/lib/time";

type Slot = { dayOfWeek: number; startMin: number; endMin: number };

const initial: FormState = { error: "" };
const times = timeChoices();

export function ProfileForm({
  name,
  sports,
  slots,
}: {
  name: string;
  sports: string[];
  slots: Slot[];
}) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);
  const [rows, setRows] = useState<Slot[]>(slots);
  const [day, setDay] = useState(1);
  const [startMin, setStartMin] = useState(18 * 60);
  const [endMin, setEndMin] = useState(21 * 60);

  function addSlot() {
    if (endMin <= startMin) return;
    setRows((current) => [...current, { dayOfWeek: day, startMin, endMin }]);
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {state.error && (
        <p role="alert" className="rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay">
          {state.error}
        </p>
      )}
      <input type="hidden" name="slots" value={JSON.stringify(rows)} />
      <label className="flex flex-col gap-2 text-sm font-medium">
        Nome
        <input className="field" name="name" defaultValue={name} required minLength={2} maxLength={80} />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Esportes de interesse</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {SPORTS.map((sport) => (
            <label key={sport} className="cursor-pointer">
              <input
                className="peer sr-only"
                type="checkbox"
                name="sports"
                value={sport}
                defaultChecked={sports.includes(sport)}
              />
              <span className="inline-flex rounded-full border border-line bg-paper px-3 py-2 text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-lime">
                {sport}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">Disponibilidade semanal</legend>
        <p className="mt-1 text-sm text-ink/60">Dias e faixas em que você pode jogar. O desafio só entra se couber em todo mundo da equipe.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {rows.length === 0 && <li className="text-sm text-ink/50">Nenhum horário ainda.</li>}
          {rows.map((slot, index) => (
            <li key={`${slot.dayOfWeek}-${slot.startMin}-${slot.endMin}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-sand px-3 py-2 text-sm">
              <span>
                {WEEKDAYS.find((item) => item.value === slot.dayOfWeek)?.label} · {times.find((item) => item.value === slot.startMin)?.label}–{times.find((item) => item.value === slot.endMin)?.label ?? minutes(slot.endMin)}
              </span>
              <button
                type="button"
                className="text-sm font-semibold text-clay"
                onClick={() => setRows((current) => current.filter((_, item) => item !== index))}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <select className="field" value={day} onChange={(event) => setDay(Number(event.target.value))} aria-label="Dia da semana">
            {WEEKDAYS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select className="field" value={startMin} onChange={(event) => setStartMin(Number(event.target.value))} aria-label="Início">
            {times.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select className="field" value={endMin} onChange={(event) => setEndMin(Number(event.target.value))} aria-label="Fim">
            {times.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button className="btn-ghost" type="button" onClick={addSlot}>
            Adicionar
          </button>
        </div>
        {endMin <= startMin && <p className="mt-2 text-sm text-clay">O fim precisa ser depois do início.</p>}
      </fieldset>
      <button className="btn-primary w-fit" type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar perfil"}
      </button>
    </form>
  );
}

function minutes(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
