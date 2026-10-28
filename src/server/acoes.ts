"use server";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { publicar } from "@/engine/tempo-real";
import { ErroDeRegra } from "@/lib/erros";
import { ehCadastroDuplicado } from "@/lib/restricao-unica";
import { interpretarDataHoraLocal } from "@/lib/formatacao";
import { integrantesDoFormulario } from "@/lib/integrantes";
import { erroZod, esquemaCadastro, esquemaEdicaoInscricao, esquemaInscricaoDireta, esquemaLogin, esquemaPerfil } from "@/lib/schemas";
import { conferirSenha, gerarHash } from "@/server/senha";
import { criarSessao, encerrarSessao, exigirAdmin, exigirAtleta } from "@/server/sessao";
import { prisma } from "@/server/db";
import { alterarStatus, atualizarTorneio, criarTorneio, encerrarInscricao, excluirTorneio, reiniciarTorneio } from "@/server/torneios";
import {
  adicionarMembro,
  aprovarEquipe,
  aprovarInscricao,
  aprovarTodas,
  cadastrarEquipePorNomes,
  cadastrarEquipeSomenteComNome,
  criarEquipe,
  editarDadosDaInscricao,
  excluirInscricaoDoTorneio,
  inscrever,
  inscreverAtletaDireto,
  rejeitarEquipe,
  rejeitarInscricao,
  removerMembro,
} from "@/server/inscricoes";
import {
  confirmarResultado,
  confirmarSorteioConfrontos,
  confirmarSorteioEquipes,
  corrigirResultado,
  desfazerSorteioEquipes,
  devolverPartida,
  distribuirAgora,
  gerarSorteioConfrontos,
  gerarSorteioEquipes,
  indisponibilizarQuadra,
  iniciarPartida,
  iniciarTorneio,
  pausarPartida,
  retomarPartida,
  salvarQuadra,
  trocarQuadra,
  vincularQuadra,
} from "@/server/competicao";
import type { EstadoAcao } from "@/tipos";

