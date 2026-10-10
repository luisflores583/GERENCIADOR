import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroDeRegra } from "@/lib/erros";

const rodar = process.env.RODAR_INTEGRACAO === "1";

describe.skipIf(!rodar)("integração com o banco", () => {
  const prefixo = `int${Date.now().toString(36)}`;
  const criados = { usuarios: [] as string[], torneios: [] as string[], quadras: [] as string[] };
  let prisma: Awaited<typeof import("@/server/db")>["prisma"];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");
    ({ prisma } = await import("@/server/db"));
  });

  afterAll(async () => {
    if (!prisma) return;
    if (criados.torneios.length) await prisma.torneio.deleteMany({ where: { id: { in: criados.torneios } } });
    if (criados.usuarios.length) await prisma.usuario.deleteMany({ where: { id: { in: criados.usuarios } } });
    if (criados.quadras.length) await prisma.quadra.deleteMany({ where: { id: { in: criados.quadras } } });
    await prisma.$disconnect();
  });

  async function usuario(email: string, papel: "ADMIN" | "ATLETA", nome: string) {
    const { gerarHash } = await import("@/server/senha");
    const criado = await prisma.usuario.create({
      data: {
        email,
        nome,
        papel,
        senhaHash: await gerarHash("senha-integracao-123"),
        atleta: papel === "ATLETA" ? { create: { nomeCompleto: nome } } : undefined,
      },
      include: { atleta: true },
    });
    criados.usuarios.push(criado.id);
    return criado;
  }

  it("isola torneios, confirma placar uma vez e recusa sobra de atletas", async () => {
    const { criarTorneio, alterarStatus } = await import("@/server/torneios");
    const { criarEquipe, inscrever, aprovarEquipe, aprovarInscricao } = await import("@/server/inscricoes");
    const { confirmarResultado, confirmarSorteioConfrontos, gerarSorteioConfrontos, gerarSorteioEquipes, salvarQuadra, vincularQuadra } =
      await import("@/server/competicao");

    const admin = await usuario(`${prefixo}-admin@arena.local`, "ADMIN", "Admin teste");
    const nomes = ["Ana", "Bia", "Caio", "Davi", "Eva"];
    const atletas = [];
    for (const nome of nomes) {
      atletas.push(await usuario(`${prefixo}-${nome.toLowerCase()}@arena.local`, "ATLETA", `${nome} Teste`));
    }

    const base = {
      descricao: "Integração",
      regulamento: "Teste",
      inicioEm: "2026-11-15T09:00",
      local: "Quadra teste",
      maxAtletas: "",
      inscricoesAte: "2026-12-20T18:00",
      valorReais: "",
      pontosParaVencer: "21",
      diferencaMinima: "2",
      pontosMaximos: "",
      quadrasSimultaneas: "1",
      descansoMinutos: "0",
      permitirEquipeIncompleta: false,
      corDestaque: "#e36a3a",
      nomeOrganizador: "Teste",
    };

    const jogavel = await criarTorneio(admin.id, {
      ...base,
      nome: `${prefixo} duplas`,
      formato: "DUPLA",
      formacao: "PRE_FORMADAS",
    });
    criados.torneios.push(jogavel.id);
    const quadra = await salvarQuadra(admin.id, `${prefixo} quadra`);
    criados.quadras.push(quadra.id);
    await vincularQuadra(admin.id, jogavel.id, quadra.id, true);

    const duplas = [
      [atletas[0], atletas[1]],
      [atletas[2], atletas[3]],
    ];
    for (const [indice, par] of duplas.entries()) {
      const equipe = await criarEquipe(
        admin.id,
        jogavel.id,
        `Dupla ${indice + 1}`,
        par.map((item) => item.atleta!.id),
      );
      await aprovarEquipe(admin.id, equipe.id);
    }
    await alterarStatus(admin.id, jogavel.id, "preparar");
    const previa = await gerarSorteioConfrontos(admin.id, jogavel.id, 20261010);
    await confirmarSorteioConfrontos(admin.id, previa.sorteioId);

    const isolado = await criarTorneio(admin.id, {
      ...base,
      nome: `${prefixo} isolado`,
      formato: "DUPLA",
      formacao: "PRE_FORMADAS",
    });
    criados.torneios.push(isolado.id);

    const partida = await prisma.partida.findFirstOrThrow({
      where: {
        torneioId: jogavel.id,
        status: { in: ["PRONTA", "AGENDADA", "EM_ANDAMENTO"] },
        equipeAId: { not: null },
        equipeBId: { not: null },
      },
    });

    await expect(confirmarResultado(atletas[0].id, partida.id, 21, 15)).rejects.toMatchObject({ status: 403 });

    const primeira = await confirmarResultado(admin.id, partida.id, 21, 15);
    expect(primeira.idempotente).toBe(false);
    const segunda = await confirmarResultado(admin.id, partida.id, 21, 15);
    expect(segunda.idempotente).toBe(true);
    await expect(confirmarResultado(admin.id, partida.id, 15, 21)).rejects.toBeInstanceOf(ErroDeRegra);

    const vencedorId = 21 > 15 ? partida.equipeAId : partida.equipeBId;
    const vencedora = await prisma.equipe.findUniqueOrThrow({ where: { id: vencedorId! } });
    expect(vencedora.vitorias).toBe(1);
    expect(vencedora.derrotas).toBe(0);
    const concluidas = await prisma.partida.count({ where: { torneioId: jogavel.id, status: "CONCLUIDA", codigo: partida.codigo } });
    expect(concluidas).toBe(1);
    expect(await prisma.partida.count({ where: { torneioId: isolado.id } })).toBe(0);

    const sorteado = await criarTorneio(admin.id, {
      ...base,
      nome: `${prefixo} sorteio`,
      formato: "DUPLA",
      formacao: "SORTEADAS",
    });
    criados.torneios.push(sorteado.id);
    for (const atleta of atletas) {
      const inscricao = await inscrever(atleta.id, sorteado.id);
      await aprovarInscricao(admin.id, inscricao.id);
    }
    await alterarStatus(admin.id, sorteado.id, "encerrar");
    await expect(gerarSorteioEquipes(admin.id, sorteado.id, false)).rejects.toMatchObject({ codigo: "SOBRA" });
    expect(await prisma.equipe.count({ where: { torneioId: sorteado.id } })).toBe(0);
    expect(await prisma.inscricao.count({ where: { torneioId: sorteado.id, status: "APROVADA" } })).toBe(5);
  });
});
