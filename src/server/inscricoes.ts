import type { Torneio } from "@prisma/client";
import { tamanhoDaEquipe, validarElenco } from "@/engine/sorteio";
import { ErroDeRegra } from "@/lib/erros";
import { carregarUsuario, exigirAdministrador } from "@/server/acesso";
import { trancar, type Tx } from "@/server/banco";

function afirmarInscricoesAbertas(torneio: Torneio) {
  if (torneio.status !== "INSCRICOES_ABERTAS") {
    throw new ErroDeRegra("As inscrições deste torneio não estão abertas.");
  }
  if (torneio.inscricoesAte.getTime() < Date.now()) {
    throw new ErroDeRegra("O prazo de inscrição terminou.");
  }
}

function afirmarComposicaoAberta(torneio: Torneio) {
  if (torneio.equipesTravadasEm || ["EM_ANDAMENTO", "PAUSADO", "FINALIZADO"].includes(torneio.status)) {
    throw new ErroDeRegra("As equipes não podem ser alteradas após a confirmação ou o início do torneio.");
  }
}

async function afirmarVaga(tx: Tx, torneio: Torneio, adicionais = 1) {
  if (torneio.maxAtletas == null) return;
  const ocupadas = await tx.inscricao.count({
    where: { torneioId: torneio.id, status: { in: ["PENDENTE", "APROVADA"] } },
  });
  if (ocupadas + adicionais > torneio.maxAtletas) {
    throw new ErroDeRegra("O limite de atletas deste torneio foi atingido.");
  }
}

async function atletaDoUsuario(usuarioId: string) {
  const usuario = await carregarUsuario(usuarioId);
  if (usuario.papel === "ADMIN") return { usuario, atletaId: null as string | null };
  if (!usuario.atleta) throw new ErroDeRegra("Complete o perfil de atleta para se inscrever.", 403);
  return { usuario, atletaId: usuario.atleta.id };
}

export async function inscrever(usuarioId: string, torneioId: string) {
  const { atletaId } = await atletaDoUsuario(usuarioId);
  if (!atletaId) throw new ErroDeRegra("Use o painel do atleta para a inscrição individual.");
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    afirmarInscricoesAbertas(torneio);
    const existente = await tx.inscricao.findUnique({
      where: { torneioId_atletaId: { torneioId, atletaId } },
    });
    if (existente && existente.status !== "REJEITADA" && existente.status !== "CANCELADA") {
      throw new ErroDeRegra("Você já está inscrito neste torneio.");
    }
    await afirmarVaga(tx, torneio, existente ? 0 : 1);
    if (existente) {
      return tx.inscricao.update({
        where: { id: existente.id },
        data: { status: "PENDENTE", equipeId: null },
      });
    }
    return tx.inscricao.create({
      data: { torneioId, atletaId, status: "PENDENTE" },
    });
  });
}

