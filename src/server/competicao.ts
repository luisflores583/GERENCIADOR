import { randomInt } from "node:crypto";
import { Prisma, type Partida } from "@prisma/client";
import {
  criarEstadoInicial,
  planejarCorrecao,
  reexecutar,
  type ResultadoRegistrado,
} from "@/engine/dupla-eliminacao";
import { validarPlacar } from "@/engine/placar";
import { validarTrocaDeQuadra, type PartidaOperacional, type QuadraOperacional } from "@/engine/quadras";
import { validarNaipe } from "@/engine/naipe";
import { ALGORITMO_SORTEIO, ordemDasCabecas, sortearEquipes, validarElenco } from "@/engine/sorteio";
import { ErroDeRegra } from "@/lib/erros";
import { exigirAdministrador } from "@/server/acesso";
import { distribuirTorneio, regrasDoTorneio, sincronizarChave, trancar, type Tx } from "@/server/banco";
import { prisma } from "@/server/db";

const ALGORITMO_CHAVE = `${ALGORITMO_SORTEIO}+dupla-eliminacao-v1`;
const ALGORITMO_FOLHA_16 = "ordem-de-confirmacao+folha-16-v1";

function extrairResultados(partidas: Partida[]): ResultadoRegistrado[] {
  return partidas
    .filter(
      (partida) =>
        partida.status === "CONCLUIDA" &&
        partida.placarA != null &&
        partida.placarB != null &&
        partida.equipeAId &&
        partida.equipeBId,
    )
    .sort((a, b) => (a.ordemConclusao ?? 0) - (b.ordemConclusao ?? 0) || a.codigo.localeCompare(b.codigo))
    .map((partida) => ({
      partidaId: partida.codigo,
      placarA: partida.placarA!,
      placarB: partida.placarB!,
      equipeAId: partida.equipeAId!,
      equipeBId: partida.equipeBId!,
    }));
}

function sementeDe(informada?: number) {
  if (informada && Number.isInteger(informada)) return informada;
  return randomInt(1, 2_000_000_000);
}

export async function gerarSorteioEquipes(adminId: string, torneioId: string, autorizarIncompleta: boolean, semente?: number) {
  await exigirAdministrador(adminId);
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (torneio.formacao !== "SORTEADAS") {
      throw new ErroDeRegra("Este torneio usa equipes previamente formadas.");
    }
    if (!["AGUARDANDO_SORTEIO", "INSCRICOES_ENCERRADAS"].includes(torneio.status) || torneio.equipesTravadasEm) {
      throw new ErroDeRegra("Encerre as inscrições e prepare o sorteio antes de formar as equipes.");
    }
    const pendentes = await tx.inscricao.count({ where: { torneioId, status: "PENDENTE" } });
    if (pendentes > 0) throw new ErroDeRegra("Ainda há inscrições pendentes. Aprove ou rejeite todas antes do sorteio.");
    const atletas = await tx.inscricao.findMany({
      where: { torneioId, status: "APROVADA" },
      select: { atletaId: true, atleta: { select: { nomeCompleto: true, sexo: true } } },
      orderBy: { criadaEm: "asc" },
    });
    for (const item of atletas) {
      const individual = validarNaipe(torneio.naipe, [item.atleta.sexo], false);
      if (!individual.ok) throw new ErroDeRegra(individual.erro);
    }
    const sorteio = sortearEquipes({
      atletaIds: atletas.map((item) => item.atletaId),
      nomes: Object.fromEntries(atletas.map((item) => [item.atletaId, item.atleta.nomeCompleto])),
      sexos: Object.fromEntries(atletas.map((item) => [item.atletaId, item.atleta.sexo])),
      naipe: torneio.naipe,
      formato: torneio.formato,
      semente: sementeDe(semente),
      autorizarIncompleta: autorizarIncompleta && torneio.permitirEquipeIncompleta,
    });
    if (!sorteio.ok) {
      throw new ErroDeRegra(`${sorteio.mensagem} ${sorteio.alternativas.join(" ")}`, 409, "SOBRA", {
        alternativas: sorteio.alternativas,
        sobra: sorteio.sobra,
      });
    }
    if (autorizarIncompleta && !torneio.permitirEquipeIncompleta && atletas.length % (torneio.formato === "DUPLA" ? 2 : torneio.formato === "TRIO" ? 3 : 4) !== 0) {
      throw new ErroDeRegra("A equipe incompleta só pode ser formada se o torneio autorizar essa regra.");
    }
    await tx.sorteio.updateMany({
      where: { torneioId, tipo: "EQUIPES", status: "RASCUNHO" },
      data: { status: "DESCARTADO" },
    });
    const registro = await tx.sorteio.create({
      data: {
        torneioId,
        tipo: "EQUIPES",
        status: "RASCUNHO",
        semente: sorteio.semente,
        algoritmo: sorteio.algoritmo,
        resultado: JSON.parse(JSON.stringify(sorteio)) as Prisma.InputJsonValue,
        criadoPorId: adminId,
      },
    });
    return { sorteioId: registro.id, sorteio, torneioId, slug: torneio.slug };
  });
}

