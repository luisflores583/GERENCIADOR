import Link from "next/link";
import { notFound } from "next/navigation";
import { CounterForm, DecisionButtons } from "@/components/challenge-form";
import { Banner, StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { availabilityOf, getActivePair, getChallenge, listOpenChallenges, membersOf, pairNames } from "@/lib/data";
import { buildSlots } from "@/lib/schedule";
import { formatSlot, formatTimeRange } from "@/lib/time";

export default async function DesafioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;
  const query = await searchParams;
  const [challenge, pair] = await Promise.all([getChallenge(id), getActivePair(user.id)]);
  if (!challenge) notFound();
  const involved = pair && (challenge.challengerPairId === pair.id || challenge.challengedPairId === pair.id);
  if (!involved || !pair) {
    return (
      <section className="card">
        <p>Esse desafio não é da sua dupla.</p>
        <Link className="btn-ghost mt-4" href="/desafios">
          Voltar
        </Link>
      </section>
    );
  }

  const myTurn =
    (challenge.awaiting === "challenger" && challenge.challengerPairId === pair.id) ||
    (challenge.awaiting === "challenged" && challenge.challengedPairId === pair.id);
  const open = challenge.status === "pending" || challenge.status === "countered";
  const slots =
    myTurn && open
      ? buildSlots({
          users: availabilityOf([...membersOf(challenge.challengerPair), ...membersOf(challenge.challengedPair)]),
          challenges: await listOpenChallenges(),
          pairIds: [challenge.challengerPairId, challenge.challengedPairId],
          ignoreId: challenge.id,
          courts: [challenge.court],
        }).filter((slot) => !(slot.startIso === challenge.startAt.toISOString() && slot.endIso === challenge.endAt.toISOString()))
      : [];

  return (
    <>
      <Banner ok={query.ok} erro={query.erro} />
      <Link className="text-sm font-semibold text-pine" href="/desafios">
        ← Desafios
      </Link>
      <article className="card">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={challenge.status} />
          {myTurn && open && <span className="rounded-full bg-clay px-2.5 py-1 text-xs font-semibold text-white">Sua vez</span>}
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold">
          {challenge.sport} · {challenge.court}
        </h1>
        <p className="mt-2 text-lg">{formatSlot(challenge.startAt, challenge.endAt)}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-sand p-4">
            <p className="kicker">Desafiou</p>
            <p className="mt-2 font-semibold">{pairNames(challenge.challengerPair)}</p>
          </div>
          <div className="rounded-2xl bg-sand p-4">
            <p className="kicker">Desafiada</p>
            <p className="mt-2 font-semibold">{pairNames(challenge.challengedPair)}</p>
          </div>
        </div>
      </article>
      <section className="card">
        <h2 className="font-display text-2xl">Horários propostos</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {challenge.proposals.map((proposal, index) => (
            <li key={proposal.id} className="rounded-2xl border border-line px-4 py-3 text-sm">
              <span className="font-semibold">{index === 0 ? "Proposta inicial" : "Contraproposta"}</span>
              <span className="text-ink/70"> · {formatSlot(proposal.startAt, proposal.endAt)}</span>
              {proposal.startAt.getTime() === challenge.startAt.getTime() && challenge.status !== "declined" && (
                <span className="ml-2 text-pine">horário atual</span>
              )}
            </li>
          ))}
        </ol>
      </section>
      {open && myTurn && (
        <section className="card flex flex-col gap-5">
          <div>
            <h2 className="font-display text-2xl">Responder</h2>
            <p className="mt-1 text-sm text-ink/70">
              Aceite {formatTimeRange(challenge.startAt, challenge.endAt)}, recuse ou proponha outro horário na {challenge.court}.
            </p>
          </div>
          <DecisionButtons id={challenge.id} />
          <CounterForm id={challenge.id} slots={slots} />
        </section>
      )}
      {open && !myTurn && <p className="text-sm text-ink/70">Aguardando a outra dupla responder a este horário.</p>}
      {challenge.status === "accepted" && (
        <Link className="btn-primary w-fit" href="/agenda">
          Ver na agenda
        </Link>
      )}
    </>
  );
}