function ehRedirect(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    "digest" in erro &&
    String((erro as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function falha(erro: unknown): EstadoAcao {
  if (ehRedirect(erro)) throw erro;
  if (erro instanceof ErroDeRegra) return { ok: false, erro: erro.message };
  if (erro instanceof ZodError) return { ok: false, erro: erroZod(erro) };
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    if (ehCadastroDuplicado(erro.meta)) return { ok: false, erro: "Já existe um cadastro com estes dados." };
    console.error(erro);
    return { ok: false, erro: "Não foi possível concluir a operação." };
  }
  console.error(erro);
  return { ok: false, erro: "Não foi possível concluir a operação." };
}

function texto(form: FormData, campo: string): string {
  return String(form.get(campo) ?? "");
}

function marcar(form: FormData, campo: string): boolean {
  return form.get(campo) === "on" || form.get(campo) === "true";
}

function revalidarPainel() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/atleta", "layout");
}

function atualizarTelas(torneio: { id?: string; torneioId?: string; slug: string }, tipo: string) {
  const id = torneio.id ?? torneio.torneioId;
  if (!id) return;
  revalidarPainel();
  publicar(id, tipo);
  revalidatePath("/");
  revalidatePath(`/admin/torneios/${id}`);
  for (const sufixo of ["/inscricoes", "/sorteio", "/jogos", "/quadras", "/encerramento"]) {
    revalidatePath(`/admin/torneios/${id}${sufixo}`);
  }
  revalidatePath(`/ao-vivo/${torneio.slug}`);
  revalidatePath(`/torneios/${torneio.slug}`);
  revalidatePath("/atleta");
  revalidatePath(`/atleta/torneios/${id}`);
}

function dadosTorneio(form: FormData) {
  return {
    nome: texto(form, "nome"),
    descricao: texto(form, "descricao"),
    regulamento: texto(form, "regulamento"),
    inicioEm: texto(form, "inicioEm"),
    local: texto(form, "local"),
    formato: texto(form, "formato"),
    formacao: texto(form, "formacao"),
    naipe: texto(form, "naipe") || "MISTO",
    modeloChave: texto(form, "modeloChave") || "GENERICA",
    maxAtletas: texto(form, "maxAtletas"),
    inscricoesAte: texto(form, "inscricoesAte"),
    valorReais: texto(form, "valorReais"),
    pontosParaVencer: texto(form, "pontosParaVencer"),
    diferencaMinima: texto(form, "diferencaMinima"),
    pontosMaximos: texto(form, "pontosMaximos"),
    quadrasSimultaneas: texto(form, "quadrasSimultaneas"),
    descansoMinutos: texto(form, "descansoMinutos"),
    permitirEquipeIncompleta: marcar(form, "permitirEquipeIncompleta"),
    corDestaque: texto(form, "corDestaque") || "#e36a3a",
    nomeOrganizador: texto(form, "nomeOrganizador"),
  };
}

export async function acaoEntrar(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const dados = esquemaLogin.parse({ email: texto(form, "email"), senha: texto(form, "senha") });
    const usuario = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (!usuario || !(await conferirSenha(dados.senha, usuario.senhaHash))) {
      return { ok: false, erro: "E-mail ou senha inválidos." };
    }
    await criarSessao(usuario.id);
    redirect(usuario.papel === "ADMIN" ? "/admin" : "/atleta");
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoSair(): Promise<void> {
  await encerrarSessao();
  redirect("/");
}

export async function acaoCadastrar(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const dados = esquemaCadastro.parse({
      nome: texto(form, "nome"),
      apelido: texto(form, "apelido"),
      telefone: texto(form, "telefone"),
      sexo: texto(form, "sexo"),
      email: texto(form, "email"),
      senha: texto(form, "senha"),
    });
    const existe = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (existe) return { ok: false, erro: "Este e-mail já está cadastrado." };
    const usuario = await prisma.usuario.create({
      data: {
        email: dados.email,
        senhaHash: await gerarHash(dados.senha),
        papel: "ATLETA",
        nome: dados.nome,
        atleta: {
          create: {
            nomeCompleto: dados.nome,
            sexo: dados.sexo,
            apelido: dados.apelido || null,
            telefone: dados.telefone || null,
          },
        },
      },
    });
    await criarSessao(usuario.id);
    redirect("/atleta");
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoPerfil(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const { atleta, usuario } = await exigirAtleta();
    const dados = esquemaPerfil.parse({
      nome: texto(form, "nome"),
      apelido: texto(form, "apelido"),
      telefone: texto(form, "telefone"),
      sexo: texto(form, "sexo"),
    });
    await prisma.atleta.update({
      where: { id: atleta.id },
      data: { nomeCompleto: dados.nome, sexo: dados.sexo, apelido: dados.apelido || null, telefone: dados.telefone || null },
    });
    await prisma.usuario.update({ where: { id: usuario.id }, data: { nome: dados.nome } });
    revalidatePath("/atleta/perfil");
    return { ok: true, mensagem: "Perfil atualizado." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoFoto(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const { atleta } = await exigirAtleta();
    const arquivo = form.get("foto");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha uma imagem." };
    if (arquivo.size > 2_000_000) return { ok: false, erro: "A foto pode ter no máximo 2 MB." };
    const tipos: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extensao = tipos[arquivo.type];
    if (!extensao) return { ok: false, erro: "Envie uma imagem JPG, PNG ou WebP." };
    const nome = `${atleta.id}-${Date.now()}.${extensao}`;
    const pasta = path.join(process.cwd(), "public", "uploads");
    await mkdir(pasta, { recursive: true });
    await writeFile(path.join(pasta, nome), Buffer.from(await arquivo.arrayBuffer()));
    await prisma.atleta.update({ where: { id: atleta.id }, data: { fotoUrl: `/uploads/${nome}` } });
    revalidatePath("/atleta/perfil");
    return { ok: true, mensagem: "Foto atualizada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoCriarTorneio(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const torneio = await criarTorneio(admin.id, dadosTorneio(form));
    redirect(`/admin/torneios/${torneio.id}`);
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoAtualizarTorneio(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const torneio = await atualizarTorneio(admin.id, texto(form, "torneioId"), dadosTorneio(form));
    atualizarTelas(torneio, "torneio");
    return { ok: true, mensagem: "Torneio atualizado." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoStatus(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    if (texto(form, "acao") === "finalizar" && !marcar(form, "confirmo")) {
      return { ok: false, erro: "Confirme o encerramento do torneio." };
    }
    const torneio = await alterarStatus(admin.id, texto(form, "torneioId"), texto(form, "acao"));
    atualizarTelas(torneio, "status");
    return { ok: true, mensagem: "Status atualizado." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoExcluirTorneio(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    if (!marcar(form, "confirmo")) {
      return { ok: false, erro: "Confirme a exclusão. Ela não pode ser desfeita." };
    }
    const torneio = await excluirTorneio(admin.id, texto(form, "torneioId"));
    revalidarPainel();
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath(`/ao-vivo/${torneio.slug}`);
    revalidatePath(`/torneios/${torneio.slug}`);
    revalidatePath("/atleta");
    publicar(torneio.id, "exclusao");
    redirect("/admin");
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoReiniciarTorneio(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    if (!marcar(form, "confirmo")) {
      return { ok: false, erro: "Confirme o reinício. Os jogos saem, a configuração pode ser alterada e os atletas inscritos permanecem." };
    }
    const torneio = await reiniciarTorneio(admin.id, texto(form, "torneioId"));
    atualizarTelas(torneio, "reinicio");
    return { ok: true, mensagem: "Torneio reiniciado. Os jogos saíram. A configuração pode ser alterada. Os atletas inscritos permanecem." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoEncerrarInscricao(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    if (!marcar(form, "confirmo")) {
      return { ok: false, erro: "Confirme o encerramento. A lista atual permanece e ninguém novo entra." };
    }
    const torneio = await encerrarInscricao(admin.id, texto(form, "torneioId"));
    atualizarTelas(torneio, "inscricoes");
    return { ok: true, mensagem: "Inscrições encerradas. A lista atual permanece. Ninguém novo entra." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoIniciarTorneio(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const resultado = await iniciarTorneio(admin.id, texto(form, "torneioId"));
    atualizarTelas(resultado, "inicio");
    return { ok: true, mensagem: resultado.idempotente ? "O torneio já estava em andamento." : "Torneio iniciado. Já dá para registrar a vitória." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoInscreverDireto(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const torneioId = texto(form, "torneioId");
    const aberto = await prisma.torneio.findUnique({ where: { id: torneioId }, select: { status: true } });
    if (aberto?.status === "INSCRICOES_ENCERRADAS") {
      return { ok: false, erro: "As inscrições estão encerradas. A lista atual permanece. Ninguém novo entra." };
    }
    let atletaId = texto(form, "atletaId");
    if (!atletaId) {
      const dados = esquemaInscricaoDireta.parse({
        nome: texto(form, "nome"),
        apelido: texto(form, "apelido"),
        telefone: texto(form, "telefone"),
        sexo: texto(form, "sexo"),
        email: texto(form, "email"),
        senha: texto(form, "senha"),
      });
      const email = dados.email.trim().toLowerCase();
      if (email) {
        const existente = await prisma.usuario.findUnique({ where: { email }, include: { atleta: true } });
        if (existente?.papel === "ADMIN") return { ok: false, erro: "Este e-mail pertence à organização." };
        if (existente?.atleta) {
          atletaId = existente.atleta.id;
        } else if (existente) {
          const atleta = await prisma.atleta.create({
            data: {
              usuarioId: existente.id,
              nomeCompleto: dados.nome,
              sexo: dados.sexo,
              apelido: dados.apelido || null,
              telefone: dados.telefone || null,
            },
          });
          atletaId = atleta.id;
        } else {
          const usuario = await prisma.usuario.create({
            data: {
              email,
              senhaHash: await gerarHash(dados.senha),
              papel: "ATLETA",
              nome: dados.nome,
              atleta: {
                create: {
                  nomeCompleto: dados.nome,
                  sexo: dados.sexo,
                  apelido: dados.apelido || null,
                  telefone: dados.telefone || null,
                },
              },
            },
            include: { atleta: true },
          });
          atletaId = usuario.atleta!.id;
        }
      } else {
        const usuario = await prisma.usuario.create({
          data: {
            email: null,
            senhaHash: await gerarHash(randomBytes(24).toString("hex")),
            papel: "ATLETA",
            nome: dados.nome,
            atleta: {
              create: {
                nomeCompleto: dados.nome,
                sexo: dados.sexo,
                apelido: dados.apelido || null,
                telefone: dados.telefone || null,
              },
            },
          },
          include: { atleta: true },
        });
        atletaId = usuario.atleta!.id;
      }
    }
    const resultado = await inscreverAtletaDireto(admin.id, torneioId, atletaId);
    atualizarTelas(resultado, "inscricao");
    return { ok: true, mensagem: `A inscrição de ${resultado.nome} foi gravada neste torneio.` };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoInscrever(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const { usuario } = await exigirAtleta();
    await inscrever(usuario.id, texto(form, "torneioId"));
    revalidatePath("/atleta");
    return { ok: true, mensagem: "Inscrição enviada. Aguarde a aprovação da organização." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoCadastrarEquipePorNome(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const equipe = await cadastrarEquipeSomenteComNome(admin.id, texto(form, "torneioId"), texto(form, "nome"));
    revalidarPainel();
    return { ok: true, mensagem: `Equipe ${equipe.nome} gravada. Ela já pode ir ao sorteio e à tabela.` };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoCadastrarEquipe(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const usuario = await exigirAdminOuAtleta();
    const componentes = integrantesDoFormulario((campo) => texto(form, campo), 4);
    const equipe = await cadastrarEquipePorNomes(
      usuario.id,
      texto(form, "torneioId"),
      texto(form, "nome"),
      componentes,
      marcar(form, "autorizarIncompleta"),
    );
    revalidarPainel();
    revalidatePath("/atleta");
    return { ok: true, mensagem: `Equipe ${equipe.nome} gravada. Ela entra no sorteio depois da aprovação.` };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoCriarEquipe(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const usuario = await prisma.usuario.findFirst({ where: { id: (await exigirAdminOuAtleta()).id } });
    if (!usuario) return { ok: false, erro: "Sessão inválida." };
    const ids = form.getAll("atletaId").map(String);
    const equipe = await criarEquipe(usuario.id, texto(form, "torneioId"), texto(form, "nome"), ids);
    revalidarPainel();
    revalidatePath("/atleta");
    return { ok: true, mensagem: `Equipe ${equipe.nome} criada. Ela entra no sorteio depois da aprovação.` };
  } catch (erro) {
    return falha(erro);
  }
}

async function exigirAdminOuAtleta() {
  const { obterUsuario } = await import("@/server/sessao");
  const usuario = await obterUsuario();
  if (!usuario) redirect("/entrar");
  return usuario;
}

export async function acaoAdicionarMembro(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const usuario = await exigirAdminOuAtleta();
    await adicionarMembro(usuario.id, texto(form, "equipeId"), texto(form, "atletaId"));
    revalidarPainel();
    revalidatePath("/atleta");
    return { ok: true, mensagem: "Atleta incluído na equipe." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoRemoverMembro(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const usuario = await exigirAdminOuAtleta();
    await removerMembro(usuario.id, texto(form, "equipeId"), texto(form, "atletaId"));
    revalidarPainel();
    revalidatePath("/atleta");
    return { ok: true, mensagem: "Atleta removido da equipe." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoEditarInscricao(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const dados = esquemaEdicaoInscricao.parse({
      nome: texto(form, "nome"),
      apelido: texto(form, "apelido"),
      telefone: texto(form, "telefone"),
      sexo: texto(form, "sexo"),
      email: texto(form, "email"),
    });
    const resultado = await editarDadosDaInscricao(admin.id, texto(form, "inscricaoId"), dados);
    atualizarTelas(resultado, "inscricao");
    return { ok: true, mensagem: `Os dados de ${resultado.nome} foram atualizados.` };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoExcluirInscricao(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    if (!marcar(form, "confirmo")) {
      return { ok: false, erro: "Confirme a exclusão. Ela não pode ser desfeita." };
    }
    const resultado = await excluirInscricaoDoTorneio(admin.id, texto(form, "inscricaoId"));
    atualizarTelas(resultado, "inscricao");
    return { ok: true, mensagem: `${resultado.nome} saiu deste torneio. O cadastro da pessoa permanece.` };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoAprovarInscricao(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await aprovarInscricao(admin.id, texto(form, "inscricaoId"));
    revalidarPainel();
    return { ok: true, mensagem: "Inscrição aprovada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoRejeitarInscricao(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await rejeitarInscricao(admin.id, texto(form, "inscricaoId"));
    revalidarPainel();
    return { ok: true, mensagem: "Inscrição rejeitada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoAprovarEquipe(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await aprovarEquipe(admin.id, texto(form, "equipeId"));
    revalidarPainel();
    return { ok: true, mensagem: "Equipe aprovada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoRejeitarEquipe(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    if (!marcar(form, "confirmo")) return { ok: false, erro: "Confirme a rejeição da equipe." };
    await rejeitarEquipe(admin.id, texto(form, "equipeId"));
    revalidarPainel();
    return { ok: true, mensagem: "Equipe rejeitada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoAprovarTodas(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const resultado = await aprovarTodas(admin.id, texto(form, "torneioId"));
    revalidarPainel();
    return { ok: true, mensagem: `${resultado.quantidade} inscrição(ões) aprovada(s).` };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoGerarEquipes(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await gerarSorteioEquipes(admin.id, texto(form, "torneioId"), marcar(form, "autorizarIncompleta"));
    revalidarPainel();
    return { ok: true, mensagem: "Sorteio das equipes gerado. Confira e confirme." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoConfirmarEquipes(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    if (!marcar(form, "confirmo")) return { ok: false, erro: "Confirme o sorteio exibido para travar as equipes." };
    const resultado = await confirmarSorteioEquipes(admin.id, texto(form, "sorteioId"));
    if ("slug" in resultado && resultado.slug) atualizarTelas({ id: resultado.torneioId, slug: resultado.slug }, "sorteio");
    else revalidarPainel();
    return { ok: true, mensagem: resultado.idempotente ? "Este sorteio já estava confirmado." : "Equipes confirmadas." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoDesfazerEquipes(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    if (!marcar(form, "confirmo")) return { ok: false, erro: "Confirme para desfazer o sorteio das equipes." };
    await desfazerSorteioEquipes(admin.id, texto(form, "torneioId"));
    revalidarPainel();
    return { ok: true, mensagem: "Sorteio de equipes desfeito." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoGerarConfrontos(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const modo = texto(form, "modo") === "RANKING" ? "RANKING" : "ALEATORIO";
    const ordemLista = form.getAll("equipeId").map((valor) => String(valor));
    const posicoes: Record<string, number | null> = {};
    for (const id of ordemLista) {
      const bruto = texto(form, `posicao-${id}`).trim();
      if (!bruto) {
        posicoes[id] = null;
        continue;
      }
      if (!/^\d+$/.test(bruto)) {
        return { ok: false, erro: "A posição do ranking precisa ser um número inteiro." };
      }
      posicoes[id] = Number(bruto);
    }
    await gerarSorteioConfrontos(admin.id, texto(form, "torneioId"), undefined, {
      modo,
      ordemLista,
      posicoes,
    });
    revalidarPainel();
    return {
      ok: true,
      mensagem: modo === "RANKING" ? "Ranking montado. Confirme para iniciar." : "Prévia da primeira rodada pronta. Confirme para iniciar.",
    };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoConfirmarConfrontos(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    if (!marcar(form, "confirmo")) return { ok: false, erro: "Confirme o sorteio dos confrontos." };
    const resultado = await confirmarSorteioConfrontos(admin.id, texto(form, "sorteioId"));
    if ("slug" in resultado && resultado.slug) atualizarTelas({ id: resultado.torneioId, slug: resultado.slug }, "chave");
    return { ok: true, mensagem: resultado.idempotente ? "A chave já estava confirmada." : "Chave gerada e quadras distribuídas." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoConfirmarPlacar(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const vencedorEquipeId = texto(form, "vencedorEquipeId");
    if (!vencedorEquipeId) return { ok: false, erro: "Escolha quem venceu." };
    const resultado = await confirmarResultado(admin.id, texto(form, "partidaId"), vencedorEquipeId);
    atualizarTelas(resultado, "resultado");
    return { ok: true, mensagem: resultado.idempotente ? "Essa vitória já estava confirmada." : "Vitória confirmada. A chave foi atualizada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoCorrigirPlacar(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const vencedorEquipeId = texto(form, "vencedorEquipeId");
    if (!vencedorEquipeId) return { ok: false, erro: "Escolha o novo vencedor." };
    const resultado = await corrigirResultado(
      admin.id,
      texto(form, "partidaId"),
      vencedorEquipeId,
      texto(form, "motivo"),
      marcar(form, "confirmarDependencias"),
    );
    if (resultado.precisaConfirmacao) {
      return {
        ok: false,
        precisaConfirmacao: true,
        afetadas: resultado.afetadas,
        erro: "A correção muda partidas já confirmadas. Marque a confirmação para recalcular a chave.",
      };
    }
    atualizarTelas(resultado, "correcao");
    return { ok: true, mensagem: resultado.idempotente ? "O vencedor já era esse." : "Vencedor corrigido e dependências recalculadas." };
  } catch (erro) {
    return falha(erro);
  }
}

async function acaoSimples(fn: () => Promise<{ torneioId: string; slug: string }>, mensagem: string, tipo: string): Promise<EstadoAcao> {
  try {
    const resultado = await fn();
    atualizarTelas(resultado, tipo);
    return { ok: true, mensagem };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoIniciar(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  return acaoSimples(() => iniciarPartida(admin.id, texto(form, "partidaId")), "Partida iniciada.", "partida");
}

export async function acaoPausarPartida(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  return acaoSimples(() => pausarPartida(admin.id, texto(form, "partidaId")), "Partida pausada.", "partida");
}

export async function acaoRetomarPartida(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  return acaoSimples(() => retomarPartida(admin.id, texto(form, "partidaId")), "Partida retomada.", "partida");
}

export async function acaoDevolver(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  return acaoSimples(() => devolverPartida(admin.id, texto(form, "partidaId")), "Partida devolvida à fila.", "quadra");
}

export async function acaoTrocarQuadra(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  return acaoSimples(
    () => trocarQuadra(admin.id, texto(form, "partidaId"), texto(form, "quadraId")),
    "Quadra alterada.",
    "quadra",
  );
}

export async function acaoDistribuir(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  return acaoSimples(() => distribuirAgora(admin.id, texto(form, "torneioId")), "Quadras redistribuídas.", "quadra");
}

export async function acaoCriarQuadra(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await salvarQuadra(admin.id, texto(form, "nome"));
    revalidatePath("/admin/quadras");
    return { ok: true, mensagem: "Quadra cadastrada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoVincularQuadra(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  return acaoSimples(
    () => vincularQuadra(admin.id, texto(form, "torneioId"), texto(form, "quadraId"), marcar(form, "habilitada")),
    "Quadra atualizada neste torneio.",
    "quadra",
  );
}

export async function acaoIndisponivel(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  const bruto = texto(form, "ate");
  return acaoSimples(
    () =>
      indisponibilizarQuadra(
        admin.id,
        texto(form, "torneioId"),
        texto(form, "quadraId"),
        bruto ? interpretarDataHoraLocal(bruto) : null,
      ),
    "Disponibilidade da quadra atualizada.",
    "quadra",
  );
}