export async function confirmarSorteioEquipes(adminId: string, sorteioId: string) {
  await exigirAdministrador(adminId);
  const rascunho = await prisma.sorteio.findUnique({ where: { id: sorteioId } });
  if (!rascunho) throw new ErroDeRegra("Sorteio não encontrado.", 404);
  return trancar(rascunho.torneioId, async (tx) => {
    const atual = await tx.sorteio.findUniqueOrThrow({ where: { id: sorteioId } });
    if (atual.status === "CONFIRMADO") return { idempotente: true, torneioId: atual.torneioId };
    if (atual.status !== "RASCUNHO" || atual.tipo !== "EQUIPES") {
      throw new ErroDeRegra("Este sorteio não está aguardando confirmação.");
    }
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: atual.torneioId } });
    const resultado = atual.resultado as {
      equipes: { nome: string; atletaIds: string[]; incompleta: boolean }[];
    };
    const aprovados = await tx.inscricao.findMany({
      where: { torneioId: torneio.id, status: "APROVADA" },
      select: { atletaId: true },
    });
    const atualIds = new Set(aprovados.map((item) => item.atletaId));
    const sorteados = resultado.equipes.flatMap((equipe) => equipe.atletaIds);
    if (atualIds.size !== sorteados.length || sorteados.some((id) => !atualIds.has(id))) {
      throw new ErroDeRegra("A lista de atletas mudou. Gere o sorteio novamente.");
    }
    for (const equipe of resultado.equipes) {
      const criada = await tx.equipe.create({
        data: {
          torneioId: torneio.id,
          nome: equipe.nome,
          status: "CONFIRMADA",
          incompleta: equipe.incompleta,
          capitaoId: equipe.atletaIds[0],
        },
      });
      for (const atletaId of equipe.atletaIds) {
        await tx.membroEquipe.create({ data: { equipeId: criada.id, atletaId } });
        await tx.inscricao.update({
          where: { torneioId_atletaId: { torneioId: torneio.id, atletaId } },
          data: { equipeId: criada.id, status: "APROVADA" },
        });
      }
    }
    await tx.sorteio.update({
      where: { id: atual.id },
      data: { status: "CONFIRMADO", confirmadoEm: new Date() },
    });
    await tx.torneio.update({
      where: { id: torneio.id },
      data: { equipesTravadasEm: new Date(), status: "AGUARDANDO_SORTEIO" },
    });
    return { idempotente: false, torneioId: torneio.id, slug: torneio.slug };
  });
}

export async function desfazerSorteioEquipes(adminId: string, torneioId: string) {
  await exigirAdministrador(adminId);
  return trancar(torneioId, async (tx) => {
    const partidas = await tx.partida.count({ where: { torneioId } });
    if (partidas > 0) throw new ErroDeRegra("O chaveamento já foi gerado e as equipes não podem ser desfeitas.");
    await tx.inscricao.updateMany({ where: { torneioId }, data: { equipeId: null } });
    await tx.equipe.deleteMany({ where: { torneioId } });
    await tx.sorteio.updateMany({
      where: { torneioId, tipo: "EQUIPES", status: "CONFIRMADO" },
      data: { status: "DESCARTADO" },
    });
    const torneio = await tx.torneio.update({
      where: { id: torneioId },
      data: { equipesTravadasEm: null },
    });
    return torneio;
  });
}

