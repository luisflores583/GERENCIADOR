import { SeloPartida, SeloSituacao } from "@/components/selo";
import type { PartidaResumo } from "@/tipos";

const GRUPOS = [
  { chave: "VENCEDORES", titulo: "Chave dos vencedores" },
  { chave: "PERDEDORES", titulo: "Chave dos perdedores" },
  { chave: "FINAL", titulo: "Finais" },
] as const;

function Cartao({ partida }: { partida: PartidaResumo }) {
  return (
    <article className="w-64 rounded-3xl border border-navy/10 bg-foam p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ocean">{partida.fase}</p>
        <SeloPartida status={partida.status} />
      </div>
      {[partida.equipeA, partida.equipeB].map((equipe, indice) => {
        const placar = indice === 0 ? partida.placarA : partida.placarB;
        const venceu =
          partida.status === "CONCLUIDA" &&
          placar != null &&
          (indice === 0 ? (partida.placarA ?? 0) > (partida.placarB ?? 0) : (partida.placarB ?? 0) > (partida.placarA ?? 0));
        return (
          <div key={indice} className={`mt-2 flex items-center justify-between gap-2 rounded-2xl px-3 py-2 ${venceu ? "bg-emerald-50" : "bg-white"}`}>
            <div className="min-w-0">
              <p className={`truncate font-semibold ${equipe?.situacao === "ELIMINADA" ? "text-stone-500 line-through" : "text-navy"}`}>
                {equipe?.nome ?? (partida.aguardandoAdversario ? "Aguardando adversário" : "Folga")}
              </p>
              {equipe ? <SeloSituacao situacao={equipe.situacao} /> : null}
            </div>
            <span className="text-2xl font-bold tabular-nums text-navy">{placar ?? "–"}</span>
          </div>
        );
      })}
      <p className="mt-2 text-sm text-navy/70">{partida.quadra ?? "Quadra a definir"}</p>
    </article>
  );
}

export function ChaveVisual({ partidas }: { partidas: PartidaResumo[] }) {
  return (
    <div className="space-y-8">
      {GRUPOS.map((grupo) => {
        const doGrupo = partidas.filter((partida) =>
          grupo.chave === "FINAL" ? partida.chave === "FINAL" || partida.chave === "FINAL_EXTRA" : partida.chave === grupo.chave,
        );
        if (doGrupo.length === 0) return null;
        const rodadas = [...new Set(doGrupo.map((partida) => `${partida.chave}-${partida.rodada}`))];
        return (
          <section key={grupo.chave}>
            <h3 className="mb-3 font-display text-2xl text-navy">{grupo.titulo}</h3>
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4">
                {rodadas.map((rodada) => (
                  <div key={rodada} className="space-y-3">
                    {doGrupo
                      .filter((partida) => `${partida.chave}-${partida.rodada}` === rodada)
                      .map((partida) => (
                        <Cartao key={partida.id} partida={partida} />
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
