import Link from "next/link";
import { ChallengeForm } from "@/components/challenge-form";
import { SquadMark } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { otherTeamPhrase } from "@/lib/constants";
import {
  availabilityOf,
  commonSports,
  getActiveSquad,
  getSquadById,
  listOpenChallenges,
  membersOf,
  roster,
  sportsOfSquad,
  squadInclude,
  squadNames,
  squadTitle,
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
  const squad = await getActiveSquad(user.id);
  if (!squad) {
    return (
      <section className="card">
        <h1 className="font-display text-3xl">Forme uma equipe primeiro</h1>
        <p className="mt-2 text-ink/70">Dupla, trio ou quarteto: só uma equipe ativa pode lançar um desafio.</p>
        <Link className="btn-primary mt-4" href="/dupla">
          Escolher formato
        </Link>
      </section>
    );
  }

  const others = await prisma.squad.findMany({
    where: { status: "active", kind: squad.kind, id: { not: squad.id } },
    include: squadInclude,
    orderBy: { createdAt: "asc" },
  });
  const selected = params.adversaria ? others.find((item) => item.id === params.adversaria) ?? null : null;
  const loaded = selected ? await getSquadById(selected.id) : null;
  const shared = loaded ? commonSports(squad, loaded) : [];
  const challenges = await listOpenChallenges();
  const slots =
    loaded && shared.length > 0
      ? buildSlots({
          users: availabilityOf([...membersOf(squad), ...membersOf(loaded)]),
          challenges,
          pairIds: [squad.id, loaded.id],
        })
      : [];
  const opponent = otherTeamPhrase(squad.kind);

  return (
    <>
      <section>
        <p className="kicker">Desafio</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Desafiar {opponent}</h1>
        <p className="mt-2 max-w-2xl text-ink/70">
          Escolha esporte, espaço e um horário livre para as duas equipes. A equipe desafiada pode aceitar, recusar ou propor outro horário.
        </p>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        {others.map((item) => {
          const sports = commonSports(squad, item);
          const active = selected?.id === item.id;
          const names = roster(item).map((member) => member.user.name);
          return (
            <Link key={item.id} href={`/desafiar?adversaria=${item.id}`} className={`card flex items-center gap-4 ${active ? "border-ink ring-2 ring-lime" : ""}`}>
              <SquadMark names={names} size="sm" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-pine">{squadTitle(item)}</p>
                <p className="font-semibold">{squadNames(item)}</p>
                <p className="text-sm text-ink/60">{sports.length > 0 ? `Em comum: ${sports.join(", ")}` : "Nenhum esporte em comum"}</p>
              </div>
            </Link>
          );
        })}
        {others.length === 0 && <p className="text-sm text-ink/60">Ainda não há {opponent} formado na arena.</p>}
      </section>
      {loaded && (
        <section className="card">
          <h2 className="font-display text-2xl">Contra {squadNames(loaded)}</h2>
          <p className="mt-1 text-sm text-ink/60">Esportes da equipe: {sportsOfSquad(loaded).join(", ")}</p>
          {shared.length === 0 ? (
            <p className="mt-4 text-sm">Não dá para desafiar: as equipes não praticam o mesmo esporte.</p>
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