export async function gerarSorteioConfrontos(adminId: string, torneioId: string, semente?: number) {
  await exigirAdministrador(adminId);
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (torneio.status !== "AGUARDANDO_SORTEIO") {
      throw new ErroDeRegra("Prepare o sorteio antes de gerar os confrontos.");
    }
    if (await tx.partida.count({ where: { torneioId } })) {
      throw new ErroDeRegra("Os confrontos deste torneio já foram gerados.");
    }
    await validarEquipesParaChave(tx, torneio.id, torneio.formato, torneio.formacao, torneio.naipe, torneio.permitirEquipeIncompleta);
    const quadras = await tx.torneioQuadra.count({ where: { torneioId, habilitada: true } });
    if (quadras < 1) throw new ErroDeRegra("Habilite pelo menos uma quadra antes do sorteio.");
    const equipes = await tx.equipe.findMany({
      where: { torneioId, status: "CONFIRMADA" },
      orderBy: { criadaEm: "asc" },
    });
    if (equipes.length < 2) throw new ErroDeRegra("São necessárias pelo menos duas equipes confirmadas.");
    if (torneio.modeloChave === "FOLHA_16" && equipes.length > 16) {
      throw new ErroDeRegra("A tabela de até 16 times aceita no máximo 16 equipes. A tabela de 32 times não entra neste torneio.");
    }
    const valor = sementeDe(semente);
    const ordem = ordemDasCabecas(equipes, torneio.modeloChave, valor);
    await tx.sorteio.updateMany({
      where: { torneioId, tipo: "CONFRONTOS", status: "RASCUNHO" },
      data: { status: "DESCARTADO" },
    });
    const registro = await tx.sorteio.create({
      data: {
        torneioId,
        tipo: "CONFRONTOS",
        status: "RASCUNHO",
        semente: valor,
        algoritmo: torneio.modeloChave === "FOLHA_16" ? ALGORITMO_FOLHA_16 : ALGORITMO_CHAVE,
        resultado: { equipes: ordem },
        criadoPorId: adminId,
      },
    });
    return { sorteioId: registro.id, ordem, semente: valor, torneioId, slug: torneio.slug };
  });
}

async function validarEquipesParaChave(
  tx: Tx,
  torneioId: string,
  formato: "DUPLA" | "TRIO" | "QUARTETO",
  formacao: "PRE_FORMADAS" | "SORTEADAS",
  naipe: "FEMININO" | "MASCULINO" | "MISTO",
  permitirIncompleta: boolean,
) {
  const pendentesInscricao = await tx.inscricao.count({ where: { torneioId, status: "PENDENTE" } });
  if (pendentesInscricao > 0) throw new ErroDeRegra("Ainda há inscrições pendentes.");
  const pendentesEquipe = await tx.equipe.count({ where: { torneioId, status: "PENDENTE" } });
  if (pendentesEquipe > 0) throw new ErroDeRegra("Ainda há equipes pendentes. Aprove ou rejeite antes do sorteio.");
  if (formacao === "SORTEADAS") {
    const confirmado = await tx.sorteio.count({ where: { torneioId, tipo: "EQUIPES", status: "CONFIRMADO" } });
    if (!confirmado) throw new ErroDeRegra("Confirme o sorteio das equipes antes dos confrontos.");
  }
  const equipes = await tx.equipe.findMany({
    where: { torneioId, status: "CONFIRMADA" },
    include: { membros: { include: { atleta: true } } },
  });
  for (const equipe of equipes) {
    const validacao = validarElenco(formato, equipe.membros.length, equipe.incompleta && permitirIncompleta);
    if (!validacao.ok) throw new ErroDeRegra(`${equipe.nome}: ${validacao.erro}`);
    const naipeOk = validarNaipe(naipe, equipe.membros.map((membro) => membro.atleta.sexo), true);
    if (!naipeOk.ok) throw new ErroDeRegra(`${equipe.nome}: ${naipeOk.erro}`);
  }
}

