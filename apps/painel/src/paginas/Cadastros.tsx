// Cadastros do administrador: tipos de ocorrência, usuários, aparelhos e configuração do campus.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mensagemErro } from '../api';
import { useSessao } from '../sessao';
import { fDataHora, GRAVIDADE, PAPEL } from '../textos';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Carregando, Celula, ErroCaixa, Modal, Selecao, Selo, Tabela, tomGravidade, Vazio } from '../ui/base';

function useAlternar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recurso, id, ativo }: { recurso: string; id: string; ativo: boolean }) =>
      api(`/${recurso}/${id}/${ativo ? 'desativacao' : 'reativacao'}`, { metodo: 'POST', corpo: ativo ? { motivo: 'Desativado pelo painel' } : undefined }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

const opcoesGravidade = Object.entries(GRAVIDADE).map(([valor, rotulo]) => ({ valor, rotulo }));

export function Tipos() {
  const { eu } = useSessao();
  const admin = eu?.papel === 'ADMINISTRADOR';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['tipos'], queryFn: () => api<{ id: string; nome: string; gravidadePadrao: string; ordemExibicao: number; ativo: boolean }[]>('/tipos-ocorrencia') });
  const alternar = useAlternar();
  const [nome, setNome] = useState('');
  const [g, setG] = useState('MEDIA');
  const criar = useMutation({
    mutationFn: () => api('/tipos-ocorrencia', { metodo: 'POST', corpo: { nome, gravidadePadrao: g } }),
    onSuccess: () => {
      setNome('');
      qc.invalidateQueries();
    },
  });
  return (
    <>
      <Cabecalho titulo="Tipos de ocorrência" subtitulo="Os botões que o vigilante vê em “O que aconteceu?”. Mudanças chegam ao app na próxima atualização." />
      <ErroCaixa erro={q.error ?? alternar.error} />
      <Cartao>
        {admin ? (
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <Campo rotulo="Novo tipo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Extintor vencido" className="flex-1 min-w-56" />
            <Selecao rotulo="Gravidade padrão" value={g} onChange={(e) => setG(e.target.value)} opcoes={opcoesGravidade} />
            <Botao carregando={criar.isPending} disabled={nome.trim().length < 2} onClick={() => criar.mutate()}>Adicionar</Botao>
          </div>
        ) : null}
        {criar.error ? <div className="mb-3"><Aviso>{mensagemErro(criar.error)}</Aviso></div> : null}
        {q.isLoading ? <Carregando /> : (
          <Tabela colunas={['Tipo', 'Gravidade padrão', '']}>
            {(q.data ?? []).map((t) => (
              <tr key={t.id} className={t.ativo ? '' : 'opacity-50'}>
                <Celula className="font-medium">{t.nome}</Celula>
                <Celula><Selo tom={tomGravidade(t.gravidadePadrao)}>{GRAVIDADE[t.gravidadePadrao]}</Selo></Celula>
                <Celula className="text-right">{admin ? <Botao variante="fantasma" onClick={() => alternar.mutate({ recurso: 'tipos-ocorrencia', id: t.id, ativo: t.ativo })}>{t.ativo ? 'Desativar' : 'Reativar'}</Botao> : null}</Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
    </>
  );
}

interface Usuario { id: string; nome: string; matricula: string; papel: string; ativo: boolean; deveTrocarSenha: boolean }

export function Usuarios() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['usuarios'], queryFn: () => api<Usuario[]>('/usuarios') });
  const alternar = useAlternar();
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ nome: '', matricula: '', papel: 'VIGILANTE' });
  const [senha, setSenha] = useState<{ nome: string; senha: string } | null>(null);
  const criar = useMutation({
    mutationFn: () => api<{ senhaTemporaria: string }>('/usuarios', { metodo: 'POST', corpo: f }),
    onSuccess: (r) => {
      setSenha({ nome: f.nome, senha: r.senhaTemporaria });
      setNovo(false);
      setF({ nome: '', matricula: '', papel: 'VIGILANTE' });
      qc.invalidateQueries();
    },
  });
  const redefinir = useMutation({
    mutationFn: (u: Usuario) => api<{ senhaTemporaria: string }>(`/usuarios/${u.id}/redefinicao-senha`, { metodo: 'POST' }).then((r) => ({ nome: u.nome, senha: r.senhaTemporaria })),
    onSuccess: (r) => setSenha(r),
  });
  return (
    <>
      <Cabecalho titulo="Usuários" subtitulo="Vigilantes entram no app; coordenadores e administradores, no painel. O administrador também entra no app para instalar tags." acoes={<Botao onClick={() => setNovo(true)}>Novo usuário</Botao>} />
      <ErroCaixa erro={q.error ?? alternar.error ?? redefinir.error} />
      <Cartao>
        {q.isLoading ? <Carregando /> : (
          <Tabela colunas={['Nome', 'Matrícula', 'Perfil', '']}>
            {(q.data ?? []).map((u) => (
              <tr key={u.id} className={u.ativo ? '' : 'opacity-50'}>
                <Celula className="font-medium">{u.nome}{u.deveTrocarSenha ? <span className="ml-2"><Selo tom="aviso">senha temporária</Selo></span> : null}</Celula>
                <Celula className="tabular-nums">{u.matricula}</Celula>
                <Celula>{PAPEL[u.papel]}</Celula>
                <Celula className="text-right whitespace-nowrap">
                  <Botao variante="fantasma" onClick={() => redefinir.mutate(u)}>Nova senha</Botao>
                  <Botao variante="fantasma" onClick={() => alternar.mutate({ recurso: 'usuarios', id: u.id, ativo: u.ativo })}>{u.ativo ? 'Desativar' : 'Reativar'}</Botao>
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Cartao>
      <Modal titulo="Novo usuário" aberto={novo} aoFechar={() => setNovo(false)} rodape={<><Botao variante="secundario" onClick={() => setNovo(false)}>Cancelar</Botao><Botao carregando={criar.isPending} disabled={!f.nome || !f.matricula} onClick={() => criar.mutate()}>Criar</Botao></>}>
        <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <Campo rotulo="Matrícula (é o login)" value={f.matricula} onChange={(e) => setF({ ...f, matricula: e.target.value })} />
        <Selecao rotulo="Perfil" value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value })} opcoes={Object.entries(PAPEL).filter(([k]) => k !== 'RESPONSAVEL').map(([valor, rotulo]) => ({ valor, rotulo }))} />
        <p className="text-xs text-texto2">Uma senha temporária é gerada e mostrada uma vez. A pessoa troca no primeiro acesso ao painel.</p>
        {criar.error ? <Aviso>{mensagemErro(criar.error)}</Aviso> : null}
      </Modal>
      <Modal titulo="Senha temporária" aberto={!!senha} aoFechar={() => setSenha(null)} rodape={<Botao onClick={() => setSenha(null)}>Anotei</Botao>}>
        <p className="text-sm">Passe para <b>{senha?.nome}</b>. Ela não aparece de novo.</p>
        <div className="text-3xl font-bold tracking-widest tabular-nums text-center py-3 rounded-lg bg-fundo border border-borda select-all">{senha?.senha}</div>
      </Modal>
    </>
  );
}

export function Aparelhos() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['aparelhos'],
    queryFn: () => api<{ id: string; modelo: string; plataforma: string; versaoSo: string; versaoApp: string; revogadoEm: string | null; ultimoAcessoEm: string; usuario: { nome: string; matricula: string } }[]>('/dispositivos'),
  });
  const [alvo, setAlvo] = useState<string | null>(null);
  const revogar = useMutation({
    mutationFn: (id: string) => api(`/dispositivos/${id}/revogacao`, { metodo: 'POST' }),
    onSuccess: () => {
      setAlvo(null);
      qc.invalidateQueries();
    },
  });
  return (
    <>
      <Cabecalho titulo="Aparelhos" subtitulo="Celulares que já entraram no app. Revogue um aparelho perdido: ele é desconectado em até 1 minuto." />
      <ErroCaixa erro={q.error} />
      <Cartao>
        {q.isLoading ? <Carregando /> : q.data?.length ? (
          <Tabela colunas={['Aparelho', 'Usuário', 'App', 'Último acesso', '']}>
            {q.data.map((d) => (
              <tr key={d.id} className={d.revogadoEm ? 'opacity-50' : ''}>
                <Celula>{d.modelo} <span className="text-texto2">· {d.plataforma} {d.versaoSo}</span></Celula>
                <Celula>{d.usuario.nome}</Celula>
                <Celula className="tabular-nums">{d.versaoApp}</Celula>
                <Celula className="tabular-nums">{fDataHora(d.ultimoAcessoEm)}</Celula>
                <Celula className="text-right">{d.revogadoEm ? <Selo tom="erro">Revogado</Selo> : <Botao variante="perigo" onClick={() => setAlvo(d.id)}>Revogar</Botao>}</Celula>
              </tr>
            ))}
          </Tabela>
        ) : <Vazio>Nenhum aparelho ainda.</Vazio>}
      </Cartao>
      <Modal titulo="Revogar aparelho?" aberto={!!alvo} aoFechar={() => setAlvo(null)} rodape={<><Botao variante="secundario" onClick={() => setAlvo(null)}>Voltar</Botao><Botao variante="perigo" carregando={revogar.isPending} onClick={() => alvo && revogar.mutate(alvo)}>Revogar</Botao></>}>
        <p className="text-sm">O aparelho sai da conta e não consegue entrar de novo. Registros que ainda não foram enviados ficam presos nele.</p>
        {revogar.error ? <Aviso>{mensagemErro(revogar.error)}</Aviso> : null}
      </Modal>
    </>
  );
}

