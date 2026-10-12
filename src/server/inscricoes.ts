import { randomBytes } from "node:crypto";
import type { Sexo, Torneio } from "@prisma/client";
import { validarNaipe } from "@/engine/naipe";
import { desambiguarNome, nomeAutomatico, pareceNomeAutomatico, resolverNomeEquipe } from "@/engine/nomes";
import { tamanhoDaEquipe, validarElenco } from "@/engine/sorteio";
import { ErroDeRegra } from "@/lib/erros";
import type { IntegranteInformado } from "@/lib/integrantes";
import { carregarUsuario, exigirAdministrador } from "@/server/acesso";
import { trancar, type Tx } from "@/server/banco";
import { gerarHash } from "@/server/senha";

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
    const atleta = await tx.atleta.findUniqueOrThrow({ where: { id: atletaId } });
    afirmarSexoNoTorneio(torneio.naipe, [atleta.sexo], false);
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

export async function criarEquipe(
  usuarioId: string,
  torneioId: string,
  nome: string,
  atletaIds: string[],
  autorizarIncompleta = false,
) {
  const { usuario, atletaId } = await atletaDoUsuario(usuarioId);
  const unicos = [...new Set(atletaIds.filter(Boolean))];
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (torneio.formacao !== "PRE_FORMADAS") {
      throw new ErroDeRegra("Neste torneio as equipes serão sorteadas. Inscreva-se individualmente.");
    }
    afirmarComposicaoAberta(torneio);
    if (usuario.papel !== "ADMIN") afirmarInscricoesAbertas(torneio);
    if (atletaId && !unicos.includes(atletaId)) {
      throw new ErroDeRegra("A equipe precisa incluir você.");
    }
    return persistirEquipe(tx, usuario.papel, torneio, nome, unicos, autorizarIncompleta);
  });
}

export async function cadastrarEquipePorNomes(
  usuarioId: string,
  torneioId: string,
  nome: string,
  componentes: IntegranteInformado[],
  autorizarIncompleta: boolean,
) {
  const { usuario, atletaId } = await atletaDoUsuario(usuarioId);
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (torneio.formacao !== "PRE_FORMADAS") {
      throw new ErroDeRegra("Neste torneio as equipes serão sorteadas. Inscreva-se individualmente.");
    }
    afirmarComposicaoAberta(torneio);
    if (usuario.papel !== "ADMIN") afirmarInscricoesAbertas(torneio);
    const ids: string[] = [];
    for (const componente of componentes) {
      const id = await resolverIntegrante(tx, torneioId, componente);
      if (ids.includes(id)) throw new ErroDeRegra("O mesmo atleta foi informado mais de uma vez.");
      ids.push(id);
    }
    if (atletaId && !ids.includes(atletaId)) {
      throw new ErroDeRegra("A equipe precisa incluir você.");
    }
    return persistirEquipe(tx, usuario.papel, torneio, nome, ids, usuario.papel === "ADMIN" && autorizarIncompleta);
  });
}

