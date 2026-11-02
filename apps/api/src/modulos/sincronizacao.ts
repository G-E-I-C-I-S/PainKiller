// Sincronização do app (docs/06 e 07 · 7): lote de eventos idempotente, uma transação por evento, e upload das fotos.
import { Body, Controller, Headers, HttpCode, Param, Post, Put, Req, Res } from '@nestjs/common';
import { Prisma, type Ronda } from '@prisma/client';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { auditar, Banco, Problema, type Tx, validar } from '../nucleo/base';
import { Papeis, Usuario, type UsuarioToken } from '../nucleo/auth';
import { uidValido } from './vigilante';

const data = z.string().datetime({ offset: true });
const Localizacao = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), precisaoM: z.number().nonnegative() }).nullable();
const ResultadoGeo = z.enum(['DENTRO_AREA', 'FORA_AREA', 'INDETERMINADO', 'SEM_LOCALIZACAO']);
const Motivo = z.enum(['ACESSO_BLOQUEADO', 'AREA_INTERDITADA', 'TAG_DANIFICADA_OU_AUSENTE', 'EMERGENCIA_EM_ATENDIMENTO', 'CONDICAO_INSEGURA', 'OUTRO']);
const Base = z.object({ id: z.string().uuid(), criadoEmDispositivo: data });

const Evento = z.discriminatedUnion('tipo', [
  Base.extend({ tipo: z.literal('RONDA_INICIADA'), dados: z.object({ rondaId: z.string().uuid(), iniciadaEmDispositivo: data, localizacao: Localizacao }) }),
  Base.extend({
    tipo: z.literal('PONTO_VISITADO'),
    dados: z.object({
      rondaId: z.string().uuid(), pontoRondaId: z.string().uuid(), uidHex: uidValido, payloadNfc: z.string().max(512),
      lidoEmDispositivo: data, localizacao: Localizacao, localizacaoSimulada: z.boolean(), resultadoGeoDispositivo: ResultadoGeo, foraDaOrdem: z.boolean(),
    }),
  }),
  Base.extend({
    tipo: z.literal('PONTO_CONFERIDO'),
    dados: z.object({
      rondaId: z.string().uuid(), pontoRondaId: z.string().uuid(), visitaId: z.string().uuid().nullable(),
      itens: z.array(z.object({ item: z.string().max(100), ok: z.boolean() })).max(20), conferidoEmDispositivo: data,
    }),
  }),
  Base.extend({
    tipo: z.literal('PONTO_JUSTIFICADO'),
    dados: z.object({ rondaId: z.string().uuid(), pontoRondaId: z.string().uuid(), motivo: Motivo, descricao: z.string().min(10).max(1000), justificadaEmDispositivo: data, localizacao: Localizacao }),
  }),
  Base.extend({
    tipo: z.literal('OCORRENCIA_REGISTRADA'),
    dados: z.object({
      rondaId: z.string().uuid(), tipoOcorrenciaId: z.string().uuid(), gravidade: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA']),
      descricao: z.string().max(2000).nullable(), predioId: z.string().uuid(), andarId: z.string().uuid().nullable(), setorId: z.string().uuid().nullable(),
      pontoRondaId: z.string().uuid().nullable(), detalheLocal: z.string().max(200).nullable().optional(), resolvidoNoLocal: z.boolean().optional(),
      registradaEmDispositivo: data, localizacao: Localizacao, localizacaoSimulada: z.boolean(),
      fotos: z.array(z.object({ fotoId: z.string().uuid(), sha256: z.string().length(64), tamanhoBytes: z.number().int() })).max(5),
    }),
  }),
  Base.extend({
    tipo: z.literal('RONDA_FINALIZADA'),
    dados: z.object({ rondaId: z.string().uuid(), finalizadaEmDispositivo: data, localizacao: Localizacao, finalizadaComPendencias: z.boolean(), observacao: z.string().max(2000).nullable().optional() }),
  }),
]);
type Evento = z.infer<typeof Evento>;

type Resultado = { id: string; resultado: 'ACEITO' | 'DUPLICADO' } | { id: string; resultado: 'REJEITADO'; codigo: string; mensagem: string };

