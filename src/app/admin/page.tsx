import Link from "next/link";
import { ExcluirTorneio } from "@/components/excluir-torneio";
import { ReiniciarTorneio } from "@/components/reiniciar-torneio";
import { SeloStatus } from "@/components/selo";
import { formatarData } from "@/lib/formatacao";
import { prisma } from "@/server/db";

export default async function PainelAdmin() {
  const [torneios, pendentes, emJogo] = await Promise.all([
    prisma.torneio.findMany({ orderBy: { inicioEm: "desc" }, include: { _count: { select: { equipes: true, partidas: true } } } }),
    prisma.inscricao.count({ where: { status: "PENDENTE" } }),
    prisma.partida.count({ where: { status: "EM_ANDAMENTO" } }),
  ]);
  const andamento = torneios.filter((torneio) => torneio.status === "EM_ANDAMENTO").length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-navy">Painel do organizador</h1>
          <p className="mt-2 text-navy/70">Indicadores do dia e atalhos para os torneios.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-14 items-center rounded-2xl bg-coral px-5 font-semibold text-white" href="/admin/torneios/novo">
            Novo torneio
          </Link>
          <Link className="inline-flex min-h-14 items-center rounded-2xl bg-white px-5 font-semibold text-navy" href="/admin/quadras">
            Quadras
          </Link>
        </div>
      </div>
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="rounded-3xl bg-navy p-5 text-white"><p>Em andamento</p><p className="text-4xl font-bold">{andamento}</p></article>
        <article className="rounded-3xl bg-foam p-5 shadow-card"><p>Inscrições pendentes</p><p className="text-4xl font-bold">{pendentes}</p></article>
        <article className="rounded-3xl bg-foam p-5 shadow-card"><p>Partidas rolando</p><p className="text-4xl font-bold">{emJogo}</p></article>
      </section>
      <section className="mt-8 space-y-3">
        {torneios.map((torneio) => (
          <article key={torneio.id} className="rounded-3xl bg-foam p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl text-navy">{torneio.nome}</h2>
              <SeloStatus status={torneio.status} />
            </div>
            <p className="mt-2 text-navy/70">
              {formatarData(torneio.inicioEm)} · {torneio._count.equipes} equipes · {torneio._count.partidas} partidas na chave
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="inline-flex min-h-14 items-center rounded-2xl bg-coral px-4 font-semibold text-white" href={`/admin/torneios/${torneio.id}/jogos`}>
                Registrar resultado
              </Link>
              <Link className="inline-flex min-h-14 items-center rounded-2xl bg-navy px-4 font-semibold text-white" href={`/admin/torneios/${torneio.id}/inscricoes`}>
                Inscrever atleta
              </Link>
              <Link className="inline-flex min-h-14 items-center rounded-2xl bg-white px-4 font-semibold text-navy" href={`/admin/torneios/${torneio.id}`}>
                Configurar
              </Link>
            </div>
            <div className="mt-4 grid items-start gap-6 border-t border-navy/10 pt-4 lg:grid-cols-2">
              <ReiniciarTorneio torneioId={torneio.id} />
              <ExcluirTorneio torneioId={torneio.id} nome={torneio.nome} />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
