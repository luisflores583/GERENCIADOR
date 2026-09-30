import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { getActivePair } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ArenaLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  const [invites, pair] = await Promise.all([
    prisma.partnership.count({ where: { inviteeId: user.id, status: "pending" } }),
    getActivePair(user.id),
  ]);
  const challenges = pair
    ? await prisma.challenge.count({
        where: {
          status: { in: ["pending", "countered"] },
          OR: [
            { challengerPairId: pair.id, awaiting: "challenger" },
            { challengedPairId: pair.id, awaiting: "challenged" },
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
