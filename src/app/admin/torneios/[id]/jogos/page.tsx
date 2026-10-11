import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { Campo, Entrada } from "@/components/campo";
import { Formulario } from "@/components/formulario";
import { MenuTorneio } from "@/components/menu-torneio";
import { SeloPartida } from "@/components/selo";
import { formatarDataHora } from "@/lib/formatacao";
import { nomeDaFase, rodadasDaChaveDeVencedores } from "@/engine/dupla-eliminacao";
import { ROTULO_PARTIDA } from "@/lib/rotulos";
import {
  acaoConfirmarPlacar,
  acaoCorrigirPlacar,
  acaoDevolver,
  acaoIniciar,
  acaoPausarPartida,
  acaoRetomarPartida,
} from "@/server/acoes";
import { prisma } from "@/server/db";

export default async function Jogos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const torneio = await prisma.torneio.findUnique({
    where: { id },
    include: {
      partidas: {
        include: {
          equipeA: true,
          equipeB: true,
          quadra: true,
          historico: { include: { admin: true }, orderBy: { criadoEm: "desc" } },
        },
      },
      equipes: true,
    },
  });
  if (!torneio) notFound();
  const rodadas = rodadasDaChaveDeVencedores(Math.max(2, torneio.equipes.length));
  const partidas = torneio.partidas
    .filter((partida) => partida.status !== "VAZIA")
    .sort((a, b) => a.rodada - b.rodada || a.posicao - b.posicao);
  const grupos = ["EM_ANDAMENTO", "PAUSADA", "AGENDADA", "PRONTA", "AGUARDANDO", "CONCLUIDA", "BYE", "NAO_NECESSARIA"];
  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <h1 id="registrar" className="font-display text-4xl text-navy">Registrar resultado</h1>
      <p className="mt-2 max-w-3xl text-navy/70">
        Informe o placar das duas equipes e confirme. O resultado fica gravado e a chave avança na hora.
        Para vencer: {torneio.pontosParaVencer} pontos, diferença mínima {torneio.diferencaMinima}
        {torneio.pontosMaximos ? `, teto ${torneio.pontosMaximos}` : ""}.
      </p>
      {torneio.status !== "EM_ANDAMENTO" ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">
          O placar só é gravado com o torneio em andamento.
        </p>
      ) : null}
      {partidas.every((partida) => !["PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"].includes(partida.status) || !partida.equipeA || !partida.equipeB) ? (
        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-navy">
          Nenhuma partida está pronta para receber placar. A chave precisa ter os dois adversários definidos.
        </p>
      ) : null}
      {grupos.map((status) => {
        const lista = partidas.filter((partida) => partida.status === status);
        if (lista.length === 0) return null;
        return (
          <section key={status} className="mt-6 space-y-3">
            <h2 className="font-display text-2xl text-navy">{ROTULO_PARTIDA[status as keyof typeof ROTULO_PARTIDA] ?? status}</h2>
            {lista.map((partida) => (
              <article key={partida.id} className="rounded-3xl bg-foam p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ocean">{nomeDaFase(partida.chave, partida.rodada, rodadas)} · {partida.codigo}</p>
                    <h2 className="text-2xl font-bold">
                      {partida.equipeA?.nome ?? "Aguardando adversário"} x {partida.equipeB?.nome ?? "Aguardando adversário"}
                    </h2>
                    <p className="text-sm text-navy/70">{partida.quadra?.nome ?? "Sem quadra"}{partida.placarA != null ? ` · ${partida.placarA} x ${partida.placarB}` : ""}</p>
                  </div>
                  <SeloPartida status={partida.status} />
                </div>
                {["PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"].includes(partida.status) && partida.equipeA && partida.equipeB ? (
                  <Formulario acao={acaoConfirmarPlacar} className="mt-4">
                    <input type="hidden" name="partidaId" value={partida.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo id={`a-${partida.id}`} rotulo={partida.equipeA.nome}>
                        <Entrada id={`a-${partida.id}`} name="placarA" inputMode="numeric" required placeholder="0" />
                      </Campo>
                      <Campo id={`b-${partida.id}`} rotulo={partida.equipeB.nome}>
                        <Entrada id={`b-${partida.id}`} name="placarB" inputMode="numeric" required placeholder="0" />
                      </Campo>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Botao type="submit">Confirmar resultado</Botao>
                    </div>
                  </Formulario>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {partida.status === "AGENDADA" || partida.status === "PRONTA" ? (
                    <Formulario acao={acaoIniciar} className="w-auto">
                      <input type="hidden" name="partidaId" value={partida.id} />
                      <Botao type="submit" variante="navy">Iniciar</Botao>
                    </Formulario>
                  ) : null}
                  {partida.status === "EM_ANDAMENTO" ? (
                    <Formulario acao={acaoPausarPartida} className="w-auto">
                      <input type="hidden" name="partidaId" value={partida.id} />
                      <Botao type="submit" variante="secundario">Pausar</Botao>
                    </Formulario>
                  ) : null}
                  {partida.status === "PAUSADA" ? (
                    <Formulario acao={acaoRetomarPartida} className="w-auto">
                      <input type="hidden" name="partidaId" value={partida.id} />
                      <Botao type="submit" variante="navy">Retomar</Botao>
                    </Formulario>
                  ) : null}
                  {partida.status === "AGENDADA" ? (
                    <Formulario acao={acaoDevolver} className="w-auto">
                      <input type="hidden" name="partidaId" value={partida.id} />
                      <Botao type="submit" variante="fantasma">Devolver à fila</Botao>
                    </Formulario>
                  ) : null}
                </div>
                {partida.status === "CONCLUIDA" ? (
                  <Formulario acao={acaoCorrigirPlacar} className="mt-4">
                    <input type="hidden" name="partidaId" value={partida.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo id={`ca-${partida.id}`} rotulo="Novo placar A">
                        <Entrada id={`ca-${partida.id}`} name="placarA" inputMode="numeric" required defaultValue={partida.placarA ?? 0} />
                      </Campo>
                      <Campo id={`cb-${partida.id}`} rotulo="Novo placar B">
                        <Entrada id={`cb-${partida.id}`} name="placarB" inputMode="numeric" required defaultValue={partida.placarB ?? 0} />
                      </Campo>
                    </div>
                    <Campo id={`motivo-${partida.id}`} rotulo="Motivo da correção">
                      <Entrada id={`motivo-${partida.id}`} name="motivo" required />
                    </Campo>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="confirmarDependencias" />
                      Confirmo o recálculo das partidas dependentes
                    </label>
                    <Botao type="submit" variante="secundario">Corrigir placar</Botao>
                  </Formulario>
                ) : null}
                {partida.historico.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-navy/70">
                    {partida.historico.map((item) => (
                      <li key={item.id}>
                        {formatarDataHora(item.criadoEm)} · {item.acao === "CORRECAO" ? "Correção" : "Confirmação"} por {item.admin.nome}
                        {item.motivo ? ` · ${item.motivo}` : ""} · {item.placarANovo} x {item.placarBNovo}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
