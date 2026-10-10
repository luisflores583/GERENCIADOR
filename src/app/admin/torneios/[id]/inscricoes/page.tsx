import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { Campo, Entrada, Selecao } from "@/components/campo";
import { Formulario } from "@/components/formulario";
import { MenuTorneio } from "@/components/menu-torneio";
import { ROTULO_INSCRICAO } from "@/lib/rotulos";
import {
  acaoAprovarEquipe,
  acaoAprovarInscricao,
  acaoAprovarTodas,
  acaoCriarEquipe,
  acaoRejeitarEquipe,
  acaoRejeitarInscricao,
  acaoRemoverMembro,
} from "@/server/acoes";
import { prisma } from "@/server/db";
import { tamanhoDaEquipe } from "@/engine/sorteio";

export default async function Inscricoes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const torneio = await prisma.torneio.findUnique({
    where: { id },
    include: {
      inscricoes: { include: { atleta: true, equipe: true }, orderBy: { criadaEm: "asc" } },
      equipes: { include: { membros: { include: { atleta: true } }, capitao: true }, orderBy: { nome: "asc" } },
    },
  });
  if (!torneio) notFound();
  const atletas = await prisma.atleta.findMany({ orderBy: { nomeCompleto: "asc" } });
  const tamanho = tamanhoDaEquipe(torneio.formato);
  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <h1 className="font-display text-4xl text-navy">Inscrições</h1>
      <p className="mt-2 text-navy/70">
        {torneio.formacao === "SORTEADAS"
          ? "Atletas entram sozinhos. A equipe só aparece depois do sorteio confirmado."
          : `Cada equipe precisa de exatamente ${tamanho} atletas para ser aprovada.`}
      </p>
      {torneio.formacao === "SORTEADAS" ? (
        <Formulario acao={acaoAprovarTodas} className="mt-4 w-auto">
          <input type="hidden" name="torneioId" value={torneio.id} />
          <Botao type="submit" variante="navy">Aprovar todas as pendentes</Botao>
        </Formulario>
      ) : null}

      <section className="mt-6 space-y-3">
        {torneio.inscricoes.map((inscricao) => (
          <article key={inscricao.id} className="rounded-3xl bg-foam p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{inscricao.atleta.nomeCompleto}</p>
                <p className="text-sm text-navy/70">
                  {inscricao.atleta.apelido ? `${inscricao.atleta.apelido} · ` : ""}
                  {inscricao.atleta.telefone ?? "sem telefone"} · {ROTULO_INSCRICAO[inscricao.status]}
                  {inscricao.equipe ? ` · ${inscricao.equipe.nome}` : ""}
                </p>
              </div>
              {torneio.formacao === "SORTEADAS" && inscricao.status === "PENDENTE" ? (
                <div className="flex gap-2">
                  <Formulario acao={acaoAprovarInscricao} className="w-auto">
                    <input type="hidden" name="inscricaoId" value={inscricao.id} />
                    <Botao type="submit">Aprovar</Botao>
                  </Formulario>
                  <Formulario acao={acaoRejeitarInscricao} className="w-auto">
                    <input type="hidden" name="inscricaoId" value={inscricao.id} />
                    <Botao type="submit" variante="perigo">Rejeitar</Botao>
                  </Formulario>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {torneio.formacao === "PRE_FORMADAS" ? (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-3xl">Equipes</h2>
          {torneio.equipes.map((equipe) => (
            <article key={equipe.id} className="rounded-3xl bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-bold">{equipe.nome}</h3>
                <p>{equipe.membros.length}/{tamanho} · {equipe.status}</p>
              </div>
              <ul className="mt-2">
                {equipe.membros.map((membro) => (
                  <li key={membro.atletaId} className="flex items-center justify-between gap-2 py-1">
                    <span>{membro.atleta.nomeCompleto}{equipe.capitaoId === membro.atletaId ? " · responsável" : ""}</span>
                    <Formulario acao={acaoRemoverMembro} className="w-auto">
                      <input type="hidden" name="equipeId" value={equipe.id} />
                      <input type="hidden" name="atletaId" value={membro.atletaId} />
                      <Botao type="submit" variante="fantasma">Remover</Botao>
                    </Formulario>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Formulario acao={acaoAprovarEquipe} className="w-auto">
                  <input type="hidden" name="equipeId" value={equipe.id} />
                  <Botao type="submit">Aprovar equipe</Botao>
                </Formulario>
                <Formulario acao={acaoRejeitarEquipe} className="w-auto">
                  <input type="hidden" name="equipeId" value={equipe.id} />
                  <label className="mr-2 text-sm"><input type="checkbox" name="confirmo" className="mr-2" />Confirmo</label>
                  <Botao type="submit" variante="perigo">Rejeitar</Botao>
                </Formulario>
              </div>
            </article>
          ))}
          <Formulario acao={acaoCriarEquipe} className="rounded-3xl bg-foam p-5 shadow-card">
            <h3 className="font-display text-2xl">Montar equipe</h3>
            <input type="hidden" name="torneioId" value={torneio.id} />
            <Campo id="nomeEquipe" rotulo="Nome da equipe">
              <Entrada id="nomeEquipe" name="nome" required />
            </Campo>
            <Campo id="atletas" rotulo="Atletas" dica={`Selecione até ${tamanho}. Segure Ctrl ou Cmd para vários.`}>
              <Selecao id="atletas" name="atletaId" multiple required className="min-h-40">
                {atletas.map((atleta) => (
                  <option key={atleta.id} value={atleta.id}>{atleta.nomeCompleto}</option>
                ))}
              </Selecao>
            </Campo>
            <Botao type="submit">Criar equipe</Botao>
          </Formulario>
        </section>
      ) : null}
    </div>
  );
}
