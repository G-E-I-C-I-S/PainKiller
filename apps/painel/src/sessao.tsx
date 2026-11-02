// Sessão do painel: restaura pelo cookie de refresh ao abrir e guarda o usuário em memória.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, definirAoExpirar, definirToken, renovar } from './api';

export interface Eu {
  id: string;
  nome: string;
  matricula: string;
  papel: 'COORDENADOR' | 'RESPONSAVEL' | 'ADMINISTRADOR';
  campus: { id: string; nome: string };
  deveTrocarSenha: boolean;
}

interface Valor {
  eu: Eu | null;
  carregando: boolean;
  entrar: (matricula: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<Valor>(null as unknown as Valor);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [eu, setEu] = useState<Eu | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    definirAoExpirar(() => {
      definirToken(null);
      setEu(null);
    });
    renovar()
      .then(async (ok) => (ok ? setEu(await api<Eu>('/auth/eu')) : null))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const entrar = useCallback(async (matricula: string, senha: string) => {
    const r = await api<{ accessToken: string }>('/auth/login', { metodo: 'POST', corpo: { matricula, senha } });
    definirToken(r.accessToken);
    setEu(await api<Eu>('/auth/eu'));
  }, []);

  const sair = useCallback(async () => {
    await api('/auth/logout', { metodo: 'POST' }).catch(() => {});
    definirToken(null);
    setEu(null);
  }, []);

  return <Ctx.Provider value={{ eu, carregando, entrar, sair }}>{children}</Ctx.Provider>;
}

export const useSessao = () => useContext(Ctx);
