// Único lugar do app que faz fetch (docs/08 · 5). Token, versão do app, refresh e erros RFC 9457.
import { apiUrl, versaoApp } from '../config';
import * as SecureStore from 'expo-secure-store';

const OPCOES = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const TEMPO_LIMITE_MS = 20_000;

export class ErroApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

let accessToken: string | null = null;
let aoSessaoExpirar: (() => void) | null = null;

export function definirAoSessaoExpirar(f: () => void) {
  aoSessaoExpirar = f;
}

export async function guardarTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  if (access) await SecureStore.setItemAsync('access_token', access, OPCOES);
  else await SecureStore.deleteItemAsync('access_token');
  if (refresh) await SecureStore.setItemAsync('refresh_token', refresh, OPCOES);
  else if (refresh === null) await SecureStore.deleteItemAsync('refresh_token');
}

async function tokenAtual() {
  if (!accessToken) accessToken = await SecureStore.getItemAsync('access_token', OPCOES);
  return accessToken;
}

let refreshEmAndamento: Promise<boolean> | null = null;

async function renovar(): Promise<boolean> {
  refreshEmAndamento ??= (async () => {
    const refreshToken = await SecureStore.getItemAsync('refresh_token', OPCOES);
    if (!refreshToken) return false;
    const r = await fetchComTempo(`${apiUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Versao-App': versaoApp },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
    if (!r) return false; // sem rede: tenta depois, sem derrubar a sessão
    if (!r.ok) {
      aoSessaoExpirar?.();
      return false;
    }
    const corpo = await r.json();
    await guardarTokens(corpo.accessToken, corpo.refreshToken);
    return true;
  })().finally(() => {
    refreshEmAndamento = null;
  });
  return refreshEmAndamento;
}

function fetchComTempo(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  corpo?: unknown;
  corpoBruto?: BodyInit;
  headers?: Record<string, string>;
  publico?: boolean;
}

export interface RespostaApi<T> {
  status: number;
  dados: T;
  headers: Headers;
}

export async function chamar<T>(caminho: string, op: Opcoes = {}, tentativa = 0): Promise<RespostaApi<T>> {
  const base = apiUrl();
  if (!base) throw new ErroApi(0, 'MODO_LOCAL', 'Sem servidor configurado');
  const headers: Record<string, string> = { 'X-Versao-App': versaoApp, Accept: 'application/json', ...op.headers };
  if (op.corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (!op.publico) {
    const t = await tokenAtual();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let r: Response;
  try {
    r = await fetchComTempo(`${base}${caminho}`, {
      method: op.metodo ?? 'GET',
      headers,
      body: op.corpoBruto ?? (op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined),
    });
  } catch {
    throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o servidor');
  }
  if (r.status === 401 && !op.publico && tentativa === 0 && (await renovar())) {
    return chamar<T>(caminho, op, 1);
  }
  if (!r.ok && r.status !== 304) {
    let codigo = `HTTP_${r.status}`;
    let mensagem = r.statusText;
    try {
      const p = await r.json();
      codigo = p.codigo ?? codigo;
      mensagem = p.detail ?? p.title ?? mensagem;
    } catch {}
    if (codigo === 'DISPOSITIVO_REVOGADO') aoSessaoExpirar?.();
    throw new ErroApi(r.status, codigo, mensagem);
  }
  const texto = r.status === 204 || r.status === 304 ? '' : await r.text();
  return { status: r.status, dados: (texto ? JSON.parse(texto) : null) as T, headers: r.headers };
}
