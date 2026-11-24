-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Oferta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "disciplina" TEXT NOT NULL,
    "codigoDisciplina" TEXT NOT NULL,
    "descricao" TEXT,
    "local" TEXT NOT NULL,
    "vagas" INTEGER NOT NULL,
    "dataInicio" TEXT NOT NULL,
    "dataFim" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "monitorId" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Oferta_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Horario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ofertaId" INTEGER NOT NULL,
    "diaSemana" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    CONSTRAINT "Horario_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "Oferta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ofertaId" INTEGER NOT NULL,
    "inicio" DATETIME NOT NULL,
    "fim" DATETIME NOT NULL,
    "vagas" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVISTA',
    CONSTRAINT "Sessao_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "Oferta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessaoId" INTEGER NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGENDADO',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Agendamento_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "Sessao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Agendamento_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Frequencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "agendamentoId" INTEGER NOT NULL,
    "presente" BOOLEAN NOT NULL,
    "observacao" TEXT,
    "registradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Frequencia_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Oferta_monitorId_idx" ON "Oferta"("monitorId");

-- CreateIndex
CREATE INDEX "Oferta_codigoDisciplina_idx" ON "Oferta"("codigoDisciplina");

-- CreateIndex
CREATE UNIQUE INDEX "Horario_ofertaId_diaSemana_horaInicio_key" ON "Horario"("ofertaId", "diaSemana", "horaInicio");

-- CreateIndex
CREATE INDEX "Sessao_inicio_idx" ON "Sessao"("inicio");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_ofertaId_inicio_key" ON "Sessao"("ofertaId", "inicio");

-- CreateIndex
CREATE INDEX "Agendamento_sessaoId_status_idx" ON "Agendamento"("sessaoId", "status");

-- CreateIndex
CREATE INDEX "Agendamento_alunoId_idx" ON "Agendamento"("alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "Frequencia_agendamentoId_key" ON "Frequencia"("agendamentoId");