export async function confirmarSorteioConfrontos(adminId: string, sorteioId: string) {
  await exigirAdministrador(adminId);
  const rascunho = await prisma.sorteio.findUnique({ where: { id: sorteioId } });
  if (!rascunho) throw new ErroDeRegra("Sorteio não encontrado.", 404);
  return trancar(rascunho.torneioId, async (tx) => {
    const atual = await tx.sorteio.findUniqueOrThrow({ where: { id: sorteioId } });
    if (atual.status === "CONFIRMADO" && atual.tipo === "CONFRONTOS") {
      return { idempotente: true, torneioId: atual.torneioId };
    }
    if (atual.status !== "RASCUNHO" || atual.tipo !== "CONFRONTOS") {
      throw new ErroDeRegra("Este sorteio de confrontos não está aguardando confirmação.");
    }
    if (await tx.partida.count({ where: { torneioId: atual.torneioId } })) {
      throw new ErroDeRegra("Os confrontos já foram gerados.");
    }
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: atual.torneioId } });
    await validarEquipesParaChave(tx, torneio.id, torneio.formato, torneio.formacao, torneio.naipe, torneio.permitirEquipeIncompleta);
    const ordem = (atual.resultado as { equipes: string[] }).equipes;
    const confirmadas = await tx.equipe.findMany({ where: { torneioId: torneio.id, status: "CONFIRMADA" } });
    if (ordem.length !== confirmadas.length || confirmadas.some((equipe) => !ordem.includes(equipe.id))) {
      throw new ErroDeRegra("As equipes mudaram. Gere o sorteio dos confrontos novamente.");
    }
    for (let indice = 0; indice < ordem.length; indice++) {
      await tx.equipe.update({ where: { id: ordem[indice] }, data: { cabeca: indice + 1 } });
    }
    if (torneio.modeloChave === "FOLHA_16" && ordem.length > 16) {
      throw new ErroDeRegra("A tabela de até 16 times aceita no máximo 16 equipes. A tabela de 32 times não entra neste torneio.");
    }
    const estado = criarEstadoInicial(ordem, torneio.modeloChave);
    await sincronizarChave(tx, torneio.id, estado);
    await tx.sorteio.update({
      where: { id: atual.id },
      data: { status: "CONFIRMADO", confirmadoEm: new Date() },
    });
    const agora = new Date();
    await tx.torneio.update({
      where: { id: torneio.id },
      data: { status: "EM_ANDAMENTO", iniciadoEm: agora, equipesTravadasEm: torneio.equipesTravadasEm ?? agora },
    });
    await distribuirTorneio(tx, torneio.id, agora);
    return { idempotente: false, torneioId: torneio.id, slug: torneio.slug };
  });
}

