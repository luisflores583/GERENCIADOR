import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { Campo, Entrada, Selecao } from "@/components/campo";
import { CamposEquipe } from "@/components/campos-equipe";
import { Formulario } from "@/components/formulario";
import { EncerrarInscricao } from "@/components/encerrar-inscricao";
import { MenuTorneio } from "@/components/menu-torneio";
import { SeloStatus } from "@/components/selo";
import { AVISO_EQUIPE_NA_CHAVE, equipesDoAtletaNaChave } from "@/lib/chave-da-equipe";
import { ROTULO_EQUIPE, ROTULO_INSCRICAO, ROTULO_NAIPE, ROTULO_SEXO } from "@/lib/rotulos";
import {
  acaoAprovarEquipe,
  acaoAprovarInscricao,
  acaoAprovarTodas,
  acaoCadastrarEquipe,
  acaoCadastrarEquipePorNome,
  acaoEditarInscricao,
  acaoExcluirInscricao,
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
      inscricoes: { include: { atleta: { include: { usuario: true } }, equipe: true }, orderBy: { criadaEm: "asc" } },
      equipes: { include: { membros: { include: { atleta: true } }, capitao: true }, orderBy: { nome: "asc" } },
      partidas: { select: { equipeAId: true, equipeBId: true, vencedorId: true, perdedorId: true } },
    },
  });
  if (!torneio) notFound();
  const atletas = await prisma.atleta.findMany({ orderBy: { nomeCompleto: "asc" } });
  const tamanho = tamanhoDaEquipe(torneio.formato);
  const travado = Boolean(torneio.equipesTravadasEm) || ["EM_ANDAMENTO", "PAUSADO", "FINALIZADO"].includes(torneio.status);
  const inscricoesEncerradas = torneio.status === "INSCRICOES_ENCERRADAS";
  const entradaNovaBloqueada = travado || inscricoesEncerradas;
  const ocupados = new Set(
    torneio.inscricoes.filter((item) => item.status === "PENDENTE" || item.status === "APROVADA").map((item) => item.atletaId),
  );
  const disponiveis = atletas.filter((atleta) => !ocupados.has(atleta.id));
  const equipesNaChave = new Set(
    torneio.partidas.flatMap((partida) =>
      [partida.equipeAId, partida.equipeBId, partida.vencedorId, partida.perdedorId].filter((id): id is string => Boolean(id)),
    ),
  );
  const equipesPorAtleta = new Map<string, string[]>();
  for (const equipe of torneio.equipes) {
    for (const membro of equipe.membros) {
      const lista = equipesPorAtleta.get(membro.atletaId) ?? [];
      lista.push(equipe.id);
      equipesPorAtleta.set(membro.atletaId, lista);
    }
  }
  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl text-navy">Inscrições de {torneio.nome}</h1>
        <SeloStatus status={torneio.status} />
      </div>
      <p className="mt-2 text-navy/70">
        {torneio.formacao === "SORTEADAS"
          ? "A organização inscreve o atleta neste torneio. A equipe só aparece depois do sorteio confirmado."
          : "Cadastre a equipe só com o nome, ou preencha os integrantes. No cadastro com integrantes, o nome da equipe é opcional."}
      </p>
      {torneio.status === "INSCRICOES_ABERTAS" ? (
        <section className="mt-6 rounded-3xl bg-foam p-5 shadow-card">
          <h2 className="font-display text-2xl text-navy">Encerrar inscrição</h2>
          <p className="mt-2 text-navy/70">A lista atual permanece. Ninguém novo entra. Quem já está continua, e a inscrição ainda pode ser editada ou excluída.</p>
          <div className="mt-4">
            <EncerrarInscricao torneioId={torneio.id} />
          </div>
        </section>
      ) : null}
      {inscricoesEncerradas ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">
          Inscrições encerradas. A lista atual permanece. Ninguém novo entra.
        </p>
      ) : travado ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">
          Este torneio já começou ou as equipes foram travadas. Novas inscrições ficam bloqueadas.
        </p>
      ) : (
        <Formulario acao={acaoInscreverDireto} className="mt-6 rounded-3xl bg-foam p-5 shadow-card">
          <h2 className="font-display text-3xl text-navy">Inscrever atleta neste torneio</h2>
          <p className="text-navy/70">
            A inscrição é gravada como aprovada. O nome e o sexo bastam. O e-mail e o telefone são opcionais. Naipe deste torneio: {ROTULO_NAIPE[torneio.naipe]}.
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
          <Campo id="telefoneNovo" rotulo="Telefone" dica="Opcional.">
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
        {torneio.inscricoes.map((inscricao) => {
          const equipesDoAtleta = [
            ...new Set([
              ...(inscricao.equipeId ? [inscricao.equipeId] : []),
              ...(equipesPorAtleta.get(inscricao.atletaId) ?? []),
            ]),
          ];
          const naChave = equipesDoAtletaNaChave(equipesDoAtleta, equipesNaChave).length > 0;
          return (
          <article key={inscricao.id} className="rounded-3xl bg-foam p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{inscricao.atleta.nomeCompleto}</p>
                <p className="text-sm text-navy/70">
                  {ROTULO_SEXO[inscricao.atleta.sexo]}
                  {inscricao.atleta.apelido ? ` · ${inscricao.atleta.apelido}` : ""}
                  {" · "}
                  {inscricao.atleta.telefone ?? "sem telefone"}
                  {" · "}
                  {inscricao.atleta.usuario.email ?? "sem e-mail"}
                  {" · "}
                  {ROTULO_INSCRICAO[inscricao.status]}
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
            <details className="mt-3">
              <summary className="inline-flex min-h-14 cursor-pointer list-none items-center rounded-2xl bg-navy px-5 font-semibold text-white">
                Editar
              </summary>
              <Formulario acao={acaoEditarInscricao} className="mt-3 rounded-2xl bg-white p-4">
                <input type="hidden" name="inscricaoId" value={inscricao.id} />
                <Campo id={`nome-${inscricao.id}`} rotulo="Nome">
                  <Entrada id={`nome-${inscricao.id}`} name="nome" defaultValue={inscricao.atleta.nomeCompleto} autoComplete="name" required />
                </Campo>
                <Campo id={`sexo-${inscricao.id}`} rotulo="Sexo">
                  <Selecao id={`sexo-${inscricao.id}`} name="sexo" defaultValue={inscricao.atleta.sexo}>
                    <option value="FEMININO">Feminino</option>
                    <option value="MASCULINO">Masculino</option>
                  </Selecao>
                </Campo>
                <Campo id={`apelido-${inscricao.id}`} rotulo="Apelido" dica="Opcional.">
                  <Entrada id={`apelido-${inscricao.id}`} name="apelido" defaultValue={inscricao.atleta.apelido ?? ""} autoComplete="off" />
                </Campo>
                <Campo id={`telefone-${inscricao.id}`} rotulo="Telefone" dica="Opcional.">
                  <Entrada id={`telefone-${inscricao.id}`} name="telefone" defaultValue={inscricao.atleta.telefone ?? ""} autoComplete="tel" />
                </Campo>
                <Campo id={`email-${inscricao.id}`} rotulo="E-mail" dica="Opcional.">
                  <Entrada id={`email-${inscricao.id}`} name="email" type="email" defaultValue={inscricao.atleta.usuario.email ?? ""} autoComplete="off" />
                </Campo>
                <Botao type="submit">Gravar alterações</Botao>
              </Formulario>
            </details>
            {naChave ? <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-amber-950">{AVISO_EQUIPE_NA_CHAVE}</p> : null}
            <Formulario acao={acaoExcluirInscricao} className="mt-3">
              <input type="hidden" name="inscricaoId" value={inscricao.id} />
              <label className="flex items-start gap-3 text-sm text-navy">
                <input type="checkbox" name="confirmo" className="mt-1 h-5 w-5 shrink-0" />
                <span>Confirmo excluir esta inscrição. O atleta sai só deste torneio.</span>
              </label>
              <Botao type="submit" variante="perigo">Excluir</Botao>
            </Formulario>
          </article>
          );
        })}
      </section>

      {torneio.formacao === "PRE_FORMADAS" ? (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-3xl">Equipes</h2>
          {torneio.equipes.map((equipe) => (
            <article key={equipe.id} className="rounded-3xl bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-bold">{equipe.nome}</h3>
                <p>
                  {equipe.membros.length === 0 ? "Sem integrantes listados" : `${equipe.membros.length}/${tamanho}`}
                  {" · "}
                  {ROTULO_EQUIPE[equipe.status]}
                </p>
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
          {entradaNovaBloqueada ? null : (
            <Formulario acao={acaoCadastrarEquipePorNome} className="rounded-3xl bg-foam p-5 shadow-card">
              <h3 className="font-display text-2xl">Cadastrar equipe só com o nome</h3>
              <p className="text-navy/70">
                Informe o nome da equipe. Os nomes dos integrantes, o sexo, o telefone e o e-mail não são necessários. A equipe entra confirmada e pode ir ao sorteio e à tabela.
              </p>
              <input type="hidden" name="torneioId" value={torneio.id} />
              <Campo id="nomeSomenteEquipe" rotulo="Nome da equipe">
                <Entrada id="nomeSomenteEquipe" name="nome" maxLength={80} autoComplete="off" required />
              </Campo>
              <Botao type="submit">Gravar equipe</Botao>
            </Formulario>
          )}
          {entradaNovaBloqueada ? null : (
            <Formulario acao={acaoCadastrarEquipe} className="rounded-3xl bg-foam p-5 shadow-card">
              <h3 className="font-display text-2xl">Cadastrar equipe com os integrantes</h3>
              <p className="text-navy/70">
                Preencha o nome e o sexo de cada integrante. O e-mail e o telefone são opcionais. Quem já existe entra na equipe; quem não existe é cadastrado.
              </p>
              <input type="hidden" name="torneioId" value={torneio.id} />
              <CamposEquipe tamanho={tamanho} permitirIncompleta={torneio.permitirEquipeIncompleta} telefoneObrigatorio={false} />
              <Botao type="submit">Gravar equipe</Botao>
            </Formulario>
          )}
        </section>
      ) : null}
    </div>
  );
}
