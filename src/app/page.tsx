import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { squadInclude, squadNames } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { formatDayHeading, formatTimeRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const matches = await prisma.challenge.findMany({
    where: { status: "accepted", endAt: { gt: new Date() } },
    orderBy: { startAt: "asc" },
    take: 3,
    include: {
      challengerSquad: { include: squadInclude },
      challengedSquad: { include: squadInclude },
    },
  });

  return (
    <div className="arena-bg min-h-screen">
      <div className="h-1.5 bg-ink" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <p className="font-display text-xl font-semibold">Ache sua dupla</p>
        <div className="flex gap-2">
          {user ? (
            <Link className="btn-primary" href="/inicio">
              Ir para a arena
            </Link>
          ) : (
            <>
              <Link className="btn-ghost" href="/entrar">
                Entrar
              </Link>
              <Link className="btn-primary" href="/cadastro">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <p className="kicker">Arena esportiva</p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            O jogo começa quando a equipe está formada.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink/75">
            Cadastre-se, monte uma dupla, um trio ou um quarteto e desafie outra equipe. Os esportes da arena são vôlei, beach tennis e futevôlei.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn-lime px-5 py-3" href={user ? "/inicio" : "/cadastro"}>
              {user ? "Continuar" : "Criar conta"}
            </Link>
            {!user && (
              <Link className="btn-ghost px-5 py-3" href="/entrar">
                Entrar na arena
              </Link>
            )}
          </div>
          <ol className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Cadastre-se", "E-mail e senha, só nesta arena."],
              ["02", "Forme a equipe", "Dupla, trio ou quarteto. Quem é convidado aceita ou recusa."],
              ["03", "Marque o jogo", "Desafie outra equipe do mesmo formato e fechem o horário."],
            ].map(([step, title, text]) => (
              <li key={step} className="card">
                <p className="font-display text-2xl text-pine">{step}</p>
                <p className="mt-2 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-ink/70">{text}</p>
              </li>
            ))}
          </ol>
        </section>
        <aside className="court-grid card relative overflow-hidden bg-ink text-paper">
          <p className="kicker text-lime">Próximos jogos</p>
          <h2 className="mt-2 font-display text-3xl text-white">Agenda da arena</h2>
          <div className="mt-6 flex flex-col gap-3">
            {matches.length === 0 && <p className="text-sm text-white/70">Nenhum desafio confirmado ainda.</p>}
            {matches.map((match) => (
              <article key={match.id} className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs uppercase tracking-wider text-lime">{formatDayHeading(match.startAt)}</p>
                <p className="mt-1 font-display text-2xl">{formatTimeRange(match.startAt, match.endAt)}</p>
                <p className="mt-1 text-sm text-white/80">
                  {match.sport} · {match.court}
                </p>
                <p className="mt-3 text-sm">{squadNames(match.challengerSquad)}</p>
                <p className="text-sm text-white/60">contra {squadNames(match.challengedSquad)}</p>
              </article>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
