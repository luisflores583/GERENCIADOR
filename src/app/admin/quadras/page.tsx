import { Botao } from "@/components/botao";
import { Campo, Entrada } from "@/components/campo";
import { Formulario } from "@/components/formulario";
import { acaoCriarQuadra } from "@/server/acoes";
import { prisma } from "@/server/db";

export default async function Quadras() {
  const quadras = await prisma.quadra.findMany({ orderBy: { nome: "asc" }, include: { _count: { select: { torneios: true } } } });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="font-display text-4xl text-navy">Quadras</h1>
        <ul className="mt-4 space-y-3">
          {quadras.map((quadra) => (
            <li key={quadra.id} className="rounded-3xl bg-foam p-4 shadow-card">
              <p className="text-xl font-bold">{quadra.nome}</p>
              <p className="text-sm text-navy/70">Usada em {quadra._count.torneios} torneio(s)</p>
            </li>
          ))}
        </ul>
      </section>
      <Formulario acao={acaoCriarQuadra} className="h-fit rounded-3xl bg-foam p-5 shadow-card">
        <h2 className="font-display text-2xl">Nova quadra</h2>
        <Campo id="nome" rotulo="Nome ou número">
          <Entrada id="nome" name="nome" required placeholder="Quadra 1" />
        </Campo>
        <Botao type="submit">Cadastrar</Botao>
      </Formulario>
    </div>
  );
}
