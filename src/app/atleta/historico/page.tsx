import Link from "next/link";
import { formatarDataHora } from "@/lib/formatacao";
import { prisma } from "@/server/db";
import { exigirAtleta } from "@/server/sessao";

export default async function Historico() {
  const { atleta } = await exigirAtleta();
  const membros = await prisma.membroEquipe.findMany({ where: { atletaId: atleta.id }, select: { equipeId: true } });
  const equipeIds = membros.map((item) => item.equipeId);
  const partidas = await prisma.partida.findMany({
    where: {
      status: "CONCLUIDA",
      OR: [{ equipeAId: { in: equipeIds } }, { equipeBId: { in: equipeIds } }],
    },
    include: { equipeA: true, equipeB: true, quadra: true, torneio: true },
    orderBy: { fimEm: "desc" },
  });
  return (
    <div>
      <h1 className="font-display text-4xl text-navy">Histórico de partidas</h1>
      <ul className="mt-4 space-y-3">
        {partidas.map((partida) => (
          <li key={partida.id} className="rounded-3xl bg-foam p-4 shadow-card">
            <Link href={`/ao-vivo/${partida.torneio.slug}`} className="text-sm font-semibold text-ocean">{partida.torneio.nome}</Link>
            <p className="text-lg font-bold">{partida.equipeA?.nome} {partida.placarA} x {partida.placarB} {partida.equipeB?.nome}</p>
            <p className="text-sm text-navy/70">{partida.quadra?.nome ?? "Sem quadra"} · {partida.fimEm ? formatarDataHora(partida.fimEm) : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
