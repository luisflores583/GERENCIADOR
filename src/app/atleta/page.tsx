import Link from "next/link";
import { SeloStatus } from "@/components/selo";
import { formatarDataHora } from "@/lib/formatacao";
import { ROTULO_FORMATO } from "@/lib/rotulos";
import { prisma } from "@/server/db";
import { exigirAtleta } from "@/server/sessao";

export default async function InicioAtleta() {
  const { atleta } = await exigirAtleta();
  const [abertos, inscricoes] = await Promise.all([
    prisma.torneio.findMany({ where: { status: "INSCRICOES_ABERTAS" }, orderBy: { inicioEm: "asc" } }),
    prisma.inscricao.findMany({
      where: { atletaId: atleta.id },
      include: { torneio: true, equipe: { include: { membros: { include: { atleta: true } } } } },
      orderBy: { criadaEm: "desc" },
    }),
  ]);
  const equipeIds = inscricoes.map((item) => item.equipeId).filter((id): id is string => Boolean(id));
  const proximas = equipeIds.length
    ? await prisma.partida.findMany({
        where: {
          status: { in: ["AGENDADA", "EM_ANDAMENTO", "PRONTA", "PAUSADA"] },
          OR: [{ equipeAId: { in: equipeIds } }, { equipeBId: { in: equipeIds } }],
        },
        include: { equipeA: true, equipeB: true, quadra: true, torneio: true },
        orderBy: { prontaEm: "asc" },
        take: 3,
      })
    : [];
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl text-navy">Olá, {atleta.apelido || atleta.nomeCompleto}</h1>
        <p className="mt-2 text-navy/70">Seus torneios, o próximo jogo e a situação da equipe.</p>
        <Link className="mt-3 inline-flex min-h-14 items-center font-semibold text-ocean" href="/atleta/perfil">Editar perfil</Link>
      </header>
      <section>
        <h2 className="font-display text-2xl">Próximo jogo</h2>
        {proximas.length === 0 ? <p className="mt-2">Nenhum jogo liberado agora.</p> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {proximas.map((partida) => (
            <article key={partida.id} className="rounded-3xl bg-foam p-4 shadow-card">
              <p className="text-sm text-ocean">{partida.torneio.nome}</p>
              <p className="text-xl font-bold">{partida.equipeA?.nome} x {partida.equipeB?.nome}</p>
              <p>{partida.quadra?.nome ?? "Quadra a definir"} · {partida.inicioEm ? formatarDataHora(partida.inicioEm) : "horário a definir"}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-display text-2xl">Minhas inscrições</h2>
        <div className="mt-3 space-y-3">
          {inscricoes.map((inscricao) => (
            <Link key={inscricao.id} href={`/atleta/torneios/${inscricao.torneioId}`} className="block rounded-3xl bg-foam p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-bold">{inscricao.torneio.nome}</h3>
                <SeloStatus status={inscricao.torneio.status} />
              </div>
              <p className="mt-1">{ROTULO_FORMATO[inscricao.torneio.formato]} · {inscricao.equipe?.nome ?? "Sem equipe ainda"}</p>
              {inscricao.equipe ? <p>Vitórias {inscricao.equipe.vitorias} · Derrotas {inscricao.equipe.derrotas}</p> : null}
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-display text-2xl">Inscrições abertas</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {abertos.map((torneio) => (
            <Link key={torneio.id} href={`/atleta/torneios/${torneio.id}`} className="rounded-3xl bg-white p-4 shadow-card">
              <h3 className="text-xl font-bold">{torneio.nome}</h3>
              <p>{formatarDataHora(torneio.inicioEm)} · {torneio.local}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
