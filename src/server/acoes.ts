"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { publicar } from "@/engine/tempo-real";
import { ErroDeRegra } from "@/lib/erros";
import { interpretarDataHoraLocal } from "@/lib/formatacao";
import { erroZod, esquemaCadastro, esquemaLogin, esquemaPerfil } from "@/lib/schemas";
import { conferirSenha, gerarHash } from "@/server/senha";
import { criarSessao, encerrarSessao, exigirAdmin, exigirAtleta } from "@/server/sessao";
import { prisma } from "@/server/db";
import { alterarStatus, atualizarTorneio, criarTorneio } from "@/server/torneios";
import {
  adicionarMembro,
  aprovarEquipe,
  aprovarInscricao,
  aprovarTodas,
  criarEquipe,
  inscrever,
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
    return { ok: false, erro: "Já existe um cadastro com estes dados." };
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

function atualizarTelas(torneio: { id?: string; torneioId?: string; slug: string }, tipo: string) {
  const id = torneio.id ?? torneio.torneioId;
  if (!id) return;
  publicar(id, tipo);
  revalidatePath("/");
  revalidatePath("/admin");
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
    });
    await prisma.atleta.update({
      where: { id: atleta.id },
      data: { nomeCompleto: dados.nome, apelido: dados.apelido || null, telefone: dados.telefone || null },
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

export async function acaoCriarEquipe(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const usuario = await prisma.usuario.findFirst({ where: { id: (await exigirAdminOuAtleta()).id } });
    if (!usuario) return { ok: false, erro: "Sessão inválida." };
    const ids = form.getAll("atletaId").map(String);
    const equipe = await criarEquipe(usuario.id, texto(form, "torneioId"), texto(form, "nome"), ids);
    revalidatePath("/admin");
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
    revalidatePath("/admin");
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
    revalidatePath("/admin");
    revalidatePath("/atleta");
    return { ok: true, mensagem: "Atleta removido da equipe." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoAprovarInscricao(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await aprovarInscricao(admin.id, texto(form, "inscricaoId"));
    revalidatePath("/admin");
    return { ok: true, mensagem: "Inscrição aprovada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoRejeitarInscricao(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await rejeitarInscricao(admin.id, texto(form, "inscricaoId"));
    revalidatePath("/admin");
    return { ok: true, mensagem: "Inscrição rejeitada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoAprovarEquipe(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await aprovarEquipe(admin.id, texto(form, "equipeId"));
    revalidatePath("/admin");
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
    revalidatePath("/admin");
    return { ok: true, mensagem: "Equipe rejeitada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoAprovarTodas(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const resultado = await aprovarTodas(admin.id, texto(form, "torneioId"));
    revalidatePath("/admin");
    return { ok: true, mensagem: `${resultado.quantidade} inscrição(ões) aprovada(s).` };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoGerarEquipes(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await gerarSorteioEquipes(admin.id, texto(form, "torneioId"), marcar(form, "autorizarIncompleta"));
    revalidatePath("/admin");
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
    else revalidatePath("/admin");
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
    revalidatePath("/admin");
    return { ok: true, mensagem: "Sorteio de equipes desfeito." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoGerarConfrontos(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    await gerarSorteioConfrontos(admin.id, texto(form, "torneioId"));
    revalidatePath("/admin");
    return { ok: true, mensagem: "Prévia da primeira rodada pronta. Confirme para iniciar." };
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
    const resultado = await confirmarResultado(
      admin.id,
      texto(form, "partidaId"),
      Number(texto(form, "placarA")),
      Number(texto(form, "placarB")),
    );
    atualizarTelas(resultado, "resultado");
    return { ok: true, mensagem: resultado.idempotente ? "Esse placar já estava confirmado." : "Resultado confirmado. A chave foi atualizada." };
  } catch (erro) {
    return falha(erro);
  }
}

export async function acaoCorrigirPlacar(_estado: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  try {
    const admin = await exigirAdmin();
    const resultado = await corrigirResultado(
      admin.id,
      texto(form, "partidaId"),
      Number(texto(form, "placarA")),
      Number(texto(form, "placarB")),
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
    return { ok: true, mensagem: resultado.idempotente ? "O placar já estava assim." : "Placar corrigido e dependências recalculadas." };
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
