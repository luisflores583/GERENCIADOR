import Link from "next/link";
import { ChallengeForm } from "@/components/challenge-form";
import { PairMark } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import {
  availabilityOf,
  commonSports,
  getActivePair,
  getPairById,
  listOpenChallenges,
  membersOf,
  pairNames,
  sportsOfPair,
} from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { buildSlots } from "@/lib/schedule";

export default async function DesafiarPage({
  searchParams,
}: {
  searchParams: Promise<{ adversaria?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const pair = await getActivePair(user.id);
  if (!pair) {
    return (
      <section className="card">
        <h1 className="font-display text-3xl">Forme uma dupla primeiro</h1>
        <p className="mt-2 text-ink/70">Só uma dupla ativa pode lançar um desafio.</p>
        <Link className="btn-primary mt-4" href="/atletas">
          Ver atletas
        </Link>
      </section>
    );
  }

  const others = await prisma.partnership.findMany({
    where: { status: "accepted", id: { not: pair.id } },
    include: {
      inviter: { select: { id: true, name: true, email: true, sports: { select: { sport: true } }, availability: { select: { dayOfWeek: true, startMin: true, endMin: true } } } },
      invitee: { select: { id: true, name: true, email: true, sports: { select: { sport: true } }, availability: { select: { dayOfWeek: true, startMin: true, endMin: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const selected = params.adversaria ? others.find((item) => item.id === params.adversaria) ?? null : null;
  const loaded = selected ? await getPairById(selected.id) : null;
  const shared = loaded ? commonSports(pair, loaded) : [];
  const challenges = await listOpenChallenges();
  const slots =
    loaded && shared.length > 0
      ? buildSlots({
          users: availabilityOf([...membersOf(pair), ...membersOf(loaded)]),
          challenges,
          pairIds: [pair.id, loaded.id],
        })
      : [];

  return (
    <>
      <section>
        <p className="kicker">Desafio</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Desafiar outra dupla</h1>
        <p className="mt-2 max-w-2xl text-ink/70">
          Escolha esporte, espaço e um horário livre para as duas duplas. A dupla desafiada pode aceitar, recusar ou propor outro horário.
        </p>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        {others.map((item) => {
          const sports = commonSports(pair, item);
          const active = selected?.id === item.id;
          return (
            <Link
              key={item.id}
              href={`/desafiar?adversaria=${item.id}`}
              className={`card flex items-center gap-4 ${active ? "border-ink ring-2 ring-lime" : ""}`}
            >
              <PairMark a={item.inviter.name} b={item.invitee.name} size="sm" />
              <div>
                <p className="font-semibold">{pairNames(item)}</p>
                <p className="text-sm text-ink/60">
                  {sports.length > 0 ? `Em comum: ${sports.join(", ")}` : "Nenhum esporte em comum"}
                </p>
              </div>
            </Link>
          );
        })}
        {others.length === 0 && <p className="text-sm text-ink/60">Ainda não há outra dupla formada na arena.</p>}
      </section>
      {loaded && (
        <section className="card">
          <h2 className="font-display text-2xl">Contra {pairNames(loaded)}</h2>
          <p className="mt-1 text-sm text-ink/60">Esportes da dupla: {sportsOfPair(loaded).join(", ")}</p>
          {shared.length === 0 ? (
            <p className="mt-4 text-sm">Não dá para desafiar: as duplas não praticam o mesmo esporte.</p>
          ) : (
            <div className="mt-4">
              <ChallengeForm adversaryId={loaded.id} sports={shared} slots={slots} />
            </div>
          )}
        </section>
      )}
    </>
  );
}
