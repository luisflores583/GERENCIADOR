import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { Campo, Entrada, Selecao } from "@/components/campo";
import { Formulario } from "@/components/formulario";
import { MenuTorneio } from "@/components/menu-torneio";
import { formatarDataHora } from "@/lib/formatacao";
import { acaoDistribuir, acaoIndisponivel, acaoTrocarQuadra, acaoVincularQuadra } from "@/server/acoes";
import { prisma } from "@/server/db";

export default async function QuadrasDoTorneio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const torneio = await prisma.torneio.findUnique({
    where: { id },
    include: {
      quadras: { include: { quadra: true }, orderBy: { ordem: "asc" } },
      partidas: { include: { equipeA: true, equipeB: true, quadra: true } },
    },
  });
  if (!torneio) notFound();
  const todas = await prisma.quadra.findMany({ orderBy: { nome: "asc" } });
  const ligadas = new Set(torneio.quadras.map((item) => item.quadraId));
  const moveis = torneio.partidas.filter((partida) => ["PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"].includes(partida.status));
  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <h1 className="font-display text-4xl text-navy">Quadras do torneio</h1>
      <p className="mt-2">Até {torneio.quadrasSimultaneas} jogo(s) ao mesmo tempo. Descanso mínimo: {torneio.descansoMinutos} min.</p>
      <Formulario acao={acaoDistribuir} className="mt-4 w-auto">
        <input type="hidden" name="torneioId" value={torneio.id} />
        <Botao type="submit">Distribuir agora</Botao>
      </Formulario>
      <section className="mt-6 grid gap-3 md:grid-cols-2">
        {todas.map((quadra) => {
          const vinculo = torneio.quadras.find((item) => item.quadraId === quadra.id);
          return (
            <article key={quadra.id} className="rounded-3xl bg-foam p-4 shadow-card">
              <h2 className="text-xl font-bold">{quadra.nome}</h2>
              <p className="text-sm">{vinculo?.habilitada ? "Habilitada" : ligadas.has(quadra.id) ? "Desabilitada" : "Fora deste torneio"}</p>
              {vinculo?.indisponivelAte ? <p className="text-sm">Indisponível até {formatarDataHora(vinculo.indisponivelAte)}</p> : null}
              <Formulario acao={acaoVincularQuadra} className="mt-3">
                <input type="hidden" name="torneioId" value={torneio.id} />
                <input type="hidden" name="quadraId" value={quadra.id} />
                <label className="flex items-center gap-2"><input type="checkbox" name="habilitada" defaultChecked={vinculo?.habilitada ?? false} /> Habilitada</label>
                <Botao type="submit" variante="secundario">Salvar</Botao>
              </Formulario>
              {vinculo ? (
                <Formulario acao={acaoIndisponivel} className="mt-3">
                  <input type="hidden" name="torneioId" value={torneio.id} />
                  <input type="hidden" name="quadraId" value={quadra.id} />
                  <Campo id={`ate-${quadra.id}`} rotulo="Indisponível até" dica="Deixe vazio para liberar.">
                    <Entrada id={`ate-${quadra.id}`} name="ate" type="datetime-local" />
                  </Campo>
                  <Botao type="submit" variante="fantasma">Atualizar indisponibilidade</Botao>
                </Formulario>
              ) : null}
            </article>
          );
        })}
      </section>
      <section className="mt-8">
        <h2 className="font-display text-2xl">Troca manual</h2>
        {moveis.map((partida) => (
          <Formulario key={partida.id} acao={acaoTrocarQuadra} className="mt-3 rounded-3xl bg-white p-4 shadow-card">
            <input type="hidden" name="partidaId" value={partida.id} />
            <p className="font-semibold">{partida.equipeA?.nome ?? "Aguardando"} x {partida.equipeB?.nome ?? "Aguardando"}</p>
            <Campo id={`quadra-${partida.id}`} rotulo="Quadra">
              <Selecao id={`quadra-${partida.id}`} name="quadraId" defaultValue={partida.quadraId ?? ""}>
                <option value="">Escolha</option>
                {torneio.quadras.filter((item) => item.habilitada).map((item) => (
                  <option key={item.id} value={item.quadraId}>{item.quadra.nome}</option>
                ))}
              </Selecao>
            </Campo>
            <Botao type="submit">Trocar quadra</Botao>
          </Formulario>
        ))}
      </section>
    </div>
  );
}
