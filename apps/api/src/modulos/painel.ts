// Acompanhamento no painel (docs/07 · 8 e docs/10): resumo do dia, rondas com linha do tempo, visitas sinalizadas,
// ocorrências com fotos e eventos recusados na sincronização.
import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Prisma, StatusOcorrencia, StatusRonda } from '@prisma/client';
import type { Response } from 'express';
import { z } from 'zod';
import { auditar, Banco, naoEncontrado, novoId, Problema, validar } from '../nucleo/base';
import { Papeis, Usuario, type UsuarioToken } from '../nucleo/auth';
import { diaLocal, diaValido, intervaloDoDia, localParaUtc, somarDias } from '../nucleo/tempo';

// O documento separa o administrador do acompanhamento; aqui ele também acompanha, a pedido da equipe.
const ACOMPANHA = ['COORDENADOR', 'RESPONSAVEL', 'ADMINISTRADOR'] as const;
const GERENCIA = ['COORDENADOR', 'ADMINISTRADOR'] as const;

function paginacao(q: { pagina?: string; tamanho?: string }) {
  const pagina = Math.max(1, Number(q.pagina) || 1);
  const tamanho = Math.min(100, Math.max(1, Number(q.tamanho) || 20));
  return { pagina, tamanho, skip: (pagina - 1) * tamanho, take: tamanho };
}

/** Ronda atrasada: não começou depois da tolerância, ou passou do fim e não terminou. */
function atraso(r: { status: StatusRonda; inicioPrevisto: Date; fimPrevisto: Date; toleranciaInicioMin: number }, agora = Date.now()) {
  if (r.status === 'AGENDADA') {
    const limite = r.inicioPrevisto.getTime() + r.toleranciaInicioMin * 60_000;
    return agora > limite ? Math.round((agora - r.inicioPrevisto.getTime()) / 60_000) : 0;
  }
  if (r.status === 'EM_ANDAMENTO' && agora > r.fimPrevisto.getTime()) return Math.round((agora - r.fimPrevisto.getTime()) / 60_000);
  return 0;
}

@Controller()
export class PainelController {
  constructor(private db: Banco) {}

  private async fuso(u: UsuarioToken) {
    return (await this.db.campus.findUniqueOrThrow({ where: { id: u.campusId } })).fuso;
  }

  private async progresso(ids: string[]) {
    const [pontos, visitas, justificativas, ocorrencias, sinalizadas] = await Promise.all([
      this.db.rondaPonto.groupBy({ by: ['rondaId'], where: { rondaId: { in: ids } }, _count: true }),
      this.db.visita.groupBy({ by: ['rondaId'], where: { rondaId: { in: ids } }, _count: true }),
      this.db.justificativa.groupBy({ by: ['rondaId'], where: { rondaId: { in: ids } }, _count: true }),
      this.db.ocorrencia.groupBy({ by: ['rondaId'], where: { rondaId: { in: ids } }, _count: true }),
      this.db.visita.groupBy({ by: ['rondaId'], where: { rondaId: { in: ids }, statusRevisao: 'PENDENTE' }, _count: true }),
    ]);
    const m = (l: { rondaId: string; _count: number }[]) => new Map(l.map((x) => [x.rondaId, x._count]));
    const [p, v, j, o, s] = [m(pontos), m(visitas), m(justificativas), m(ocorrencias), m(sinalizadas)];
    return (id: string) => ({ total: p.get(id) ?? 0, lidos: v.get(id) ?? 0, justificados: j.get(id) ?? 0, ocorrencias: o.get(id) ?? 0, sinalizadas: s.get(id) ?? 0 });
  }

