import Link from "next/link";
import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { Formulario } from "@/components/formulario";
import { MenuTorneio } from "@/components/menu-torneio";
import { SeloSituacao } from "@/components/selo";
import { acaoStatus } from "@/server/acoes";
import { montarPainel } from "@/server/consultas";
import { prisma } from "@/server/db";

export default async function Encerramento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const torneio = await prisma.torneio.findUnique({ where: { id } });
  if (!torneio) notFound();
  const painel = await montarPainel(torneio.slug);
  if (!painel) notFound();
  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <h1 className="font-display text-4xl text-navy">Encerramento</h1>
      {painel.modeloChave === "FOLHA_16" ? (
        <div className="mt-3 space-y-2 text-2xl">
          <p>{painel.campeaoOuro ? `Campeão da série Ouro: ${painel.campeaoOuro}.` : "A série Ouro ainda não tem campeão."}</p>
          <p>{painel.campeaoPrata ? `Campeã da série Prata: ${painel.campeaoPrata}.` : "A série Prata ainda não tem campeã."}</p>
        </div>
      ) : painel.modeloChave === "FOLHA_32" ? (
        <div className="mt-3 space-y-2 text-2xl">
          <p>Jogo 29 · Disputa de 3º lugar.</p>
          <p>Jogo 30 · Final.</p>
        </div>
      ) : painel.campeao ? (
        <p className="mt-3 text-2xl">Campeã: {painel.campeao}. Vice: {painel.vice}.</p>
      ) : (
        <p className="mt-3">O campeão ainda não está definido.</p>
      )}
      <ol className="mt-4 space-y-2">
        {painel.classificacao.map((equipe) => (
          <li key={equipe.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-foam px-4 py-3">
            <span>{equipe.posicao}. {equipe.nome} — {equipe.membros.join(", ")} — {equipe.vitorias}V {equipe.derrotas}D</span>
            <SeloSituacao situacao={equipe.situacao} />
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link className="inline-flex min-h-14 items-center rounded-2xl bg-navy px-5 font-semibold text-white" href={`/api/admin/torneios/${torneio.id}/csv`}>
          Baixar CSV
        </Link>
        <Link className="inline-flex min-h-14 items-center rounded-2xl bg-white px-5 font-semibold text-navy" href={`/api/admin/torneios/${torneio.id}/pdf`}>
          Baixar PDF
        </Link>
      </div>
      <Formulario acao={acaoStatus} className="mt-6 max-w-xl">
        <input type="hidden" name="torneioId" value={torneio.id} />
        <input type="hidden" name="acao" value="finalizar" />
        <label className="flex items-center gap-2"><input type="checkbox" name="confirmo" /> Confirmo o encerramento e a publicação do resultado</label>
        <Botao type="submit">Finalizar torneio</Botao>
      </Formulario>
    </div>
  );
}
