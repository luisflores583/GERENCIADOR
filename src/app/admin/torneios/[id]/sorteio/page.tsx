import { notFound } from "next/navigation";
import { criarEstadoInicial } from "@/engine/dupla-eliminacao";
import { Botao } from "@/components/botao";
import { Formulario } from "@/components/formulario";
import { MenuTorneio } from "@/components/menu-torneio";
import { acaoConfirmarConfrontos, acaoConfirmarEquipes, acaoDesfazerEquipes, acaoGerarConfrontos, acaoGerarEquipes } from "@/server/acoes";
import { prisma } from "@/server/db";

export default async function Sorteio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const torneio = await prisma.torneio.findUnique({
    where: { id },
    include: {
      sorteios: { orderBy: { criadoEm: "desc" }, include: { criadoPor: true } },
      equipes: { include: { membros: { include: { atleta: true } } } },
    },
  });
  if (!torneio) notFound();
  const rascunhoEquipes = torneio.sorteios.find((item) => item.tipo === "EQUIPES" && item.status === "RASCUNHO");
  const rascunhoConfrontos = torneio.sorteios.find((item) => item.tipo === "CONFRONTOS" && item.status === "RASCUNHO");
  const previaEquipes = rascunhoEquipes?.resultado as { equipes?: { nome: string; atletaIds: string[]; incompleta: boolean }[] } | undefined;
  const nomes = new Map(
    (await prisma.atleta.findMany({ select: { id: true, nomeCompleto: true, apelido: true } })).map((atleta) => [
      atleta.id,
      atleta.apelido || atleta.nomeCompleto,
    ]),
  );
  let previaChave: { codigo: string; a: string; b: string }[] = [];
  if (rascunhoConfrontos) {
    const ordem = (rascunhoConfrontos.resultado as { equipes: string[] }).equipes;
    const porId = new Map(torneio.equipes.map((equipe) => [equipe.id, equipe.nome]));
    const estado = criarEstadoInicial(ordem);
    previaChave = estado.partidas
      .filter((partida) => partida.chave === "VENCEDORES" && partida.rodada === 1 && partida.status !== "VAZIA")
      .map((partida) => ({
        codigo: partida.id,
        a: partida.equipeAId ? (porId.get(partida.equipeAId) ?? "Folga") : "Folga",
        b: partida.equipeBId ? (porId.get(partida.equipeBId) ?? "Folga") : "Folga",
      }));
  }

  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <h1 className="font-display text-4xl text-navy">Sorteios</h1>
      <p className="mt-2 max-w-3xl text-navy/75">
        O sorteio fica registrado com a semente e o algoritmo. Confirmar trava a composição. Sem sobra de atletas, o sistema não forma equipe incompleta.
      </p>

      {torneio.formacao === "SORTEADAS" ? (
        <section className="mt-6 rounded-3xl bg-foam p-5 shadow-card">
          <h2 className="font-display text-2xl">1. Equipes</h2>
          <Formulario acao={acaoGerarEquipes}>
            <input type="hidden" name="torneioId" value={torneio.id} />
            <label className="flex min-h-14 items-center gap-3">
              <input type="checkbox" name="autorizarIncompleta" className="h-5 w-5" />
              Autorizo equipe incompleta, se o torneio permitir
            </label>
            <Botao type="submit">Sortear equipes</Botao>
          </Formulario>
          {previaEquipes?.equipes ? (
            <div className="mt-4">
              <p className="text-sm">Semente {rascunhoEquipes?.semente} · {rascunhoEquipes?.algoritmo}</p>
              <ul className="mt-2 space-y-2">
                {previaEquipes.equipes.map((equipe) => (
                  <li key={equipe.nome} className="rounded-2xl bg-white p-3">
                    <strong>{equipe.nome}</strong>
                    {equipe.incompleta ? " · incompleta" : ""}
                    <p>{equipe.atletaIds.map((atletaId) => nomes.get(atletaId) ?? atletaId).join(", ")}</p>
                  </li>
                ))}
              </ul>
              <Formulario acao={acaoConfirmarEquipes} className="mt-3">
                <input type="hidden" name="sorteioId" value={rascunhoEquipes?.id} />
                <label className="flex items-center gap-2"><input type="checkbox" name="confirmo" /> Confirmo este sorteio</label>
                <Botao type="submit">Confirmar equipes</Botao>
              </Formulario>
            </div>
          ) : null}
          <Formulario acao={acaoDesfazerEquipes} className="mt-4">
            <input type="hidden" name="torneioId" value={torneio.id} />
            <label className="flex items-center gap-2"><input type="checkbox" name="confirmo" /> Confirmo desfazer</label>
            <Botao type="submit" variante="secundario">Desfazer sorteio de equipes</Botao>
          </Formulario>
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl bg-foam p-5 shadow-card">
        <h2 className="font-display text-2xl">{torneio.formacao === "SORTEADAS" ? "2. " : ""}Confrontos da primeira rodada</h2>
        <Formulario acao={acaoGerarConfrontos}>
          <input type="hidden" name="torneioId" value={torneio.id} />
          <Botao type="submit">Sortear confrontos</Botao>
        </Formulario>
        {previaChave.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm">Semente {rascunhoConfrontos?.semente} · {rascunhoConfrontos?.algoritmo} · por {rascunhoConfrontos?.criadoPor.nome}</p>
            <ul className="mt-2 space-y-2">
              {previaChave.map((jogo) => (
                <li key={jogo.codigo} className="rounded-2xl bg-white p-3">{jogo.a} x {jogo.b}</li>
              ))}
            </ul>
            <Formulario acao={acaoConfirmarConfrontos} className="mt-3">
              <input type="hidden" name="sorteioId" value={rascunhoConfrontos?.id} />
              <label className="flex items-center gap-2"><input type="checkbox" name="confirmo" /> Confirmo a chave e inicio o torneio</label>
              <Botao type="submit">Confirmar e iniciar</Botao>
            </Formulario>
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">Auditoria</h2>
        <ul className="mt-3 space-y-2">
          {torneio.sorteios.map((sorteio) => (
            <li key={sorteio.id} className="rounded-2xl bg-white p-3 text-sm">
              {sorteio.tipo === "EQUIPES" ? "Equipes" : "Confrontos"} · {sorteio.status} · semente {sorteio.semente} · {sorteio.algoritmo} · {sorteio.criadoPor.nome}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