  private async nomes(ids: string[]) {
    const us = await this.db.usuario.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, nome: true } });
    const m = new Map(us.map((u) => [u.id, u.nome]));
    return (id: string | null | undefined) => (id ? (m.get(id) ?? '—') : null);
  }

  @Get('painel/resumo')
  @Papeis(...ACOMPANHA)
  async resumo(@Usuario() u: UsuarioToken, @Query('data') data?: string, @Res({ passthrough: true }) res?: Response) {
    res?.setHeader('Cache-Control', 'no-store');
    const fuso = await this.fuso(u);
    const dia = diaValido(data) ? data : diaLocal(new Date(), fuso);
    const rondas = await this.db.ronda.findMany({ where: { campusId: u.campusId, inicioPrevisto: intervaloDoDia(dia, fuso) }, orderBy: { inicioPrevisto: 'asc' } });
    // Rondas em andamento que começaram em outro dia também aparecem.
    const emAndamentoAntigas = await this.db.ronda.findMany({ where: { campusId: u.campusId, status: 'EM_ANDAMENTO', inicioPrevisto: { lt: intervaloDoDia(dia, fuso).gte } } });
    const todas = [...emAndamentoAntigas, ...rondas];
    const prog = await this.progresso(todas.map((r) => r.id));
    const nome = await this.nomes(todas.map((r) => r.vigilanteId));
    const conta = (s: StatusRonda) => rondas.filter((r) => r.status === s).length;
    const linha = (r: (typeof todas)[number]) => ({
      id: r.id, roteiro: r.roteiroNome, vigilante: nome(r.vigilanteId), status: r.status, inicioPrevisto: r.inicioPrevisto, fimPrevisto: r.fimPrevisto,
      iniciadaEm: r.iniciadaEmDispositivo, atrasoMin: atraso(r), progresso: prog(r.id),
    });
    const desde = new Date(Date.now() - 864e5);
    const [visitasPendentes, ocorrenciasGraves, rejeitados, ocorrenciasRecentes] = await Promise.all([
      this.db.visita.count({ where: { statusRevisao: 'PENDENTE', ronda: { campusId: u.campusId } } }),
      this.db.ocorrencia.count({ where: { status: { in: ['ABERTA', 'EM_ATENDIMENTO'] }, gravidade: { in: ['ALTA', 'CRITICA'] }, ronda: { campusId: u.campusId } } }),
      this.db.eventoSincronizacao.count({ where: { resultado: 'REJEITADO', recebidoEm: { gte: desde } } }),
      this.db.ocorrencia.findMany({ where: { ronda: { campusId: u.campusId } }, orderBy: { recebidoEmServidor: 'desc' }, take: 8 }),
    ]);
    const tipos = new Map((await this.db.tipoOcorrencia.findMany({ where: { campusId: u.campusId } })).map((t) => [t.id, t.nome]));
    const predios = new Map((await this.db.predio.findMany({ where: { campusId: u.campusId } })).map((p) => [p.id, p.nome]));
    return {
      data: dia,
      atualizadoEm: new Date(),
      rondas: {
        agendadas: conta('AGENDADA'), emAndamento: todas.filter((r) => r.status === 'EM_ANDAMENTO').length, atrasadas: todas.filter((r) => atraso(r) > 0).length,
        concluidas: conta('CONCLUIDA'), incompletas: conta('INCOMPLETA'), naoRealizadas: conta('NAO_REALIZADA'), canceladas: conta('CANCELADA'), total: rondas.length,
      },
      alertas: { visitasPendentesRevisao: visitasPendentes, ocorrenciasAbertasAltaOuCritica: ocorrenciasGraves, eventosRecusados24h: rejeitados },
      listas: {
        emAndamento: todas.filter((r) => r.status === 'EM_ANDAMENTO').map(linha),
        atrasadas: todas.filter((r) => atraso(r) > 0).map(linha),
        doDia: rondas.map(linha),
        ocorrenciasRecentes: ocorrenciasRecentes.map((o) => ({ id: o.id, tipo: tipos.get(o.tipoOcorrenciaId), gravidade: o.gravidade, status: o.status, predio: predios.get(o.predioId), recebidoEmServidor: o.recebidoEmServidor })),
      },
    };
  }

  @Get('rondas')
  @Papeis(...ACOMPANHA)
  async rondas(@Usuario() u: UsuarioToken, @Query() q: Record<string, string>) {
    const fuso = await this.fuso(u);
    const de = diaValido(q.de) ? q.de : somarDias(diaLocal(new Date(), fuso), -7);
    const ate = diaValido(q.ate) ? q.ate : diaLocal(new Date(), fuso);
    const where: Prisma.RondaWhereInput = {
      campusId: u.campusId,
      inicioPrevisto: { gte: localParaUtc(de, '00:00', fuso), lt: localParaUtc(somarDias(ate, 1), '00:00', fuso) },
      ...(q.status ? { status: q.status as StatusRonda } : {}),
      ...(q.vigilanteId ? { vigilanteId: q.vigilanteId } : {}),
    };
    const p = paginacao(q);
    const [itens, total] = await Promise.all([this.db.ronda.findMany({ where, orderBy: { inicioPrevisto: 'desc' }, skip: p.skip, take: p.take }), this.db.ronda.count({ where })]);
    const prog = await this.progresso(itens.map((r) => r.id));
    const nome = await this.nomes(itens.map((r) => r.vigilanteId));
    return {
      itens: itens.map((r) => ({
        id: r.id, roteiro: r.roteiroNome, vigilante: nome(r.vigilanteId), status: r.status, inicioPrevisto: r.inicioPrevisto, fimPrevisto: r.fimPrevisto,
        iniciadaEm: r.iniciadaEmDispositivo, finalizadaEm: r.finalizadaEmDispositivo, atrasoMin: atraso(r), progresso: prog(r.id),
      })),
      pagina: p.pagina, tamanho: p.tamanho, total, de, ate,
    };
  }

  @Get('rondas/:id')
  @Papeis(...ACOMPANHA)
  async ronda(@Usuario() u: UsuarioToken, @Param('id') id: string) {
    const r = await this.db.ronda.findFirst({
      where: { id, campusId: u.campusId },
      include: { pontos: { orderBy: { ordem: 'asc' } }, visitas: true, justificativas: true, ocorrencias: true },
    });
    if (!r) throw naoEncontrado('Ronda');
    const pontos = await this.db.pontoRonda.findMany({ where: { id: { in: r.pontos.map((p) => p.pontoRondaId) } }, include: { predio: true, andar: true } });
    const pm = new Map(pontos.map((p) => [p.id, p]));
    const tipos = new Map((await this.db.tipoOcorrencia.findMany({ where: { campusId: u.campusId } })).map((t) => [t.id, t.nome]));
    const nome = await this.nomes([r.vigilanteId, r.encerradaPorId ?? '', r.canceladaPorId ?? '', ...r.visitas.map((v) => v.revisadaPorId ?? '')]);
    const pontoNome = (id: string | null) => (id ? (pm.get(id)?.nome ?? '—') : null);
    const situacao = (pid: string) => {
      const v = r.visitas.find((x) => x.pontoRondaId === pid);
      if (v) return v.statusRevisao === 'REJEITADA' ? 'VISITA_INVALIDA' : v.statusRevisao === 'PENDENTE' ? 'VISITA_SINALIZADA' : 'VISITADO';
      return r.justificativas.some((x) => x.pontoRondaId === pid) ? 'JUSTIFICADO' : 'PENDENTE';
    };
    const linhaDoTempo = [
      r.iniciadaEmDispositivo && { tipo: 'INICIO', emDispositivo: r.iniciadaEmDispositivo, recebidoEmServidor: r.iniciadaRecebidoEm, localizacao: r.inicioLocalizacao },
      ...r.visitas.map((v) => ({
        tipo: 'VISITA', id: v.id, ponto: pontoNome(v.pontoRondaId), emDispositivo: v.lidoEmDispositivo, recebidoEmServidor: v.recebidoEmServidor,
        resultadoGeo: v.resultadoGeo, validacaoTag: v.validacaoTag, statusRevisao: v.statusRevisao, foraDaOrdem: v.foraDaOrdem, localizacaoSimulada: v.localizacaoSimulada,
        uidHex: v.uidHex, localizacao: v.localizacao, checklist: v.checklist, desvioRelogioMs: v.desvioRelogioMs, recebidoAposEncerramento: v.recebidoAposEncerramento,
        revisadaPor: nome(v.revisadaPorId), observacaoRevisao: v.observacaoRevisao,
      })),
      ...r.justificativas.map((j) => ({ tipo: 'JUSTIFICATIVA', id: j.id, ponto: pontoNome(j.pontoRondaId), motivo: j.motivo, descricao: j.descricao, emDispositivo: j.justificadaEmDispositivo, recebidoEmServidor: j.recebidoEmServidor })),
      ...r.ocorrencias.map((o) => ({ tipo: 'OCORRENCIA', id: o.id, tipoOcorrencia: tipos.get(o.tipoOcorrenciaId), gravidade: o.gravidade, status: o.status, ponto: pontoNome(o.pontoRondaId), emDispositivo: o.registradaEmDispositivo, recebidoEmServidor: o.recebidoEmServidor })),
      r.finalizadaEmDispositivo && { tipo: 'FIM', emDispositivo: r.finalizadaEmDispositivo, recebidoEmServidor: r.finalizadaRecebidoEm, finalizadaComPendencias: r.finalizadaComPendencias, observacao: r.observacao },
    ]
      .filter(Boolean)
      .sort((a, b) => new Date((a as { emDispositivo: Date }).emDispositivo).getTime() - new Date((b as { emDispositivo: Date }).emDispositivo).getTime());
    return {
      id: r.id, roteiro: r.roteiroNome, exigeOrdem: r.exigeOrdem, vigilante: nome(r.vigilanteId), status: r.status, atrasoMin: atraso(r),
      inicioPrevisto: r.inicioPrevisto, fimPrevisto: r.fimPrevisto, toleranciaInicioMin: r.toleranciaInicioMin,
      iniciadaEmDispositivo: r.iniciadaEmDispositivo, finalizadaEmDispositivo: r.finalizadaEmDispositivo, observacao: r.observacao,
      cancelada: r.canceladaEm ? { em: r.canceladaEm, por: nome(r.canceladaPorId) } : null,
      encerramento: r.encerradaPorId ? { motivo: r.encerramentoMotivo, por: nome(r.encerradaPorId) } : null,
      pontos: r.pontos.map((p) => {
        const pt = pm.get(p.pontoRondaId);
        return { pontoRondaId: p.pontoRondaId, nome: pt?.nome ?? '—', local: [pt?.predio.nome, pt?.andar?.nome].filter(Boolean).join(' · '), ordem: p.ordem, obrigatorio: p.obrigatorio, situacao: situacao(p.pontoRondaId) };
      }),
      linhaDoTempo,
    };
  }

  @Post('rondas/:id/encerramento')
  @Papeis(...GERENCIA)
  @HttpCode(204)
  async encerrar(@Usuario() u: UsuarioToken, @Param('id') id: string, @Body() corpo: unknown) {
    const b = validar(z.object({ motivo: z.string().trim().min(10, 'Mínimo de 10 caracteres').max(500) }), corpo);
    const r = await this.db.ronda.findFirst({ where: { id, campusId: u.campusId } });
    if (!r) throw naoEncontrado('Ronda');
    if (r.status !== 'EM_ANDAMENTO') throw new Problema(422, 'RONDA_NAO_EM_ANDAMENTO', 'Só dá para encerrar ronda em andamento.');
    await this.db.ronda.update({ where: { id }, data: { status: 'INCOMPLETA', encerramentoMotivo: b.motivo, encerradaPorId: u.id, finalizadaComPendencias: true } });
    await auditar(this.db, u.id, 'ENCERRAR_RONDA', 'ronda', id, b);
  }

  @Post('rondas/:id/cancelamento')
  @Papeis(...GERENCIA)
  @HttpCode(204)
  async cancelar(@Usuario() u: UsuarioToken, @Param('id') id: string, @Body() corpo: unknown) {
    const b = validar(z.object({ motivo: z.string().trim().min(3).max(500) }), corpo);
    const r = await this.db.ronda.findFirst({ where: { id, campusId: u.campusId } });
    if (!r) throw naoEncontrado('Ronda');
    if (r.status !== 'AGENDADA') throw new Problema(422, 'RONDA_NAO_AGENDADA', 'Só dá para cancelar ronda que ainda não começou.');
    await this.db.ronda.update({ where: { id }, data: { status: 'CANCELADA', canceladaEm: new Date(), canceladaPorId: u.id } });
    await auditar(this.db, u.id, 'CANCELAR_RONDA', 'ronda', id, b);
  }

  @Get('visitas')
  @Papeis(...ACOMPANHA)
  async visitas(@Usuario() u: UsuarioToken, @Query('statusRevisao') status = 'PENDENTE') {
    const vs = await this.db.visita.findMany({
      where: { statusRevisao: status as 'PENDENTE', ronda: { campusId: u.campusId } },
      include: { ronda: true },
      orderBy: { recebidoEmServidor: 'desc' },
      take: 200,
    });
    const pontos = new Map((await this.db.pontoRonda.findMany({ where: { id: { in: vs.map((v) => v.pontoRondaId) } } })).map((p) => [p.id, p.nome]));
    const nome = await this.nomes(vs.map((v) => v.ronda.vigilanteId));
    return {
      itens: vs.map((v) => ({
        id: v.id, rondaId: v.rondaId, roteiro: v.ronda.roteiroNome, vigilante: nome(v.ronda.vigilanteId), ponto: pontos.get(v.pontoRondaId), lidoEm: v.lidoEmDispositivo,
        resultadoGeo: v.resultadoGeo, validacaoTag: v.validacaoTag, localizacaoSimulada: v.localizacaoSimulada, foraDaOrdem: v.foraDaOrdem, uidHex: v.uidHex, statusRevisao: v.statusRevisao,
      })),
    };
  }

  @Post('visitas/:id/revisao')
  @Papeis(...GERENCIA)
  @HttpCode(204)
  async revisar(@Usuario() u: UsuarioToken, @Param('id') id: string, @Body() corpo: unknown) {
    const b = validar(
      z.object({ decisao: z.enum(['ACEITA', 'REJEITADA']), observacao: z.string().trim().max(1000).optional() }).refine((x) => x.decisao === 'ACEITA' || (x.observacao?.length ?? 0) >= 10, {
        message: 'Explique a rejeição (mínimo de 10 caracteres)',
        path: ['observacao'],
      }),
      corpo,
    );
    const v = await this.db.visita.findFirst({ where: { id, ronda: { campusId: u.campusId } } });
    if (!v) throw naoEncontrado('Visita');
    if (v.statusRevisao !== 'PENDENTE') throw new Problema(409, 'VISITA_JA_REVISADA', 'Esta visita já foi revisada.');
    await this.db.visita.update({ where: { id }, data: { statusRevisao: b.decisao, revisadaPorId: u.id, revisadaEm: new Date(), observacaoRevisao: b.observacao ?? null } });
    await auditar(this.db, u.id, 'REVISAR_VISITA', 'visita', id, b);
  }

  @Get('ocorrencias')
  @Papeis(...ACOMPANHA)
  async ocorrencias(@Usuario() u: UsuarioToken, @Query() q: Record<string, string>) {
    const where: Prisma.OcorrenciaWhereInput = {
      ronda: { campusId: u.campusId },
      ...(q.status ? { status: q.status as StatusOcorrencia } : {}),
      ...(q.gravidade ? { gravidade: q.gravidade as 'ALTA' } : {}),
    };
    const p = paginacao(q);
    const [itens, total] = await Promise.all([
      this.db.ocorrencia.findMany({ where, orderBy: { recebidoEmServidor: 'desc' }, skip: p.skip, take: p.take, include: { _count: { select: { fotos: true } }, ronda: true } }),
      this.db.ocorrencia.count({ where }),
    ]);
    const tipos = new Map((await this.db.tipoOcorrencia.findMany({ where: { campusId: u.campusId } })).map((t) => [t.id, t.nome]));
    const predios = new Map((await this.db.predio.findMany({ where: { campusId: u.campusId } })).map((x) => [x.id, x.nome]));
    const nome = await this.nomes(itens.map((o) => o.autorId));
    return {
      itens: itens.map((o) => ({
        id: o.id, tipo: tipos.get(o.tipoOcorrenciaId), gravidade: o.gravidade, status: o.status, predio: predios.get(o.predioId), detalheLocal: o.detalheLocal,
        descricao: o.descricao, autor: nome(o.autorId), roteiro: o.ronda.roteiroNome, registradaEm: o.registradaEmDispositivo, recebidoEmServidor: o.recebidoEmServidor, fotos: o._count.fotos,
      })),
      pagina: p.pagina, tamanho: p.tamanho, total,
    };
  }

  @Get('ocorrencias/:id')
  @Papeis(...ACOMPANHA)
  async ocorrencia(@Usuario() u: UsuarioToken, @Param('id') id: string) {
    const o = await this.db.ocorrencia.findFirst({
      where: { id, ronda: { campusId: u.campusId } },
      include: { ronda: true, fotos: { select: { id: true, tamanhoBytes: true, capturadaEmDispositivo: true } }, historico: { orderBy: { em: 'asc' } } },
    });
    if (!o) throw naoEncontrado('Ocorrência');
    const [tipo, predio, ponto] = await Promise.all([
      this.db.tipoOcorrencia.findUnique({ where: { id: o.tipoOcorrenciaId } }),
      this.db.predio.findUnique({ where: { id: o.predioId } }),
      o.pontoRondaId ? this.db.pontoRonda.findUnique({ where: { id: o.pontoRondaId } }) : null,
    ]);
    const nome = await this.nomes([o.autorId, ...o.historico.map((h) => h.usuarioId)]);
    const anunciadas = (o.fotosAnunciadas as unknown[]).length;
    return {
      id: o.id, tipo: tipo?.nome, gravidade: o.gravidade, status: o.status, descricao: o.descricao, predio: predio?.nome, ponto: ponto?.nome ?? null, detalheLocal: o.detalheLocal,
      resolvidoNoLocal: o.resolvidoNoLocal, autor: nome(o.autorId), rondaId: o.rondaId, roteiro: o.ronda.roteiroNome, registradaEm: o.registradaEmDispositivo,
      recebidoEmServidor: o.recebidoEmServidor, localizacao: o.localizacao, localizacaoSimulada: o.localizacaoSimulada,
      fotos: o.fotos, fotosPendentes: Math.max(0, anunciadas - o.fotos.length),
      historico: o.historico.map((h) => ({ de: h.de, para: h.para, comentario: h.comentario, por: nome(h.usuarioId), em: h.em })),
    };
  }

  @Post('ocorrencias/:id/status')
  @Papeis(...GERENCIA)
  @HttpCode(204)
  async status(@Usuario() u: UsuarioToken, @Param('id') id: string, @Body() corpo: unknown) {
    const b = validar(z.object({ statusNovo: z.enum(['EM_ATENDIMENTO', 'RESOLVIDA', 'ARQUIVADA']), comentario: z.string().trim().max(1000).optional() }), corpo);
    const o = await this.db.ocorrencia.findFirst({ where: { id, ronda: { campusId: u.campusId } } });
    if (!o) throw naoEncontrado('Ocorrência');
    const permitidas: Record<string, string[]> = { ABERTA: ['EM_ATENDIMENTO', 'ARQUIVADA', 'RESOLVIDA'], EM_ATENDIMENTO: ['RESOLVIDA'], RESOLVIDA: ['ARQUIVADA'], ARQUIVADA: [] };
    if (!permitidas[o.status].includes(b.statusNovo)) throw new Problema(422, 'TRANSICAO_INVALIDA', `Não dá para passar de ${o.status} para ${b.statusNovo}.`);
    if (['RESOLVIDA', 'ARQUIVADA'].includes(b.statusNovo) && !b.comentario) throw new Problema(422, 'COMENTARIO_OBRIGATORIO', 'Escreva um comentário.');
    await this.db.$transaction([
      this.db.ocorrencia.update({ where: { id }, data: { status: b.statusNovo } }),
      this.db.ocorrenciaStatus.create({ data: { id: novoId(), ocorrenciaId: id, de: o.status, para: b.statusNovo, comentario: b.comentario ?? null, usuarioId: u.id } }),
    ]);
    await auditar(this.db, u.id, 'MUDAR_STATUS_OCORRENCIA', 'ocorrencia', id, { de: o.status, para: b.statusNovo });
  }

  /** Foto da ocorrência (cada visualização é auditada). */
  @Get('ocorrencias/:id/fotos/:fotoId')
  @Papeis(...ACOMPANHA)
  async foto(@Usuario() u: UsuarioToken, @Param('id') id: string, @Param('fotoId') fotoId: string, @Res() res: Response) {
    const f = await this.db.foto.findFirst({ where: { id: fotoId, ocorrenciaId: id, ocorrencia: { ronda: { campusId: u.campusId } } } });
    if (!f) throw naoEncontrado('Foto');
    await auditar(this.db, u.id, 'VISUALIZAR_FOTO', 'foto', fotoId);
    res.setHeader('Cache-Control', 'private, no-store');
    res.type('image/jpeg').send(Buffer.from(f.dados));
  }

  /** Eventos que o servidor recusou: o que chegou do app e não entrou (para saber se está tudo certo). */
  @Get('sincronizacao/recusados')
  @Papeis(...ACOMPANHA)
  async recusados() {
    const evs = await this.db.eventoSincronizacao.findMany({ where: { resultado: 'REJEITADO' }, orderBy: { recebidoEm: 'desc' }, take: 100 });
    const nome = await this.nomes(evs.map((e) => e.usuarioId));
    return { itens: evs.map((e) => ({ id: e.id, tipo: e.tipo, usuario: nome(e.usuarioId), codigo: e.codigo, mensagem: e.mensagem, recebidoEm: e.recebidoEm })) };
  }
}
