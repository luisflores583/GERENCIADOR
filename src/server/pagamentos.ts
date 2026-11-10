import { Prisma, type Pagamento, type TipoPagamento } from "@prisma/client";
import { cobraInscricao } from "@/lib/formatacao";
import { ErroDeRegra } from "@/lib/erros";
import type { IntegranteInformado } from "@/lib/integrantes";
import { trancar } from "@/server/banco";
import { prisma } from "@/server/db";
import { adicionarMembro, cadastrarEquipePorNomes, inscrever } from "@/server/inscricoes";
import {
  AVISO_PAGAMENTO_NAO_CONFIGURADO,
  CAMINHO_WEBHOOK,
  ambienteDoToken,
  checkoutCombinaComToken,
  clienteMercadoPago,
  efeitoDoStatus,
  pagamentoEstaConfigurado,
  pontoDeCheckout,
  tokenDeAcesso,
  type PagamentoRemoto,
} from "@/server/mercadopago";

export { AVISO_PAGAMENTO_NAO_CONFIGURADO, pagamentoEstaConfigurado, CAMINHO_WEBHOOK };

type RascunhoEquipe = { nome: string; componentes: IntegranteInformado[] };
type RascunhoVaga = { equipeId: string };

export async function iniciarPagamentoIndividual(usuarioId: string, torneioId: string, origem: string) {
  return abrirCheckout(usuarioId, torneioId, "INDIVIDUAL", {}, origem);
}

export async function iniciarPagamentoEquipe(
  usuarioId: string,
  torneioId: string,
  nome: string,
  componentes: IntegranteInformado[],
  origem: string,
) {
  return abrirCheckout(usuarioId, torneioId, "EQUIPE", { nome, componentes }, origem);
}

export async function iniciarPagamentoVaga(usuarioId: string, equipeId: string, origem: string) {
  const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } });
  if (!equipe) throw new ErroDeRegra("Equipe não encontrada.", 404);
  return abrirCheckout(usuarioId, equipe.torneioId, "VAGA", { equipeId }, origem);
}

export async function pagamentoDaInscricao(atletaId: string, torneioId: string) {
  return prisma.pagamento.findFirst({
    where: { atletaId, torneioId },
    orderBy: { criadoEm: "desc" },
  });
}

export async function aplicarNotificacaoDePagamento(idExterno: string) {
  const token = tokenDeAcesso();
  if (!token) throw new ErroDeRegra(AVISO_PAGAMENTO_NAO_CONFIGURADO, 503);
  const remoto = await clienteMercadoPago().buscarPagamento(token, idExterno);
  const referencia = remoto.external_reference?.trim() ?? "";
  if (!referencia) return { repetido: false, ignorado: true };
  const pagamento = await prisma.pagamento.findUnique({ where: { id: referencia } });
  if (!pagamento) return { repetido: false, ignorado: true };
  return aplicarRemoto(pagamento, remoto);
}

