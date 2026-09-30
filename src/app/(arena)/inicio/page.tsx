import Link from "next/link";
import { Banner, SportPills, SquadMark, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatById, yourTeam } from "@/lib/constants";
import { getActiveSquad, roster, sportsOfSquad, squadInclude, squadNames } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { formatSlot } from "@/lib/time";

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const squad = await getActiveSquad(user.id);
  const invites = await prisma.squadMember.findMany({
    where: { userId: user.id, status: "pending", squad: { status: "forming" } },
    include: { squad: { include: { creator: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const challenges = squad
    ? await prisma.challenge.findMany({
        where: {
          status: { in: ["pending", "countered", "accepted"] },
          OR: [{ challengerSquadId: squad.id }, { challengedSquadId: squad.id }],
          endAt: { gt: new Date() },
        },
        orderBy: { startAt: "asc" },
        include: {
          challengerSquad: { include: squadInclude },
          challengedSquad: { include: squadInclude },
        },
      })
    : [];
  const nextMatch = challenges.find((item) => item.status === "accepted");
  const waiting = challenges.filter((item) => item.status === "pending" || item.status === "countered");
  const people = squad ? roster(squad) : [];

  return (
    <>
      <Banner ok={params.ok} erro={params.erro} />
      <section>
        <p className="kicker">Início</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Olá, {user.name.split(" ")[0]}</h1>
        <p className="mt-2 max-w-2xl text-ink/70">Sua equipe, os convites e os jogos da arena ficam neste painel.</p>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card">
          <p className="kicker">{squad ? yourTeam(squad.kind) : "Sua equipe"}</p>
          {squad ? (
            <div className="mt-4">
              <SquadMark names={people.map((member) => member.user.name)} />
              <p className="mt-3 font-display text-2xl">{squadNames(squad)}</p>
              <div className="mt-2">
                <SportPills sports={sportsOfSquad(squad)} />
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-ink/70">Você ainda não tem equipe. Forme uma dupla, um trio ou um quarteto.</p>
              <Link className="btn-primary mt-4" href="/dupla">
                Escolher formato
              </Link>
            </div>
          )}
          {squad && (
            <Link className="btn-lime mt-5" href="/desafiar">
              Desafiar {formatById(squad.kind).id === "dupla" ? "outra dupla" : formatById(squad.kind).id === "trio" ? "outro trio" : "outro quarteto"}
            </Link>
          )}
        </article>
        <article className="card bg-ink text-paper">
          <p className="kicker text-lime">Próximo jogo</p>
          {nextMatch ? (
            <div className="mt-3">
              <p className="font-display text-3xl">{formatSlot(nextMatch.startAt, nextMatch.endAt)}</p>
              <p className="mt-2 text-white/80">
                {nextMatch.sport} · {nextMatch.court}
              </p>
              <p className="mt-3 text-sm text-white/70">
                {squadNames(nextMatch.challengerSquad)} contra {squadNames(nextMatch.challengedSquad)}
              </p>
              <Link className="btn-lime mt-5" href="/agenda">
                Abrir agenda
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-white/75">Nenhum jogo confirmado com a sua equipe.</p>
          )}
        </article>
      </section>
      {invites.length > 0 && (
        <section className="card">
          <p className="kicker">Convites</p>
          <ul className="mt-3 flex flex-col gap-2">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3">
                <span>
                  {invite.squad.creator.name} quer você {formatById(invite.squad.kind).id === "dupla" ? "na dupla" : formatById(invite.squad.kind).id === "trio" ? "no trio" : "no quarteto"}.
                </span>
                <Link className="btn-ghost" href="/dupla">
                  Responder
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {waiting.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">Desafios em aberto</h2>
          {waiting.map((challenge) => {
            const myTurn =
              (challenge.challengerSquadId === squad?.id && challenge.awaiting === "challenger") ||
              (challenge.challengedSquadId === squad?.id && challenge.awaiting === "challenged");
            return (
              <article key={challenge.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={challenge.status} />
                    {myTurn && <span className="rounded-full bg-clay px-2.5 py-1 text-xs font-semibold text-white">Sua vez</span>}
                  </div>
                  <p className="mt-2 font-semibold">
                    {challenge.sport} · {challenge.court}
                  </p>
                  <p className="text-sm text-ink/70">{formatSlot(challenge.startAt, challenge.endAt)}</p>
                  <p className="mt-1 text-sm">
                    {squadNames(challenge.challengerSquad)} contra {squadNames(challenge.challengedSquad)}
                  </p>
                </div>
                <Link className="btn-primary" href={`/desafios/${challenge.id}`}>
                  {myTurn ? "Responder" : "Ver desafio"}
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
