// Sessão, login (servidor ou modo local), desbloqueio por biometria e bloqueio por inatividade (docs/08 · 12).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { apiUrl, carregarApiUrl, definirApiUrl, versaoApp } from '../core/config';
import { chamar, definirAoSessaoExpirar, ErroApi, guardarTokens } from '../core/api/cliente';
import { abrirBanco, kvGravar, kvLer } from '../dados/banco';
import { configuracao, contagemFila } from '../dados/repositorios';
import { prepararModoLocal } from '../dados/pacote';
import { ligarMotor, atualizarReferencias } from './sincronizacao';
import type { PapelUsuario } from '../dominio/tipos';
import { textos } from '../textos';

const OPCOES = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export interface Usuario {
  id: string;
  nome: string;
  matricula: string;
  papel: PapelUsuario;
}

interface DadosSessao {
  usuario: Usuario;
  modo: 'LOCAL' | 'API';
  avisoPendente: boolean;
}

type Estado = 'CARREGANDO' | 'SEM_SESSAO' | 'BLOQUEADA' | 'ATIVA';

interface ValorSessao {
  estado: Estado;
  sessao: DadosSessao | null;
  erroBanco: string | null;
  entrar: (matricula: string, senha: string, servidor: string) => Promise<void>;
  desbloquear: () => Promise<boolean>;
  sair: () => Promise<{ ok: true } | { ok: false; pendentes: number }>;
  registrarAtividade: () => void;
  confirmarAviso: () => Promise<void>;
}

const Contexto = createContext<ValorSessao>(null as unknown as ValorSessao);

// Modo local: usuários de teste fixos, sem servidor.
const USUARIOS_LOCAIS: Record<string, Usuario> = {
  vigilante: { id: '0192ef90-0000-7000-8000-0000000000e1', nome: 'Vigilante de Teste', matricula: 'vigilante', papel: 'VIGILANTE' },
  admin: { id: '0192ef90-0000-7000-8000-0000000000e2', nome: 'Administrador de Teste', matricula: 'admin', papel: 'ADMINISTRADOR' },
};
const SENHA_LOCAL = '1234';

/** Nome do banco da conta: cada usuário (e o modo local de teste) tem os seus dados separados no aparelho. */
const contaDe = (s: { usuario: { id: string }; modo: 'LOCAL' | 'API' }) => `${s.modo === 'LOCAL' ? 'local' : 'api'}_${s.usuario.id}`;

