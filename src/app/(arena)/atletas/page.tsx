import Link from "next/link";
import { inviteAction } from "@/actions/partnership";
import { AvailabilitySummary, Avatar, Banner, SportPills } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { FORMATS, formatById, SPORTS, type FormatId } from "@/lib/constants";
import { getActiveSquad, getFormingSquad, occupiedCount, sportsOf } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function AtletasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; esporte?: string; formato?: string; ok?: string; erro?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const sport = params.esporte && (SPORTS as readonly string[]).includes(params.esporte) ? params.esporte : "";
  const requested = FORMATS.some((item) => item.id === params.formato) ? (params.formato as FormatId) : "";
  const [allPeople, mySquad, forming, pending, activeMembers] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        sports: { select: { sport: true } },
        availability: { select: { dayOfWeek: true, startMin: true, endMin: true } },
      },
      orderBy: { name: "asc" },
    }),
    getActiveSquad(user.id),
    getFormingSquad(user.id),
    prisma.squadMember.findMany({
      where: {
        status: "pending",
        squad: { status: "forming" },
        OR: [{ userId: user.id }, { squad: { creatorId: user.id } }],
      },
      select: { userId: true, squad: { select: { creatorId: true } } },
    }),
    prisma.squadMember.findMany({
      where: { status: "accepted", squad: { status: "active" } },
      select: { userId: true, squadId: true },
    }),
  ]);
  const needle = query.toLocaleLowerCase("pt-BR");
  const people = allPeople.filter((person) => {
    const nameOk = !needle || person.name.toLocaleLowerCase("pt-BR").includes(needle);
    const sportOk = !sport || person.sports.some((item) => item.sport === sport);
    return nameOk && sportOk;
  });
  const taken = new Set(activeMembers.map((item) => item.userId));
  const mySquadId = mySquad?.id;
  const kind = forming?.kind ?? requested;
  const format = kind ? formatById(kind) : null;
  const slotsLeft = forming && format ? format.size - occupiedCount(forming) : format ? format.size - 1 : 0;
  const invitedIds = new Set(
    forming?.members.filter((member) => member.status === "pending" || member.status === "accepted").map((member) => member.userId) ?? [],
  );

  return (
    <>
      <Banner ok={params.ok} erro={params.erro} />
      <section>
        <p className="kicker">Atletas</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Quem está na arena</h1>
        <p className="mt-2 max-w-2xl text-ink/70">
          {format
            ? `Convide para ${format.label.toLowerCase()} (${format.hint}). Quem recebe aceita ou recusa.`
            : "Escolha dupla, trio ou quarteto e convide os atletas. Quem recebe aceita ou recusa."}
        </p>
      </section>
      {!mySquad && !forming && (
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((item) => (
            <Link key={item.id} className={`btn-ghost ${kind === item.id ? "border-ink bg-ink text-lime" : ""}`} href={`/atletas?formato=${item.id}${query ? `&q=${encodeURIComponent(query)}` : ""}${sport ? `&esporte=${encodeURIComponent(sport)}` : ""}`}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
      {forming && format && (
        <p className="rounded-2xl bg-lime/50 px-4 py-3 text-sm">{squadProgress(format.id, format.label, slotsLeft)}</p>
      )}
      <form className="flex flex-col gap-3" action="/atletas" method="get">
        {sport ? <input type="hidden" name="esporte" value={sport} /> : null}
        {kind ? <input type="hidden" name="formato" value={kind} /> : null}
        <input className="field" name="q" defaultValue={query} placeholder="Buscar por nome" aria-label="Buscar por nome" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link className={`btn-ghost shrink-0 ${sport === "" ? "border-ink bg-ink text-lime" : ""}`} href={kind ? `/atletas?formato=${kind}` : "/atletas"}>
            Todos
          </Link>
          {SPORTS.map((item) => (
            <Link
              key={item}
              className={`btn-ghost shrink-0 ${sport === item ? "border-ink bg-ink text-lime" : ""}`}
              href={`/atletas?esporte=${encodeURIComponent(item)}${kind ? `&formato=${kind}` : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
            >
              {item}
            </Link>
          ))}
        </div>
      </form>
      {mySquad && <p className="rounded-2xl bg-lime/50 px-4 py-3 text-sm">Sua equipe já está formada. Desfaça a equipe atual se quiser convidar outra pessoa.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {people.map((person) => {
          const mine = person.id === user.id;
          const partner = Boolean(mySquadId && activeMembers.some((item) => item.userId === person.id && item.squadId === mySquadId));
          const sent = invitedIds.has(person.id) && !mine;
          const received = pending.some((item) => item.userId === user.id && item.squad.creatorId === person.id);
          return (
            <li key={person.id} className="card flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={person.name} />
                <div>
                  <p className="font-semibold">{person.name}</p>
                  <p className="text-xs text-ink/50">{mine ? "Você" : partner ? "Sua equipe" : "Atleta inscrito"}</p>
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
                  <span className="text-sm font-medium text-ink/50">Já tem equipe</span>
                ) : mySquad ? (
                  <span className="text-sm font-medium text-ink/50">Sua equipe já está formada</span>
                ) : !format ? (
                  <Link className="btn-ghost" href="/dupla">
                    Escolher formato
                  </Link>
                ) : slotsLeft <= 0 ? (
                  <span className="text-sm font-medium text-ink/50">Equipe completa</span>
                ) : (
                  <form action={inviteAction}>
                    <input type="hidden" name="userId" value={person.id} />
                    <input type="hidden" name="kind" value={format.id} />
                    <button className="btn-primary" type="submit">
                      Convidar para {format.label.toLowerCase()}
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

function squadProgress(id: string, label: string, slotsLeft: number) {
  const article = id === "dupla" ? "a" : "o";
  const done = id === "dupla" ? "completa" : "completo";
  if (slotsLeft <= 0) return `${label} ${done}. Aguarde todo mundo aceitar.`;
  if (slotsLeft === 1) return `Falta 1 pessoa para fechar ${article} ${label.toLowerCase()}.`;
  return `Faltam ${slotsLeft} pessoas para fechar ${article} ${label.toLowerCase()}.`;
}
