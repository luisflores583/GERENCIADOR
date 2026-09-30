import Link from "next/link";
import { endPairAction, respondInviteAction } from "@/actions/partnership";
import { AvailabilitySummary, Banner, PairMark, SportPills } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getActivePair, otherMember, sportsOf, sportsOfPair } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function DuplaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const [pair, incoming, outgoing] = await Promise.all([
    getActivePair(user.id),
    prisma.partnership.findMany({
      where: { inviteeId: user.id, status: "pending" },
      include: {
        inviter: {
          select: {
            name: true,
            sports: { select: { sport: true } },
            availability: { select: { dayOfWeek: true, startMin: true, endMin: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partnership.findFirst({
      where: { inviterId: user.id, status: "pending" },
      include: {
        invitee: {
          select: {
            name: true,
            sports: { select: { sport: true } },
            availability: { select: { dayOfWeek: true, startMin: true, endMin: true } },
          },
        },
      },
    }),
  ]);
  const partner = pair ? otherMember(pair, user.id) : null;

  return (
    <>
      <Banner ok={params.ok} erro={params.erro} />
      <section>
        <p className="kicker">Dupla</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Uma dupla ativa por vez</h1>
      </section>
      {pair && partner ? (
        <article className="card">
          <PairMark a={user.name} b={partner.name} />
          <h2 className="mt-4 font-display text-3xl">{user.name} e {partner.name}</h2>
          <div className="mt-3">
            <SportPills sports={sportsOfPair(pair)} />
          </div>
          <p className="mt-4 text-sm text-ink/70">Com a dupla formada, vocês já podem desafiar outra dupla da arena.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="btn-primary" href="/desafiar">
              Desafiar outra dupla
            </Link>
            <form action={endPairAction}>
              <button className="btn-danger" type="submit">
                Desfazer dupla
              </button>
            </form>
          </div>
        </article>
      ) : (
        <article className="card">
          <p>Você ainda não tem dupla.</p>
          <Link className="btn-primary mt-4" href="/atletas">
            Convidar um atleta
          </Link>
        </article>
      )}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">Convites recebidos</h2>
          {incoming.length === 0 && <p className="text-sm text-ink/60">Nenhum convite esperando resposta.</p>}
          {incoming.map((invite) => (
            <article key={invite.id} className="card">
              <p className="font-semibold">{invite.inviter.name}</p>
              <div className="mt-2">
                <SportPills sports={sportsOf(invite.inviter)} />
              </div>
              <div className="mt-2">
                <AvailabilitySummary slots={invite.inviter.availability} />
              </div>
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
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">Convite enviado</h2>
          {!outgoing && <p className="text-sm text-ink/60">Você não enviou convite pendente.</p>}
          {outgoing && (
            <article className="card">
              <p className="font-semibold">{outgoing.invitee.name}</p>
              <p className="mt-1 text-sm text-ink/60">Aguardando resposta.</p>
              <div className="mt-2">
                <SportPills sports={sportsOf(outgoing.invitee)} />
              </div>
              <form className="mt-4" action={respondInviteAction}>
                <input type="hidden" name="id" value={outgoing.id} />
                <input type="hidden" name="intent" value="cancel" />
                <button className="btn-ghost" type="submit">
                  Cancelar convite
                </button>
              </form>
            </article>
          )}
        </div>
      </section>
    </>
  );
}
