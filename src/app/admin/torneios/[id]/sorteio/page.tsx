import { notFound } from "next/navigation";
import { criarEstadoInicial } from "@/engine/dupla-eliminacao";
import { Botao } from "@/components/botao";
import { Formulario } from "@/components/formulario";
import { ListaRanking } from "@/components/lista-ranking";
import { MenuTorneio } from "@/components/menu-torneio";
import { SeloStatus } from "@/components/selo";
import { IniciarTorneio } from "@/components/iniciar-torneio";
import { acaoConfirmarConfrontos, acaoConfirmarEquipes, acaoDesfazerEquipes, acaoGerarConfrontos, acaoGerarEquipes, acaoStatus } from "@/server/acoes";
import { prisma } from "@/server/db";

type ResultadoConfrontos = {
  modo?: "ALEATORIO" | "RANKING";
  equipes?: string[];
  posicoes?: { equipeId: string; posicao: number | null }[] | null;
};

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
  const confirmadas = torneio.equipes
    .filter((equipe) => equipe.status === "CONFIRMADA")
    .sort((a, b) => a.criadaEm.getTime() - b.criadaEm.getTime());
  const porId = new Map(torneio.equipes.map((equipe) => [equipe.id, equipe.nome]));
  const resultadoConfrontos = (rascunhoConfrontos?.resultado ?? null) as ResultadoConfrontos | null;
  let previaChave: { codigo: string; a: string; b: string }[] = [];
  const ordem = resultadoConfrontos?.equipes;
  if (rascunhoConfrontos && ordem) {
    const folhaNumerada = torneio.modeloChave === "FOLHA_16" || torneio.modeloChave === "FOLHA_32";
    const limiteFolha = torneio.modeloChave === "FOLHA_32" ? 32 : 16;
    const ultimaAbertura = torneio.modeloChave === "FOLHA_32" ? 16 : 8;
    if (folhaNumerada && ordem.length > limiteFolha) {
      previaChave = [];
    } else {
      const estado = criarEstadoInicial(ordem, torneio.modeloChave);
      previaChave = estado.partidas
        .filter((partida) =>
          folhaNumerada
            ? Number(partida.id) >= 1 && Number(partida.id) <= ultimaAbertura
            : partida.chave === "VENCEDORES" && partida.rodada === 1 && partida.status !== "VAZIA",
        )
        .map((partida) => ({
          codigo: folhaNumerada ? `Jogo ${partida.id}` : partida.id,
          a: partida.equipeAId ? (porId.get(partida.equipeAId) ?? "Folga") : "Folga",
          b: partida.equipeBId ? (porId.get(partida.equipeBId) ?? "Folga") : "Folga",
        }));
    }
  }
  const partidas = await prisma.partida.count({ where: { torneioId: torneio.id } });
  const confrontosConfirmados = torneio.sorteios.some((item) => item.tipo === "CONFRONTOS" && item.status === "CONFIRMADO");
  const prontoParaConfrontos = (torneio.status === "AGUARDANDO_SORTEIO" || torneio.status === "INSCRICOES_ENCERRADAS") && partidas === 0;

  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl text-navy">Sorteios</h1>
        <SeloStatus status={torneio.status} />
      </div>
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
        {torneio.modeloChave === "FOLHA_16" ? (
          <p className="mt-2 text-navy/75">
            Este torneio usa a tabela de até 16 times. A posição 1 do ranking é a cabeça 1 e a posição 16 é a cabeça 16. O jogo 1 é 1 contra 16, o jogo 2 é 9 contra 8, o jogo 3 é 5 contra 12, o jogo 4 é 4 contra 13, o jogo 5 é 3 contra 14, o jogo 6 é 6 contra 11, o jogo 7 é 7 contra 10 e o jogo 8 é 15 contra 2.
          </p>
        ) : torneio.modeloChave === "FOLHA_32" ? (
          <p className="mt-2 text-navy/75">
            Este torneio usa a tabela de até 32 times. A posição 1 é a equipe 1 e a posição 32 é a equipe 32. Os jogos 1 a 16 são 1 x 32, 17 x 16, 9 x 24, 25 x 8, 5 x 28, 21 x 12, 13 x 20, 29 x 4, 3 x 30, 19 x 14, 11 x 22, 27 x 6, 7 x 26, 23 x 10, 15 x 18 e 31 x 2.
          </p>
        ) : (
          <p className="mt-2 text-navy/75">
            As duas opções definem quem ocupa cada vaga da primeira rodada da chave automática.
          </p>
        )}
        {prontoParaConfrontos ? (
          <div className="mt-4 space-y-6">
            <IniciarTorneio torneioId={torneio.id} />
            <Formulario acao={acaoGerarConfrontos}>
              <input type="hidden" name="torneioId" value={torneio.id} />
              <input type="hidden" name="modo" value="ALEATORIO" />
              <p className="text-navy/75">O sorteio aleatório embaralha as vagas e grava a semente.</p>
              <Botao type="submit">Sortear aleatoriamente</Botao>
            </Formulario>
            <Formulario acao={acaoGerarConfrontos}>
              <input type="hidden" name="torneioId" value={torneio.id} />
              <input type="hidden" name="modo" value="RANKING" />
              <h3 className="font-display text-xl">Ranking</h3>
              <p className="text-navy/75">
                Numere ou reordene as equipes confirmadas. Sem número, a ordem da lista vale. A posição 1 é a cabeça 1.
              </p>
              <ListaRanking equipes={confirmadas.map((equipe) => ({ id: equipe.id, nome: equipe.nome }))} />
              <Botao type="submit" variante="navy">Usar este ranking</Botao>
            </Formulario>
          </div>
        ) : partidas > 0 || confrontosConfirmados ? (
          <div className="mt-4 space-y-3">
            <p className="text-navy/75">Os confrontos deste torneio já foram definidos.</p>
            {torneio.status !== "FINALIZADO" ? (
              <IniciarTorneio torneioId={torneio.id} retomada={torneio.status === "PAUSADO"} />
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-navy/75">
              O torneio ainda não começou. Inicie para gravar as vitórias. A chave usa a ordem atual das equipes confirmadas.
            </p>
            <IniciarTorneio torneioId={torneio.id} />
            {torneio.status === "INSCRICOES_ABERTAS" || torneio.status === "INSCRICOES_ENCERRADAS" ? (
              <Formulario acao={acaoStatus} className="w-auto">
                <input type="hidden" name="torneioId" value={torneio.id} />
                <input type="hidden" name="acao" value="preparar" />
                <Botao type="submit" variante="secundario">Preparar sorteio</Botao>
              </Formulario>
            ) : null}
          </div>
        )}
        {previaChave.length > 0 && ordem ? (
          <div className="mt-4">
            <p className="text-sm">
              {resultadoConfrontos?.modo === "RANKING" ? "Ranking" : "Aleatório"}
              {resultadoConfrontos?.modo === "ALEATORIO" || !resultadoConfrontos?.modo ? ` · semente ${rascunhoConfrontos?.semente}` : ""}
              {" · "}
              {rascunhoConfrontos?.algoritmo} · por {rascunhoConfrontos?.criadoPor.nome}
            </p>
            {resultadoConfrontos?.modo === "RANKING" ? (
              <ol className="mt-2 space-y-1 text-sm">
                {ordem.map((equipeId, indice) => (
                  <li key={equipeId}>{indice + 1}. {porId.get(equipeId) ?? equipeId}</li>
                ))}
              </ol>
            ) : null}
            <ul className="mt-2 space-y-2">
              {previaChave.map((jogo) => (
                <li key={jogo.codigo} className="rounded-2xl bg-white p-3">{jogo.codigo}: {jogo.a} x {jogo.b}</li>
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
          {torneio.sorteios.map((sorteio) => {
            const resultado = sorteio.resultado as ResultadoConfrontos;
            const modo =
              sorteio.tipo === "CONFRONTOS"
                ? resultado.modo === "RANKING"
                  ? "Ranking"
                  : resultado.modo === "ALEATORIO"
                    ? "Aleatório"
                    : null
                : null;
            return (
              <li key={sorteio.id} className="rounded-2xl bg-white p-3 text-sm">
                {sorteio.tipo === "EQUIPES" ? "Equipes" : "Confrontos"}
                {modo ? ` · ${modo}` : ""}
                {" · "}
                {sorteio.status}
                {sorteio.tipo === "CONFRONTOS" && resultado.modo === "RANKING" ? "" : ` · semente ${sorteio.semente}`}
                {" · "}
                {sorteio.algoritmo} · {sorteio.criadoPor.nome}
                {sorteio.tipo === "CONFRONTOS" && resultado.modo === "RANKING" && resultado.equipes ? (
                  <ol className="mt-2 space-y-1">
                    {resultado.equipes.map((equipeId, indice) => (
                      <li key={equipeId}>{indice + 1}. {porId.get(equipeId) ?? equipeId}</li>
                    ))}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
