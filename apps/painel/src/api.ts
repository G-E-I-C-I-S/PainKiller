// Único ponto de acesso à API. Access token só em memória; o refresh fica em cookie HttpOnly (docs/10 · 8).
export class ErroApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
    public erros?: { campo: string; mensagem: string }[],
  ) {
    super(mensagem);
  }
}

const BASE = '/api/v1';
let token: string | null = null;
let aoExpirar: (() => void) | null = null;

export const definirToken = (t: string | null) => {
  token = t;
};
export const definirAoExpirar = (f: () => void) => {
  aoExpirar = f;
};

let renovando: Promise<boolean> | null = null;

export function renovar(): Promise<boolean> {
  renovando ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'guardiao-painel' } })
    .then(async (r) => {
      if (!r.ok) return false;
      token = (await r.json()).accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

export async function api<T = unknown>(caminho: string, op: { metodo?: string; corpo?: unknown } = {}, tentativa = 0): Promise<T> {
  const r = await fetch(BASE + caminho, {
    method: op.metodo ?? 'GET',
    credentials: 'include',
    headers: {
      'X-Requested-With': 'guardiao-painel',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(op.corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined,
  }).catch(() => {
    throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o servidor.');
  });
  if (r.status === 401 && tentativa === 0 && !caminho.startsWith('/auth/login')) {
    if (await renovar()) return api<T>(caminho, op, 1);
    aoExpirar?.();
  }
  if (!r.ok) {
    let p: { codigo?: string; detail?: string; erros?: { campo: string; mensagem: string }[] } = {};
    try {
      p = await r.json();
    } catch {}
    throw new ErroApi(r.status, p.codigo ?? `HTTP_${r.status}`, p.detail ?? r.statusText, p.erros);
  }
  const texto = await r.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

/** Imagem protegida (foto de ocorrência): baixa com o token e devolve um blob URL. */
export async function imagem(caminho: string): Promise<string> {
  let r = await fetch(BASE + caminho, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (r.status === 401 && (await renovar())) r = await fetch(BASE + caminho, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new ErroApi(r.status, 'FOTO', 'Não foi possível abrir a foto.');
  return URL.createObjectURL(await r.blob());
}

export const mensagemErro = (e: unknown) =>
  e instanceof ErroApi ? (e.erros?.length ? e.erros.map((x) => `${x.campo ? `${x.campo}: ` : ''}${x.mensagem}`).join(' · ') : e.message) : e instanceof Error ? e.message : String(e);
