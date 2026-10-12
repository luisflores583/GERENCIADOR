import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { Campo, Entrada, Selecao } from "@/components/campo";
import { CamposEquipe } from "@/components/campos-equipe";
import { Formulario } from "@/components/formulario";
import { MenuTorneio } from "@/components/menu-torneio";
import { ROTULO_INSCRICAO, ROTULO_NAIPE, ROTULO_SEXO } from "@/lib/rotulos";
import {
  acaoAprovarEquipe,
  acaoAprovarInscricao,
  acaoAprovarTodas,
  acaoCadastrarEquipe,
  acaoInscreverDireto,
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
  const travado = Boolean(torneio.equipesTravadasEm) || ["EM_ANDAMENTO", "PAUSADO", "FINALIZADO"].includes(torneio.status);
  const ocupados = new Set(
    torneio.inscricoes.filter((item) => item.status === "PENDENTE" || item.status === "APROVADA").map((item) => item.atletaId),
  );
  const disponiveis = atletas.filter((atleta) => !ocupados.has(atleta.id));
  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <h1 className="font-display text-4xl text-navy">Inscrições de {torneio.nome}</h1>
      <p className="mt-2 text-navy/70">
        {torneio.formacao === "SORTEADAS"
          ? "A organização inscreve o atleta neste torneio. A equipe só aparece depois do sorteio confirmado."
          : `Cadastre a equipe com ${tamanho} integrantes. O nome da equipe é opcional.`}
      </p>
      {travado ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">
          Este torneio já começou ou as equipes foram travadas. Novas inscrições ficam bloqueadas.
        </p>
      ) : (
        <Formulario acao={acaoInscreverDireto} className="mt-6 rounded-3xl bg-foam p-5 shadow-card">
          <h2 className="font-display text-3xl text-navy">Inscrever atleta neste torneio</h2>
          <p className="text-navy/70">
            A inscrição é gravada como aprovada. O e-mail não é obrigatório. Naipe deste torneio: {ROTULO_NAIPE[torneio.naipe]}.
            {torneio.naipe === "MISTO" ? " Cada equipe precisa de pelo menos uma atleta feminina." : ""}
          </p>
          <input type="hidden" name="torneioId" value={torneio.id} />
          <Campo id="atletaExistente" rotulo="Atleta já cadastrado" dica="Deixe em branco para cadastrar alguém novo abaixo.">
            <Selecao id="atletaExistente" name="atletaId" defaultValue="">
              <option value="">Cadastrar um atleta novo</option>
              {disponiveis.map((atleta) => (
                <option key={atleta.id} value={atleta.id}>{atleta.nomeCompleto} · {ROTULO_SEXO[atleta.sexo]}</option>
              ))}
            </Selecao>
          </Campo>
          <Campo id="nomeNovo" rotulo="Nome do atleta novo">
            <Entrada id="nomeNovo" name="nome" autoComplete="name" />
          </Campo>
          <Campo id="sexoNovo" rotulo="Sexo">
            <Selecao id="sexoNovo" name="sexo" defaultValue="FEMININO">
              <option value="FEMININO">Feminino</option>
              <option value="MASCULINO">Masculino</option>
            </Selecao>
          </Campo>
          <Campo id="telefoneNovo" rotulo="Telefone">
            <Entrada id="telefoneNovo" name="telefone" autoComplete="tel" />
          </Campo>
          <Campo id="emailNovo" rotulo="E-mail" dica="Opcional. A inscrição não exige e-mail.">
            <Entrada id="emailNovo" name="email" type="email" autoComplete="off" />
          </Campo>
          <Campo id="senhaNova" rotulo="Senha de acesso" dica="Só é necessária se você informar um e-mail para a atleta entrar depois.">
            <Entrada id="senhaNova" name="senha" type="password" autoComplete="new-password" />
          </Campo>
          <Botao type="submit">Gravar inscrição</Botao>
        </Formulario>
      )}
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
                  {ROTULO_SEXO[inscricao.atleta.sexo]} · {inscricao.atleta.telefone ?? "sem telefone"} · {ROTULO_INSCRICAO[inscricao.status]}
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
                    {travado ? null : (
                      <Formulario acao={acaoRemoverMembro} className="w-auto">
                        <input type="hidden" name="equipeId" value={equipe.id} />
                        <input type="hidden" name="atletaId" value={membro.atletaId} />
                        <Botao type="submit" variante="fantasma">Remover</Botao>
                      </Formulario>
                    )}
                  </li>
                ))}
              </ul>
              {travado ? null : (
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
              )}
            </article>
          ))}
          {travado ? null : (
            <Formulario acao={acaoCadastrarEquipe} className="rounded-3xl bg-foam p-5 shadow-card">
              <h3 className="font-display text-2xl">Cadastrar equipe</h3>
              <p className="text-navy/70">
                Preencha o nome, o sexo e o telefone de cada integrante. O e-mail é opcional. Quem já existe entra na equipe; quem não existe é cadastrado.
              </p>
              <input type="hidden" name="torneioId" value={torneio.id} />
              <CamposEquipe tamanho={tamanho} permitirIncompleta={torneio.permitirEquipeIncompleta} />
              <Botao type="submit">Gravar equipe</Botao>
            </Formulario>
          )}
        </section>
      ) : null}
    </div>
  );
}
