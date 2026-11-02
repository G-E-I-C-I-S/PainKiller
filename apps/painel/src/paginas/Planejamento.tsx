// Planejamento (docs/10 · 4.6): roteiros com pontos e ordem, agendas recorrentes e ronda avulsa.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mensagemErro } from '../api';
import { DIAS, hojeLocal } from '../textos';
import { Aviso, Botao, Cabecalho, Campo, Cartao, Carregando, Celula, ErroCaixa, Modal, Selecao, Selo, Tabela, Vazio } from '../ui/base';

interface Ponto { id: string; nome: string; predioNome: string; andarNome: string | null; ativo: boolean; tag: { uidHex: string } | null }
interface Roteiro { id: string; nome: string; exigeOrdem: boolean; ativo: boolean; pontos: { pontoRondaId: string; ordem: number; obrigatorio: boolean }[]; _count: { agendas: number } }
interface Agenda { id: string; roteiroId: string; vigilanteId: string; diasSemana: number[]; horaInicio: string; duracaoMin: number; toleranciaInicioMin: number; ativo: boolean; roteiro: { nome: string }; vigilante: { nome: string } }
interface Usuario { id: string; nome: string; papel: string; ativo: boolean }

const useDados = () => {
  const pontos = useQuery({ queryKey: ['pontos'], queryFn: () => api<Ponto[]>('/pontos-ronda') });
  const roteiros = useQuery({ queryKey: ['roteiros'], queryFn: () => api<Roteiro[]>('/roteiros') });
  const agendas = useQuery({ queryKey: ['agendas'], queryFn: () => api<Agenda[]>('/agendas') });
  const vigilantes = useQuery({ queryKey: ['usuarios', 'VIGILANTE'], queryFn: () => api<Usuario[]>('/usuarios?papel=VIGILANTE') });
  return { pontos, roteiros, agendas, vigilantes };
};