interface CampusCfg { nome: string; politicaGeo: string; precisaoMaximaM: number; toleranciaInicioMin: number; inatividadeBloqueioMin: number }

export function Campus() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['campus'], queryFn: () => api<CampusCfg>('/campus') });
  const [f, setF] = useState<CampusCfg | null>(null);
  useEffect(() => {
    if (q.data) setF(q.data);
  }, [q.data]);
  const salvar = useMutation({
    mutationFn: () => api('/campus', { metodo: 'PATCH', corpo: { nome: f!.nome, politicaGeo: f!.politicaGeo, precisaoMaximaM: Number(f!.precisaoMaximaM), toleranciaInicioMin: Number(f!.toleranciaInicioMin), inatividadeBloqueioMin: Number(f!.inatividadeBloqueioMin) } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  if (!f) return q.error ? <ErroCaixa erro={q.error} /> : <Carregando />;
  return (
    <>
      <Cabecalho titulo="Campus" subtitulo="Regras que valem para todos os celulares. Mudanças chegam ao app na próxima atualização." />
      <Cartao className="max-w-xl">
        <div className="flex flex-col gap-4">
          <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          <Selecao
            rotulo="Leitura fora da área do ponto"
            value={f.politicaGeo}
            onChange={(e) => setF({ ...f, politicaGeo: e.target.value })}
            opcoes={[{ valor: 'SINALIZAR', rotulo: 'Aceitar e sinalizar para revisão' }, { valor: 'BLOQUEAR', rotulo: 'Bloquear no celular' }]}
          />
          <div className="grid grid-cols-3 gap-3">
            <Campo rotulo="Precisão máxima do GPS (m)" type="number" value={f.precisaoMaximaM} onChange={(e) => setF({ ...f, precisaoMaximaM: Number(e.target.value) })} />
            <Campo rotulo="Tolerância de início (min)" type="number" value={f.toleranciaInicioMin} onChange={(e) => setF({ ...f, toleranciaInicioMin: Number(e.target.value) })} />
            <Campo rotulo="Bloqueio por inatividade (min)" type="number" value={f.inatividadeBloqueioMin} onChange={(e) => setF({ ...f, inatividadeBloqueioMin: Number(e.target.value) })} />
          </div>
          {salvar.error ? <Aviso>{mensagemErro(salvar.error)}</Aviso> : null}
          {salvar.isSuccess ? <Aviso tom="sucesso">Salvo.</Aviso> : null}
          <div><Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Botao></div>
        </div>
      </Cartao>
    </>
  );
}
