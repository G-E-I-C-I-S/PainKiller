// Rotas do app: rondas do vigilante, pacote offline com ETag e modo instalação de tags (docs/07 · 6).
import { Body, Controller, Get, Headers, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { auditar, Banco, novoId, Problema, validar } from '../nucleo/base';
import { Papeis, Usuario, type UsuarioToken } from '../nucleo/auth';
import { VERSAO_AVISO } from './identidade';

export const uidValido = z.string().regex(/^[0-9A-F]{8,20}$/, 'UID em hexadecimal maiúsculo');

@Controller('vigilante')
export class VigilanteController {
  constructor(private db: Banco) {}

  @Get('rondas')
  @Papeis('VIGILANTE', 'ADMINISTRADOR')
  async rondas(@Usuario() u: UsuarioToken, @Query('de') de?: string, @Query('ate') ate?: string) {
    const dia = (s: string | undefined, delta: number) => {
      const d = s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : new Date();
      return new Date(d.getTime() + delta * 864e5);
    };
    // Margem de 1 dia para cobrir o fuso do campus.
    const itens = await this.db.ronda.findMany({
      where: { vigilanteId: u.id, inicioPrevisto: { gte: dia(de, -1), lt: dia(ate, 2) } },
      include: { pontos: { orderBy: { ordem: 'asc' } } },
      orderBy: { inicioPrevisto: 'asc' },
    });
    return {
      itens: itens.map((r) => ({
        id: r.id,
        roteiro: { id: r.roteiroId, nome: r.roteiroNome, exigeOrdem: r.exigeOrdem },
        status: r.status,
        inicioPrevisto: r.inicioPrevisto.toISOString(),
        fimPrevisto: r.fimPrevisto.toISOString(),
        toleranciaInicioMin: r.toleranciaInicioMin,
        pontos: r.pontos.map((p) => ({ pontoRondaId: p.pontoRondaId, ordem: p.ordem, obrigatorio: p.obrigatorio })),
        canceladaEm: r.canceladaEm?.toISOString() ?? null,
      })),
      atualizadoEm: new Date().toISOString(),
    };
  }

  @Get('pacote-offline')
  @Papeis('VIGILANTE', 'ADMINISTRADOR')
  async pacote(@Usuario() u: UsuarioToken, @Headers('if-none-match') etag: string | undefined, @Res({ passthrough: true }) res: Response) {
    const campus = await this.db.campus.findUniqueOrThrow({ where: { id: u.campusId } });
    const predios = await this.db.predio.findMany({ where: { campusId: u.campusId, ativo: true }, orderBy: { codigo: 'asc' } });
    const ids = predios.map((p) => p.id);
    const [andares, pontos, tipos] = await Promise.all([
      this.db.andar.findMany({ where: { predioId: { in: ids }, ativo: true } }),
      this.db.pontoRonda.findMany({ where: { predioId: { in: ids }, ativo: true } }),
      this.db.tipoOcorrencia.findMany({ where: { campusId: u.campusId, ativo: true }, orderBy: { ordemExibicao: 'asc' } }),
    ]);
    const tags = await this.db.tagNfc.findMany({ where: { ativo: true, pontoRondaId: { in: pontos.map((p) => p.id) } } });
    const conteudo = {
      campus: {
        id: campus.id,
        nome: campus.nome,
        configuracao: {
          politicaGeo: campus.politicaGeo,
          precisaoMaximaM: campus.precisaoMaximaM,
          toleranciaInicioMin: campus.toleranciaInicioMin,
          inatividadeBloqueioMin: campus.inatividadeBloqueioMin,
          limiteDesvioRelogioMin: campus.limiteDesvioRelogioMin,
        },
      },
      predios: predios.map((p) => ({ id: p.id, codigo: p.codigo, nome: p.nome, latitude: p.latitude, longitude: p.longitude, raioGeofenceM: p.raioGeofenceM })),
      andares: andares.map((a) => ({ id: a.id, predioId: a.predioId, nome: a.nome, ordem: a.ordem })),
      setores: [],
      pontos: pontos.map((p) => ({
        id: p.id, predioId: p.predioId, andarId: p.andarId, setorId: null, nome: p.nome, instrucoes: p.instrucoes,
        latitude: p.latitude, longitude: p.longitude, raioToleranciaM: p.raioToleranciaM,
      })),
      tags: tags.map((t) => ({ uidHex: t.uidHex, tipo: t.tipo, pontoRondaId: t.pontoRondaId })),
      tiposOcorrencia: tipos.map((t) => ({ id: t.id, nome: t.nome, gravidadePadrao: t.gravidadePadrao, ordemExibicao: t.ordemExibicao })),
      avisoPrivacidade: { versao: VERSAO_AVISO },
    };
    const versao = `pk-${createHash('sha256').update(JSON.stringify(conteudo)).digest('hex').slice(0, 12)}`;
    res.setHeader('ETag', `"${versao}"`);
    if (etag && etag.replace(/"/g, '') === versao) {
      res.status(304);
      return;
    }
    return { versao, geradoEm: new Date().toISOString(), ...conteudo };
  }
}

@Controller('tags-nfc')
export class TagsController {
  constructor(private db: Banco) {}

  @Get()
  @Papeis('ADMINISTRADOR', 'COORDENADOR')
  async listar(@Query('uid') uid?: string) {
    const tags = await this.db.tagNfc.findMany({ where: uid ? { uidHex: uid.toUpperCase() } : {}, include: { ponto: true }, orderBy: { vinculadaEm: 'desc' } });
    return { itens: tags.map((t) => ({ id: t.id, uidHex: t.uidHex, tipo: t.tipo, ativo: t.ativo, vinculadaEm: t.vinculadaEm, ponto: { id: t.ponto.id, nome: t.ponto.nome } })) };
  }

  /** Vincula (ou revincula) a tag ao ponto. Gravar o ponto na própria tag é feito pelo app. */
  @Post()
  @Papeis('ADMINISTRADOR')
  async vincular(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(z.object({ pontoRondaId: z.string().uuid(), uidHex: uidValido, tipo: z.enum(['NTAG424_DNA', 'NTAG215_LEGADA']), leituraSun: z.string().nullable().optional() }), corpo);
    const ponto = await this.db.pontoRonda.findFirst({ where: { id: b.pontoRondaId, predio: { campusId: u.campusId } } });
    if (!ponto) throw new Problema(404, 'PONTO_NAO_ENCONTRADO', 'Ponto não encontrado.');
    const tag = await this.db.$transaction(async (tx) => {
      // Um ponto tem uma tag ativa: a anterior é desativada (substituição).
      await tx.tagNfc.updateMany({ where: { pontoRondaId: ponto.id, ativo: true, NOT: { uidHex: b.uidHex } }, data: { ativo: false } });
      const t = await tx.tagNfc.upsert({
        where: { uidHex: b.uidHex },
        update: { pontoRondaId: ponto.id, tipo: b.tipo, ativo: true, vinculadaEm: new Date(), vinculadaPorId: u.id },
        create: { id: novoId(), uidHex: b.uidHex, tipo: b.tipo, pontoRondaId: ponto.id, vinculadaPorId: u.id },
      });
      await auditar(tx, u.id, 'VINCULAR_TAG', 'tag_nfc', t.id, { uidHex: b.uidHex, pontoRondaId: ponto.id });
      return t;
    });
    return { id: tag.id, uidHex: tag.uidHex, tipo: tag.tipo, pontoRondaId: tag.pontoRondaId };
  }
}
