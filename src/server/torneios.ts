import type { StatusTorneio } from "@prisma/client";
import { centavosDeReais, interpretarDataHoraLocal, slugificar } from "@/lib/formatacao";
import { ErroDeRegra } from "@/lib/erros";
import { erroZod, esquemaTorneio } from "@/lib/schemas";
import { exigirAdministrador } from "@/server/acesso";
import { distribuirTorneio, trancar } from "@/server/banco";
import { prisma } from "@/server/db";

const TRANSICOES: Record<string, { de: StatusTorneio[]; para: StatusTorneio }> = {
  encerrar: { de: ["INSCRICOES_ABERTAS"], para: "INSCRICOES_ENCERRADAS" },
  preparar: { de: ["INSCRICOES_ABERTAS", "INSCRICOES_ENCERRADAS"], para: "AGUARDANDO_SORTEIO" },
  reabrir: { de: ["INSCRICOES_ENCERRADAS", "AGUARDANDO_SORTEIO"], para: "INSCRICOES_ABERTAS" },
  pausar: { de: ["EM_ANDAMENTO"], para: "PAUSADO" },
  retomar: { de: ["PAUSADO"], para: "EM_ANDAMENTO" },
};

function numeroOpcional(valor: string): number | null {
  if (!valor.trim()) return null;
  return Number(valor);
}

async function slugLivre(nome: string, ignorarId?: string) {
  const base = slugificar(nome);
  for (let indice = 0; indice < 30; indice++) {
    const slug = indice === 0 ? base : `${base}-${indice + 1}`;
    const existente = await prisma.torneio.findUnique({ where: { slug } });
    if (!existente || existente.id === ignorarId) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function dadosDoFormulario(entrada: unknown) {
  const lido = esquemaTorneio.safeParse(entrada);
  if (!lido.success) throw new ErroDeRegra(erroZod(lido.error));
  const dados = lido.data;
  return {
    nome: dados.nome,
    descricao: dados.descricao,
    regulamento: dados.regulamento,
    inicioEm: interpretarDataHoraLocal(dados.inicioEm),
    local: dados.local,
    formato: dados.formato,
    formacao: dados.formacao,
    maxAtletas: numeroOpcional(dados.maxAtletas),
    inscricoesAte: interpretarDataHoraLocal(dados.inscricoesAte),
    valorCentavos: centavosDeReais(dados.valorReais),
    pontosParaVencer: dados.pontosParaVencer,
    diferencaMinima: dados.diferencaMinima,
    pontosMaximos: numeroOpcional(dados.pontosMaximos),
    quadrasSimultaneas: dados.quadrasSimultaneas,
    descansoMinutos: dados.descansoMinutos,
    permitirEquipeIncompleta: dados.permitirEquipeIncompleta,
    corDestaque: dados.corDestaque,
    nomeOrganizador: dados.nomeOrganizador,
  };
}

export async function criarTorneio(adminId: string, entrada: unknown) {
  await exigirAdministrador(adminId);
  const dados = dadosDoFormulario(entrada);
  const slug = await slugLivre(dados.nome);
  return prisma.torneio.create({
    data: {
      ...dados,
      slug,
      modalidade: "Vôlei de areia",
    },
  });
}

export async function atualizarTorneio(adminId: string, torneioId: string, entrada: unknown) {
  await exigirAdministrador(adminId);
  const dados = dadosDoFormulario(entrada);
  return trancar(torneioId, async (tx) => {
    const atual = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (atual.status === "FINALIZADO") throw new ErroDeRegra("Torneio finalizado não pode ser alterado.");
    const travado = Boolean(atual.equipesTravadasEm) || ["EM_ANDAMENTO", "PAUSADO"].includes(atual.status);
    if (travado && (dados.formato !== atual.formato || dados.formacao !== atual.formacao)) {
      throw new ErroDeRegra("Formato e formação ficam travados depois que as equipes são confirmadas.");
    }
    const jaTemPlacar = await tx.partida.count({ where: { torneioId, status: "CONCLUIDA" } });
    if (jaTemPlacar > 0) {
      dados.pontosParaVencer = atual.pontosParaVencer;
      dados.diferencaMinima = atual.diferencaMinima;
      dados.pontosMaximos = atual.pontosMaximos;
    }
    const slug = atual.nome === dados.nome ? atual.slug : await slugLivre(dados.nome, atual.id);
    const torneio = await tx.torneio.update({ where: { id: torneioId }, data: { ...dados, slug } });
    if (torneio.status === "EM_ANDAMENTO") await distribuirTorneio(tx, torneioId);
    return torneio;
  });
}

export async function alterarStatus(adminId: string, torneioId: string, acao: string) {
  await exigirAdministrador(adminId);
  return trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (acao === "finalizar") return finalizar(tx, torneio.id, torneio.status);

    const transicao = TRANSICOES[acao];
    if (!transicao || !transicao.de.includes(torneio.status)) {
      throw new ErroDeRegra("Esta mudança de status não é permitida agora.");
    }
    if (acao === "reabrir") {
      const partidas = await tx.partida.count({ where: { torneioId } });
      if (partidas > 0 || torneio.equipesTravadasEm) {
        throw new ErroDeRegra("Desfaça o sorteio confirmado antes de reabrir as inscrições.");
      }
    }
    const atualizado = await tx.torneio.update({
      where: { id: torneioId },
      data: { status: transicao.para },
    });
    if (acao === "retomar") await distribuirTorneio(tx, torneioId);
    return atualizado;
  });
}

async function finalizar(tx: Parameters<Parameters<typeof trancar>[1]>[0], torneioId: string, status: StatusTorneio) {
  if (status !== "EM_ANDAMENTO" && status !== "PAUSADO") {
    throw new ErroDeRegra("Só é possível encerrar um torneio que já começou.");
  }
  const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
  if (!torneio.campeaoEquipeId || !torneio.viceEquipeId) {
    throw new ErroDeRegra("O torneio só pode ser encerrado quando o campeão estiver definido.");
  }
  const pendentes = await tx.partida.count({
    where: {
      torneioId,
      OR: [
        { status: { in: ["PRONTA", "AGENDADA", "EM_ANDAMENTO", "PAUSADA"] } },
        { status: "AGUARDANDO", OR: [{ equipeAId: { not: null } }, { equipeBId: { not: null } }] },
      ],
    },
  });
  if (pendentes > 0) {
    throw new ErroDeRegra("Ainda há partidas obrigatórias pendentes. O torneio não pode ser encerrado.");
  }
  return tx.torneio.update({
    where: { id: torneioId },
    data: { status: "FINALIZADO", finalizadoEm: new Date() },
  });
}
