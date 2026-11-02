// API do Guardião. Também serve o painel web (arquivos estáticos) quando PAINEL_DIR existe, para rodar num processo só.
import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Banco, FiltroProblemas } from './nucleo/base';
import { GuardaAuth, Publico } from './nucleo/auth';
import { AvisoController, IdentidadeController } from './modulos/identidade';
import { TagsController, VigilanteController } from './modulos/vigilante';
import { SincronizacaoController } from './modulos/sincronizacao';
import { PainelController } from './modulos/painel';
import { CadastrosController } from './modulos/cadastros';
import { Agendamento } from './modulos/agendamento';

const VERSAO = '0.1.0';

@Controller('saude')
class SaudeController {
  constructor(private db: Banco) {}

  @Publico()
  @Get()
  vivo() {
    return { status: 'ok', versao: VERSAO };
  }

  @Publico()
  @Get('prontidao')
  async pronto() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}

@Module({
  controllers: [SaudeController, IdentidadeController, AvisoController, VigilanteController, TagsController, SincronizacaoController, PainelController, CadastrosController],
  providers: [Banco, Agendamento, { provide: APP_GUARD, useClass: GuardaAuth }, { provide: APP_FILTER, useClass: FiltroProblemas }],
})
class AppModule {}

async function iniciar() {
  if (!process.env.JWT_SEGREDO || process.env.JWT_SEGREDO.length < 32) throw new Error('Defina JWT_SEGREDO com pelo menos 32 caracteres.');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set('trust proxy', 1);
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const id = (req.headers['x-request-id'] as string) || `req_${randomUUID()}`;
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  // Fotos chegam como bytes; o resto é JSON de até 512 KB.
  app.use('/api/v1/ocorrencias', express.raw({ type: 'image/jpeg', limit: '2mb' }));
  app.use(express.json({ limit: '512kb' }));
  app.setGlobalPrefix('api/v1');

  const painel = process.env.PAINEL_DIR;
  if (painel && fs.existsSync(path.join(painel, 'index.html'))) {
    app.useStaticAssets(painel, { index: false, maxAge: '1h' });
    // Rotas do SPA: qualquer GET fora de /api devolve o index.html.
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(painel, 'index.html'));
    });
  }

  const porta = Number(process.env.PORTA ?? 3000);
  await app.listen(porta, '0.0.0.0');
  console.log(`API do Guardião ${VERSAO} na porta ${porta}`);
}

void iniciar();