async function identificadorInstalacao() {
  let id = await SecureStore.getItemAsync('id_instalacao', OPCOES);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync('id_instalacao', id, OPCOES);
  }
  return id;
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('CARREGANDO');
  const [sessao, setSessao] = useState<DadosSessao | null>(null);
  const [erroBanco, setErroBanco] = useState<string | null>(null);
  const ultimaAtividade = useRef(Date.now());
  const minutosInatividade = useRef(10);

  const salvar = async (s: DadosSessao | null) => {
    setSessao(s);
    if (s) await SecureStore.setItemAsync('sessao', JSON.stringify(s), OPCOES);
    else await SecureStore.deleteItemAsync('sessao');
  };

  const encerrarSessao = useCallback(async () => {
    await guardarTokens(null, null);
    await salvar(null);
    setEstado('SEM_SESSAO');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await carregarApiUrl();
        const s = await SecureStore.getItemAsync('sessao', OPCOES);
        if (!s) {
          setEstado('SEM_SESSAO');
          return;
        }
        const salva: DadosSessao = JSON.parse(s);
        await abrirBanco(contaDe(salva));
        if (salva.modo === 'LOCAL') await prepararModoLocal();
        minutosInatividade.current = (await configuracao()).inatividadeBloqueioMin;
        setSessao(salva);
        setEstado('BLOQUEADA');
      } catch (e) {
        setErroBanco(e instanceof Error ? e.message : String(e));
      }
    })();
    definirAoSessaoExpirar(() => encerrarSessao());
  }, [encerrarSessao]);

  // Motor de sincronização ligado só com sessão de servidor.
  useEffect(() => {
    if (estado === 'ATIVA' && sessao?.modo === 'API') return ligarMotor();
  }, [estado, sessao?.modo]);

  // Bloqueio: 10 min em segundo plano ou sem interação.
  useEffect(() => {
    if (estado !== 'ATIVA') return;
    let saiuEm = 0;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') saiuEm = Date.now();
      if (s === 'active' && saiuEm && Date.now() - saiuEm > minutosInatividade.current * 60_000) setEstado('BLOQUEADA');
    });
    const timer = setInterval(() => {
      if (Date.now() - ultimaAtividade.current > minutosInatividade.current * 60_000) setEstado('BLOQUEADA');
    }, 30_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [estado]);

  const registrarAtividade = useCallback(() => {
    ultimaAtividade.current = Date.now();
  }, []);

  const entrar = async (matricula: string, senha: string, servidor: string) => {
    const m = matricula.trim();
    const local = USUARIOS_LOCAIS[m.toLowerCase()];
    // Usuários de teste entram sempre no modo local, mesmo com um endereço de servidor salvo.
    await definirApiUrl(local ? '' : servidor);
    if (!apiUrl()) {
      const u = local;
      if (!u || senha.trim() !== SENHA_LOCAL) throw new Error(textos.login.credenciaisInvalidas);
      await abrirBanco(contaDe({ usuario: u, modo: 'LOCAL' }));
      await prepararModoLocal();
      const avisoVisto = await kvLer(`aviso_visto_${u.id}`);
      await salvar({ usuario: u, modo: 'LOCAL', avisoPendente: !avisoVisto });
    } else {
      try {
        const r = await chamar<any>('/auth/login', {
          metodo: 'POST',
          publico: true,
          corpo: {
            matricula: m,
            senha,
            dispositivo: {
              identificadorInstalacao: await identificadorInstalacao(),
              plataforma: Platform.OS,
              modelo: String((Platform.constants as any)?.Model ?? 'desconhecido'),
              versaoSo: String(Platform.Version),
              versaoApp,
            },
          },
        });
        const d = r.dados;
        await guardarTokens(d.accessToken, d.refreshToken);
        await abrirBanco(contaDe({ usuario: { id: d.usuario.id }, modo: 'API' }));
        await salvar({
          usuario: { id: d.usuario.id, nome: d.usuario.nome, matricula: m, papel: d.usuario.papel },
          modo: 'API',
          avisoPendente: !!d.avisoPrivacidadePendente,
        });
        await atualizarReferencias().catch(() => {});
      } catch (e) {
        if (e instanceof ErroApi) {
          const msg: Record<string, string> = {
            CREDENCIAIS_INVALIDAS: textos.login.credenciaisInvalidas,
            DISPOSITIVO_REVOGADO: textos.login.aparelhoRevogado,
            USUARIO_INATIVO: textos.login.usuarioInativo,
            PAPEL_SEM_ACESSO_AO_CANAL: textos.login.semAcesso,
            SEM_CONEXAO: textos.login.semConexao,
          };
          throw new Error(msg[e.codigo] ?? e.message);
        }
        throw e;
      }
    }
    minutosInatividade.current = (await configuracao()).inatividadeBloqueioMin;
    ultimaAtividade.current = Date.now();
    setEstado('ATIVA');
  };

  const desbloquear = async () => {
    const temBloqueio = (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
    if (temBloqueio) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: textos.desbloqueio.prompt, disableDeviceFallback: false });
      if (!r.success) return false;
    }
    ultimaAtividade.current = Date.now();
    setEstado('ATIVA');
    return true;
  };

  const sair = async (): Promise<{ ok: true } | { ok: false; pendentes: number }> => {
    const c = await contagemFila();
    // RN17: logout só com fila vazia (no modo local os registros não têm para onde ir, então não bloqueia).
    if (sessao?.modo === 'API' && c.pendentes + c.fotosPendentes > 0) return { ok: false, pendentes: c.pendentes + c.fotosPendentes };
    if (sessao?.modo === 'API') await chamar('/auth/logout', { metodo: 'POST' }).catch(() => {});
    await encerrarSessao();
    return { ok: true };
  };

  const confirmarAviso = async () => {
    if (!sessao) return;
    if (sessao.modo === 'API') await chamar('/aviso-privacidade/ciencia', { metodo: 'POST', corpo: { versao: 1 } }).catch(() => {});
    else await kvGravar(`aviso_visto_${sessao.usuario.id}`, new Date().toISOString());
    await salvar({ ...sessao, avisoPendente: false });
  };

  return (
    <Contexto.Provider value={{ estado, sessao, erroBanco, entrar, desbloquear, sair, registrarAtividade, confirmarAviso }}>
      {children}
    </Contexto.Provider>
  );
}

export const useSessao = () => useContext(Contexto);