export async function criarEquipe(usuarioId: string, torneioId: string, nome: string, atletaIds: string[]) {
  const { usuario, atletaId } = await atletaDoUsuario(usuarioId);
  const titulo = nome.trim();
  if (titulo.length < 2) throw new ErroDeRegra("Informe o nome da equipe.");
  const unicos = [...new Set(atletaIds.filter(Boolean))];
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (torneio.formacao !== "PRE_FORMADAS") {
      throw new ErroDeRegra("Neste torneio as equipes serão sorteadas. Inscreva-se individualmente.");
    }
    afirmarComposicaoAberta(torneio);
    if (usuario.papel !== "ADMIN") afirmarInscricoesAbertas(torneio);
    if (atletaId && !unicos.includes(atletaId)) unicos.unshift(atletaId);
    const tamanho = tamanhoDaEquipe(torneio.formato);
    if (unicos.length < 1 || unicos.length > tamanho) {
      throw new ErroDeRegra(`A equipe de ${torneio.formato.toLowerCase()} aceita de 1 a ${tamanho} atletas até a aprovação.`);
    }
    if (usuario.papel !== "ADMIN" && atletaId && !unicos.includes(atletaId)) {
      throw new ErroDeRegra("O responsável precisa fazer parte da equipe.");
    }

    const novas = [];
    for (const id of unicos) {
      const inscricao = await tx.inscricao.findUnique({ where: { torneioId_atletaId: { torneioId, atletaId: id } } });
      if (inscricao?.equipeId) throw new ErroDeRegra("Um dos atletas já está em outra equipe deste torneio.");
      if (inscricao && !["PENDENTE", "APROVADA", "REJEITADA", "CANCELADA"].includes(inscricao.status)) {
        throw new ErroDeRegra("Inscrição inválida.");
      }
      if (!inscricao || inscricao.status === "REJEITADA" || inscricao.status === "CANCELADA") novas.push(id);
    }
    await afirmarVaga(tx, torneio, novas.length);

    const equipe = await tx.equipe.create({
      data: {
        torneioId,
        nome: titulo,
        status: "PENDENTE",
        capitaoId: unicos[0],
      },
    });
    for (const id of unicos) {
      await tx.membroEquipe.create({ data: { equipeId: equipe.id, atletaId: id } });
      await tx.inscricao.upsert({
        where: { torneioId_atletaId: { torneioId, atletaId: id } },
        update: { equipeId: equipe.id, status: "PENDENTE" },
        create: { torneioId, atletaId: id, equipeId: equipe.id, status: "PENDENTE" },
      });
    }
    return equipe;
  });
}

export async function adicionarMembro(usuarioId: string, equipeId: string, atletaId: string) {
  const { usuario, atletaId: proprio } = await atletaDoUsuario(usuarioId);
  return trancarEquipe(equipeId, async (tx, equipe) => {
    if (usuario.papel !== "ADMIN" && equipe.capitaoId !== proprio) {
      throw new ErroDeRegra("Somente o responsável da equipe ou o administrador pode incluir atletas.", 403);
    }
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: equipe.torneioId } });
    afirmarComposicaoAberta(torneio);
    const tamanho = tamanhoDaEquipe(torneio.formato);
    const membros = await tx.membroEquipe.count({ where: { equipeId } });
    if (membros >= tamanho) throw new ErroDeRegra("A equipe já está completa.");
    const inscricao = await tx.inscricao.findUnique({
      where: { torneioId_atletaId: { torneioId: torneio.id, atletaId } },
    });
    if (inscricao?.equipeId && inscricao.equipeId !== equipeId) {
      throw new ErroDeRegra("Este atleta já está em outra equipe deste torneio.");
    }
    if (!inscricao) await afirmarVaga(tx, torneio, 1);
    await tx.membroEquipe.create({ data: { equipeId, atletaId } });
    await tx.inscricao.upsert({
      where: { torneioId_atletaId: { torneioId: torneio.id, atletaId } },
      update: { equipeId, status: "PENDENTE" },
      create: { torneioId: torneio.id, atletaId, equipeId, status: "PENDENTE" },
    });
    return equipe;
  });
}

export async function removerMembro(usuarioId: string, equipeId: string, atletaId: string) {
  const { usuario, atletaId: proprio } = await atletaDoUsuario(usuarioId);
  return trancarEquipe(equipeId, async (tx, equipe) => {
    if (usuario.papel !== "ADMIN" && equipe.capitaoId !== proprio) {
      throw new ErroDeRegra("Somente o responsável da equipe ou o administrador pode remover atletas.", 403);
    }
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: equipe.torneioId } });
    afirmarComposicaoAberta(torneio);
    await tx.membroEquipe.delete({ where: { equipeId_atletaId: { equipeId, atletaId } } });
    await tx.inscricao.updateMany({
      where: { torneioId: torneio.id, atletaId, equipeId },
      data: { equipeId: null, status: "PENDENTE" },
    });
    const restam = await tx.membroEquipe.count({ where: { equipeId } });
    if (restam === 0) {
      await tx.equipe.delete({ where: { id: equipeId } });
    } else if (equipe.capitaoId === atletaId) {
      const proximo = await tx.membroEquipe.findFirst({ where: { equipeId } });
      await tx.equipe.update({ where: { id: equipeId }, data: { capitaoId: proximo?.atletaId ?? null, status: "PENDENTE" } });
    } else if (equipe.status === "CONFIRMADA") {
      await tx.equipe.update({ where: { id: equipeId }, data: { status: "PENDENTE" } });
    }
    return { torneioId: torneio.id };
  });
}