async function persistirEquipe(
  tx: Tx,
  papel: "ADMIN" | "ATLETA",
  torneio: Torneio,
  nome: string,
  unicos: string[],
  autorizarIncompleta: boolean,
) {
  const tamanho = tamanhoDaEquipe(torneio.formato);
  const incompletaAutorizada = papel === "ADMIN" && autorizarIncompleta && torneio.permitirEquipeIncompleta;
  const elenco = validarElenco(torneio.formato, unicos.length, incompletaAutorizada);
  if (!elenco.ok) throw new ErroDeRegra(elenco.erro);

  const novas = [];
  for (const id of unicos) {
    const inscricao = await tx.inscricao.findUnique({ where: { torneioId_atletaId: { torneioId: torneio.id, atletaId: id } } });
    if (inscricao?.equipeId) throw new ErroDeRegra("Um dos atletas já está em outra equipe deste torneio.");
    if (inscricao && !["PENDENTE", "APROVADA", "REJEITADA", "CANCELADA"].includes(inscricao.status)) {
      throw new ErroDeRegra("Inscrição inválida.");
    }
    if (!inscricao || inscricao.status === "REJEITADA" || inscricao.status === "CANCELADA") novas.push(id);
  }
  await afirmarVaga(tx, torneio, novas.length);

  const atletas = await atletasNaOrdem(tx, unicos);
  const nomes = atletas.map((atleta) => atleta.nomeCompleto);
  afirmarSexoNoTorneio(torneio.naipe, atletas.map((atleta) => atleta.sexo), true);
  const resolvido = resolverNomeEquipe(nome, nomes);
  if (!resolvido.ok) throw new ErroDeRegra(resolvido.erro);
  const titulo = await nomeLivre(tx, torneio.id, resolvido.nome);
  const statusInscricao = papel === "ADMIN" ? "APROVADA" : "PENDENTE";

  const equipe = await tx.equipe.create({
    data: {
      torneioId: torneio.id,
      nome: titulo,
      status: "PENDENTE",
      incompleta: unicos.length < tamanho,
      capitaoId: unicos[0],
    },
  });
  for (const id of unicos) {
    await tx.membroEquipe.create({ data: { equipeId: equipe.id, atletaId: id } });
    await tx.inscricao.upsert({
      where: { torneioId_atletaId: { torneioId: torneio.id, atletaId: id } },
      update: { equipeId: equipe.id, status: statusInscricao },
      create: { torneioId: torneio.id, atletaId: id, equipeId: equipe.id, status: statusInscricao },
    });
  }
  return equipe;
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
    const antes = await tx.membroEquipe.findMany({ where: { equipeId }, include: { atleta: true } });
    await tx.membroEquipe.create({ data: { equipeId, atletaId } });
    const statusInscricao = usuario.papel === "ADMIN" ? "APROVADA" : "PENDENTE";
    await tx.inscricao.upsert({
      where: { torneioId_atletaId: { torneioId: torneio.id, atletaId } },
      update: { equipeId, status: statusInscricao },
      create: { torneioId: torneio.id, atletaId, equipeId, status: statusInscricao },
    });
    const novo = await tx.atleta.findUnique({ where: { id: atletaId } });
    if (!novo) throw new ErroDeRegra("Atleta não encontrado.", 404);
    afirmarSexoNoTorneio(
      torneio.naipe,
      [...antes.map((membro) => membro.atleta.sexo), novo.sexo],
      membros + 1 === tamanho,
    );
    await renomearSeAutomatica(tx, equipe, antes.map((membro) => membro.atleta.nomeCompleto), [
      ...antes.map((membro) => membro.atleta.nomeCompleto),
      novo.nomeCompleto,
    ]);
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
    const antes = await tx.membroEquipe.findMany({ where: { equipeId }, include: { atleta: true } });
    await tx.membroEquipe.delete({ where: { equipeId_atletaId: { equipeId, atletaId } } });
    await tx.inscricao.updateMany({
      where: { torneioId: torneio.id, atletaId, equipeId },
      data: { equipeId: null, status: "PENDENTE" },
    });
    const restam = await tx.membroEquipe.count({ where: { equipeId } });
    if (restam === 0) {
      await tx.equipe.delete({ where: { id: equipeId } });
    } else {
      const depois = antes.filter((membro) => membro.atletaId !== atletaId).map((membro) => membro.atleta.nomeCompleto);
      await renomearSeAutomatica(tx, equipe, antes.map((membro) => membro.atleta.nomeCompleto), depois);
      if (equipe.capitaoId === atletaId) {
        const proximo = await tx.membroEquipe.findFirst({ where: { equipeId } });
        await tx.equipe.update({ where: { id: equipeId }, data: { capitaoId: proximo?.atletaId ?? null, status: "PENDENTE" } });
      } else if (equipe.status === "CONFIRMADA") {
        await tx.equipe.update({ where: { id: equipeId }, data: { status: "PENDENTE" } });
      }
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
    const membros = await tx.membroEquipe.findMany({ where: { equipeId }, include: { atleta: true } });
    const validacao = validarElenco(torneio.formato, membros.length, equipe.incompleta && torneio.permitirEquipeIncompleta);
    if (!validacao.ok) throw new ErroDeRegra(validacao.erro);
    afirmarSexoNoTorneio(torneio.naipe, membros.map((membro) => membro.atleta.sexo), true);
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

export async function inscreverAtletaDireto(adminId: string, torneioId: string, atletaId: string) {
  await exigirAdministrador(adminId);
  if (!atletaId) throw new ErroDeRegra("Escolha o atleta que será inscrito.");
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    afirmarComposicaoAberta(torneio);
    if (torneio.status === "FINALIZADO") throw new ErroDeRegra("Torneio finalizado.");
    const atleta = await tx.atleta.findUnique({ where: { id: atletaId } });
    if (!atleta) throw new ErroDeRegra("Atleta não encontrado.", 404);
    afirmarSexoNoTorneio(torneio.naipe, [atleta.sexo], false);
    const existente = await tx.inscricao.findUnique({
      where: { torneioId_atletaId: { torneioId, atletaId } },
    });
    if (existente && existente.status !== "REJEITADA" && existente.status !== "CANCELADA") {
      throw new ErroDeRegra("Este atleta já está inscrito neste torneio.");
    }
    await afirmarVaga(tx, torneio, existente ? 0 : 1);
    const inscricao = existente
      ? await tx.inscricao.update({
          where: { id: existente.id },
          data: { status: "APROVADA", equipeId: null },
        })
      : await tx.inscricao.create({
          data: { torneioId, atletaId, status: "APROVADA" },
        });
    return { inscricao, torneioId: torneio.id, slug: torneio.slug, nome: atleta.nomeCompleto };
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

function afirmarSexoNoTorneio(naipe: Torneio["naipe"], sexos: Sexo[], exigirParticipanteFeminina: boolean) {
  const validacao = validarNaipe(naipe, sexos, exigirParticipanteFeminina);
  if (!validacao.ok) throw new ErroDeRegra(validacao.erro);
}

async function atletasNaOrdem(tx: Tx, ids: string[]) {
  const atletas = await tx.atleta.findMany({
    where: { id: { in: ids } },
    select: { id: true, nomeCompleto: true, sexo: true },
  });
  const porId = new Map(atletas.map((atleta) => [atleta.id, atleta]));
  return ids.map((id) => {
    const atleta = porId.get(id);
    if (!atleta) throw new ErroDeRegra("Atleta não encontrado.", 404);
    return atleta;
  });
}

async function nomeLivre(tx: Tx, torneioId: string, base: string, ignorarEquipeId?: string) {
  const equipes = await tx.equipe.findMany({
    where: { torneioId, ...(ignorarEquipeId ? { id: { not: ignorarEquipeId } } : {}) },
    select: { nome: true },
  });
  return desambiguarNome(base, equipes.map((equipe) => equipe.nome));
}

async function renomearSeAutomatica(
  tx: Tx,
  equipe: { id: string; torneioId: string; nome: string },
  nomesAntes: string[],
  nomesDepois: string[],
) {
  if (!pareceNomeAutomatico(equipe.nome, nomesAntes)) return;
  const nome = await nomeLivre(tx, equipe.torneioId, nomeAutomatico(nomesDepois), equipe.id);
  if (nome !== equipe.nome) {
    await tx.equipe.update({ where: { id: equipe.id }, data: { nome } });
    equipe.nome = nome;
  }
}

async function resolverIntegrante(tx: Tx, torneioId: string, componente: IntegranteInformado) {
  if (componente.atletaId) {
    const atleta = await tx.atleta.findUnique({ where: { id: componente.atletaId } });
    if (!atleta) throw new ErroDeRegra("Atleta não encontrado.", 404);
    await afirmarAtletaLivre(tx, torneioId, atleta.id, atleta.nomeCompleto);
    return atleta.id;
  }
  if (componente.nome.trim().length < 3) throw new ErroDeRegra("Informe o nome completo de cada integrante.");
  if (componente.sexo !== "FEMININO" && componente.sexo !== "MASCULINO") {
    throw new ErroDeRegra("Informe o sexo de cada integrante.");
  }
  const email = componente.email.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErroDeRegra("Informe um e-mail válido ou deixe em branco.");
  }
  if (email) {
    const usuario = await tx.usuario.findUnique({ where: { email }, include: { atleta: true } });
    if (usuario?.papel === "ADMIN") throw new ErroDeRegra("Este e-mail pertence à organização.");
    if (usuario?.atleta) {
      await afirmarAtletaLivre(tx, torneioId, usuario.atleta.id, usuario.atleta.nomeCompleto);
      return usuario.atleta.id;
    }
    if (usuario) {
      const atleta = await tx.atleta.create({
        data: {
          usuarioId: usuario.id,
          nomeCompleto: componente.nome.trim(),
          sexo: componente.sexo,
          telefone: telefoneNovo(componente.telefone),
        },
      });
      return atleta.id;
    }
  } else {
    const iguais = await tx.atleta.findMany({
      where: { nomeCompleto: { equals: componente.nome.trim(), mode: "insensitive" } },
    });
    if (iguais.length > 1) {
      throw new ErroDeRegra(`Há mais de um atleta chamado ${componente.nome.trim()}. Informe o e-mail para distinguir.`);
    }
    if (iguais.length === 1) {
      const atleta = iguais[0]!;
      await afirmarAtletaLivre(tx, torneioId, atleta.id, atleta.nomeCompleto);
      return atleta.id;
    }
  }
  const criado = await tx.usuario.create({
    data: {
      email: email || null,
      senhaHash: await gerarHash(randomBytes(24).toString("hex")),
      papel: "ATLETA",
      nome: componente.nome.trim(),
      atleta: {
        create: {
          nomeCompleto: componente.nome.trim(),
          sexo: componente.sexo,
          telefone: telefoneNovo(componente.telefone),
        },
      },
    },
    include: { atleta: true },
  });
  return criado.atleta!.id;
}

function telefoneNovo(telefone: string) {
  const valor = telefone.trim();
  if (!valor) throw new ErroDeRegra("Informe o telefone de cada integrante novo.");
  if (valor.length > 20) throw new ErroDeRegra("O telefone pode ter no máximo 20 caracteres.");
  return valor;
}

async function afirmarAtletaLivre(tx: Tx, torneioId: string, atletaId: string, nome: string) {
  const inscricao = await tx.inscricao.findUnique({
    where: { torneioId_atletaId: { torneioId, atletaId } },
  });
  if (inscricao?.equipeId) throw new ErroDeRegra(`${nome} já está em outra equipe deste torneio.`);
  if (inscricao && inscricao.status !== "REJEITADA" && inscricao.status !== "CANCELADA" && inscricao.status !== "PENDENTE" && inscricao.status !== "APROVADA") {
    throw new ErroDeRegra("Inscrição inválida.");
  }
}

async function trancarEquipe<T>(equipeId: string, fn: (tx: Tx, equipe: { id: string; torneioId: string; capitaoId: string | null; status: string; nome: string; incompleta: boolean }) => Promise<T>) {
  const { prisma } = await import("@/server/db");
  const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } });
  if (!equipe) throw new ErroDeRegra("Equipe não encontrada.", 404);
  return trancar(equipe.torneioId, (tx) => fn(tx, equipe));
}
