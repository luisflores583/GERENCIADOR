import Link from "next/link";
import { cancelSquadAction, endPairAction, respondInviteAction } from "@/actions/partnership";
import { AvailabilitySummary, Banner, SportPills, SquadMark } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { FORMATS, formatById } from "@/lib/constants";
import { getActiveSquad, getFormingSquad, occupiedCount, roster, sportsOf, sportsOfSquad, squadNames, squadTitle } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function DuplaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const [squad, forming, incoming] = await Promise.all([
    getActiveSquad(user.id),
    getFormingSquad(user.id),
    prisma.squadMember.findMany({
      where: { userId: user.id, status: "pending", squad: { status: "forming" } },
      include: {
        squad: {
          include: {
            creator: { select: { name: true } },
            members: { include: { user: { select: { name: true, sports: { select: { sport: true } }, availability: { select: { dayOfWeek: true, startMin: true, endMin: true } } } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const people = squad ? roster(squad) : [];
  const formingPeople = forming ? roster(forming, ["accepted", "pending"]) : [];
  const slotsLeft = forming ? formatById(forming.kind).size - occupiedCount(forming) : 0;

  return (
    <>
      <Banner ok={params.ok} erro={params.erro} />
      <section>
        <p className="kicker">Equipe</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Dupla, trio ou quarteto</h1>
        <p className="mt-2 max-w-2xl text-ink/70">Cada pessoa pode ter uma equipe ativa por vez. O desafio acontece entre duas equipes do mesmo formato.</p>
      </section>
      {squad ? (
        <article className="card">
          <div className="flex flex-wrap items-center gap-3">
            <SquadMark names={people.map((member) => member.user.name)} />
            <span className="rounded-full bg-lime px-3 py-1 text-xs font-semibold">{squadTitle(squad)}</span>
          </div>
          <h2 className="mt-4 font-display text-3xl">{squadNames(squad)}</h2>
          <div className="mt-3">
            <SportPills sports={sportsOfSquad(squad)} />
          </div>
          <p className="mt-4 text-sm text-ink/70">Com a equipe formada, vocês já podem desafiar {formatById(squad.kind).id === "dupla" ? "outra dupla" : formatById(squad.kind).id === "trio" ? "outro trio" : "outro quarteto"}.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="btn-primary" href="/desafiar">
              Desafiar
            </Link>
            <form action={endPairAction}>
              <button className="btn-danger" type="submit">
                Desfazer {squadTitle(squad).toLowerCase()}
              </button>
            </form>
          </div>
        </article>
      ) : forming ? (
        <article className="card">
          <p className="kicker">Formando {squadTitle(forming).toLowerCase()}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {formingPeople.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 rounded-2xl bg-sand px-3 py-2 text-sm">
                <span>{member.user.name}</span>
                <span className="text-ink/60">{member.status === "accepted" ? "Confirmado" : "Aguardando"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {slotsLeft > 0 && (
              <Link className="btn-primary" href={`/atletas?formato=${forming.kind}`}>
                Convidar mais {slotsLeft === 1 ? "1 pessoa" : `${slotsLeft} pessoas`}
              </Link>
            )}
            <form action={cancelSquadAction}>
              <button className="btn-danger" type="submit">
                Cancelar formação
              </button>
            </form>
          </div>
        </article>
      ) : (
        <section className="grid gap-3 md:grid-cols-3">
          {FORMATS.map((format) => (
            <Link key={format.id} href={`/atletas?formato=${format.id}`} className="card hover:border-ink">
              <p className="font-display text-3xl">{format.label}</p>
              <p className="mt-1 text-sm text-ink/60">{format.hint}</p>
              <p className="mt-4 text-sm font-semibold text-pine">Escolher atletas</p>
            </Link>
          ))}
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Convites recebidos</h2>
        {incoming.length === 0 && <p className="text-sm text-ink/60">Nenhum convite esperando resposta.</p>}
        {incoming.map((invite) => {
          const creator = invite.squad.members.find((member) => member.userId === invite.squad.creatorId);
          return (
            <article key={invite.id} className="card">
              <p className="kicker">{formatById(invite.squad.kind).label}</p>
              <p className="mt-2 font-semibold">{invite.squad.creator.name} convidou você</p>
              {creator && (
                <div className="mt-2">
                  <SportPills sports={sportsOf(creator.user)} />
                  <div className="mt-2">
                    <AvailabilitySummary slots={creator.user.availability} />
                  </div>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <form action={respondInviteAction}>
                  <input type="hidden" name="id" value={invite.id} />
                  <input type="hidden" name="intent" value="accept" />
                  <button className="btn-primary" type="submit">
                    Aceitar
                  </button>
                </form>
                <form action={respondInviteAction}>
                  <input type="hidden" name="id" value={invite.id} />
                  <input type="hidden" name="intent" value="decline" />
                  <button className="btn-danger" type="submit">
                    Recusar
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
