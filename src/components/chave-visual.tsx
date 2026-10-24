import { SeloPartida, SeloSituacao } from "@/components/selo";
import { avancouPorFolga } from "@/engine/classificacao";
import type { PartidaResumo } from "@/tipos";

const GRUPOS = [
  { chave: "VENCEDORES", titulo: "Chave dos vencedores" },
  { chave: "PERDEDORES", titulo: "Chave dos perdedores" },
  { chave: "FINAL", titulo: "Finais" },
] as const;

const GRUPOS_FOLHA = [
  { chave: "SEM_REGIAO", titulo: "Jogos", apenasIniciais: true },
  { chave: "VENCEDORES", titulo: "Vencedores" },
  { chave: "PERDEDORES", titulo: "Perdedores" },
  { chave: "SEM_REGIAO", titulo: "Jogos", apenasIniciais: false },
  { chave: "SEMIFINALISTA_A", titulo: "Semifinalista A" },
  { chave: "SEMIFINALISTA_B", titulo: "Semifinalista B" },
  { chave: "SEMIFINALISTA_C", titulo: "Semifinalista C" },
  { chave: "SEMIFINALISTA_D", titulo: "Semifinalista D" },
  { chave: "SEMIFINAL", titulo: "Semifinais" },
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
        const venceuPorPlacar =
          partida.status === "CONCLUIDA" &&
          partida.placarA != null &&
          partida.placarB != null &&
          (indice === 0 ? partida.placarA > partida.placarB : partida.placarB > partida.placarA);
        const venceu =
          partida.status === "CONCLUIDA" &&
          Boolean(partida.equipeA && partida.equipeB) &&
          (equipe?.id === partida.vencedorId || (!partida.vencedorId && venceuPorPlacar));
        const avancou = avancouPorFolga(
          {
            status: partida.status,
            vencedorId: partida.vencedorId,
            equipeAId: partida.equipeA?.id ?? null,
            equipeBId: partida.equipeB?.id ?? null,
          },
          equipe?.id ?? null,
        );
        const vaga = indice === 0 ? partida.vagaA : partida.vagaB;
        return (
          <div key={indice} className={`mt-2 flex items-center justify-between gap-2 rounded-2xl px-3 py-2 ${venceu || avancou ? "bg-emerald-50" : "bg-white"}`}>
            <div className="min-w-0">
              <p className={`truncate font-semibold ${equipe?.situacao === "ELIMINADA" && !avancou ? "text-stone-500 line-through" : "text-navy"}`}>
                {equipe?.nome ?? vaga ?? (partida.aguardandoAdversario ? "Aguardando adversário" : "Folga")}
              </p>
              {equipe && !avancou ? <SeloSituacao situacao={equipe.situacao} /> : null}
            </div>
            <span className={`font-bold text-navy ${placar != null ? "text-2xl tabular-nums" : "text-sm"}`}>
              {placar != null ? placar : avancou ? "Avançou" : venceu ? "Venceu" : "–"}
            </span>
          </div>
        );
      })}
      <p className="mt-2 text-sm text-navy/70">{partida.quadra ?? "Quadra a definir"}</p>
    </article>
  );
}

export function ChaveVisual({ partidas }: { partidas: PartidaResumo[] }) {
  const folha = partidas.some((partida) => partida.codigo === "30");
  const grupos = folha ? GRUPOS_FOLHA : GRUPOS;
  return (
    <div className="space-y-8">
      {grupos.map((grupo) => {
        const doGrupo = partidas.filter((partida) => {
          if (!folha && grupo.chave === "FINAL") return partida.chave === "FINAL" || partida.chave === "FINAL_EXTRA";
          if (partida.chave !== grupo.chave) return false;
          if (!folha || grupo.chave !== "SEM_REGIAO") return true;
          const numero = Number(partida.codigo);
          const iniciais = "apenasIniciais" in grupo && grupo.apenasIniciais;
          return iniciais ? numero <= 8 : numero > 8;
        });
        if (doGrupo.length === 0) return null;
        const rodadas = [...new Set(doGrupo.map((partida) => `${partida.chave}-${partida.rodada}`))];
        return (
          <section key={`${grupo.chave}-${grupo.titulo}-${"apenasIniciais" in grupo ? String(grupo.apenasIniciais) : "grupo"}`}>
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
