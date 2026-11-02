// Autenticação (ADR-0012): access token JWT de 15 min e refresh opaco de 30 dias com rotação e detecção de reuso.
import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Papel } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import { Banco, novoId, Problema } from './base';

const ACESSO_MIN = 15;
const REFRESH_DIAS = 30;
const segredo = () => new TextEncoder().encode(process.env.JWT_SEGREDO ?? '');

export interface UsuarioToken {
  id: string;
  sessaoId: string;
  papel: Papel;
  campusId: string;
  dispositivoId: string | null;
}

export const hashRefresh = (t: string) => createHash('sha256').update(t).digest('hex');

export async function emitirTokens(db: Banco, u: { id: string; papel: Papel; campusId: string }, canal: 'APP' | 'PAINEL', dispositivoId: string | null, familia = novoId()) {
  const refreshToken = `rt_${randomBytes(32).toString('base64url')}`;
  const sessao = await db.sessao.create({
    data: { id: novoId(), usuarioId: u.id, dispositivoId, canal, familia, refreshHash: hashRefresh(refreshToken), expiraEm: new Date(Date.now() + REFRESH_DIAS * 864e5) },
  });
  const expiraEm = new Date(Date.now() + ACESSO_MIN * 60_000);
  const accessToken = await new SignJWT({ papel: u.papel, campus: u.campusId, sid: sessao.id, dsp: dispositivoId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(u.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiraEm.getTime() / 1000))
    .sign(segredo());
  return { accessToken, refreshToken, expiraEm: expiraEm.toISOString(), sessaoId: sessao.id };
}

/** Troca o refresh por um par novo. Reuso de refresh já trocado revoga a família inteira (HU-006). */
export async function renovarTokens(db: Banco, refreshToken: string) {
  const s = await db.sessao.findUnique({ where: { refreshHash: hashRefresh(refreshToken) }, include: { usuario: true } });
  const invalido = new Problema(401, 'REFRESH_INVALIDO', 'Sessão expirada. Entre de novo.');
  if (!s || s.revogadaEm || s.expiraEm < new Date()) throw invalido;
  if (s.substituidaEm) {
    await db.sessao.updateMany({ where: { familia: s.familia, revogadaEm: null }, data: { revogadaEm: new Date() } });
    throw invalido;
  }
  if (!s.usuario.ativo) throw new Problema(403, 'USUARIO_INATIVO', 'Usuário desativado.');
  if (s.dispositivoId) {
    const d = await db.dispositivo.findUnique({ where: { id: s.dispositivoId } });
    if (d?.revogadoEm) throw new Problema(403, 'DISPOSITIVO_REVOGADO', 'Este aparelho foi desconectado pelo administrador.');
  }
  await db.sessao.update({ where: { id: s.id }, data: { substituidaEm: new Date() } });
  return emitirTokens(db, s.usuario, s.canal as 'APP' | 'PAINEL', s.dispositivoId, s.familia);
}

// Sessões revogadas: consulta com cache de 30 s, para revogar um aparelho em até 1 minuto.
const cacheSessao = new Map<string, { ok: boolean; em: number }>();

export const PUBLICO = 'publico';
export const Publico = () => SetMetadata(PUBLICO, true);
export const PAPEIS = 'papeis';
export const Papeis = (...p: Papel[]) => SetMetadata(PAPEIS, p);

@Injectable()
export class GuardaAuth implements CanActivate {
  constructor(
    private reflector: Reflector,
    private db: Banco,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const alvo = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvo)) return true;
    const req = ctx.switchToHttp().getRequest<Request & { usuario?: UsuarioToken }>();
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new Problema(401, 'NAO_AUTENTICADO', 'Entre para continuar.');
    let payload;
    try {
      payload = (await jwtVerify(token, segredo())).payload;
    } catch {
      throw new Problema(401, 'TOKEN_INVALIDO', 'Sessão expirada.');
    }
    const sid = String(payload.sid);
    const c = cacheSessao.get(sid);
    let ok = c && Date.now() - c.em < 30_000 ? c.ok : undefined;
    if (ok === undefined) {
      const s = await this.db.sessao.findUnique({ where: { id: sid } });
      const d = payload.dsp ? await this.db.dispositivo.findUnique({ where: { id: String(payload.dsp) } }) : null;
      ok = !!s && !s.revogadaEm && !d?.revogadoEm;
      cacheSessao.set(sid, { ok, em: Date.now() });
    }
    if (!ok) throw new Problema(401, 'SESSAO_REVOGADA', 'Sessão encerrada.');
    req.usuario = { id: String(payload.sub), sessaoId: sid, papel: payload.papel as Papel, campusId: String(payload.campus), dispositivoId: payload.dsp ? String(payload.dsp) : null };
    const papeis = this.reflector.getAllAndOverride<Papel[] | undefined>(PAPEIS, alvo);
    if (papeis && !papeis.includes(req.usuario.papel)) throw new Problema(403, 'SEM_PERMISSAO', 'Seu perfil não tem acesso a isso.');
    return true;
  }
}

export const esquecerSessao = (sid: string) => cacheSessao.delete(sid);

export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().usuario as UsuarioToken);
