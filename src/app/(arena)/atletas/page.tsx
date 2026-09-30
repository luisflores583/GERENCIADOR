import Link from "next/link";
import { inviteAction } from "@/actions/partnership";
import { AvailabilitySummary, Avatar, Banner, SportPills } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { SPORTS } from "@/lib/constants";
import { getActivePair, sportsOf } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function AtletasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; esporte?: string; ok?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const sport = params.esporte && (SPORTS as readonly string[]).includes(params.esporte) ? params.esporte : "";
  const [allPeople, myPair, pending, accepted] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        sports: { select: { sport: true } },
        availability: { select: { dayOfWeek: true, startMin: true, endMin: true } },
      },
      orderBy: { name: "asc" },
    }),
    getActivePair(user.id),
    prisma.partnership.findMany({
      where: { status: "pending", OR: [{ inviterId: user.id }, { inviteeId: user.id }] },
    }),
    prisma.partnership.findMany({
      where: { status: "accepted" },
      select: { inviterId: true, inviteeId: true },
    }),
  ]);
  const needle = query.toLocaleLowerCase("pt-BR");
  const people = allPeople.filter((person) => {
    const nameOk = !needle || person.name.toLocaleLowerCase("pt-BR").includes(needle);
    const sportOk = !sport || person.sports.some((item) => item.sport === sport);
    return nameOk && sportOk;
  });
  const taken = new Set(accepted.flatMap((item) => [item.inviterId, item.inviteeId]));

  const outgoing = pending.find((item) => item.inviterId === user.id);

  return (
    <>
      <Banner ok={params.ok} erro={params.erro} />
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker">Atletas</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Quem está na arena</h1>
          <p className="mt-2 max-w-2xl text-ink/70">Convide uma pessoa para ser sua dupla. Quem recebe aceita ou recusa.</p>
        </div>
        <p className="text-sm text-ink/60">{people.length} inscritos</p>
      </section>
      <form className="flex flex-col gap-3" action="/atletas" method="get">
        {sport ? <input type="hidden" name="esporte" value={sport} /> : null}
        <input className="field" name="q" defaultValue={query} placeholder="Buscar por nome" aria-label="Buscar por nome" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link className={`btn-ghost shrink-0 ${sport === "" ? "border-ink bg-ink text-lime" : ""}`} href={query ? `/atletas?q=${encodeURIComponent(query)}` : "/atletas"}>
            Todos
          </Link>
          {SPORTS.map((item) => (
            <Link
              key={item}
              className={`btn-ghost shrink-0 ${sport === item ? "border-ink bg-ink text-lime" : ""}`}
              href={`/atletas?esporte=${encodeURIComponent(item)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
            >
              {item}
            </Link>
          ))}
        </div>
      </form>
      {myPair && (
        <p className="rounded-2xl bg-lime/50 px-4 py-3 text-sm">
          Sua dupla já está formada. Desfaça a dupla atual se quiser convidar outra pessoa.
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {people.map((person) => {
          const mine = person.id === user.id;
          const partner = myPair && (myPair.inviter.id === person.id || myPair.invitee.id === person.id) && !mine;
          const sent = outgoing?.inviteeId === person.id;
          const received = pending.some((item) => item.inviterId === person.id && item.inviteeId === user.id);
          return (
            <li key={person.id} className="card flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={person.name} />
                <div>
                  <p className="font-semibold">{person.name}</p>
                  <p className="text-xs text-ink/50">{mine ? "Você" : partner ? "Sua dupla" : "Atleta inscrito"}</p>
                </div>
              </div>
              <SportPills sports={sportsOf(person)} />
              <AvailabilitySummary slots={person.availability} />
              <div className="mt-auto">
                {mine || partner ? null : sent ? (
                  <Link className="btn-ghost" href="/dupla">
                    Convite enviado
                  </Link>
                ) : received ? (
                  <Link className="btn-primary" href="/dupla">
                    Responder convite
                  </Link>
                ) : taken.has(person.id) ? (
                  <span className="text-sm font-medium text-ink/50">Já tem dupla</span>
                ) : myPair ? (
                  <span className="text-sm font-medium text-ink/50">Sua dupla já está formada</span>
                ) : outgoing ? (
                  <span className="text-sm font-medium text-ink/50">Você já tem um convite pendente</span>
                ) : (
                  <form action={inviteAction}>
                    <input type="hidden" name="userId" value={person.id} />
                    <button className="btn-primary" type="submit">
                      Convidar para dupla
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {people.length === 0 && <p className="text-sm text-ink/60">Nenhum atleta com esse filtro.</p>}
    </>
  );
}