function EditorRoteiro({ inicial, pontos, aoFechar }: { inicial: Roteiro | null; pontos: Ponto[]; aoFechar: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [exigeOrdem, setExigeOrdem] = useState(inicial?.exigeOrdem ?? false);
  const [lista, setLista] = useState<{ pontoRondaId: string; obrigatorio: boolean }[]>(inicial?.pontos.map((p) => ({ pontoRondaId: p.pontoRondaId, obrigatorio: p.obrigatorio })) ?? []);
  const m = useMutation({
    mutationFn: () => api(inicial ? `/roteiros/${inicial.id}` : '/roteiros', { metodo: inicial ? 'PATCH' : 'POST', corpo: { nome, exigeOrdem, pontos: lista } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roteiros'] });
      aoFechar();
    },
  });
  const nomeDe = (id: string) => pontos.find((p) => p.id === id);
  const mover = (i: number, d: number) => {
    const n = [...lista];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setLista(n);
  };
  const disponiveis = pontos.filter((p) => p.ativo && !lista.some((l) => l.pontoRondaId === p.id));
  return (
    <Modal
      titulo={inicial ? 'Editar roteiro' : 'Novo roteiro'}
      aberto
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao carregando={m.isPending} disabled={!nome.trim() || !lista.length} onClick={() => m.mutate()}>Salvar</Botao>
        </>
      }
    >
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Noturna P1 e P2" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={exigeOrdem} onChange={(e) => setExigeOrdem(e.target.checked)} className="size-4 accent-[var(--primaria)]" />
        Exigir a ordem dos pontos
      </label>
      <div>
        <div className="text-xs font-medium text-texto2 mb-1.5">Pontos do roteiro ({lista.length})</div>
        {lista.length ? (
          <ol className="flex flex-col gap-1.5">
            {lista.map((l, i) => {
              const p = nomeDe(l.pontoRondaId);
              return (
                <li key={l.pontoRondaId} className="flex items-center gap-2 rounded-lg bg-fundo border border-borda px-3 py-2 text-sm">
                  <span className="text-texto2 tabular-nums w-5">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate">{p?.nome} <span className="text-texto2">· {p?.predioNome}</span></span>
                  <label className="flex items-center gap-1 text-xs text-texto2">
                    <input type="checkbox" checked={l.obrigatorio} onChange={(e) => setLista(lista.map((x, j) => (j === i ? { ...x, obrigatorio: e.target.checked } : x)))} />
                    obrigatório
                  </label>
                  <button className="px-1 text-texto2 hover:text-texto disabled:opacity-30" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir">↑</button>
                  <button className="px-1 text-texto2 hover:text-texto disabled:opacity-30" disabled={i === lista.length - 1} onClick={() => mover(i, 1)} aria-label="Descer">↓</button>
                  <button className="px-1 text-erro" onClick={() => setLista(lista.filter((_, j) => j !== i))} aria-label="Tirar">×</button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-texto2">Adicione os pontos abaixo.</p>
        )}
      </div>
      {disponiveis.length ? (
        <div>
          <div className="text-xs font-medium text-texto2 mb-1.5">Adicionar ponto</div>
          <div className="flex flex-wrap gap-1.5">
            {disponiveis.map((p) => (
              <button key={p.id} onClick={() => setLista([...lista, { pontoRondaId: p.id, obrigatorio: true }])} className="rounded-full border border-borda px-3 py-1 text-xs hover:border-primaria hover:text-primaria">
                + {p.nome} <span className="text-texto2">· {p.predioNome}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
    </Modal>
  );
}

function NovaAgenda({ roteiros, vigilantes, aoFechar }: { roteiros: Roteiro[]; vigilantes: Usuario[]; aoFechar: () => void }) {
  const qc = useQueryClient();
  const [roteiroId, setRoteiroId] = useState(roteiros[0]?.id ?? '');
  const [vigilanteId, setVigilanteId] = useState(vigilantes[0]?.id ?? '');
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hora, setHora] = useState('22:00');
  const [duracao, setDuracao] = useState('60');
  const [tolerancia, setTolerancia] = useState('30');
  const m = useMutation({
    mutationFn: () => api('/agendas', { metodo: 'POST', corpo: { roteiroId, vigilanteId, diasSemana: dias, horaInicio: hora, duracaoMin: Number(duracao), toleranciaInicioMin: Number(tolerancia) } }),
    onSuccess: () => {
      qc.invalidateQueries();
      aoFechar();
    },
  });
  return (
    <Modal
      titulo="Nova agenda"
      aberto
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao carregando={m.isPending} disabled={!roteiroId || !vigilanteId || !dias.length} onClick={() => m.mutate()}>Criar agenda</Botao>
        </>
      }
    >
      <p className="text-sm text-texto2">A ronda é criada sozinha em cada dia marcado e aparece no celular do vigilante com até 2 dias de antecedência.</p>
      <Selecao rotulo="Roteiro" value={roteiroId} onChange={(e) => setRoteiroId(e.target.value)} opcoes={roteiros.map((r) => ({ valor: r.id, rotulo: r.nome }))} />
      <Selecao rotulo="Vigilante" value={vigilanteId} onChange={(e) => setVigilanteId(e.target.value)} opcoes={vigilantes.map((v) => ({ valor: v.id, rotulo: v.nome }))} />
      <div>
        <div className="text-xs font-medium text-texto2 mb-1.5">Dias da semana</div>
        <div className="flex flex-wrap gap-1.5">
          {DIAS.map((d, i) => (
            <button key={d} onClick={() => setDias(dias.includes(i) ? dias.filter((x) => x !== i) : [...dias, i].sort())} className={`rounded-lg px-3 h-9 text-sm border ${dias.includes(i) ? 'bg-primaria text-sobre-primaria border-primaria font-semibold' : 'border-borda text-texto2'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo="Início" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        <Campo rotulo="Duração (min)" type="number" min={10} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
        <Campo rotulo="Tolerância (min)" type="number" min={0} value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} />
      </div>
      {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
    </Modal>
  );
}

function RondaAvulsa({ roteiros, vigilantes, aoFechar }: { roteiros: Roteiro[]; vigilantes: Usuario[]; aoFechar: () => void }) {
  const qc = useQueryClient();
  const [roteiroId, setRoteiroId] = useState(roteiros[0]?.id ?? '');
  const [vigilanteId, setVigilanteId] = useState(vigilantes[0]?.id ?? '');
  const [dia, setDia] = useState(hojeLocal());
  const agora = new Date();
  const [hora, setHora] = useState(`${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`);
  const [duracao, setDuracao] = useState('60');
  const m = useMutation({
    mutationFn: () => api('/rondas', { metodo: 'POST', corpo: { roteiroId, vigilanteId, inicioPrevisto: new Date(`${dia}T${hora}:00`).toISOString(), duracaoMin: Number(duracao) } }),
    onSuccess: () => {
      qc.invalidateQueries();
      aoFechar();
    },
  });
  return (
    <Modal
      titulo="Ronda avulsa"
      aberto
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao carregando={m.isPending} disabled={!roteiroId || !vigilanteId} onClick={() => m.mutate()}>Criar ronda</Botao>
        </>
      }
    >
      <p className="text-sm text-texto2">Uma ronda só, fora da agenda. Aparece no celular do vigilante na próxima atualização (abrir o app ou puxar a lista).</p>
      <Selecao rotulo="Roteiro" value={roteiroId} onChange={(e) => setRoteiroId(e.target.value)} opcoes={roteiros.map((r) => ({ valor: r.id, rotulo: r.nome }))} />
      <Selecao rotulo="Vigilante" value={vigilanteId} onChange={(e) => setVigilanteId(e.target.value)} opcoes={vigilantes.map((v) => ({ valor: v.id, rotulo: v.nome }))} />
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo="Dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        <Campo rotulo="Início" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        <Campo rotulo="Duração (min)" type="number" min={10} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
      </div>
      {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
    </Modal>
  );
}

export function Planejamento() {
  const { pontos, roteiros, agendas, vigilantes } = useDados();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Roteiro | null | 'novo'>(null);
  const [modal, setModal] = useState<'agenda' | 'avulsa' | null>(null);
  const alternar = useMutation({
    mutationFn: ({ recurso, id, ativo }: { recurso: string; id: string; ativo: boolean }) =>
      api(`/${recurso}/${id}/${ativo ? 'desativacao' : 'reativacao'}`, { metodo: 'POST', corpo: ativo ? { motivo: 'Desativado pelo painel' } : undefined }),
    onSuccess: () => qc.invalidateQueries(),
  });
  if (roteiros.isLoading || pontos.isLoading) return <Carregando />;
  const rs = roteiros.data ?? [];
  const ativos = rs.filter((r) => r.ativo);
  const vigs = (vigilantes.data ?? []).filter((v) => v.ativo);
  return (
    <>
      <Cabecalho
        titulo="Roteiros e agendas"
        subtitulo="Roteiro é a lista de pontos. Agenda diz quem faz, em que dias e horário. A ronda avulsa é uma só, fora da agenda."
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setModal('avulsa')} disabled={!ativos.length || !vigs.length}>Ronda avulsa</Botao>
            <Botao onClick={() => setModal('agenda')} disabled={!ativos.length || !vigs.length}>Nova agenda</Botao>
          </>
        }
      />
      <ErroCaixa erro={roteiros.error ?? agendas.error ?? alternar.error} />
      {!vigs.length && !vigilantes.isLoading ? <div className="mb-4"><Aviso tom="aviso">Cadastre um vigilante em Usuários para criar agendas.</Aviso></div> : null}
      <div className="grid gap-4">
        <Cartao titulo="Agendas" >
          {agendas.data?.length ? (
            <Tabela colunas={['Horário', 'Dias', 'Roteiro', 'Vigilante', '']}>
              {agendas.data.map((a) => (
                <tr key={a.id} className={a.ativo ? '' : 'opacity-50'}>
                  <Celula className="whitespace-nowrap tabular-nums">{a.horaInicio} · {a.duracaoMin} min</Celula>
                  <Celula className="whitespace-nowrap">{a.diasSemana.length === 7 ? 'Todos os dias' : a.diasSemana.map((d) => DIAS[d]).join(', ')}</Celula>
                  <Celula>{a.roteiro.nome}</Celula>
                  <Celula>{a.vigilante.nome}</Celula>
                  <Celula className="text-right">
                    <Botao variante={a.ativo ? 'fantasma' : 'secundario'} onClick={() => alternar.mutate({ recurso: 'agendas', id: a.id, ativo: a.ativo })}>{a.ativo ? 'Desativar' : 'Reativar'}</Botao>
                  </Celula>
                </tr>
              ))}
            </Tabela>
          ) : (
            <Vazio>Nenhuma agenda. Crie uma para as rondas aparecerem sozinhas no celular.</Vazio>
          )}
        </Cartao>
        <Cartao titulo="Roteiros" acao={<Botao variante="secundario" onClick={() => setEditando('novo')}>Novo roteiro</Botao>}>
          {rs.length ? (
            <Tabela colunas={['Roteiro', 'Pontos', 'Agendas', '']}>
              {rs.map((r) => (
                <tr key={r.id} className={r.ativo ? '' : 'opacity-50'}>
                  <Celula>
                    <div className="font-medium">{r.nome}</div>
                    {r.exigeOrdem ? <Selo tom="info">exige ordem</Selo> : null}
                  </Celula>
                  <Celula className="text-sm text-texto2">
                    {r.pontos.map((p) => pontos.data?.find((x) => x.id === p.pontoRondaId)?.nome).join(' → ')}
                  </Celula>
                  <Celula>{r._count.agendas}</Celula>
                  <Celula className="text-right whitespace-nowrap">
                    <Botao variante="fantasma" onClick={() => setEditando(r)}>Editar</Botao>
                    <Botao variante="fantasma" onClick={() => alternar.mutate({ recurso: 'roteiros', id: r.id, ativo: r.ativo })}>{r.ativo ? 'Desativar' : 'Reativar'}</Botao>
                  </Celula>
                </tr>
              ))}
            </Tabela>
          ) : (
            <Vazio>Nenhum roteiro ainda.</Vazio>
          )}
        </Cartao>
      </div>
      {editando ? <EditorRoteiro inicial={editando === 'novo' ? null : editando} pontos={pontos.data ?? []} aoFechar={() => setEditando(null)} /> : null}
      {modal === 'agenda' ? <NovaAgenda roteiros={ativos} vigilantes={vigs} aoFechar={() => setModal(null)} /> : null}
      {modal === 'avulsa' ? <RondaAvulsa roteiros={ativos} vigilantes={vigs} aoFechar={() => setModal(null)} /> : null}
    </>
  );
}
