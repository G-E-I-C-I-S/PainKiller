// Identidade: login do app e do painel, refresh, logout, aviso de privacidade e troca de senha (docs/07 · 2).
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auditar, Banco, novoId, Problema, validar } from '../nucleo/base';
import { emitirTokens, esquecerSessao, Publico, renovarTokens, Usuario, type UsuarioToken } from '../nucleo/auth';

export const VERSAO_AVISO = 1;
const COOKIE = 'guardiao_refresh';

const Login = z.object({
  matricula: z.string().trim().min(1).max(60),
  senha: z.string().min(1).max(200),
  dispositivo: z
    .object({
      identificadorInstalacao: z.string().min(8).max(100),
      plataforma: z.string().max(20),
      modelo: z.string().max(100),
      versaoSo: z.string().max(40),
      versaoApp: z.string().max(40),
    })
    .optional(),
});

// Limite de tentativas: 5 por minuto por IP + matrícula.
const tentativas = new Map<string, number[]>();
function conferirLimite(chave: string) {
  const agora = Date.now();
  const lista = (tentativas.get(chave) ?? []).filter((t) => agora - t < 60_000);
  if (lista.length >= 5) throw new Problema(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Aguarde 1 minuto.');
  lista.push(agora);
  tentativas.set(chave, lista);
}

function lerCookie(req: Request, nome: string) {
  const m = (req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === nome);
  return m ? decodeURIComponent(m.slice(1).join('=')) : null;
}

function gravarCookie(req: Request, res: Response, valor: string | null) {
  res.cookie(COOKIE, valor ?? '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    path: '/api/v1/auth',
    maxAge: valor ? 30 * 864e5 : 0,
  });
}

@Controller('auth')
export class IdentidadeController {
  constructor(private db: Banco) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  async login(@Body() corpo: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const b = validar(Login, corpo);
    conferirLimite(`${req.ip}|${b.matricula}`);
    const u = await this.db.usuario.findUnique({ where: { matricula: b.matricula } });
    if (!u || !(await bcrypt.compare(b.senha, u.senhaHash))) throw new Problema(401, 'CREDENCIAIS_INVALIDAS', 'Matrícula ou senha inválida.');
    if (!u.ativo) throw new Problema(403, 'USUARIO_INATIVO', 'Usuário desativado.');
    const app = !!b.dispositivo;
    const permitidos = app ? ['VIGILANTE', 'ADMINISTRADOR'] : ['COORDENADOR', 'RESPONSAVEL', 'ADMINISTRADOR'];
    if (!permitidos.includes(u.papel)) throw new Problema(403, 'PAPEL_SEM_ACESSO_AO_CANAL', app ? 'Use o painel web.' : 'Use o app no celular.');

    let dispositivoId: string | null = null;
    if (b.dispositivo) {
      const d = b.dispositivo;
      const existente = await this.db.dispositivo.findUnique({ where: { identificadorInstalacao: d.identificadorInstalacao } });
      if (existente?.revogadoEm) throw new Problema(403, 'DISPOSITIVO_REVOGADO', 'Este aparelho foi desconectado pelo administrador.');
      const dados = { usuarioId: u.id, plataforma: d.plataforma, modelo: d.modelo, versaoSo: d.versaoSo, versaoApp: d.versaoApp, ultimoAcessoEm: new Date() };
      const disp = existente
        ? await this.db.dispositivo.update({ where: { id: existente.id }, data: dados })
        : await this.db.dispositivo.create({ data: { id: novoId(), identificadorInstalacao: d.identificadorInstalacao, ...dados } });
      dispositivoId = disp.id;
    }
    const t = await emitirTokens(this.db, u, app ? 'APP' : 'PAINEL', dispositivoId);
    await auditar(this.db, u.id, 'LOGIN', 'usuario', u.id, { canal: app ? 'APP' : 'PAINEL', dispositivoId });
    if (!app) gravarCookie(req, res, t.refreshToken);
    return {
      accessToken: t.accessToken,
      refreshToken: app ? t.refreshToken : undefined,
      expiraEm: t.expiraEm,
      usuario: { id: u.id, nome: u.nome, matricula: u.matricula, papel: u.papel, campusId: u.campusId, deveTrocarSenha: u.deveTrocarSenha },
      avisoPrivacidadePendente: (u.avisoVersaoCiente ?? 0) < VERSAO_AVISO ? { versao: VERSAO_AVISO } : null,
    };
  }

  @Publico()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() corpo: { refreshToken?: string } | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const doCookie = lerCookie(req, COOKIE);
    const token = corpo?.refreshToken ?? doCookie;
    if (!token) throw new Problema(401, 'REFRESH_INVALIDO', 'Sessão expirada. Entre de novo.');
    const t = await renovarTokens(this.db, token);
    if (!corpo?.refreshToken) {
      gravarCookie(req, res, t.refreshToken);
      return { accessToken: t.accessToken, expiraEm: t.expiraEm };
    }
    return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiraEm: t.expiraEm };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Usuario() u: UsuarioToken, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const s = await this.db.sessao.findUnique({ where: { id: u.sessaoId } });
    if (s) await this.db.sessao.updateMany({ where: { familia: s.familia, revogadaEm: null }, data: { revogadaEm: new Date() } });
    esquecerSessao(u.sessaoId);
    gravarCookie(req, res, null);
  }

  @Get('eu')
  async eu(@Usuario() t: UsuarioToken) {
    const u = await this.db.usuario.findUniqueOrThrow({ where: { id: t.id }, include: { campus: true } });
    return { id: u.id, nome: u.nome, matricula: u.matricula, papel: u.papel, campus: { id: u.campus.id, nome: u.campus.nome }, deveTrocarSenha: u.deveTrocarSenha };
  }

  @Post('troca-senha')
  @HttpCode(204)
  async trocarSenha(@Usuario() t: UsuarioToken, @Body() corpo: unknown) {
    const b = validar(z.object({ senhaAtual: z.string(), senhaNova: z.string().min(8, 'Mínimo de 8 caracteres').max(200) }), corpo);
    const u = await this.db.usuario.findUniqueOrThrow({ where: { id: t.id } });
    if (!(await bcrypt.compare(b.senhaAtual, u.senhaHash))) throw new Problema(422, 'SENHA_ATUAL_INCORRETA', 'Senha atual incorreta.');
    await this.db.usuario.update({ where: { id: u.id }, data: { senhaHash: await bcrypt.hash(b.senhaNova, 10), deveTrocarSenha: false } });
    await auditar(this.db, u.id, 'TROCAR_SENHA', 'usuario', u.id);
  }
}

@Controller('aviso-privacidade')
export class AvisoController {
  constructor(private db: Banco) {}

  @Get('vigente')
  vigente() {
    return { versao: VERSAO_AVISO };
  }

  @Post('ciencia')
  @HttpCode(204)
  async ciencia(@Usuario() u: UsuarioToken) {
    await this.db.usuario.update({ where: { id: u.id }, data: { avisoVersaoCiente: VERSAO_AVISO } });
    await auditar(this.db, u.id, 'CIENCIA_AVISO', 'usuario', u.id, { versao: VERSAO_AVISO });
  }
}