export async function confirmarResultado(adminId: string, partidaId: string, placarA: number, placarB: number) {
  await exigirAdministrador(adminId);
  const partida = await prisma.partida.findUnique({ where: { id: partidaId } });
  if (!partida) throw new ErroDeRegra("Partida não encontrada.", 404);
  return trancar(partida.torneioId, async (tx) => {
    const atual = await tx.partida.findUniqueOrThrow({ where: { id: partidaId } });
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: atual.torneioId } });
    if (torneio.status === "PAUSADO") throw new ErroDeRegra("O torneio está pausado.");
    if (torneio.status !== "EM_ANDAMENTO") throw new ErroDeRegra("O torneio não está em andamento.");
    if (atual.status === "CONCLUIDA") {
      if (atual.placarA === placarA && atual.placarB === placarB) {
        return { idempotente: true, torneioId: torneio.id, slug: torneio.slug };
      }
      throw new ErroDeRegra("O resultado já foi confirmado. Use a correção para alterar o placar.", 409, "JA_CONFIRMADO");
    }
    if (!["PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"].includes(atual.status) || !atual.equipeAId || !atual.equipeBId) {
      throw new ErroDeRegra("A partida ainda não tem os dois adversários definidos.");
    }
    const regras = regrasDoTorneio(torneio);
    const validacao = validarPlacar(placarA, placarB, regras);
    if (!validacao.ok) throw new ErroDeRegra(validacao.erro);
    const partidas = await tx.partida.findMany({ where: { torneioId: torneio.id } });
    const equipes = await tx.equipe.findMany({
      where: { torneioId: torneio.id, cabeca: { not: null } },
      orderBy: { cabeca: "asc" },
    });
    const resultados = extrairResultados(partidas);
    resultados.push({
      partidaId: atual.codigo,
      placarA,
      placarB,
      equipeAId: atual.equipeAId,
      equipeBId: atual.equipeBId,
    });
    const replay = reexecutar(
      equipes.map((equipe) => equipe.id),
      resultados,
      regras,
      { estrito: true, modelo: torneio.modeloChave },
    );
    await sincronizarChave(tx, torneio.id, replay.estado);
    const salva = await tx.partida.update({
      where: { torneioId_codigo: { torneioId: torneio.id, codigo: atual.codigo } },
      data: {
        registradaPorId: adminId,
        fimEm: new Date(),
        inicioEm: atual.inicioEm ?? new Date(),
      },
    });
    await tx.historicoResultado.create({
      data: {
        partidaId: salva.id,
        torneioId: torneio.id,
        acao: "CONFIRMACAO",
        placarANovo: placarA,
        placarBNovo: placarB,
        vencedorNovoId: placarA > placarB ? atual.equipeAId : atual.equipeBId,
        partidasAfetadas: [],
        adminId,
      },
    });
    await distribuirTorneio(tx, torneio.id);
    return { idempotente: false, torneioId: torneio.id, slug: torneio.slug };
  });
}

export async function corrigirResultado(
  adminId: string,
  partidaId: string,
  placarA: number,
  placarB: number,
  motivo: string,
  confirmarDependencias: boolean,
) {
  await exigirAdministrador(adminId);
  if (motivo.trim().length < 3) throw new ErroDeRegra("Descreva o motivo da correção.");
  const partida = await prisma.partida.findUnique({ where: { id: partidaId } });
  if (!partida) throw new ErroDeRegra("Partida não encontrada.", 404);
  return trancar(partida.torneioId, async (tx) => {
    const atual = await tx.partida.findUniqueOrThrow({ where: { id: partidaId } });
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: atual.torneioId } });
    if (torneio.status === "FINALIZADO") throw new ErroDeRegra("O torneio já foi encerrado.");
    if (!["EM_ANDAMENTO", "PAUSADO"].includes(torneio.status)) {
      throw new ErroDeRegra("Ainda não há resultados para corrigir.");
    }
    const regras = regrasDoTorneio(torneio);
    const partidas = await tx.partida.findMany({ where: { torneioId: torneio.id } });
    const equipes = await tx.equipe.findMany({
      where: { torneioId: torneio.id, cabeca: { not: null } },
      orderBy: { cabeca: "asc" },
    });
    const resultados = extrairResultados(partidas);
    const plano = planejarCorrecao(
      equipes.map((equipe) => equipe.id),
      resultados,
      atual.codigo,
      placarA,
      placarB,
      regras,
      torneio.modeloChave,
    );
    const nomes = new Map(equipes.map((equipe) => [equipe.id, equipe.nome]));
    const afetadas = plano.invalidados.map((item) => ({
      codigo: item.partidaId,
      descricao: `${item.partidaId}: ${nomes.get(item.equipeAId) ?? "Equipe A"} ${item.placarA} x ${item.placarB} ${nomes.get(item.equipeBId) ?? "Equipe B"}`,
    }));
    if (plano.idempotente) return { idempotente: true, precisaConfirmacao: false, afetadas: [], torneioId: torneio.id, slug: torneio.slug };
    if (plano.precisaConfirmacao && !confirmarDependencias) {
      return { idempotente: false, precisaConfirmacao: true, afetadas, torneioId: torneio.id, slug: torneio.slug };
    }
    await sincronizarChave(tx, torneio.id, plano.estado);
    const salva = await tx.partida.update({
      where: { torneioId_codigo: { torneioId: torneio.id, codigo: atual.codigo } },
      data: { registradaPorId: adminId },
    });
    await tx.historicoResultado.create({
      data: {
        partidaId: salva.id,
        torneioId: torneio.id,
        acao: "CORRECAO",
        placarAAnterior: atual.placarA,
        placarBAnterior: atual.placarB,
        vencedorAnteriorId: atual.vencedorId,
        placarANovo: placarA,
        placarBNovo: placarB,
        vencedorNovoId: placarA > placarB ? atual.equipeAId : atual.equipeBId,
        motivo: motivo.trim(),
        partidasAfetadas: afetadas,
        adminId,
      },
    });
    if (torneio.status === "EM_ANDAMENTO") await distribuirTorneio(tx, torneio.id);
    return { idempotente: false, precisaConfirmacao: false, afetadas, torneioId: torneio.id, slug: torneio.slug };
  });
}

