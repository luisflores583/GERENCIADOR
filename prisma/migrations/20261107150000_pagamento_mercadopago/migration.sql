CREATE TYPE "StatusPagamento" AS ENUM ('AGUARDANDO', 'APROVADO', 'RECUSADO', 'CANCELADO');

CREATE TYPE "TipoPagamento" AS ENUM ('INDIVIDUAL', 'EQUIPE', 'VAGA');

CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "torneioId" TEXT NOT NULL,
    "atletaId" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'AGUARDANDO',
    "tipo" "TipoPagamento" NOT NULL,
    "preferenciaId" TEXT,
    "pagamentoExternoId" TEXT,
    "initPoint" TEXT NOT NULL DEFAULT '',
    "rascunho" JSONB NOT NULL,
    "inscricaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "aprovadoEm" TIMESTAMP(3),

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Pagamento_pagamentoExternoId_key" ON "Pagamento"("pagamentoExternoId");

CREATE INDEX "Pagamento_torneioId_atletaId_status_idx" ON "Pagamento"("torneioId", "atletaId", "status");

CREATE INDEX "Pagamento_inscricaoId_idx" ON "Pagamento"("inscricaoId");

ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_torneioId_fkey" FOREIGN KEY ("torneioId") REFERENCES "Torneio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_atletaId_fkey" FOREIGN KEY ("atletaId") REFERENCES "Atleta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
