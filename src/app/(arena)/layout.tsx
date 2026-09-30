import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSquad } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ArenaLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const [invites, squad] = await Promise.all([
    prisma.squadMember.count({
      where: { userId: user.id, status: "pending", squad: { status: "forming" } },
    }),
    getActiveSquad(user.id),
  ]);
  const challenges = squad
    ? await prisma.challenge.count({
        where: {
          status: { in: ["pending", "countered"] },
          OR: [
            { challengerSquadId: squad.id, awaiting: "challenger" },
            { challengedSquadId: squad.id, awaiting: "challenged" },
          ],
        },
      })
    : 0;

  return (
    <Shell name={user.name} invites={invites} challenges={challenges}>
      {children}
    </Shell>
  );
}