async function operacaoDePartida(adminId: string, partidaId: string, fn: (tx: Tx, partida: Partida) => Promise<void>) {
  await exigirAdministrador(adminId);
  const partida = await prisma.partida.findUnique({ where: { id: partidaId } });
  if (!partida) throw new ErroDeRegra("Partida não encontrada.", 404);
  return trancar(partida.torneioId, async (tx) => {
    const atual = await tx.partida.findUniqueOrThrow({ where: { id: partidaId } });
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: atual.torneioId } });
    if (torneio.status !== "EM_ANDAMENTO") throw new ErroDeRegra("O torneio não está em andamento.");
    await fn(tx, atual);
    const atualizado = await tx.torneio.findUniqueOrThrow({ where: { id: torneio.id } });
    return { torneioId: atualizado.id, slug: atualizado.slug };
  });
}

export async function iniciarPartida(adminId: string, partidaId: string) {
  return operacaoDePartida(adminId, partidaId, async (tx, partida) => {
    if (!["AGENDADA", "PRONTA"].includes(partida.status) || !partida.quadraId) {
      throw new ErroDeRegra("Agende a partida em uma quadra antes de iniciá-la.");
    }
    await tx.partida.update({
      where: { id: partida.id },
      data: { status: "EM_ANDAMENTO", inicioEm: partida.inicioEm ?? new Date() },
    });
  });
}

export async function pausarPartida(adminId: string, partidaId: string) {
  return operacaoDePartida(adminId, partidaId, async (tx, partida) => {
    if (partida.status !== "EM_ANDAMENTO") throw new ErroDeRegra("Só uma partida em andamento pode ser pausada.");
    await tx.partida.update({ where: { id: partida.id }, data: { status: "PAUSADA" } });
  });
}

export async function retomarPartida(adminId: string, partidaId: string) {
  return operacaoDePartida(adminId, partidaId, async (tx, partida) => {
    if (partida.status !== "PAUSADA") throw new ErroDeRegra("Esta partida não está pausada.");
    await tx.partida.update({ where: { id: partida.id }, data: { status: "EM_ANDAMENTO" } });
  });
}

export async function devolverPartida(adminId: string, partidaId: string) {
  return operacaoDePartida(adminId, partidaId, async (tx, partida) => {
    if (partida.status !== "AGENDADA") throw new ErroDeRegra("Só uma partida agendada pode voltar para a fila.");
    await tx.partida.update({ where: { id: partida.id }, data: { status: "PRONTA", quadraId: null } });
    await distribuirTorneio(tx, partida.torneioId);
  });
}

