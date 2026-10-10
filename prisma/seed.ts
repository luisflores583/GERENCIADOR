import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function carregarEnv() {
  const arquivo = resolve(process.cwd(), ".env");
  if (!existsSync(arquivo)) return;
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual < 1) continue;
    const chave = limpa.slice(0, igual).trim();
    let valor = limpa.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!process.env[chave]) process.env[chave] = valor;
  }
}

carregarEnv();

const ATLETAS = [
  { email: "ana@arena.local", nome: "Ana Lima", apelido: "Ana" },
  { email: "bia@arena.local", nome: "Bia Costa", apelido: "Bia" },
  { email: "caio@arena.local", nome: "Caio Nunes", apelido: "Caio" },
  { email: "davi@arena.local", nome: "Davi Rocha", apelido: "Davi" },
  { email: "eva@arena.local", nome: "Eva Martins", apelido: "Eva" },
  { email: "felipe@arena.local", nome: "Felipe Dias", apelido: "Felipe" },
  { email: "gabi@arena.local", nome: "Gabi Alves", apelido: "Gabi" },
  { email: "hugo@arena.local", nome: "Hugo Pires", apelido: "Hugo" },
] as const;

const DUPLAS = [
  ["Maré Alta", "ana@arena.local", "bia@arena.local"],
  ["Vento Sul", "caio@arena.local", "davi@arena.local"],
  ["Sol a Pino", "eva@arena.local", "felipe@arena.local"],
  ["Areia Quente", "gabi@arena.local", "hugo@arena.local"],
] as const;

const QUADRAS = ["Quadra 1", "Quadra 2"];
const SEMENTE = 20261010;

async function principal() {
  const senhaAdmin = process.env.SEED_ADMIN_PASSWORD ?? "";
  const senhaAtleta = process.env.SEED_ATHLETE_PASSWORD ?? "";
  const emailAdmin = (process.env.SEED_ADMIN_EMAIL ?? "admin@arena.local").toLowerCase();
  if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL.");
  if (!senhaAdmin || !senhaAtleta) {
    throw new Error("Defina SEED_ADMIN_PASSWORD e SEED_ATHLETE_PASSWORD. O seed não inventa senha.");
  }

  const { prisma } = await import("../src/server/db");
  const { gerarHash } = await import("../src/server/senha");
  const { criarTorneio, alterarStatus } = await import("../src/server/torneios");
  const { criarEquipe, inscrever } = await import("../src/server/inscricoes");
  const { confirmarSorteioConfrontos, gerarSorteioConfrontos, salvarQuadra, vincularQuadra } = await import(
    "../src/server/competicao"
  );

  async function garantirUsuario(email: string, nome: string, papel: "ADMIN" | "ATLETA", senha: string, apelido?: string) {
    const existente = await prisma.usuario.findUnique({ where: { email }, include: { atleta: true } });
    if (existente) {
      if (papel === "ATLETA" && !existente.atleta) {
        await prisma.atleta.create({
          data: { usuarioId: existente.id, nomeCompleto: nome, apelido: apelido ?? null },
        });
      }
      return prisma.usuario.findUniqueOrThrow({ where: { email }, include: { atleta: true } });
    }
    return prisma.usuario.create({
      data: {
        email,
        nome,
        papel,
        senhaHash: await gerarHash(senha),
        atleta: papel === "ATLETA" ? { create: { nomeCompleto: nome, apelido: apelido ?? null } } : undefined,
      },
      include: { atleta: true },
    });
  }

  const admin = await garantirUsuario(emailAdmin, "Organização da arena", "ADMIN", senhaAdmin);
  const atletas = new Map<string, { id: string; usuarioId: string }>();
  for (const item of ATLETAS) {
    const usuario = await garantirUsuario(item.email, item.nome, "ATLETA", senhaAtleta, item.apelido);
    if (!usuario.atleta) throw new Error(`Atleta ausente: ${item.email}`);
    atletas.set(item.email, { id: usuario.atleta.id, usuarioId: usuario.id });
  }

  for (const nome of QUADRAS) {
    await prisma.quadra.upsert({ where: { nome }, update: {}, create: { nome } });
  }
  const quadras = await prisma.quadra.findMany({ where: { nome: { in: [...QUADRAS] } }, orderBy: { nome: "asc" } });

  const arena = await prisma.torneio.findUnique({ where: { slug: "arena-da-orla" } });
  if (!arena) {
    const torneio = await criarTorneio(admin.id, {
      nome: "Arena da Orla",
      descricao: "Torneio demonstração de duplas, pronto para registrar placares.",
      regulamento: "Dupla eliminação. 21 pontos, diferença mínima de 2. Cada equipe tem duas vidas.",
      inicioEm: "2026-11-15T09:00",
      local: "Orla de Copacabana",
      formato: "DUPLA",
      formacao: "PRE_FORMADAS",
      maxAtletas: "16",
      inscricoesAte: "2026-11-14T18:00",
      valorReais: "50,00",
      pontosParaVencer: "21",
      diferencaMinima: "2",
      pontosMaximos: "",
      quadrasSimultaneas: "2",
      descansoMinutos: "0",
      permitirEquipeIncompleta: false,
      corDestaque: "#e36a3a",
      nomeOrganizador: "Areia Viva",
    });
    for (const [nome, emailA, emailB] of DUPLAS) {
      const equipe = await criarEquipe(admin.id, torneio.id, nome, [atletas.get(emailA)!.id, atletas.get(emailB)!.id]);
      const { aprovarEquipe } = await import("../src/server/inscricoes");
      await aprovarEquipe(admin.id, equipe.id);
    }
    await alterarStatus(admin.id, torneio.id, "preparar");
    for (const quadra of quadras) {
      await vincularQuadra(admin.id, torneio.id, quadra.id, true);
    }
    const previa = await gerarSorteioConfrontos(admin.id, torneio.id, SEMENTE);
    await confirmarSorteioConfrontos(admin.id, previa.sorteioId);
    console.log("Torneio jogável criado: /ao-vivo/arena-da-orla");
  } else {
    console.log("Torneio Arena da Orla já existia. Senhas e chave não foram alteradas.");
  }

  const trios = await prisma.torneio.findUnique({ where: { slug: "trios-da-manha" } });
  if (!trios) {
    const torneio = await criarTorneio(admin.id, {
      nome: "Trios da Manhã",
      descricao: "Inscrições individuais abertas. As equipes de trio serão sorteadas depois da aprovação.",
      regulamento: "Formato trio. As equipes nascem no sorteio, com a lista de atletas aprovados.",
      inicioEm: "2026-12-21T08:00",
      local: "Quadra da praia",
      formato: "TRIO",
      formacao: "SORTEADAS",
      maxAtletas: "",
      inscricoesAte: "2026-12-20T18:00",
      valorReais: "",
      pontosParaVencer: "15",
      diferencaMinima: "2",
      pontosMaximos: "21",
      quadrasSimultaneas: "1",
      descansoMinutos: "5",
      permitirEquipeIncompleta: false,
      corDestaque: "#1f7a8c",
      nomeOrganizador: "Areia Viva",
    });
    for (const email of ["ana@arena.local", "bia@arena.local", "caio@arena.local", "davi@arena.local", "eva@arena.local", "felipe@arena.local"]) {
      await inscrever(atletas.get(email)!.usuarioId, torneio.id);
    }
    console.log("Torneio com inscrições abertas criado: trios-da-manha");
  } else {
    console.log("Torneio Trios da Manhã já existia.");
  }

  await prisma.$disconnect();
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
