import { ROTULO_PARTIDA, ROTULO_SITUACAO, ROTULO_STATUS } from "@/lib/rotulos";
import type { SituacaoVisual } from "@/tipos";

const CORES: Record<SituacaoVisual, string> = {
  INVICTA: "bg-emerald-100 text-emerald-950",
  UMA_DERROTA: "bg-amber-100 text-amber-950",
  ELIMINADA: "bg-stone-200 text-stone-700",
  CAMPEA: "bg-yellow-200 text-yellow-950",
  VICE: "bg-sky-100 text-sky-950",
  CAMPEA_OURO: "bg-yellow-200 text-yellow-950",
  CAMPEA_PRATA: "bg-zinc-200 text-zinc-900",
};

export function SeloSituacao({ situacao }: { situacao: SituacaoVisual }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${CORES[situacao]}`}>
      {ROTULO_SITUACAO[situacao]}
    </span>
  );
}

const CORES_PARTIDA: Record<string, string> = {
  EM_ANDAMENTO: "bg-coral text-white",
  CONCLUIDA: "bg-navy text-white",
  AGUARDANDO: "border border-dashed border-navy/40 text-navy",
  PRONTA: "bg-ocean text-white",
  AGENDADA: "bg-ocean/90 text-white",
  PAUSADA: "bg-amber-500 text-navy",
  BYE: "bg-dune text-navy",
  NAO_NECESSARIA: "bg-stone-200 text-stone-700",
};

export function SeloPartida({ status }: { status: string }) {
  const rotulo = ROTULO_PARTIDA[status as keyof typeof ROTULO_PARTIDA] ?? status;
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${CORES_PARTIDA[status] ?? "bg-white text-navy"}`}>
      {rotulo}
    </span>
  );
}

export function SeloStatus({ status }: { status: string }) {
  const rotulo = ROTULO_STATUS[status as keyof typeof ROTULO_STATUS] ?? status;
  return <span className="inline-flex rounded-full bg-navy px-3 py-1 text-sm font-semibold text-white">{rotulo}</span>;
}