async function abrirCheckout(
  usuarioId: string,
  torneioId: string,
  tipo: TipoPagamento,
  rascunho: RascunhoEquipe | RascunhoVaga | Record<string, never>,
  origem: string,
) {
  if (!pagamentoEstaConfigurado()) throw new ErroDeRegra(AVISO_PAGAMENTO_NAO_CONFIGURADO);
  const token = tokenDeAcesso();
  const atleta = await prisma.atleta.findUnique({ where: { usuarioId } });
  if (!atleta) throw new ErroDeRegra("Complete o perfil de atleta para se inscrever.", 403);

  const reservado = await trancar(torneioId, async (tx) => {
    const torneio = await tx.torneio.findUniqueOrThrow({ where: { id: torneioId } });
    if (!cobraInscricao(torneio.valorCentavos)) throw new ErroDeRegra("Esta inscrição não cobra pagamento.");
    const inscricao = await tx.inscricao.findUnique({
      where: { torneioId_atletaId: { torneioId, atletaId: atleta.id } },
    });
    const jaNaLista = Boolean(inscricao && inscricao.status !== "REJEITADA" && inscricao.status !== "CANCELADA");
    const aprovado = await tx.pagamento.findFirst({
      where: { torneioId, atletaId: atleta.id, status: "APROVADO" },
    });
    if (aprovado) throw new ErroDeRegra("Este pagamento já foi aprovado.");
    const tentativa = await tx.pagamento.findFirst({
      where: { torneioId, atletaId: atleta.id, status: { in: ["AGUARDANDO", "RECUSADO", "CANCELADO"] } },
    });
    if (jaNaLista && inscricao?.status === "APROVADA" && !tentativa) {
      throw new ErroDeRegra("Esta inscrição já foi lançada pela organização.");
    }
    if (!jaNaLista) {
      if (torneio.status !== "INSCRICOES_ABERTAS") {
        throw new ErroDeRegra("As inscrições deste torneio não estão abertas.");
      }
      if (torneio.inscricoesAte.getTime() < Date.now()) throw new ErroDeRegra("O prazo de inscrição terminou.");
    }
    const aberto = await tx.pagamento.findFirst({
      where: { torneioId, atletaId: atleta.id, status: "AGUARDANDO" },
      orderBy: { criadoEm: "desc" },
    });
    if (aberto?.initPoint && checkoutCombinaComToken(aberto.initPoint, token, aberto.ambiente)) {
      return { pagamento: aberto, nome: torneio.nome, valorCentavos: torneio.valorCentavos ?? 0 };
    }
    if (aberto?.initPoint) {
      await tx.pagamento.update({
        where: { id: aberto.id },
        data: { initPoint: "", preferenciaId: null, ambiente: "" },
      });
    }
    if (!jaNaLista && torneio.maxAtletas != null) {
      const ocupadas = await tx.inscricao.count({
        where: { torneioId, status: { in: ["PENDENTE", "APROVADA"] } },
      });
      const reservas = await tx.pagamento.count({
        where: { torneioId, status: "AGUARDANDO", ...(aberto ? { id: { not: aberto.id } } : {}) },
      });
      if (ocupadas + reservas >= torneio.maxAtletas) {
        throw new ErroDeRegra("O limite de atletas deste torneio foi atingido.");
      }
    }
    const pagamento = aberto
      ? await tx.pagamento.update({
          where: { id: aberto.id },
          data: { tipo, rascunho: rascunho as Prisma.InputJsonValue, valorCentavos: torneio.valorCentavos ?? 0 },
        })
      : await tx.pagamento.create({
          data: {
            torneioId,
            atletaId: atleta.id,
            valorCentavos: torneio.valorCentavos ?? 0,
            tipo,
            rascunho: rascunho as Prisma.InputJsonValue,
          },
        });
    return { pagamento, nome: torneio.nome, valorCentavos: torneio.valorCentavos ?? 0 };
  });

  if (reservado.pagamento.initPoint && checkoutCombinaComToken(reservado.pagamento.initPoint, token, reservado.pagamento.ambiente)) {
    return reservado.pagamento;
  }

  const base = origem.replace(/\/$/, "");
  const volta = `${base}/atleta/torneios/${torneioId}`;
  const preferencia = await clienteMercadoPago().criarPreferencia(token, {
    items: [
      {
        id: reservado.pagamento.id,
        title: `Inscrição ${reservado.nome}`.slice(0, 120),
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number((reservado.valorCentavos / 100).toFixed(2)),
      },
    ],
    external_reference: reservado.pagamento.id,
    notification_url: `${base}${CAMINHO_WEBHOOK}`,
    back_urls: {
      success: `${volta}?retorno=aprovado`,
      failure: `${volta}?retorno=recusado`,
      pending: `${volta}?retorno=pendente`,
    },
    metadata: { pagamento_id: reservado.pagamento.id },
  });
  const initPoint = pontoDeCheckout(preferencia, token);
  return prisma.pagamento.update({
    where: { id: reservado.pagamento.id },
    data: { preferenciaId: preferencia.id, initPoint, ambiente: ambienteDoToken(token) },
  });
}

async function aplicarRemoto(pagamento: Pagamento, remoto: PagamentoRemoto) {
  const efeito = efeitoDoStatus(pagamento.status, remoto.status);
  if (efeito === "repetir" || efeito === "aguardar") return { repetido: efeito === "repetir", ignorado: false };
  if (efeito === "recusar" || efeito === "cancelar") {
    await prisma.pagamento.updateMany({
      where: { id: pagamento.id, status: { not: "APROVADO" } },
      data: {
        status: efeito === "recusar" ? "RECUSADO" : "CANCELADO",
        pagamentoExternoId: remoto.id,
      },
    });
    return { repetido: false, ignorado: false };
  }

  const atleta = await prisma.atleta.findUniqueOrThrow({ where: { id: pagamento.atletaId } });
  try {
    await materializar(pagamento, atleta.usuarioId);
  } catch (erro) {
    if (!(erro instanceof ErroDeRegra) || !(await inscricaoJaEntrou(pagamento.atletaId, pagamento.torneioId))) throw erro;
  }
  const inscricao = await prisma.inscricao.findUnique({
    where: { torneioId_atletaId: { torneioId: pagamento.torneioId, atletaId: pagamento.atletaId } },
  });
  try {
    await prisma.pagamento.updateMany({
      where: { id: pagamento.id, status: { not: "APROVADO" } },
      data: {
        status: "APROVADO",
        pagamentoExternoId: remoto.id,
        aprovadoEm: new Date(),
        inscricaoId: inscricao?.id ?? null,
      },
    });
  } catch (erro) {
    const gravado = await prisma.pagamento.findUnique({ where: { id: pagamento.id } });
    if (gravado?.status === "APROVADO") return { repetido: true, ignorado: false };
    throw erro;
  }
  return { repetido: false, ignorado: false };
}

async function materializar(pagamento: Pagamento, usuarioId: string) {
  if (pagamento.tipo === "INDIVIDUAL") {
    await inscrever(usuarioId, pagamento.torneioId, true);
    return;
  }
  if (pagamento.tipo === "VAGA") {
    const rascunho = pagamento.rascunho as RascunhoVaga;
    await adicionarMembro(usuarioId, rascunho.equipeId, pagamento.atletaId, true);
    return;
  }
  const rascunho = pagamento.rascunho as RascunhoEquipe;
  await cadastrarEquipePorNomes(usuarioId, pagamento.torneioId, rascunho.nome, rascunho.componentes, false, true);
}

async function inscricaoJaEntrou(atletaId: string, torneioId: string) {
  const inscricao = await prisma.inscricao.findUnique({
    where: { torneioId_atletaId: { torneioId, atletaId } },
  });
  return Boolean(inscricao && inscricao.status !== "REJEITADA" && inscricao.status !== "CANCELADA");
}