export async function trocarQuadra(adminId: string, partidaId: string, quadraId: string) {
  await exigirAdministrador(adminId);
  const partida = await prisma.partida.findUnique({ where: { id: partidaId } });
  if (!partida) throw new ErroDeRegra("Partida não encontrada.", 404);
  return trancar(partida.torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: partida.torneioId } });
    if (torneio.status !== "EM_ANDAMENTO") throw new ErroDeRegra("O torneio não está em andamento.");
    const [partidas, vinculos] = await Promise.all([
      tx.partida.findMany({ where: { torneioId: torneio.id } }),
      tx.torneioQuadra.findMany({ where: { torneioId: torneio.id } }),
    ]);
    const agora = new Date();
    const operacionais: PartidaOperacional[] = partidas.map((item) => ({
      id: item.id,
      status: item.status,
      chave: item.chave,
      rodada: item.rodada,
      equipeAId: item.equipeAId,
      equipeBId: item.equipeBId,
      quadraId: item.quadraId,
      prontaEm: item.prontaEm?.getTime() ?? 0,
      inicioEm: item.inicioEm?.getTime() ?? null,
      fimEm: item.fimEm?.getTime() ?? null,
    }));
    const quadras: QuadraOperacional[] = vinculos.map((vinculo) => ({
      id: vinculo.quadraId,
      habilitada: vinculo.habilitada,
      indisponivelAte: vinculo.indisponivelAte?.getTime() ?? null,
    }));
    const validacao = validarTrocaDeQuadra({ partidas: operacionais, partidaId, quadraId, quadras, agora: agora.getTime() });
    if (!validacao.ok) throw new ErroDeRegra(validacao.erro);
    const atual = partidas.find((item) => item.id === partidaId)!;
    await tx.partida.update({
      where: { id: partidaId },
      data: {
        quadraId,
        status: atual.status === "PRONTA" ? "AGENDADA" : atual.status,
      },
    });
    return { torneioId: torneio.id, slug: torneio.slug };
  });
}

export async function distribuirAgora(adminId: string, torneioId: string) {
  await exigirAdministrador(adminId);
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (torneio.status !== "EM_ANDAMENTO") throw new ErroDeRegra("A distribuição automática vale com o torneio em andamento.");
    await distribuirTorneio(tx, torneioId);
    return { torneioId, slug: torneio.slug };
  });
}

export async function salvarQuadra(adminId: string, nome: string) {
  await exigirAdministrador(adminId);
  const titulo = nome.trim();
  if (titulo.length < 1) throw new ErroDeRegra("Informe o nome da quadra.");
  return prisma.quadra.create({ data: { nome: titulo } });
}

export async function vincularQuadra(adminId: string, torneioId: string, quadraId: string, habilitada: boolean) {
  await exigirAdministrador(adminId);
  const torneio = await prisma.torneio.findUnique({ where: { id: torneioId } });
  if (!torneio) throw new ErroDeRegra("Torneio não encontrado.", 404);
  if (torneio.status === "FINALIZADO") throw new ErroDeRegra("Torneio finalizado.");
  const ordem = await prisma.torneioQuadra.count({ where: { torneioId } });
  await prisma.torneioQuadra.upsert({
    where: { torneioId_quadraId: { torneioId, quadraId } },
    update: { habilitada },
    create: { torneioId, quadraId, habilitada, ordem },
  });
  if (torneio.status === "EM_ANDAMENTO") {
    await trancar(torneioId, (tx) => distribuirTorneio(tx, torneioId));
  }
  return { torneioId, slug: torneio.slug };
}

export async function indisponibilizarQuadra(adminId: string, torneioId: string, quadraId: string, ate: Date | null) {
  await exigirAdministrador(adminId);
  return trancar(torneioId, async (tx) => {
    const vinculo = await tx.torneioQuadra.findUnique({ where: { torneioId_quadraId: { torneioId, quadraId } } });
    if (!vinculo) throw new ErroDeRegra("Esta quadra não está ligada ao torneio.");
    await tx.torneioQuadra.update({ where: { id: vinculo.id }, data: { indisponivelAte: ate } });
    if (ate && ate.getTime() > Date.now()) {
      await tx.partida.updateMany({
        where: { torneioId, quadraId, status: "AGENDADA" },
        data: { quadraId: null, status: "PRONTA" },
      });
    }
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (torneio.status === "EM_ANDAMENTO") await distribuirTorneio(tx, torneioId);
    return { torneioId, slug: torneio.slug };
  });
}
