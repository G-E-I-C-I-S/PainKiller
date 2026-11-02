// Perfil: troca de senha (obrigatória com senha temporária) e tema.
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, mensagemErro } from '../api';
import { useSessao } from '../sessao';
import { PAPEL } from '../textos';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Selecao } from '../ui/base';

export function Perfil() {
  const { eu } = useSessao();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [tema, setTema] = useState(() => document.documentElement.dataset.tema ?? 'escuro');
  const m = useMutation({
    mutationFn: () => api('/auth/troca-senha', { metodo: 'POST', corpo: { senhaAtual: atual, senhaNova: nova } }),
    onSuccess: () => window.location.assign('/'),
  });
  const mudarTema = (t: string) => {
    setTema(t);
    document.documentElement.dataset.tema = t;
    try {
      localStorage.setItem('tema', t);
    } catch {}
  };
  return (
    <>
      <Cabecalho titulo="Perfil" subtitulo={`${eu?.nome} · ${eu ? PAPEL[eu.papel] : ''} · matrícula ${eu?.matricula}`} />
      <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
        <Cartao titulo="Trocar senha">
          <div className="flex flex-col gap-3">
            {eu?.deveTrocarSenha ? <Aviso tom="aviso">Você está com uma senha temporária. Escolha uma senha nova para continuar.</Aviso> : null}
            <Campo rotulo="Senha atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} />
            <Campo rotulo="Senha nova (mínimo 8 caracteres)" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
            <Campo rotulo="Repita a senha nova" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} />
            {conf && nova !== conf ? <p className="text-xs text-erro">As senhas não conferem.</p> : null}
            {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
            <div><Botao carregando={m.isPending} disabled={!atual || nova.length < 8 || nova !== conf} onClick={() => m.mutate()}>Trocar senha</Botao></div>
          </div>
        </Cartao>
        <Cartao titulo="Aparência">
          <Selecao rotulo="Tema" value={tema} onChange={(e) => mudarTema(e.target.value)} opcoes={[{ valor: 'escuro', rotulo: 'Escuro' }, { valor: 'claro', rotulo: 'Claro' }]} />
        </Cartao>
      </div>
    </>
  );
}
