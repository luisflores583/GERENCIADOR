import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PerfilPage() {
  const session = await getCurrentUser();
  if (!session) return null;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      sports: { select: { sport: true } },
      availability: { select: { dayOfWeek: true, startMin: true, endMin: true } },
    },
  });

  return (
    <>
      <section>
        <p className="kicker">Perfil</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Seus dados na arena</h1>
        <p className="mt-2 text-ink/70">
          Conta de {user.email}. O nome, os esportes e a disponibilidade semanal aparecem para os outros atletas.
        </p>
      </section>
      <section className="card">
        <ProfileForm
          name={user.name}
          sports={user.sports.map((item) => item.sport)}
          slots={user.availability.map((slot) => ({
            dayOfWeek: slot.dayOfWeek,
            startMin: slot.startMin,
            endMin: slot.endMin,
          }))}
        />
      </section>
    </>
  );
}
