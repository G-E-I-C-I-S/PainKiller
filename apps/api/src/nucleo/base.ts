// Núcleo da API: banco, erros RFC 9457, validação com zod e auditoria.
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';
import { uuidv7 } from 'uuidv7';
import { z, type ZodTypeAny } from 'zod';

export const novoId = () => uuidv7();

@Injectable()
export class Banco extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export type Tx = Prisma.TransactionClient;

/** Erro de negócio com código estável (docs/07 · 3). */
export class Problema extends HttpException {
  constructor(
    status: number,
    public codigo: string,
    detalhe: string,
    public erros?: { campo: string; mensagem: string }[],
  ) {
    super(detalhe, status);
  }
}

const TITULOS: Record<number, string> = {
  400: 'Requisição inválida', 401: 'Não autenticado', 403: 'Sem permissão', 404: 'Não encontrado', 409: 'Conflito',
  412: 'Versão divergente', 413: 'Conteúdo grande demais', 422: 'Dados inválidos', 429: 'Muitas requisições', 500: 'Erro inesperado',
};

@Catch()
export class FiltroProblemas implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let codigo = 'ERRO_INTERNO';
    let detalhe = 'Erro inesperado. Informe o requestId ao suporte.';
    let erros: unknown;
    if (e instanceof Problema) {
      status = e.getStatus();
      codigo = e.codigo;
      detalhe = e.message;
      erros = e.erros;
    } else if (e instanceof HttpException) {
      status = e.getStatus();
      codigo = status === 404 ? 'NAO_ENCONTRADO' : status === 413 ? 'CORPO_MUITO_GRANDE' : `HTTP_${status}`;
      detalhe = e.message;
    } else {
      console.error(`[${req.headers['x-request-id']}]`, e);
    }
    res
      .status(status)
      .type('application/problem+json')
      .json({ type: 'about:blank', title: TITULOS[status] ?? 'Erro', status, detail: detalhe, instance: req.originalUrl, codigo, requestId: req.headers['x-request-id'], erros });
  }
}

/** Valida o corpo com zod e responde 422 com a lista de campos. */
export function validar<S extends ZodTypeAny>(schema: S, dados: unknown): z.infer<S> {
  const r = schema.safeParse(dados);
  if (!r.success) {
    throw new Problema(422, 'DADOS_INVALIDOS', 'Confira os campos.', r.error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })));
  }
  return r.data;
}

export async function auditar(db: Banco | Tx, usuarioId: string | null, acao: string, entidade: string, entidadeId: string | null, dados?: unknown) {
  await db.auditoria.create({ data: { usuarioId, acao, entidade, entidadeId, dados: (dados ?? undefined) as Prisma.InputJsonValue } });
}

export const naoEncontrado = (o = 'Registro') => new Problema(404, 'NAO_ENCONTRADO', `${o} não encontrado.`);
