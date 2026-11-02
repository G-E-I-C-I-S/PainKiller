-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('VIGILANTE', 'COORDENADOR', 'RESPONSAVEL', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "StatusRonda" AS ENUM ('AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'INCOMPLETA', 'NAO_REALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Gravidade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "StatusOcorrencia" AS ENUM ('ABERTA', 'EM_ATENDIMENTO', 'RESOLVIDA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "StatusRevisao" AS ENUM ('NAO_REQUER', 'PENDENTE', 'ACEITA', 'REJEITADA');

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fuso" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "politicaGeo" TEXT NOT NULL DEFAULT 'SINALIZAR',
    "precisaoMaximaM" INTEGER NOT NULL DEFAULT 100,
    "toleranciaInicioMin" INTEGER NOT NULL DEFAULT 30,
    "inatividadeBloqueioMin" INTEGER NOT NULL DEFAULT 10,
    "limiteDesvioRelogioMin" INTEGER NOT NULL DEFAULT 5,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deveTrocarSenha" BOOLEAN NOT NULL DEFAULT false,
    "avisoVersaoCiente" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "identificadorInstalacao" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "versaoSo" TEXT NOT NULL,
    "versaoApp" TEXT NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "ultimoAcessoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dispositivoId" TEXT,
    "canal" TEXT NOT NULL,
    "familia" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadaEm" TIMESTAMP(3),
    "substituidaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Predio" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "raioGeofenceM" DOUBLE PRECISION,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Predio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Andar" (
    "id" TEXT NOT NULL,
    "predioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Andar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PontoRonda" (
    "id" TEXT NOT NULL,
    "predioId" TEXT NOT NULL,
    "andarId" TEXT,
    "nome" TEXT NOT NULL,
    "instrucoes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "raioToleranciaM" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PontoRonda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagNfc" (
    "id" TEXT NOT NULL,
    "uidHex" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "pontoRondaId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "vinculadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vinculadaPorId" TEXT,

    CONSTRAINT "TagNfc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoOcorrencia" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "gravidadePadrao" "Gravidade" NOT NULL,
    "ordemExibicao" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoOcorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roteiro" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "exigeOrdem" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Roteiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoteiroPonto" (
    "roteiroId" TEXT NOT NULL,
    "pontoRondaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoteiroPonto_pkey" PRIMARY KEY ("roteiroId","pontoRondaId")
);

-- CreateTable
CREATE TABLE "Agenda" (
    "id" TEXT NOT NULL,
    "roteiroId" TEXT NOT NULL,
    "vigilanteId" TEXT NOT NULL,
    "diasSemana" INTEGER[],
    "horaInicio" TEXT NOT NULL,
    "duracaoMin" INTEGER NOT NULL,
    "toleranciaInicioMin" INTEGER NOT NULL DEFAULT 30,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "geradaAte" TIMESTAMP(3),

    CONSTRAINT "Agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ronda" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "roteiroId" TEXT NOT NULL,
    "roteiroNome" TEXT NOT NULL,
    "exigeOrdem" BOOLEAN NOT NULL,
    "vigilanteId" TEXT NOT NULL,
    "agendaId" TEXT,
    "status" "StatusRonda" NOT NULL DEFAULT 'AGENDADA',
    "inicioPrevisto" TIMESTAMP(3) NOT NULL,
    "fimPrevisto" TIMESTAMP(3) NOT NULL,
    "toleranciaInicioMin" INTEGER NOT NULL,
    "iniciadaEmDispositivo" TIMESTAMP(3),
    "iniciadaRecebidoEm" TIMESTAMP(3),
    "inicioLocalizacao" JSONB,
    "finalizadaEmDispositivo" TIMESTAMP(3),
    "finalizadaRecebidoEm" TIMESTAMP(3),
    "fimLocalizacao" JSONB,
    "finalizadaComPendencias" BOOLEAN,
    "observacao" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "canceladaPorId" TEXT,
    "encerramentoMotivo" TEXT,
    "encerradaPorId" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ronda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RondaPonto" (
    "rondaId" TEXT NOT NULL,
    "pontoRondaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL,

    CONSTRAINT "RondaPonto_pkey" PRIMARY KEY ("rondaId","pontoRondaId")
);

-- CreateTable
CREATE TABLE "Visita" (
    "id" TEXT NOT NULL,
    "rondaId" TEXT NOT NULL,
    "pontoRondaId" TEXT NOT NULL,
    "uidHex" TEXT NOT NULL,
    "payloadNfc" TEXT NOT NULL,
    "lidoEmDispositivo" TIMESTAMP(3) NOT NULL,
    "recebidoEmServidor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "localizacao" JSONB,
    "localizacaoSimulada" BOOLEAN NOT NULL,
    "resultadoGeoDispositivo" TEXT NOT NULL,
    "resultadoGeo" TEXT NOT NULL,
    "validacaoTag" TEXT NOT NULL,
    "foraDaOrdem" BOOLEAN NOT NULL,
    "statusRevisao" "StatusRevisao" NOT NULL,
    "revisadaPorId" TEXT,
    "revisadaEm" TIMESTAMP(3),
    "observacaoRevisao" TEXT,
    "desvioRelogioMs" INTEGER,
    "recebidoAposEncerramento" BOOLEAN NOT NULL DEFAULT false,
    "checklist" JSONB,

    CONSTRAINT "Visita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Justificativa" (
    "id" TEXT NOT NULL,
    "rondaId" TEXT NOT NULL,
    "pontoRondaId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "justificadaEmDispositivo" TIMESTAMP(3) NOT NULL,
    "recebidoEmServidor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "localizacao" JSONB,

    CONSTRAINT "Justificativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" TEXT NOT NULL,
    "rondaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipoOcorrenciaId" TEXT NOT NULL,
    "gravidade" "Gravidade" NOT NULL,
    "descricao" TEXT,
    "predioId" TEXT NOT NULL,
    "pontoRondaId" TEXT,
    "detalheLocal" TEXT,
    "resolvidoNoLocal" BOOLEAN NOT NULL DEFAULT false,
    "registradaEmDispositivo" TIMESTAMP(3) NOT NULL,
    "recebidoEmServidor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "localizacao" JSONB,
    "localizacaoSimulada" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusOcorrencia" NOT NULL DEFAULT 'ABERTA',
    "fotosAnunciadas" JSONB NOT NULL,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcorrenciaStatus" (
    "id" TEXT NOT NULL,
    "ocorrenciaId" TEXT NOT NULL,
    "de" "StatusOcorrencia" NOT NULL,
    "para" "StatusOcorrencia" NOT NULL,
    "comentario" TEXT,
    "usuarioId" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcorrenciaStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Foto" (
    "id" TEXT NOT NULL,
    "ocorrenciaId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "capturadaEmDispositivo" TIMESTAMP(3),
    "recebidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dados" BYTEA NOT NULL,

    CONSTRAINT "Foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoSincronizacao" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dispositivoId" TEXT,
    "resultado" TEXT NOT NULL,
    "codigo" TEXT,
    "mensagem" TEXT,
    "payload" JSONB NOT NULL,
    "desvioMs" INTEGER,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoSincronizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" BIGSERIAL NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dados" JSONB,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_matricula_key" ON "Usuario"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_identificadorInstalacao_key" ON "Dispositivo"("identificadorInstalacao");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_refreshHash_key" ON "Sessao"("refreshHash");

-- CreateIndex
CREATE INDEX "Sessao_familia_idx" ON "Sessao"("familia");

-- CreateIndex
CREATE UNIQUE INDEX "Predio_campusId_codigo_key" ON "Predio"("campusId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TagNfc_uidHex_key" ON "TagNfc"("uidHex");

-- CreateIndex
CREATE INDEX "Ronda_agendaId_inicioPrevisto_idx" ON "Ronda"("agendaId", "inicioPrevisto");

-- CreateIndex
CREATE INDEX "Ronda_vigilanteId_inicioPrevisto_idx" ON "Ronda"("vigilanteId", "inicioPrevisto");

-- CreateIndex
CREATE INDEX "Ronda_status_inicioPrevisto_idx" ON "Ronda"("status", "inicioPrevisto");

-- CreateIndex
CREATE UNIQUE INDEX "Visita_rondaId_pontoRondaId_key" ON "Visita"("rondaId", "pontoRondaId");

-- CreateIndex
CREATE UNIQUE INDEX "Justificativa_rondaId_pontoRondaId_key" ON "Justificativa"("rondaId", "pontoRondaId");

-- CreateIndex
CREATE INDEX "EventoSincronizacao_usuarioId_recebidoEm_idx" ON "EventoSincronizacao"("usuarioId", "recebidoEm");

-- CreateIndex
CREATE INDEX "Auditoria_entidade_entidadeId_idx" ON "Auditoria"("entidade", "entidadeId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Predio" ADD CONSTRAINT "Predio_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Andar" ADD CONSTRAINT "Andar_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "Predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoRonda" ADD CONSTRAINT "PontoRonda_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "Predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoRonda" ADD CONSTRAINT "PontoRonda_andarId_fkey" FOREIGN KEY ("andarId") REFERENCES "Andar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagNfc" ADD CONSTRAINT "TagNfc_pontoRondaId_fkey" FOREIGN KEY ("pontoRondaId") REFERENCES "PontoRonda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipoOcorrencia" ADD CONSTRAINT "TipoOcorrencia_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roteiro" ADD CONSTRAINT "Roteiro_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoteiroPonto" ADD CONSTRAINT "RoteiroPonto_roteiroId_fkey" FOREIGN KEY ("roteiroId") REFERENCES "Roteiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agenda" ADD CONSTRAINT "Agenda_roteiroId_fkey" FOREIGN KEY ("roteiroId") REFERENCES "Roteiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agenda" ADD CONSTRAINT "Agenda_vigilanteId_fkey" FOREIGN KEY ("vigilanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ronda" ADD CONSTRAINT "Ronda_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ronda" ADD CONSTRAINT "Ronda_vigilanteId_fkey" FOREIGN KEY ("vigilanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RondaPonto" ADD CONSTRAINT "RondaPonto_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "Ronda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "Ronda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Justificativa" ADD CONSTRAINT "Justificativa_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "Ronda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "Ronda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcorrenciaStatus" ADD CONSTRAINT "OcorrenciaStatus_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "Ocorrencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foto" ADD CONSTRAINT "Foto_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "Ocorrencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
