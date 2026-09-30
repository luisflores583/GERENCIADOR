import { initials, statusLabel } from "@/lib/data";
import { weekdayShort } from "@/lib/time";
import { formatMin } from "@/lib/time";

export function PairMark({ a, b, size = "md" }: { a: string; b: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  return (
    <div className="flex items-center">
      <span className={`grid ${box} place-items-center rounded-full bg-ink font-semibold text-lime`}>{initials(a)}</span>
      <span className={`-ml-3 grid ${box} place-items-center rounded-full bg-lime font-semibold text-ink ring-2 ring-paper`}>
        {initials(b)}
      </span>
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-lime">
      {initials(name)}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "accepted"
      ? "bg-lime text-ink"
      : status === "pending"
        ? "bg-amber-100 text-amber-950"
        : status === "countered"
          ? "bg-sky-100 text-sky-950"
          : status === "declined" || status === "cancelled" || status === "ended"
            ? "bg-ink/5 text-ink/60"
            : "bg-sand text-ink";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{statusLabel(status)}</span>;
}

export function SportPills({ sports }: { sports: string[] }) {
  if (sports.length === 0) return <span className="text-sm text-ink/50">Sem esportes</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {sports.map((sport) => (
        <span key={sport} className="rounded-full bg-sand px-2.5 py-1 text-xs font-medium text-ink">
          {sport}
        </span>
      ))}
    </div>
  );
}

export function AvailabilitySummary({
  slots,
}: {
  slots: { dayOfWeek: number; startMin: number; endMin: number }[];
}) {
  if (slots.length === 0) return <p className="text-sm text-ink/50">Sem horários informados</p>;
  const ordered = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin);
  return (
    <p className="text-sm text-ink/70">
      {ordered
        .map((slot) => `${weekdayShort(slot.dayOfWeek)} ${formatMin(slot.startMin)}–${formatMin(slot.endMin)}`)
        .join(" · ")}
    </p>
  );
}

export function Banner({ ok, erro }: { ok?: string; erro?: string }) {
  const success: Record<string, string> = {
    perfil: "Perfil salvo.",
    convite: "Convite enviado.",
    aceito: "Dupla formada.",
    atualizado: "Convite atualizado.",
    encerrada: "Dupla desfeita. Desafios em aberto foram cancelados.",
    enviado: "Desafio enviado. A outra dupla já pode responder.",
    contra: "Novo horário proposto. Aguardando a outra dupla.",
    recusado: "Desafio recusado.",
    confirmado: "Desafio confirmado. Ele entrou na agenda.",
  };
  if (erro) {
    return (
      <p role="alert" className="rounded-2xl border border-clay/30 bg-white px-4 py-3 text-sm text-clay">
        {erro}
      </p>
    );
  }
  if (ok && success[ok]) {
    return <p className="rounded-2xl border border-pine/20 bg-lime/40 px-4 py-3 text-sm text-ink">{success[ok]}</p>;
  }
  return null;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="card text-center">
      <p className="font-display text-xl">{title}</p>
      <p className="mt-2 text-sm text-ink/70">{text}</p>
    </div>
  );
}
