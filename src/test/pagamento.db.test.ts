import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AVISO_PAGAMENTO_NAO_CONFIGURADO } from "@/server/mercadopago";

function carregarEnv() {
  const arquivo = resolve(process.cwd(), ".env");
  if (!existsSync(arquivo)) return;
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual < 1) continue;
    const chave = limpa.slice(0, igual).trim();
    if (!process.env[chave]) process.env[chave] = limpa.slice(igual + 1).trim();
  }
}

carregarEnv();

const rodar = process.env.RODAR_INTEGRACAO === "1";

describe.skipIf(!rodar)("pagamento simulado do Mercado Pago", () => {
  const prefixo = `pag${Date.now().toString(36)}`;
  const criados = { usuarios: [] as string[], torneios: [] as string[] };
  const remotos = new Map<string, { status: string; external_reference: string }>();
  let prisma: Awaited<typeof import("@/server/db")>["prisma"];
  const tokenAnterior = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");
    ({ prisma } = await import("@/server/db"));
    const { usarClienteMercadoPago } = await import("@/server/mercadopago");
    usarClienteMercadoPago({
      async criarPreferencia(_token, corpo) {
        const referencia = String(corpo.external_reference);
        const id = `pay-${referencia}`;
        remotos.set(id, { status: "pending", external_reference: referencia });
        return {
          id: `pref-${referencia}`,
          init_point: `https://www.mercadopago.com.br/checkout/${referencia}`,
          sandbox_init_point: `https://sandbox.mercadopago.com.br/checkout/${referencia}`,
        };
      },
      async buscarPagamento(_token, id) {
        const item = remotos.get(id);
        if (!item) throw new Error("pagamento simulado ausente");
        return { id, status: item.status, external_reference: item.external_reference };
      },
    });
  });

  afterAll(async () => {
    if (tokenAnterior == null) delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    else process.env.MERCADO_PAGO_ACCESS_TOKEN = tokenAnterior;
    if (!prisma) return;
    if (criados.torneios.length) await prisma.torneio.deleteMany({ where: { id: { in: criados.torneios } } });
    if (criados.usuarios.length) await prisma.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
    await prisma.$disconnect();
  });

  async function usuario(email: string, papel: "ADMIN" | "ATLETA", nome: string) {
    const { gerarHash } = await import("@/server/senha");
    const criado = await prisma.usuario.create({
      data: {
        email,
        nome,
        papel,
        senhaHash: await gerarHash("senha-pagamento-123"),
        atleta: papel === "ATLETA" ? { create: { nomeCompleto: nome, sexo: "MASCULINO" } } : undefined,
      },
      include: { atleta: true },
    });
    criados.usuarios.push(criado.id);
    return criado;
  }

  async function torneio(adminId: string, nome: string, valorReais: string) {
    const { criarTorneio } = await import("@/server/torneios");
    const criado = await criarTorneio(adminId, {
      nome,
      descricao: "Pagamento",
      regulamento: "Teste",
      inicioEm: "2026-12-01T09:00",
      local: "Areia",
      formato: "DUPLA",
      formacao: "SORTEADAS",
      naipe: "MASCULINO",
      maxAtletas: "",
      inscricoesAte: "2026-12-20T18:00",
      valorReais,
      pontosParaVencer: "21",
      diferencaMinima: "2",
      pontosMaximos: "",
      quadrasSimultaneas: "1",
      descansoMinutos: "0",
      permitirEquipeIncompleta: false,
      corDestaque: "#e36a3a",
      nomeOrganizador: "SetPoint Santiago",
    });
    criados.torneios.push(criado.id);
    return criado;
  }

  it("mantém a inscrição grátis e o cadastro do administrador sem cobrança", async () => {
    const { inscrever, inscreverAtletaDireto } = await import("@/server/inscricoes");
    const admin = await usuario(`${prefixo}-admin@arena.local`, "ADMIN", "Admin Pagamento");
    const atleta = await usuario(`${prefixo}-gratis@arena.local`, "ATLETA", "Atleta Gratis");
    const direto = await usuario(`${prefixo}-direto@arena.local`, "ATLETA", "Atleta Direto");
    const gratis = await torneio(admin.id, `${prefixo} grátis`, "");
    const pago = await torneio(admin.id, `${prefixo} pago admin`, "40,00");

    await inscrever(atleta.id, gratis.id);
    const inscricao = await prisma.inscricao.findUnique({
      where: { torneioId_atletaId: { torneioId: gratis.id, atletaId: atleta.atleta!.id } },
    });
    expect(inscricao?.status).toBe("PENDENTE");
    expect(await prisma.pagamento.count({ where: { torneioId: gratis.id } })).toBe(0);

    await inscreverAtletaDireto(admin.id, pago.id, direto.atleta!.id);
    const aprovada = await prisma.inscricao.findUnique({
      where: { torneioId_atletaId: { torneioId: pago.id, atletaId: direto.atleta!.id } },
    });
    expect(aprovada?.status).toBe("APROVADA");
    expect(await prisma.pagamento.count({ where: { atletaId: direto.atleta!.id } })).toBe(0);
  });

  it("só coloca a vaga na lista quando o webhook aprova, e ignora a repetição", async () => {
    const { iniciarPagamentoIndividual, aplicarNotificacaoDePagamento } = await import("@/server/pagamentos");
    const admin = await usuario(`${prefixo}-admin2@arena.local`, "ADMIN", "Admin Dois");
    const atleta = await usuario(`${prefixo}-pago@arena.local`, "ATLETA", "Atleta Pago");
    const pago = await torneio(admin.id, `${prefixo} pago`, "80,00");
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    await expect(iniciarPagamentoIndividual(atleta.id, pago.id, "http://localhost:3000")).rejects.toThrow(
      AVISO_PAGAMENTO_NAO_CONFIGURADO,
    );
    expect(await prisma.inscricao.count({ where: { torneioId: pago.id } })).toBe(0);

    process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-simulado";
    const checkout = await iniciarPagamentoIndividual(atleta.id, pago.id, "http://localhost:3000");
    expect(checkout.initPoint).toContain("sandbox.mercadopago.com.br");
    expect(await prisma.inscricao.count({ where: { torneioId: pago.id } })).toBe(0);

    const idExterno = `pay-${checkout.id}`;
    remotos.get(idExterno)!.status = "rejected";
    await aplicarNotificacaoDePagamento(idExterno);
    expect((await prisma.pagamento.findUnique({ where: { id: checkout.id } }))?.status).toBe("RECUSADO");
    expect(await prisma.inscricao.count({ where: { torneioId: pago.id } })).toBe(0);

    const novo = await iniciarPagamentoIndividual(atleta.id, pago.id, "http://localhost:3000");
    expect(novo.id).not.toBe(checkout.id);
    remotos.get(`pay-${novo.id}`)!.status = "approved";
    await aplicarNotificacaoDePagamento(`pay-${novo.id}`);
    await aplicarNotificacaoDePagamento(`pay-${novo.id}`);
    const inscricoes = await prisma.inscricao.findMany({ where: { torneioId: pago.id, atletaId: atleta.atleta!.id } });
    expect(inscricoes).toHaveLength(1);
    expect(inscricoes[0]?.status).toBe("PENDENTE");
    expect((await prisma.pagamento.findUnique({ where: { id: novo.id } }))?.status).toBe("APROVADO");
  });
});