class Rejeicao extends Error {
  constructor(
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

const json = (v: unknown) => (v ?? Prisma.DbNull) as Prisma.InputJsonValue;

export function distanciaM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (g: number) => (g * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const INICIADA = ['EM_ANDAMENTO', 'CONCLUIDA', 'INCOMPLETA'];

@Controller()
export class SincronizacaoController {
  constructor(private db: Banco) {}

  @Post('sincronizacao/eventos')
  @Papeis('VIGILANTE')
  @HttpCode(200)
  async eventos(@Usuario() u: UsuarioToken, @Body() corpo: unknown, @Headers('x-enviado-em-dispositivo') enviadoEm?: string) {
    const lote = validar(z.object({ eventos: z.array(z.unknown()).min(1).max(50) }), corpo);
    const desvioMs = enviadoEm && !Number.isNaN(Date.parse(enviadoEm)) ? Date.now() - Date.parse(enviadoEm) : 0;
    const resultados: Resultado[] = [];
    for (const bruto of lote.eventos) {
      const id = typeof (bruto as { id?: unknown })?.id === 'string' ? (bruto as { id: string }).id : '';
      const anterior = id ? await this.db.eventoSincronizacao.findUnique({ where: { id } }) : null;
      if (anterior) {
        resultados.push(anterior.resultado === 'ACEITO' ? { id, resultado: 'DUPLICADO' } : { id, resultado: 'REJEITADO', codigo: anterior.codigo ?? '', mensagem: anterior.mensagem ?? '' });
        continue;
      }
      const ev = Evento.safeParse(bruto);
      if (!ev.success) {
        const msg = ev.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        if (id) await this.registrar(id, String((bruto as { tipo?: unknown })?.tipo ?? '?'), u, bruto, 'REJEITADO', 'DADOS_INVALIDOS', msg, desvioMs);
        resultados.push({ id, resultado: 'REJEITADO', codigo: 'DADOS_INVALIDOS', mensagem: msg });
        continue;
      }
      try {
        await this.db.$transaction(async (tx) => {
          await this.aplicar(tx, ev.data, u, desvioMs);
          await tx.eventoSincronizacao.create({ data: { id, tipo: ev.data.tipo, usuarioId: u.id, dispositivoId: u.dispositivoId, resultado: 'ACEITO', payload: json(bruto), desvioMs } });
        });
        resultados.push({ id, resultado: 'ACEITO' });
      } catch (e) {
        if (e instanceof Rejeicao) {
          await this.registrar(id, ev.data.tipo, u, bruto, 'REJEITADO', e.codigo, e.message, desvioMs);
          resultados.push({ id, resultado: 'REJEITADO', codigo: e.codigo, mensagem: e.message });
        } else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          resultados.push({ id, resultado: 'DUPLICADO' }); // envio concorrente do mesmo evento
        } else {
          console.error('sincronizacao', id, e);
          break; // erro inesperado: os demais voltam ao app como pendentes, mantendo a ordem
        }
      }
    }
    return { resultados };
  }

  private async registrar(id: string, tipo: string, u: UsuarioToken, payload: unknown, resultado: string, codigo: string, mensagem: string, desvioMs: number) {
    await this.db.eventoSincronizacao
      .create({ data: { id, tipo, usuarioId: u.id, dispositivoId: u.dispositivoId, resultado, codigo, mensagem, payload: json(payload), desvioMs } })
      .catch(() => {});
    await auditar(this.db, u.id, 'EVENTO_REJEITADO', 'evento_sincronizacao', id, { tipo, codigo });
  }

  private async ronda(tx: Tx, rondaId: string, u: UsuarioToken): Promise<Ronda> {
    const r = await tx.ronda.findUnique({ where: { id: rondaId } });
    if (!r || r.vigilanteId !== u.id) throw new Rejeicao('RONDA_NAO_ATRIBUIDA', 'Ronda não atribuída a você.');
    if (r.status === 'CANCELADA') throw new Rejeicao('RONDA_CANCELADA', 'Ronda cancelada.');
    return r;
  }

  private async pontoDaRonda(tx: Tx, rondaId: string, pontoRondaId: string) {
    const rp = await tx.rondaPonto.findUnique({ where: { rondaId_pontoRondaId: { rondaId, pontoRondaId } } });
    if (!rp) throw new Rejeicao('PONTO_FORA_DO_ROTEIRO', 'Ponto fora do roteiro desta ronda.');
  }

  private async aplicar(tx: Tx, ev: Evento, u: UsuarioToken, desvioMs: number) {
    const agora = new Date();
    switch (ev.tipo) {
      case 'RONDA_INICIADA': {
        const d = ev.dados;
        const r = await this.ronda(tx, d.rondaId, u);
        if (INICIADA.includes(r.status)) return;
        const outra = await tx.ronda.findFirst({ where: { vigilanteId: u.id, status: 'EM_ANDAMENTO', NOT: { id: r.id } } });
        if (outra) throw new Rejeicao('OUTRA_RONDA_EM_ANDAMENTO', `Já existe outra ronda em andamento (${outra.roteiroNome}).`);
        // Horário do aparelho corrigido pelo desvio do relógio, com 5 min de folga.
        const inicio = Date.parse(d.iniciadaEmDispositivo) + desvioMs;
        const abre = r.inicioPrevisto.getTime() - (r.toleranciaInicioMin + 5) * 60_000;
        const fecha = r.fimPrevisto.getTime() + 5 * 60_000;
        if (inicio < abre || inicio > fecha) throw new Rejeicao('RONDA_FORA_DA_JANELA', 'Ronda iniciada fora da janela prevista.');
        await tx.ronda.update({
          where: { id: r.id },
          data: { status: 'EM_ANDAMENTO', iniciadaEmDispositivo: new Date(d.iniciadaEmDispositivo), iniciadaRecebidoEm: agora, inicioLocalizacao: json(d.localizacao) },
        });
        if (r.status === 'NAO_REALIZADA') await auditar(tx, u.id, 'RECONCILIAR_RONDA', 'ronda', r.id);
        return;
      }
      case 'PONTO_VISITADO': {
        const d = ev.dados;
        const r = await this.ronda(tx, d.rondaId, u);
        if (!INICIADA.includes(r.status)) throw new Rejeicao('RONDA_NAO_INICIADA', 'A ronda ainda não foi iniciada.');
        await this.pontoDaRonda(tx, r.id, d.pontoRondaId);
        if (!d.payloadNfc) throw new Rejeicao('PAYLOAD_NFC_AUSENTE', 'Leitura sem dados da tag.');
        if (await tx.visita.findUnique({ where: { rondaId_pontoRondaId: { rondaId: r.id, pontoRondaId: d.pontoRondaId } } })) return;
        const tag = await tx.tagNfc.findUnique({ where: { uidHex: d.uidHex } });
        if (tag?.ativo && tag.pontoRondaId !== d.pontoRondaId) throw new Rejeicao('TAG_NAO_PERTENCE_AO_PONTO', 'Esta tag está vinculada a outro ponto.');
        const validacaoTag = d.payloadNfc.startsWith('QR:') ? 'QR_CODE' : tag?.ativo ? 'VALIDA' : 'NAO_VINCULADA';
        const ponto = await tx.pontoRonda.findUniqueOrThrow({ where: { id: d.pontoRondaId }, include: { predio: true } });
        const campus = await tx.campus.findUniqueOrThrow({ where: { id: r.campusId } });
        const resultadoGeo = classificarGeo(d.localizacao, ponto, campus.precisaoMaximaM);
        const sinalizar = resultadoGeo === 'FORA_AREA' || validacaoTag !== 'VALIDA' || d.localizacaoSimulada;
        await tx.visita.create({
          data: {
            id: ev.id, rondaId: r.id, pontoRondaId: d.pontoRondaId, uidHex: d.uidHex, payloadNfc: d.payloadNfc,
            lidoEmDispositivo: new Date(d.lidoEmDispositivo), recebidoEmServidor: agora, localizacao: json(d.localizacao),
            localizacaoSimulada: d.localizacaoSimulada, resultadoGeoDispositivo: d.resultadoGeoDispositivo, resultadoGeo, validacaoTag,
            foraDaOrdem: d.foraDaOrdem, statusRevisao: sinalizar ? 'PENDENTE' : 'NAO_REQUER', desvioRelogioMs: desvioMs,
            recebidoAposEncerramento: !!r.encerradaPorId,
          },
        });
        return;
      }
      case 'PONTO_CONFERIDO': {
        const d = ev.dados;
        const r = await this.ronda(tx, d.rondaId, u);
        await tx.visita.updateMany({ where: { rondaId: r.id, pontoRondaId: d.pontoRondaId }, data: { checklist: json(d.itens) } });
        return;
      }
      case 'PONTO_JUSTIFICADO': {
        const d = ev.dados;
        const r = await this.ronda(tx, d.rondaId, u);
        if (!INICIADA.includes(r.status)) throw new Rejeicao('RONDA_NAO_INICIADA', 'A ronda ainda não foi iniciada.');
        await this.pontoDaRonda(tx, r.id, d.pontoRondaId);
        if (await tx.visita.findUnique({ where: { rondaId_pontoRondaId: { rondaId: r.id, pontoRondaId: d.pontoRondaId } } })) {
          throw new Rejeicao('PONTO_JA_VISITADO', 'O ponto já foi lido nesta ronda.');
        }
        if (await tx.justificativa.findUnique({ where: { rondaId_pontoRondaId: { rondaId: r.id, pontoRondaId: d.pontoRondaId } } })) return;
        await tx.justificativa.create({
          data: { id: ev.id, rondaId: r.id, pontoRondaId: d.pontoRondaId, motivo: d.motivo, descricao: d.descricao, justificadaEmDispositivo: new Date(d.justificadaEmDispositivo), recebidoEmServidor: agora, localizacao: json(d.localizacao) },
        });
        return;
      }
      case 'OCORRENCIA_REGISTRADA': {
        const d = ev.dados;
        const r = await this.ronda(tx, d.rondaId, u);
        const tipo = await tx.tipoOcorrencia.findUnique({ where: { id: d.tipoOcorrenciaId } });
        if (!tipo?.ativo) throw new Rejeicao('TIPO_OCORRENCIA_INATIVO', 'Tipo de ocorrência inativo.');
        if (!(await tx.predio.findUnique({ where: { id: d.predioId } }))) throw new Rejeicao('DADOS_OBRIGATORIOS_AUSENTES', 'Prédio não encontrado.');
        await tx.ocorrencia.create({
          data: {
            id: ev.id, rondaId: r.id, autorId: u.id, tipoOcorrenciaId: tipo.id, gravidade: d.gravidade, descricao: d.descricao, predioId: d.predioId,
            pontoRondaId: d.pontoRondaId, detalheLocal: d.detalheLocal ?? null, resolvidoNoLocal: d.resolvidoNoLocal ?? false,
            registradaEmDispositivo: new Date(d.registradaEmDispositivo), recebidoEmServidor: agora, localizacao: json(d.localizacao),
            localizacaoSimulada: d.localizacaoSimulada, fotosAnunciadas: d.fotos, status: d.resolvidoNoLocal ? 'RESOLVIDA' : 'ABERTA',
          },
        });
        return;
      }
      case 'RONDA_FINALIZADA': {
        const d = ev.dados;
        const r = await this.ronda(tx, d.rondaId, u);
        if (r.status !== 'EM_ANDAMENTO') return;
        // Pendência = ponto obrigatório sem leitura nem justificativa (RN06), além do que o aparelho informou.
        const [pontos, visitas, justificativas] = await Promise.all([
          tx.rondaPonto.findMany({ where: { rondaId: r.id, obrigatorio: true } }),
          tx.visita.findMany({ where: { rondaId: r.id }, select: { pontoRondaId: true } }),
          tx.justificativa.findMany({ where: { rondaId: r.id }, select: { pontoRondaId: true } }),
        ]);
        const feitos = new Set([...visitas, ...justificativas].map((x) => x.pontoRondaId));
        const pendente = d.finalizadaComPendencias || pontos.some((p) => !feitos.has(p.pontoRondaId)) || justificativas.length > 0;
        await tx.ronda.update({
          where: { id: r.id },
          data: {
            status: pendente ? 'INCOMPLETA' : 'CONCLUIDA', finalizadaEmDispositivo: new Date(d.finalizadaEmDispositivo), finalizadaRecebidoEm: agora,
            fimLocalizacao: json(d.localizacao), finalizadaComPendencias: pendente, observacao: d.observacao ?? null,
          },
        });
        return;
      }
    }
  }

  @Put('ocorrencias/:ocorrenciaId/fotos/:fotoId')
  @Papeis('VIGILANTE')
  async foto(
    @Usuario() u: UsuarioToken,
    @Param('ocorrenciaId') ocorrenciaId: string,
    @Param('fotoId') fotoId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('content-sha256') hashHeader?: string,
    @Headers('x-capturada-em-dispositivo') capturadaEm?: string,
  ) {
    const corpo = req.body;
    if (!Buffer.isBuffer(corpo) || corpo.length === 0) throw new Problema(422, 'FOTO_VAZIA', 'Envie a foto como image/jpeg.');
    if (corpo.length > 2 * 1024 * 1024) throw new Problema(413, 'FOTO_MUITO_GRANDE', 'Foto acima de 2 MB.');
    const oc = await this.db.ocorrencia.findUnique({ where: { id: ocorrenciaId }, include: { fotos: { select: { id: true, sha256: true } } } });
    if (!oc || oc.autorId !== u.id) throw new Problema(404, 'OCORRENCIA_NAO_ENCONTRADA', 'Ocorrência não encontrada.');
    const hash = createHash('sha256').update(corpo).digest('hex');
    if (hashHeader && hashHeader.toLowerCase() !== hash) throw new Problema(422, 'FOTO_HASH_DIVERGENTE', 'A foto chegou diferente do enviado.');
    const anunciada = (oc.fotosAnunciadas as { fotoId: string; sha256: string }[]).find((f) => f.fotoId === fotoId);
    if (!anunciada) throw new Problema(422, 'FOTO_NAO_ANUNCIADA', 'Foto não informada na ocorrência.');
    const existente = oc.fotos.find((f) => f.id === fotoId);
    if (existente) {
      if (existente.sha256 !== hash) throw new Problema(409, 'FOTO_CONFLITO', 'Já existe outra foto com este identificador.');
      res.status(200);
      return { id: fotoId };
    }
    if (oc.fotos.length >= 5) throw new Problema(422, 'LIMITE_DE_FOTOS', 'A ocorrência já tem 5 fotos.');
    await this.db.foto.create({
      data: { id: fotoId, ocorrenciaId, sha256: hash, tamanhoBytes: corpo.length, capturadaEmDispositivo: capturadaEm && !Number.isNaN(Date.parse(capturadaEm)) ? new Date(capturadaEm) : null, dados: new Uint8Array(corpo) },
    });
    res.status(201);
    return { id: fotoId };
  }
}

export function classificarGeo(
  pos: { latitude: number; longitude: number; precisaoM: number } | null,
  ponto: { latitude: number | null; longitude: number | null; raioToleranciaM: number; predio: { latitude: number | null; longitude: number | null; raioGeofenceM: number | null } },
  precisaoMaximaM: number,
): string {
  if (!pos) return 'SEM_LOCALIZACAO';
  if (pos.precisaoM > precisaoMaximaM) return 'INDETERMINADO';
  const alvo =
    ponto.latitude != null && ponto.longitude != null
      ? { lat: ponto.latitude, lon: ponto.longitude, raio: ponto.raioToleranciaM }
      : ponto.predio.latitude != null && ponto.predio.longitude != null && ponto.predio.raioGeofenceM != null
        ? { lat: ponto.predio.latitude, lon: ponto.predio.longitude, raio: ponto.predio.raioGeofenceM }
        : null;
  if (!alvo) return 'INDETERMINADO';
  return distanciaM(pos.latitude, pos.longitude, alvo.lat, alvo.lon) - pos.precisaoM <= alvo.raio ? 'DENTRO_AREA' : 'FORA_AREA';
}
