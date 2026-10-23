import { z } from "zod";

const dataHora = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use data e horário no formato DD/MM/AAAA, 24 horas.");

export const esquemaLogin = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").transform((valor) => valor.toLowerCase()),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

const sexo = z.enum(["FEMININO", "MASCULINO"], { message: "Informe se a atleta é mulher ou homem." });

export const esquemaCadastro = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo.").max(120),
  apelido: z.string().trim().max(40).optional().default(""),
  telefone: z.string().trim().max(20).optional().default(""),
  sexo,
  email: z.string().trim().email("Informe um e-mail válido.").transform((valor) => valor.toLowerCase()),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(80),
});

export const esquemaInscricaoDireta = z
  .object({
    nome: z.string().trim().min(3, "Informe o nome completo.").max(120),
    apelido: z.string().trim().max(40).optional().default(""),
    telefone: z.string().trim().max(20).optional().default(""),
    sexo,
    email: z.string().trim().optional().default(""),
    senha: z.string().optional().default(""),
  })
  .superRefine((dados, ctx) => {
    const email = dados.email.trim().toLowerCase();
    if (email && !z.string().email().safeParse(email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Informe um e-mail válido ou deixe em branco." });
    }
    if (email && dados.senha.length < 8) {
      ctx.addIssue({
        code: "custom",
        path: ["senha"],
        message: "Com e-mail, a senha precisa ter pelo menos 8 caracteres.",
      });
    }
  });

export const esquemaEdicaoInscricao = z
  .object({
    nome: z.string().trim().min(3, "Informe o nome completo.").max(120),
    apelido: z.string().trim().max(40).optional().default(""),
    telefone: z.string().trim().max(20).optional().default(""),
    sexo,
    email: z.string().trim().optional().default(""),
  })
  .superRefine((dados, ctx) => {
    const email = dados.email.trim().toLowerCase();
    if (email && !z.string().email().safeParse(email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Informe um e-mail válido ou deixe em branco." });
    }
  });

export const esquemaPerfil = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo.").max(120),
  apelido: z.string().trim().max(40).optional().default(""),
  telefone: z.string().trim().max(20).optional().default(""),
  sexo,
});

export const esquemaTorneio = z
  .object({
    nome: z.string().trim().min(3, "Informe o nome do torneio.").max(120),
    descricao: z.string().trim().max(5000).optional().default(""),
    regulamento: z.string().trim().max(10000).optional().default(""),
    inicioEm: dataHora,
    local: z.string().trim().min(2, "Informe o local.").max(200),
    formato: z.enum(["DUPLA", "TRIO", "QUARTETO"], { message: "Escolha duplas, trios ou quartetos." }),
    formacao: z.enum(["PRE_FORMADAS", "SORTEADAS"], { message: "Escolha como as equipes serão formadas." }),
    naipe: z.enum(["FEMININO", "MASCULINO", "MISTO"], { message: "Escolha feminino, masculino ou misto." }).default("MISTO"),
    modeloChave: z.enum(["GENERICA", "FOLHA_16"], { message: "Escolha a tabela da chave." }).default("GENERICA"),
    maxAtletas: z.string().trim().optional().default(""),
    inscricoesAte: dataHora,
    valorReais: z.string().trim().optional().default(""),
    pontosParaVencer: z.coerce.number().int().min(1, "Informe os pontos para vencer.").max(99),
    diferencaMinima: z.coerce.number().int().min(1).max(20),
    pontosMaximos: z.string().trim().optional().default(""),
    quadrasSimultaneas: z.coerce.number().int().min(1).max(40),
    descansoMinutos: z.coerce.number().int().min(0).max(180).optional().default(0),
    permitirEquipeIncompleta: z.boolean().optional().default(false),
    corDestaque: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "A cor deve estar no formato #RRGGBB.")
      .optional()
      .default("#e36a3a"),
    nomeOrganizador: z.string().trim().max(120).optional().default(""),
  })
  .superRefine((dados, ctx) => {
    if (dados.pontosMaximos) {
      const maximo = Number(dados.pontosMaximos);
      if (!Number.isInteger(maximo) || maximo < dados.pontosParaVencer) {
        ctx.addIssue({
          code: "custom",
          path: ["pontosMaximos"],
          message: "O limite de pontos precisa ser um inteiro maior ou igual aos pontos para vencer.",
        });
      }
    }
    if (dados.maxAtletas) {
      const maximo = Number(dados.maxAtletas);
      if (!Number.isInteger(maximo) || maximo < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["maxAtletas"],
          message: "O limite de atletas precisa ser um inteiro a partir de 2.",
        });
      }
    }
  });

export function erroZod(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Revise os campos do formulário.";
}
