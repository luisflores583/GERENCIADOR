import Link from "next/link";
import { Banner, PairMark, SportPills, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getActivePair, otherMember, pairNames, sportsOf, sportsOfPair } from "@/lib/data";
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
  const pair = await getActivePair(user.id);
  const invites = await prisma.partnership.findMany({
    where: { inviteeId: user.id, status: "pending" },
    include: { inviter: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const challenges = pair
    ? await prisma.challenge.findMany({
        where: {
          status: { in: ["pending", "countered", "accepted"] },
          OR: [{ challengerPairId: pair.id }, { challengedPairId: pair.id }],
          endAt: { gt: new Date() },
        },
        orderBy: { startAt: "asc" },
        include: {
          challengerPair: { include: { inviter: true, invitee: true } },
          challengedPair: { include: { inviter: true, invitee: true } },
        },
      })
    : [];

  const nextMatch = challenges.find((item) => item.status === "accepted");
  const waiting = challenges.filter((item) => item.status === "pending" || item.status === "countered");
  const partner = pair ? otherMember(pair, user.id) : null;

  return (
    <>
      <Banner ok={params.ok} erro={params.erro} />
      <section>
        <p className="kicker">Início</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Olá, {user.name.split(" ")[0]}</h1>
        <p className="mt-2 max-w-2xl text-ink/70">Sua dupla, os convites e os jogos da arena ficam neste painel.</p>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card">
          <p className="kicker">Sua dupla</p>
          {pair && partner ? (
            <div className="mt-4 flex items-center gap-4">
              <PairMark a={user.name} b={partner.name} />
              <div>
                <p className="font-display text-2xl">{partner.name}</p>
                <div className="mt-2">
                  <SportPills sports={sportsOfPair(pair)} />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-ink/70">Você ainda não tem dupla. Cada pessoa pode ter uma dupla ativa por vez.</p>
              <Link className="btn-primary mt-4" href="/atletas">
                Ver atletas
              </Link>
            </div>
          )}
          {pair && (
            <Link className="btn-lime mt-5" href="/desafiar">
              Desafiar outra dupla
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
                {pairNames(nextMatch.challengerPair)} contra {pairNames(nextMatch.challengedPair)}
              </p>
              <Link className="btn-lime mt-5" href="/agenda">
                Abrir agenda
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-white/75">Nenhum jogo confirmado com a sua dupla.</p>
          )}
        </article>
      </section>
      {invites.length > 0 && (
        <section className="card">
          <p className="kicker">Convites</p>
          <ul className="mt-3 flex flex-col gap-2">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3">
                <span>{invite.inviter.name} quer formar dupla com você.</span>
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
              (challenge.challengerPairId === pair?.id && challenge.awaiting === "challenger") ||
              (challenge.challengedPairId === pair?.id && challenge.awaiting === "challenged");
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
                    {pairNames(challenge.challengerPair)} contra {pairNames(challenge.challengedPair)}
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
      {!pair && (
        <p className="text-sm text-ink/60">
          Esportes no seu perfil: {sportsOf(await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { sports: { select: { sport: true } } } })).join(", ") || "nenhum ainda"}.{" "}
          <Link className="font-semibold text-pine" href="/perfil">
            Completar perfil
          </Link>
        </p>
      )}
    </>
  );
}
