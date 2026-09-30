"use client";

import { useActionState, useMemo, useState } from "react";
import { createChallengeAction, respondChallengeAction, type FormState } from "@/actions/challenge";
import type { SlotOption } from "@/lib/schedule";

const initial: FormState = { error: "" };

export function ChallengeForm({
  adversaryId,
  sports,
  slots,
}: {
  adversaryId: string;
  sports: string[];
  slots: SlotOption[];
}) {
  const [state, action, pending] = useActionState(createChallengeAction, initial);
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [sport, setSport] = useState(sports[0] ?? "");
  const slot = useMemo(() => slots.find((item) => item.id === slotId) ?? slots[0], [slotId, slots]);
  const [court, setCourt] = useState(slot?.courts[0] ?? "");
  const courts = slot?.courts ?? [];
  const selectedCourt = courts.includes(court) ? court : courts[0] ?? "";

  if (slots.length === 0) {
    return <p className="text-sm text-ink/70">Não há horário em comum nas próximas duas semanas.</p>;
  }

  const groups = groupSlots(slots);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay">
          {state.error}
        </p>
      )}
      <input type="hidden" name="adversaryId" value={adversaryId} />
      <input type="hidden" name="start" value={slot?.startIso ?? ""} />
      <input type="hidden" name="end" value={slot?.endIso ?? ""} />
      <input type="hidden" name="court" value={selectedCourt} />
      <label className="flex flex-col gap-2 text-sm font-medium">
        Esporte
        <select className="field" name="sport" value={sport} onChange={(event) => setSport(event.target.value)}>
          {sports.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Horário que cabe nas duas equipes
        <select
          className="field"
          value={slot?.id ?? ""}
          onChange={(event) => {
            setSlotId(event.target.value);
            const next = slots.find((item) => item.id === event.target.value);
            if (next && !next.courts.includes(court)) setCourt(next.courts[0] ?? "");
          }}
        >
          {groups.map((group) => (
            <optgroup key={group.day} label={group.day}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.timeLabel}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Espaço da arena
        <select className="field" value={selectedCourt} onChange={(event) => setCourt(event.target.value)}>
          {courts.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <p className="rounded-2xl bg-sand px-4 py-3 text-sm">
        {sport} em {selectedCourt}, {slot?.dayLabel.toLocaleLowerCase("pt-BR")}, {slot?.timeLabel.split("·")[0]?.trim()}.
      </p>
      <button className="btn-primary w-fit" type="submit" disabled={pending || !slot}>
        {pending ? "Enviando..." : "Enviar desafio"}
      </button>
    </form>
  );
}

export function CounterForm({ id, slots }: { id: string; slots: SlotOption[] }) {
  const [state, action, pending] = useActionState(respondChallengeAction, initial);
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const slot = slots.find((item) => item.id === slotId) ?? slots[0];
  if (slots.length === 0) return <p className="text-sm text-ink/70">Não há outro horário livre em comum.</p>;
  const groups = groupSlots(slots);

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && (
        <p role="alert" className="rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay">
          {state.error}
        </p>
      )}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value="counter" />
      <input type="hidden" name="start" value={slot?.startIso ?? ""} />
      <input type="hidden" name="end" value={slot?.endIso ?? ""} />
      <label className="flex flex-col gap-2 text-sm font-medium">
        Outro horário
        <select className="field" value={slot?.id ?? ""} onChange={(event) => setSlotId(event.target.value)}>
          {groups.map((group) => (
            <optgroup key={group.day} label={group.day}>
              {group.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.timeLabel}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <button className="btn-ghost w-fit" type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Propor outro horário"}
      </button>
    </form>
  );
}

export function DecisionButtons({ id }: { id: string }) {
  const [state, action, pending] = useActionState(respondChallengeAction, initial);
  return (
    <div className="flex flex-col gap-3">
      {state.error && (
        <p role="alert" className="rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="intent" value="accept" />
          <button className="btn-primary" type="submit" disabled={pending}>
            Aceitar horário
          </button>
        </form>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="intent" value="decline" />
          <button className="btn-danger" type="submit" disabled={pending}>
            Recusar
          </button>
        </form>
      </div>
    </div>
  );
}

function groupSlots(slots: SlotOption[]) {
  const groups: { day: string; items: SlotOption[] }[] = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (!last || last.day !== slot.dayLabel) groups.push({ day: slot.dayLabel, items: [slot] });
    else last.items.push(slot);
  }
  return groups;
}