export async function aprovarInscricao(adminId: string, inscricaoId: string) {
  await exigirAdministrador(adminId);
  const inscricao = await prismaInscricao(inscricaoId);
  return trancar(inscricao.torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: inscricao.torneioId } });
    if (torneio.formacao === "PRE_FORMADAS") {
      throw new ErroDeRegra("Em torneios de equipes formadas, aprove a equipe completa.");
    }
    afirmarComposicaoAberta(torneio);
    return tx.inscricao.update({ where: { id: inscricaoId }, data: { status: "APROVADA", equipeId: null } });
  });
}

export async function rejeitarInscricao(adminId: string, inscricaoId: string) {
  await exigirAdministrador(adminId);
  const inscricao = await prismaInscricao(inscricaoId);
  return trancar(inscricao.torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: inscricao.torneioId } });
    afirmarComposicaoAberta(torneio);
    if (inscricao.equipeId) {
      await tx.membroEquipe.deleteMany({ where: { equipeId: inscricao.equipeId, atletaId: inscricao.atletaId } });
    }
    return tx.inscricao.update({
      where: { id: inscricaoId },
      data: { status: "REJEITADA", equipeId: null },
    });
  });
}

export async function aprovarEquipe(adminId: string, equipeId: string) {
  await exigirAdministrador(adminId);
  return trancarEquipe(equipeId, async (tx, equipe) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: equipe.torneioId } });
    afirmarComposicaoAberta(torneio);
    const membros = await tx.membroEquipe.findMany({ where: { equipeId } });
    const validacao = validarElenco(torneio.formato, membros.length, false);
    if (!validacao.ok) throw new ErroDeRegra(validacao.erro);
    await tx.inscricao.updateMany({
      where: { equipeId },
      data: { status: "APROVADA" },
    });
    return tx.equipe.update({ where: { id: equipeId }, data: { status: "CONFIRMADA" } });
  });
}

export async function rejeitarEquipe(adminId: string, equipeId: string) {
  await exigirAdministrador(adminId);
  return trancarEquipe(equipeId, async (tx, equipe) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: equipe.torneioId } });
    afirmarComposicaoAberta(torneio);
    await tx.inscricao.updateMany({
      where: { equipeId },
      data: { status: "REJEITADA", equipeId: null },
    });
    await tx.equipe.delete({ where: { id: equipeId } });
    return { torneioId: torneio.id };
  });
}

export async function aprovarTodas(adminId: string, torneioId: string) {
  await exigirAdministrador(adminId);
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (torneio.formacao !== "SORTEADAS") {
      throw new ErroDeRegra("A aprovação em lote vale para inscrições individuais.");
    }
    afirmarComposicaoAberta(torneio);
    const resultado = await tx.inscricao.updateMany({
      where: { torneioId, status: "PENDENTE" },
      data: { status: "APROVADA" },
    });
    return { quantidade: resultado.count, torneioId };
  });
}

async function prismaInscricao(inscricaoId: string) {
  const { prisma } = await import("@/server/db");
  const inscricao = await prisma.inscricao.findUnique({ where: { id: inscricaoId } });
  if (!inscricao) throw new ErroDeRegra("Inscrição não encontrada.", 404);
  return inscricao;
}

async function trancarEquipe<T>(equipeId: string, fn: (tx: Tx, equipe: { id: string; torneioId: string; capitaoId: string | null; status: string }) => Promise<T>) {
  const { prisma } = await import("@/server/db");
  const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } });
  if (!equipe) throw new ErroDeRegra("Equipe não encontrada.", 404);
  return trancar(equipe.torneioId, (tx) => fn(tx, equipe));
}
