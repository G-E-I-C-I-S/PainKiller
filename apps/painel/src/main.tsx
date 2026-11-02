import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './estilo.css';
import { mensagemErro } from './api';
import { ProvedorSessao, useSessao } from './sessao';
import { PAPEL } from './textos';
import { Aviso, Botao, Campo, Carregando } from './ui/base';
import { Inicio } from './paginas/Inicio';
import { Ronda, Rondas } from './paginas/Rondas';
import { Ocorrencia, Ocorrencias } from './paginas/Ocorrencias';
import { Recusados, Visitas } from './paginas/Revisao';
import { Planejamento } from './paginas/Planejamento';
import { Pontos } from './paginas/Pontos';
import { Aparelhos, Campus, Tipos, Usuarios } from './paginas/Cadastros';
import { Perfil } from './paginas/Perfil';

const cliente = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 10_000 } } });

function Escudo({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function Login() {
  const { entrar } = useSessao();
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await entrar(matricula.trim(), senha);
    } catch (x) {
      setErro(mensagemErro(x));
    } finally {
      setCarregando(false);
    }
  };
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <form onSubmit={enviar} className="w-full max-w-sm flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="size-16 rounded-2xl bg-primaria text-sobre-primaria flex items-center justify-center">
            <Escudo tamanho={34} />
          </div>
          <h1 className="text-2xl font-bold mt-2">Guardião</h1>
          <p className="text-sm text-texto2 text-center">Painel da segurança patrimonial<br />IF Sul de Minas · Muzambinho</p>
        </div>
        {erro ? <Aviso>{erro}</Aviso> : null}
        <Campo rotulo="Matrícula" autoComplete="username" value={matricula} onChange={(e) => setMatricula(e.target.value)} autoFocus />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Botao type="submit" carregando={carregando} disabled={!matricula || !senha} className="h-11 mt-2">
          Entrar
        </Botao>
      </form>
    </main>
  );
}

type Item = { para: string; rotulo: string; papeis?: string[] };
const MENU: { grupo: string; itens: Item[] }[] = [
  {
    grupo: 'Acompanhamento',
    itens: [
      { para: '/', rotulo: 'Hoje' },
      { para: '/rondas', rotulo: 'Rondas' },
      { para: '/visitas', rotulo: 'Leituras a revisar' },
      { para: '/ocorrencias', rotulo: 'Ocorrências' },
      { para: '/envios', rotulo: 'Problemas de envio' },
    ],
  },
  { grupo: 'Planejamento', itens: [{ para: '/planejamento', rotulo: 'Roteiros e agendas', papeis: ['COORDENADOR', 'ADMINISTRADOR'] }] },
  {
    grupo: 'Cadastros',
    itens: [
      { para: '/cadastros/pontos', rotulo: 'Prédios, pontos e tags', papeis: ['COORDENADOR', 'ADMINISTRADOR'] },
      { para: '/cadastros/tipos', rotulo: 'Tipos de ocorrência', papeis: ['COORDENADOR', 'ADMINISTRADOR'] },
      { para: '/cadastros/usuarios', rotulo: 'Usuários', papeis: ['ADMINISTRADOR'] },
      { para: '/cadastros/aparelhos', rotulo: 'Aparelhos', papeis: ['ADMINISTRADOR'] },
      { para: '/cadastros/campus', rotulo: 'Campus', papeis: ['ADMINISTRADOR'] },
    ],
  },
];

function Layout() {
  const { eu, sair } = useSessao();
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();
  useEffect(() => setMenuAberto(false), [local.pathname]);
  if (!eu) return null;
  if (eu.deveTrocarSenha && local.pathname !== '/perfil') return <Navigate to="/perfil" replace />;
  const grupos = MENU.map((g) => ({ ...g, itens: g.itens.filter((i) => !i.papeis || i.papeis.includes(eu.papel)) })).filter((g) => g.itens.length);
  return (
    <div className="min-h-dvh lg:flex">
      <header className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-borda bg-superficie sticky top-0 z-30">
        <div className="flex items-center gap-2 font-bold">
          <span className="text-primaria"><Escudo /></span> Guardião
        </div>
        <button className="px-3 py-2 text-sm border border-borda rounded-lg" onClick={() => setMenuAberto(!menuAberto)} aria-expanded={menuAberto}>
          Menu
        </button>
      </header>
      <aside className={`${menuAberto ? 'block' : 'hidden'} lg:block lg:w-64 shrink-0 border-r border-borda bg-superficie lg:sticky lg:top-0 lg:h-dvh overflow-y-auto`}>
        <div className="hidden lg:flex items-center gap-2.5 px-5 h-16 font-bold">
          <span className="size-8 rounded-lg bg-primaria text-sobre-primaria flex items-center justify-center"><Escudo /></span>
          Guardião
        </div>
        <nav className="px-3 py-2 flex flex-col gap-5">
          {grupos.map((g) => (
            <div key={g.grupo}>
              <div className="px-2 mb-1 text-[11px] font-bold tracking-wider text-texto2 uppercase">{g.grupo}</div>
              {g.itens.map((i) => (
                <NavLink
                  key={i.para}
                  to={i.para}
                  end={i.para === '/'}
                  className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-primaria/15 text-primaria font-semibold' : 'text-texto hover:bg-elevada'}`}
                >
                  {i.rotulo}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 mt-4 border-t border-borda text-sm">
          <NavLink to="/perfil" className="block font-semibold hover:text-primaria">{eu.nome}</NavLink>
          <div className="text-xs text-texto2">{PAPEL[eu.papel]} · {eu.campus.nome}</div>
          <button className="mt-3 text-xs text-erro hover:underline" onClick={sair}>
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-4 py-6 lg:px-10 lg:py-8 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  const { eu, carregando } = useSessao();
  if (carregando) return <Carregando />;
  if (!eu) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="rondas" element={<Rondas />} />
        <Route path="rondas/:id" element={<Ronda />} />
        <Route path="visitas" element={<Visitas />} />
        <Route path="ocorrencias" element={<Ocorrencias />} />
        <Route path="ocorrencias/:id" element={<Ocorrencia />} />
        <Route path="envios" element={<Recusados />} />
        <Route path="planejamento" element={<Planejamento />} />
        <Route path="cadastros/pontos" element={<Pontos />} />
        <Route path="cadastros/tipos" element={<Tipos />} />
        <Route path="cadastros/usuarios" element={<Usuarios />} />
        <Route path="cadastros/aparelhos" element={<Aparelhos />} />
        <Route path="cadastros/campus" element={<Campus />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

try {
  const tema = localStorage.getItem('tema');
  if (tema) document.documentElement.dataset.tema = tema;
} catch {}

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <ProvedorSessao>
          <App />
        </ProvedorSessao>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
