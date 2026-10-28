-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'ATLETA');

-- CreateEnum
CREATE TYPE "StatusTorneio" AS ENUM ('INSCRICOES_ABERTAS', 'INSCRICOES_ENCERRADAS', 'AGUARDANDO_SORTEIO', 'EM_ANDAMENTO', 'PAUSADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "FormatoEquipe" AS ENUM ('DUPLA', 'TRIO', 'QUARTETO');

-- CreateEnum
CREATE TYPE "ModoFormacao" AS ENUM ('PRE_FORMADAS', 'SORTEADAS');

-- CreateEnum
CREATE TYPE "StatusInscricao" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusEquipe" AS ENUM ('PENDENTE', 'CONFIRMADA', 'ELIMINADA', 'CAMPEA', 'VICE');

-- CreateEnum
CREATE TYPE "StatusPartida" AS ENUM ('AGUARDANDO', 'PRONTA', 'AGENDADA', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'BYE', 'VAZIA', 'NAO_NECESSARIA');

-- CreateEnum
CREATE TYPE "LadoChave" AS ENUM ('VENCEDORES', 'PERDEDORES', 'FINAL', 'FINAL_EXTRA');

-- CreateEnum
CREATE TYPE "TipoSorteio" AS ENUM ('EQUIPES', 'CONFRONTOS');

-- CreateEnum
CREATE TYPE "StatusSorteio" AS ENUM ('RASCUNHO', 'CONFIRMADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atleta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "apelido" TEXT,
    "telefone" TEXT,
    "fotoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Atleta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Torneio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "regulamento" TEXT NOT NULL DEFAULT '',
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "local" TEXT NOT NULL,
    "modalidade" TEXT NOT NULL DEFAULT 'Vôlei de areia',
    "formato" "FormatoEquipe" NOT NULL,
    "formacao" "ModoFormacao" NOT NULL,
    "maxAtletas" INTEGER,
    "inscricoesAte" TIMESTAMP(3) NOT NULL,
    "valorCentavos" INTEGER,
    "status" "StatusTorneio" NOT NULL DEFAULT 'INSCRICOES_ABERTAS',
    "pontosParaVencer" INTEGER NOT NULL DEFAULT 21,
    "diferencaMinima" INTEGER NOT NULL DEFAULT 2,
    "pontosMaximos" INTEGER,
    "quadrasSimultaneas" INTEGER NOT NULL DEFAULT 1,
    "descansoMinutos" INTEGER NOT NULL DEFAULT 0,
    "permitirEquipeIncompleta" BOOLEAN NOT NULL DEFAULT false,
    "corDestaque" TEXT NOT NULL DEFAULT '#e36a3a',
    "nomeOrganizador" TEXT NOT NULL DEFAULT '',
    "equipesTravadasEm" TIMESTAMP(3),
    "iniciadoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "campeaoEquipeId" TEXT,
    "viceEquipeId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Torneio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quadra" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quadra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TorneioQuadra" (
    "id" TEXT NOT NULL,
    "torneioId" TEXT NOT NULL,
    "quadraId" TEXT NOT NULL,
    "habilitada" BOOLEAN NOT NULL DEFAULT true,
    "indisponivelAte" TIMESTAMP(3),
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TorneioQuadra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscricao" (
    "id" TEXT NOT NULL,
    "torneioId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "equipeId" TEXT,
    "status" "StatusInscricao" NOT NULL DEFAULT 'PENDENTE',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipe" (
    "id" TEXT NOT NULL,
    "torneioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "capitaoId" TEXT,
    "status" "StatusEquipe" NOT NULL DEFAULT 'PENDENTE',
    "cabeca" INTEGER,
    "incompleta" BOOLEAN NOT NULL DEFAULT false,
    "vitorias" INTEGER NOT NULL DEFAULT 0,
    "derrotas" INTEGER NOT NULL DEFAULT 0,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroEquipe" (
    "equipeId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,

    CONSTRAINT "MembroEquipe_pkey" PRIMARY KEY ("equipeId","atletaId")
);

-- CreateTable
CREATE TABLE "Sorteio" (
    "id" TEXT NOT NULL,
    "torneioId" TEXT NOT NULL,
    "tipo" "TipoSorteio" NOT NULL,
    "status" "StatusSorteio" NOT NULL DEFAULT 'RASCUNHO',
    "semente" INTEGER NOT NULL,
    "algoritmo" TEXT NOT NULL,
    "resultado" JSONB NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmadoEm" TIMESTAMP(3),

    CONSTRAINT "Sorteio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partida" (
    "id" TEXT NOT NULL,
    "torneioId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "chave" "LadoChave" NOT NULL,
    "rodada" INTEGER NOT NULL,
    "posicao" INTEGER NOT NULL,
    "origemA" JSONB NOT NULL,
    "origemB" JSONB NOT NULL,
    "equipeAId" TEXT,
    "equipeBId" TEXT,
    "vencedorId" TEXT,
    "perdedorId" TEXT,
    "placarA" INTEGER,
    "placarB" INTEGER,
    "status" "StatusPartida" NOT NULL,
    "quadraId" TEXT,
    "prontaEm" TIMESTAMP(3),
    "inicioEm" TIMESTAMP(3),
    "fimEm" TIMESTAMP(3),
    "ordemConclusao" INTEGER,
    "registradaPorId" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoResultado" (
    "id" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "torneioId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "placarAAnterior" INTEGER,
    "placarBAnterior" INTEGER,
    "vencedorAnteriorId" TEXT,
    "placarANovo" INTEGER,
    "placarBNovo" INTEGER,
    "vencedorNovoId" TEXT,
    "motivo" TEXT NOT NULL DEFAULT '',
    "partidasAfetadas" JSONB NOT NULL,
    "adminId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoResultado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON "Sessao"("tokenHash");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Atleta_usuarioId_key" ON "Atleta"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Torneio_slug_key" ON "Torneio"("slug");

-- CreateIndex
CREATE INDEX "Torneio_status_idx" ON "Torneio"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Quadra_nome_key" ON "Quadra"("nome");

-- CreateIndex
CREATE INDEX "TorneioQuadra_quadraId_idx" ON "TorneioQuadra"("quadraId");

-- CreateIndex
CREATE UNIQUE INDEX "TorneioQuadra_torneioId_quadraId_key" ON "TorneioQuadra"("torneioId", "quadraId");

-- CreateIndex
CREATE INDEX "Inscricao_torneioId_status_idx" ON "Inscricao"("torneioId", "status");

-- CreateIndex
CREATE INDEX "Inscricao_equipeId_idx" ON "Inscricao"("equipeId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscricao_torneioId_atletaId_key" ON "Inscricao"("torneioId", "atletaId");

-- CreateIndex
CREATE INDEX "Equipe_torneioId_status_idx" ON "Equipe"("torneioId", "status");

-- CreateIndex
CREATE INDEX "Equipe_capitaoId_idx" ON "Equipe"("capitaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipe_torneioId_nome_key" ON "Equipe"("torneioId", "nome");

-- CreateIndex
CREATE INDEX "MembroEquipe_atletaId_idx" ON "MembroEquipe"("atletaId");

-- CreateIndex
CREATE INDEX "Sorteio_torneioId_tipo_status_idx" ON "Sorteio"("torneioId", "tipo", "status");

-- CreateIndex
CREATE INDEX "Partida_torneioId_status_idx" ON "Partida"("torneioId", "status");

-- CreateIndex
CREATE INDEX "Partida_quadraId_idx" ON "Partida"("quadraId");

-- CreateIndex
CREATE INDEX "Partida_equipeAId_idx" ON "Partida"("equipeAId");

-- CreateIndex
CREATE INDEX "Partida_equipeBId_idx" ON "Partida"("equipeBId");

-- CreateIndex
CREATE UNIQUE INDEX "Partida_torneioId_codigo_key" ON "Partida"("torneioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Partida_torneioId_chave_rodada_posicao_key" ON "Partida"("torneioId", "chave", "rodada", "posicao");

-- CreateIndex
CREATE INDEX "HistoricoResultado_partidaId_idx" ON "HistoricoResultado"("partidaId");

-- CreateIndex
CREATE INDEX "HistoricoResultado_torneioId_idx" ON "HistoricoResultado"("torneioId");

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atleta" ADD CONSTRAINT "Atleta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Torneio" ADD CONSTRAINT "Torneio_campeaoEquipeId_fkey" FOREIGN KEY ("campeaoEquipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Torneio" ADD CONSTRAINT "Torneio_viceEquipeId_fkey" FOREIGN KEY ("viceEquipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TorneioQuadra" ADD CONSTRAINT "TorneioQuadra_torneioId_fkey" FOREIGN KEY ("torneioId") REFERENCES "Torneio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TorneioQuadra" ADD CONSTRAINT "TorneioQuadra_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "Quadra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_torneioId_fkey" FOREIGN KEY ("torneioId") REFERENCES "Torneio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipe" ADD CONSTRAINT "Equipe_torneioId_fkey" FOREIGN KEY ("torneioId") REFERENCES "Torneio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipe" ADD CONSTRAINT "Equipe_capitaoId_fkey" FOREIGN KEY ("capitaoId") REFERENCES "Atleta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroEquipe" ADD CONSTRAINT "MembroEquipe_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroEquipe" ADD CONSTRAINT "MembroEquipe_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sorteio" ADD CONSTRAINT "Sorteio_torneioId_fkey" FOREIGN KEY ("torneioId") REFERENCES "Torneio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sorteio" ADD CONSTRAINT "Sorteio_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_torneioId_fkey" FOREIGN KEY ("torneioId") REFERENCES "Torneio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_equipeAId_fkey" FOREIGN KEY ("equipeAId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_equipeBId_fkey" FOREIGN KEY ("equipeBId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_vencedorId_fkey" FOREIGN KEY ("vencedorId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_perdedorId_fkey" FOREIGN KEY ("perdedorId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "Quadra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoResultado" ADD CONSTRAINT "HistoricoResultado_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoResultado" ADD CONSTRAINT "HistoricoResultado_torneioId_fkey" FOREIGN KEY ("torneioId") REFERENCES "Torneio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoResultado" ADD CONSTRAINT "HistoricoResultado_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Uma quadra só pode ter um jogo ativo por vez.
CREATE UNIQUE INDEX "Partida_quadra_ativa_idx"
ON "Partida" ("quadraId")
WHERE "status" IN ('AGENDADA'::"StatusPartida", 'EM_ANDAMENTO'::"StatusPartida", 'PAUSADA'::"StatusPartida")
  AND "quadraId" IS NOT NULL;
