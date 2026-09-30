import Link from "next/link";
import { Banner } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSquad, squadInclude, squadNames } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { formatDayHeading, formatTimeRange, spParts } from "@/lib/time";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const squad = await getActiveSquad(user.id);
  const matches = await prisma.challenge.findMany({
    where: { status: "accepted" },
    orderBy: { startAt: "asc" },
    include: {
      challengerSquad: { include: squadInclude },
      challengedSquad: { include: squadInclude },
    },
  });

  const groups = new Map<string, typeof matches>();
  for (const match of matches) {
    const key = spParts(match.startAt).dateKey;
    const list = groups.get(key) ?? [];
    list.push(match);
    groups.set(key, list);
  }

  return (
    <>
      <Banner ok={params.ok} erro={params.erro} />
      <section>
        <p className="kicker">Agenda</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Jogos confirmados</h1>
        <p className="mt-2 max-w-2xl text-ink/70">Quando as duas equipes aceitam o horário, o desafio entra aqui.</p>
      </section>
      {matches.length === 0 && (
        <div className="card">
          <p>Nenhum jogo confirmado.</p>
          {squad && (
            <Link className="btn-primary mt-4" href="/desafiar">
              Desafiar uma equipe
            </Link>
          )}
        </div>
      )}
      {[...groups.entries()].map(([key, items]) => (
        <section key={key} className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">{formatDayHeading(items[0].startAt)}</h2>
          {items.map((match) => {
            const mine = squad && (match.challengerSquadId === squad.id || match.challengedSquadId === squad.id);
            const past = match.endAt.getTime() < Date.now();
            return (
              <article key={match.id} className={`card grid gap-4 sm:grid-cols-[140px_1fr] ${past ? "opacity-70" : ""}`}>
                <div>
                  <p className="font-display text-3xl">{formatTimeRange(match.startAt, match.endAt)}</p>
                  {mine && <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-pine">Seu jogo</p>}
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {match.sport} · {match.court}
                  </p>
                  <p className="mt-1">{squadNames(match.challengerSquad)}</p>
                  <p className="text-ink/60">contra {squadNames(match.challengedSquad)}</p>
                  <Link className="mt-3 inline-block text-sm font-semibold text-pine" href={`/desafios/${match.id}`}>
                    Ver desafio
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </>
  );
}
