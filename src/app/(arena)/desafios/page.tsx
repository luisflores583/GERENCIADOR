import Link from "next/link";
import { Banner, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSquad, squadInclude, squadNames } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { formatSlot } from "@/lib/time";

export default async function DesafiosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const squad = await getActiveSquad(user.id);
  const challenges = squad
    ? await prisma.challenge.findMany({
        where: { OR: [{ challengerSquadId: squad.id }, { challengedSquadId: squad.id }] },
        orderBy: { updatedAt: "desc" },
        include: {
          challengerSquad: { include: squadInclude },
          challengedSquad: { include: squadInclude },
        },
      })
    : [];

  return (
    <>
      <Banner ok={params.ok} erro={params.erro} />
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Desafios</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Jogos propostos</h1>
        </div>
        {squad && (
          <Link className="btn-primary" href="/desafiar">
            Novo desafio
          </Link>
        )}
      </section>
      {!squad && (
        <p className="text-sm text-ink/70">
          Forme uma dupla, um trio ou um quarteto para desafiar.{" "}
          <Link className="font-semibold text-pine" href="/dupla">
            Escolher formato
          </Link>
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {challenges.map((challenge) => {
          const myTurn =
            (challenge.challengerSquadId === squad?.id && challenge.awaiting === "challenger") ||
            (challenge.challengedSquadId === squad?.id && challenge.awaiting === "challenged");
          return (
            <li key={challenge.id}>
              <Link href={`/desafios/${challenge.id}`} className="card block hover:border-ink/40">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={challenge.status} />
                  {myTurn && <span className="rounded-full bg-clay px-2.5 py-1 text-xs font-semibold text-white">Sua vez</span>}
                </div>
                <p className="mt-3 font-display text-2xl">
                  {challenge.sport} · {challenge.court}
                </p>
                <p className="mt-1 text-sm text-ink/70">{formatSlot(challenge.startAt, challenge.endAt)}</p>
                <p className="mt-2 text-sm">
                  {squadNames(challenge.challengerSquad)} contra {squadNames(challenge.challengedSquad)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      {squad && challenges.length === 0 && <p className="text-sm text-ink/60">Nenhum desafio ainda.</p>}
    </>
  );
}
