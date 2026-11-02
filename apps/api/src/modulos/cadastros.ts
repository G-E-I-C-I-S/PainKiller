// Cadastros (docs/07 · 9) e planejamento (roteiros, agendas e ronda avulsa). Sem DELETE: desativação com motivo (RN14).
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { auditar, Banco, naoEncontrado, novoId, Problema, validar } from '../nucleo/base';
import { Papeis, Usuario, type UsuarioToken } from '../nucleo/auth';
import { Agendamento } from './agendamento';

const lat = z.number().min(-90).max(90).nullable();
const lon = z.number().min(-180).max(180).nullable();
const id = z.string().uuid();
const LEITURA = ['ADMINISTRADOR', 'COORDENADOR'] as const;

const Predio = z.object({ codigo: z.string().trim().min(1).max(20), nome: z.string().trim().min(2).max(120), latitude: lat.optional(), longitude: lon.optional(), raioGeofenceM: z.number().min(1).max(2000).nullable().optional() });
const Andar = z.object({ predioId: id, nome: z.string().trim().min(1).max(60), ordem: z.number().int().optional() });
const Ponto = z.object({
  predioId: id, andarId: id.nullable().optional(), nome: z.string().trim().min(2).max(120), instrucoes: z.string().max(500).nullable().optional(),
  latitude: lat.optional(), longitude: lon.optional(), raioToleranciaM: z.number().min(1).max(2000).optional(),
});
const Tipo = z.object({ nome: z.string().trim().min(2).max(80), gravidadePadrao: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA']), ordemExibicao: z.number().int().optional() });
const NovoUsuario = z.object({
  nome: z.string().trim().min(2).max(120), matricula: z.string().trim().min(2).max(60),
  papel: z.enum(['VIGILANTE', 'COORDENADOR', 'RESPONSAVEL', 'ADMINISTRADOR']), senha: z.string().min(6).max(200).optional(),
});
const PontosRoteiro = z.array(z.object({ pontoRondaId: id, obrigatorio: z.boolean().default(true) })).min(1, 'Escolha ao menos um ponto');
const Roteiro = z.object({ nome: z.string().trim().min(2).max(120), exigeOrdem: z.boolean().default(false), pontos: PontosRoteiro });
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no formato HH:MM');
const Agenda = z.object({
  roteiroId: id, vigilanteId: id, diasSemana: z.array(z.number().int().min(0).max(6)).min(1, 'Escolha ao menos um dia'),
  horaInicio: hora, duracaoMin: z.number().int().min(10).max(24 * 60), toleranciaInicioMin: z.number().int().min(0).max(240).optional(),
});
const Avulsa = z.object({ roteiroId: id, vigilanteId: id, inicioPrevisto: z.string().datetime({ offset: true }), duracaoMin: z.number().int().min(10).max(24 * 60), toleranciaInicioMin: z.number().int().min(0).max(240).optional() });

const senhaTemporaria = () => String(randomInt(100000, 1000000));

@Controller()
export class CadastrosController {
  constructor(
    private db: Banco,
    private agendamento: Agendamento,
  ) {}

  // ---------- Campus ----------
  @Get('campus')
  @Papeis(...LEITURA)
  campus(@Usuario() u: UsuarioToken) {
    return this.db.campus.findUniqueOrThrow({ where: { id: u.campusId } });
  }

  @Patch('campus')
  @Papeis('ADMINISTRADOR')
  async alterarCampus(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(
      z.object({
        nome: z.string().trim().min(2).max(120), politicaGeo: z.enum(['SINALIZAR', 'BLOQUEAR']), precisaoMaximaM: z.number().int().min(5).max(1000),
        toleranciaInicioMin: z.number().int().min(0).max(240), inatividadeBloqueioMin: z.number().int().min(1).max(120),
      }).partial(),
      corpo,
    );
    const c = await this.db.campus.update({ where: { id: u.campusId }, data: b });
    await auditar(this.db, u.id, 'ATUALIZAR', 'campus', c.id, b);
    return c;
  }

  // ---------- Prédios e andares ----------
  @Get('predios')
  @Papeis(...LEITURA)
  predios(@Usuario() u: UsuarioToken) {
    return this.db.predio.findMany({ where: { campusId: u.campusId }, orderBy: [{ ativo: 'desc' }, { codigo: 'asc' }], include: { andares: { orderBy: { ordem: 'asc' } }, _count: { select: { pontos: true } } } });
  }

  @Post('predios')
  @Papeis('ADMINISTRADOR')
  async criarPredio(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(Predio, corpo);
    if (await this.db.predio.findUnique({ where: { campusId_codigo: { campusId: u.campusId, codigo: b.codigo } } })) throw new Problema(409, 'CODIGO_DUPLICADO', 'Já existe um prédio com esse código.');
    const p = await this.db.predio.create({ data: { id: novoId(), campusId: u.campusId, ...b } });
    await auditar(this.db, u.id, 'CRIAR', 'predio', p.id, b);
    return p;
  }

  @Patch('predios/:id')
  @Papeis('ADMINISTRADOR')
  async alterarPredio(@Usuario() u: UsuarioToken, @Param('id') pid: string, @Body() corpo: unknown) {
    const b = validar(Predio.partial(), corpo);
    await this.doCampus('predio', pid, u);
    const p = await this.db.predio.update({ where: { id: pid }, data: b });
    await auditar(this.db, u.id, 'ATUALIZAR', 'predio', pid, b);
    return p;
  }

  @Post('andares')
  @Papeis('ADMINISTRADOR')
  async criarAndar(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(Andar, corpo);
    await this.doCampus('predio', b.predioId, u);
    const a = await this.db.andar.create({ data: { id: novoId(), ...b } });
    await auditar(this.db, u.id, 'CRIAR', 'andar', a.id, b);
    return a;
  }

  // ---------- Pontos de ronda ----------
  @Get('pontos-ronda')
  @Papeis(...LEITURA)
  async pontos(@Usuario() u: UsuarioToken) {
    const ps = await this.db.pontoRonda.findMany({
      where: { predio: { campusId: u.campusId } },
      include: { predio: true, andar: true, tags: { where: { ativo: true } } },
      orderBy: [{ ativo: 'desc' }, { predio: { codigo: 'asc' } }, { nome: 'asc' }],
    });
    return ps.map((p) => ({ ...p, predioNome: p.predio.nome, andarNome: p.andar?.nome ?? null, tag: p.tags[0] ? { uidHex: p.tags[0].uidHex, tipo: p.tags[0].tipo, vinculadaEm: p.tags[0].vinculadaEm } : null }));
  }

  @Post('pontos-ronda')
  @Papeis('ADMINISTRADOR')
  async criarPonto(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(Ponto, corpo);
    await this.doCampus('predio', b.predioId, u);
    const p = await this.db.pontoRonda.create({ data: { id: novoId(), ...b } });
    await auditar(this.db, u.id, 'CRIAR', 'ponto_ronda', p.id, b);
    return p;
  }

  @Patch('pontos-ronda/:id')
  @Papeis('ADMINISTRADOR')
  async alterarPonto(@Usuario() u: UsuarioToken, @Param('id') pid: string, @Body() corpo: unknown) {
    const b = validar(Ponto.partial(), corpo);
    await this.doCampus('ponto', pid, u);
    const p = await this.db.pontoRonda.update({ where: { id: pid }, data: b });
    await auditar(this.db, u.id, 'ATUALIZAR', 'ponto_ronda', pid, b);
    return p;
  }

  // ---------- Tipos de ocorrência ----------
  @Get('tipos-ocorrencia')
  @Papeis(...LEITURA)
  tipos(@Usuario() u: UsuarioToken) {
    return this.db.tipoOcorrencia.findMany({ where: { campusId: u.campusId }, orderBy: [{ ativo: 'desc' }, { ordemExibicao: 'asc' }] });
  }

  @Post('tipos-ocorrencia')
  @Papeis('ADMINISTRADOR')
  async criarTipo(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(Tipo, corpo);
    const ordem = b.ordemExibicao ?? (await this.db.tipoOcorrencia.count({ where: { campusId: u.campusId } })) + 1;
    const t = await this.db.tipoOcorrencia.create({ data: { id: novoId(), campusId: u.campusId, nome: b.nome, gravidadePadrao: b.gravidadePadrao, ordemExibicao: ordem } });
    await auditar(this.db, u.id, 'CRIAR', 'tipo_ocorrencia', t.id, b);
    return t;
  }

  @Patch('tipos-ocorrencia/:id')
  @Papeis('ADMINISTRADOR')
  async alterarTipo(@Usuario() u: UsuarioToken, @Param('id') tid: string, @Body() corpo: unknown) {
    const b = validar(Tipo.partial(), corpo);
    await this.doCampus('tipo', tid, u);
    const t = await this.db.tipoOcorrencia.update({ where: { id: tid }, data: b });
    await auditar(this.db, u.id, 'ATUALIZAR', 'tipo_ocorrencia', tid, b);
    return t;
  }

  // ---------- Usuários e aparelhos ----------
  @Get('usuarios')
  @Papeis(...LEITURA)
  async usuarios(@Usuario() u: UsuarioToken, @Query('papel') papel?: string) {
    const us = await this.db.usuario.findMany({
      where: { campusId: u.campusId, ...(papel ? { papel: papel as 'VIGILANTE' } : {}), ...(u.papel === 'COORDENADOR' ? { papel: 'VIGILANTE' } : {}) },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
    return us.map(({ senhaHash: _, ...x }) => x);
  }

  @Post('usuarios')
  @Papeis('ADMINISTRADOR')
  async criarUsuario(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(NovoUsuario, corpo);
    if (await this.db.usuario.findUnique({ where: { matricula: b.matricula } })) throw new Problema(409, 'MATRICULA_DUPLICADA', 'Já existe usuário com essa matrícula.');
    const senha = b.senha ?? senhaTemporaria();
    const novo = await this.db.usuario.create({
      data: { id: novoId(), campusId: u.campusId, nome: b.nome, matricula: b.matricula, papel: b.papel, senhaHash: await bcrypt.hash(senha, 10), deveTrocarSenha: !b.senha },
    });
    await auditar(this.db, u.id, 'CRIAR', 'usuario', novo.id, { nome: b.nome, matricula: b.matricula, papel: b.papel });
    return { id: novo.id, senhaTemporaria: b.senha ? null : senha };
  }

  @Patch('usuarios/:id')
  @Papeis('ADMINISTRADOR')
  async alterarUsuario(@Usuario() u: UsuarioToken, @Param('id') uid: string, @Body() corpo: unknown) {
    const b = validar(NovoUsuario.omit({ senha: true, matricula: true }).partial(), corpo);
    await this.doCampus('usuario', uid, u);
    await this.db.usuario.update({ where: { id: uid }, data: b });
    await auditar(this.db, u.id, 'ATUALIZAR', 'usuario', uid, b);
    return { id: uid };
  }

  @Post('usuarios/:id/redefinicao-senha')
  @Papeis('ADMINISTRADOR')
  async redefinirSenha(@Usuario() u: UsuarioToken, @Param('id') uid: string) {
    await this.doCampus('usuario', uid, u);
    const senha = senhaTemporaria();
    await this.db.usuario.update({ where: { id: uid }, data: { senhaHash: await bcrypt.hash(senha, 10), deveTrocarSenha: true } });
    await this.db.sessao.updateMany({ where: { usuarioId: uid, revogadaEm: null }, data: { revogadaEm: new Date() } });
    await auditar(this.db, u.id, 'REDEFINIR_SENHA', 'usuario', uid);
    return { senhaTemporaria: senha };
  }

  @Get('dispositivos')
  @Papeis('ADMINISTRADOR')
  async dispositivos(@Usuario() u: UsuarioToken) {
    const ds = await this.db.dispositivo.findMany({ where: { usuario: { campusId: u.campusId } }, include: { usuario: { select: { nome: true, matricula: true } } }, orderBy: { ultimoAcessoEm: 'desc' } });
    return ds;
  }

  @Post('dispositivos/:id/revogacao')
  @Papeis('ADMINISTRADOR')
  @HttpCode(204)
  async revogar(@Usuario() u: UsuarioToken, @Param('id') did: string) {
    const d = await this.db.dispositivo.findFirst({ where: { id: did, usuario: { campusId: u.campusId } } });
    if (!d) throw naoEncontrado('Aparelho');
    await this.db.dispositivo.update({ where: { id: did }, data: { revogadoEm: new Date() } });
    await this.db.sessao.updateMany({ where: { dispositivoId: did, revogadaEm: null }, data: { revogadaEm: new Date() } });
    await auditar(this.db, u.id, 'REVOGAR_DISPOSITIVO', 'dispositivo', did);
  }

  // ---------- Roteiros, agendas e ronda avulsa ----------
  @Get('roteiros')
  @Papeis(...LEITURA)
  roteiros(@Usuario() u: UsuarioToken) {
    return this.db.roteiro.findMany({ where: { campusId: u.campusId }, include: { pontos: { orderBy: { ordem: 'asc' } }, _count: { select: { agendas: true } } }, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] });
  }

  @Post('roteiros')
  @Papeis(...LEITURA)
  async criarRoteiro(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(Roteiro, corpo);
    await this.pontosDoCampus(b.pontos.map((p) => p.pontoRondaId), u);
    const r = await this.db.roteiro.create({
      data: { id: novoId(), campusId: u.campusId, nome: b.nome, exigeOrdem: b.exigeOrdem, pontos: { create: b.pontos.map((p, i) => ({ pontoRondaId: p.pontoRondaId, ordem: i + 1, obrigatorio: p.obrigatorio })) } },
    });
    await auditar(this.db, u.id, 'CRIAR', 'roteiro', r.id, b);
    return r;
  }

  @Patch('roteiros/:id')
  @Papeis(...LEITURA)
  async alterarRoteiro(@Usuario() u: UsuarioToken, @Param('id') rid: string, @Body() corpo: unknown) {
    const b = validar(Roteiro.partial(), corpo);
    await this.doCampus('roteiro', rid, u);
    if (b.pontos) await this.pontosDoCampus(b.pontos.map((p) => p.pontoRondaId), u);
    // Rondas já geradas guardam a cópia dos pontos; a mudança vale para as próximas.
    await this.db.$transaction(async (tx) => {
      await tx.roteiro.update({ where: { id: rid }, data: { nome: b.nome, exigeOrdem: b.exigeOrdem } });
      if (b.pontos) {
        await tx.roteiroPonto.deleteMany({ where: { roteiroId: rid } });
        await tx.roteiroPonto.createMany({ data: b.pontos.map((p, i) => ({ roteiroId: rid, pontoRondaId: p.pontoRondaId, ordem: i + 1, obrigatorio: p.obrigatorio })) });
      }
    });
    await auditar(this.db, u.id, 'ATUALIZAR', 'roteiro', rid, b);
    return { id: rid };
  }

  @Get('agendas')
  @Papeis(...LEITURA)
  async agendas(@Usuario() u: UsuarioToken) {
    return this.db.agenda.findMany({
      where: { roteiro: { campusId: u.campusId } },
      include: { roteiro: { select: { nome: true } }, vigilante: { select: { nome: true } } },
      orderBy: [{ ativo: 'desc' }, { horaInicio: 'asc' }],
    });
  }

  @Post('agendas')
  @Papeis(...LEITURA)
  async criarAgenda(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(Agenda, corpo);
    await this.doCampus('roteiro', b.roteiroId, u);
    await this.vigilanteDoCampus(b.vigilanteId, u);
    const campus = await this.db.campus.findUniqueOrThrow({ where: { id: u.campusId } });
    const a = await this.db.agenda.create({ data: { id: novoId(), ...b, toleranciaInicioMin: b.toleranciaInicioMin ?? campus.toleranciaInicioMin } });
    await auditar(this.db, u.id, 'CRIAR', 'agenda', a.id, b);
    await this.agendamento.gerar();
    return a;
  }

  @Patch('agendas/:id')
  @Papeis(...LEITURA)
  async alterarAgenda(@Usuario() u: UsuarioToken, @Param('id') aid: string, @Body() corpo: unknown) {
    const b = validar(Agenda.partial(), corpo);
    await this.doCampus('agenda', aid, u);
    if (b.vigilanteId) await this.vigilanteDoCampus(b.vigilanteId, u);
    await this.agendamento.cancelarFuturas(aid, u.id);
    const a = await this.db.agenda.update({ where: { id: aid }, data: { ...b, geradaAte: null } });
    await auditar(this.db, u.id, 'ATUALIZAR', 'agenda', aid, b);
    await this.agendamento.gerar();
    return a;
  }

  @Post('rondas')
  @Papeis(...LEITURA)
  async avulsa(@Usuario() u: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(Avulsa, corpo);
    await this.doCampus('roteiro', b.roteiroId, u);
    await this.vigilanteDoCampus(b.vigilanteId, u);
    const campus = await this.db.campus.findUniqueOrThrow({ where: { id: u.campusId } });
    const inicio = new Date(b.inicioPrevisto);
    const r = await this.agendamento.criarRonda({ roteiroId: b.roteiroId, vigilanteId: b.vigilanteId, inicio, duracaoMin: b.duracaoMin, toleranciaInicioMin: b.toleranciaInicioMin ?? campus.toleranciaInicioMin, agendaId: null });
    await auditar(this.db, u.id, 'CRIAR', 'ronda', r.id, b);
    return { id: r.id };
  }

  // ---------- Desativação e reativação ----------
  @Post(':recurso/:id/desativacao')
  @Papeis(...LEITURA)
  @HttpCode(204)
  async desativar(@Usuario() u: UsuarioToken, @Param('recurso') recurso: string, @Param('id') rid: string, @Body() corpo: unknown) {
    const b = validar(z.object({ motivo: z.string().trim().min(3, 'Informe o motivo').max(500) }), corpo);
    await this.mudarAtivo(u, recurso, rid, false, b.motivo);
  }

  @Post(':recurso/:id/reativacao')
  @Papeis(...LEITURA)
  @HttpCode(204)
  async reativar(@Usuario() u: UsuarioToken, @Param('recurso') recurso: string, @Param('id') rid: string) {
    await this.mudarAtivo(u, recurso, rid, true);
  }

  private async mudarAtivo(u: UsuarioToken, recurso: string, rid: string, ativo: boolean, motivo?: string) {
    const soAdmin = ['predios', 'andares', 'pontos-ronda', 'tipos-ocorrencia', 'usuarios', 'tags-nfc'];
    const planejamento = ['roteiros', 'agendas'];
    if (![...soAdmin, ...planejamento].includes(recurso)) throw naoEncontrado('Recurso');
    if (soAdmin.includes(recurso) && u.papel !== 'ADMINISTRADOR') throw new Problema(403, 'SEM_PERMISSAO', 'Só o administrador altera este cadastro.');
    if (!ativo || recurso !== 'tags-nfc') {
      const tipo = { predios: 'predio', andares: 'andar', 'pontos-ronda': 'ponto', 'tipos-ocorrencia': 'tipo', usuarios: 'usuario', roteiros: 'roteiro', agendas: 'agenda', 'tags-nfc': 'tag' }[recurso] as Entidade;
      await this.doCampus(tipo, rid, u);
    }
    if (!ativo && recurso === 'pontos-ronda') {
      const emUso = await this.db.roteiro.findMany({ where: { ativo: true, pontos: { some: { pontoRondaId: rid } } }, select: { nome: true } });
      if (emUso.length) throw new Problema(409, 'PONTO_EM_ROTEIRO_ATIVO', `Ponto usado nos roteiros: ${emUso.map((r) => r.nome).join(', ')}.`);
    }
    const d = { ativo };
    const ops: Record<string, () => Promise<unknown>> = {
      predios: () => this.db.predio.update({ where: { id: rid }, data: d }),
      andares: () => this.db.andar.update({ where: { id: rid }, data: d }),
      'pontos-ronda': () => this.db.pontoRonda.update({ where: { id: rid }, data: d }),
      'tipos-ocorrencia': () => this.db.tipoOcorrencia.update({ where: { id: rid }, data: d }),
      usuarios: () => this.db.usuario.update({ where: { id: rid }, data: d }),
      roteiros: () => this.db.roteiro.update({ where: { id: rid }, data: d }),
      agendas: () => this.db.agenda.update({ where: { id: rid }, data: d }),
      'tags-nfc': () => this.db.tagNfc.update({ where: { id: rid }, data: d }),
    };
    await ops[recurso]();
    if (recurso === 'agendas') {
      if (!ativo) await this.agendamento.cancelarFuturas(rid, u.id);
      else await this.agendamento.gerar();
    }
    if (!ativo && recurso === 'usuarios') await this.db.sessao.updateMany({ where: { usuarioId: rid, revogadaEm: null }, data: { revogadaEm: new Date() } });
    await auditar(this.db, u.id, ativo ? 'REATIVAR' : 'DESATIVAR', recurso, rid, motivo ? { motivo } : undefined);
  }

  // ---------- Escopo: tudo tem que ser do campus do usuário ----------
  private async doCampus(tipo: Entidade, eid: string, u: UsuarioToken) {
    const c = u.campusId;
    const achou = await {
      predio: () => this.db.predio.count({ where: { id: eid, campusId: c } }),
      andar: () => this.db.andar.count({ where: { id: eid, predio: { campusId: c } } }),
      ponto: () => this.db.pontoRonda.count({ where: { id: eid, predio: { campusId: c } } }),
      tipo: () => this.db.tipoOcorrencia.count({ where: { id: eid, campusId: c } }),
      usuario: () => this.db.usuario.count({ where: { id: eid, campusId: c } }),
      roteiro: () => this.db.roteiro.count({ where: { id: eid, campusId: c } }),
      agenda: () => this.db.agenda.count({ where: { id: eid, roteiro: { campusId: c } } }),
      tag: () => this.db.tagNfc.count({ where: { id: eid, ponto: { predio: { campusId: c } } } }),
    }[tipo]();
    if (!achou) throw naoEncontrado();
  }

  private async pontosDoCampus(ids: string[], u: UsuarioToken) {
    const n = await this.db.pontoRonda.count({ where: { id: { in: ids }, ativo: true, predio: { campusId: u.campusId } } });
    if (n !== new Set(ids).size) throw new Problema(422, 'PONTO_INVALIDO', 'Algum ponto não existe ou está desativado.');
  }

  private async vigilanteDoCampus(vid: string, u: UsuarioToken) {
    const v = await this.db.usuario.findFirst({ where: { id: vid, campusId: u.campusId, papel: 'VIGILANTE', ativo: true } });
    if (!v) throw new Problema(422, 'VIGILANTE_INVALIDO', 'Escolha um vigilante ativo.');
  }
}

type Entidade = 'predio' | 'andar' | 'ponto' | 'tipo' | 'usuario' | 'roteiro' | 'agenda' | 'tag';
