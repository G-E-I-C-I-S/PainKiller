// Prédios, andares, pontos de ronda e tags (docs/10 · 4.7). A tag é gravada no app (Instalação de tags); aqui se vê o vínculo.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, mensagemErro } from '../api';
import { useSessao } from '../sessao';
import { fDataHora } from '../textos';
import { AreaTexto, Aviso, Botao, Cabecalho, Campo, Cartao, Carregando, ErroCaixa, Modal, Selecao, Selo, Vazio } from '../ui/base';

interface Predio { id: string; codigo: string; nome: string; latitude: number | null; longitude: number | null; raioGeofenceM: number | null; ativo: boolean; andares: { id: string; nome: string; ordem: number; ativo: boolean }[] }
interface Ponto {
  id: string; predioId: string; andarId: string | null; nome: string; instrucoes: string | null; latitude: number | null; longitude: number | null; raioToleranciaM: number; ativo: boolean;
  predioNome: string; andarNome: string | null; tag: { uidHex: string; tipo: string; vinculadaEm: string } | null;
}

const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

function FormPredio({ inicial, aoFechar }: { inicial: Predio | null; aoFechar: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ codigo: inicial?.codigo ?? '', nome: inicial?.nome ?? '', latitude: String(inicial?.latitude ?? ''), longitude: String(inicial?.longitude ?? ''), raio: String(inicial?.raioGeofenceM ?? '') });
  const m = useMutation({
    mutationFn: () =>
      api(inicial ? `/predios/${inicial.id}` : '/predios', {
        metodo: inicial ? 'PATCH' : 'POST',
        corpo: { codigo: f.codigo, nome: f.nome, latitude: num(f.latitude), longitude: num(f.longitude), raioGeofenceM: num(f.raio) },
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      aoFechar();
    },
  });
  return (
    <Modal titulo={inicial ? 'Editar prédio' : 'Novo prédio'} aberto aoFechar={aoFechar} rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao carregando={m.isPending} disabled={!f.codigo || !f.nome} onClick={() => m.mutate()}>Salvar</Botao></>}>
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo="Código" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} placeholder="P1" />
        <Campo rotulo="Nome" className="col-span-2" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Prédio 1" />
      </div>
      <p className="text-xs text-texto2">Área do prédio (opcional): usada para conferir se a leitura foi feita no lugar certo quando o ponto não tem posição própria.</p>
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo="Latitude" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} placeholder="-21.3500" />
        <Campo rotulo="Longitude" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} placeholder="-46.5200" />
        <Campo rotulo="Raio (m)" value={f.raio} onChange={(e) => setF({ ...f, raio: e.target.value })} placeholder="80" />
      </div>
      {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
    </Modal>
  );
}

function FormPonto({ inicial, predios, aoFechar }: { inicial: Ponto | null; predios: Predio[]; aoFechar: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    predioId: inicial?.predioId ?? predios[0]?.id ?? '', andarId: inicial?.andarId ?? '', nome: inicial?.nome ?? '', instrucoes: inicial?.instrucoes ?? '',
    latitude: String(inicial?.latitude ?? ''), longitude: String(inicial?.longitude ?? ''), raio: String(inicial?.raioToleranciaM ?? 30),
  });
  const andares = predios.find((p) => p.id === f.predioId)?.andares.filter((a) => a.ativo) ?? [];
  const m = useMutation({
    mutationFn: () =>
      api(inicial ? `/pontos-ronda/${inicial.id}` : '/pontos-ronda', {
        metodo: inicial ? 'PATCH' : 'POST',
        corpo: { predioId: f.predioId, andarId: f.andarId || null, nome: f.nome, instrucoes: f.instrucoes || null, latitude: num(f.latitude), longitude: num(f.longitude), raioToleranciaM: num(f.raio) ?? 30 },
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      aoFechar();
    },
  });
  return (
    <Modal titulo={inicial ? 'Editar ponto' : 'Novo ponto'} aberto aoFechar={aoFechar} rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao carregando={m.isPending} disabled={!f.nome || !f.predioId} onClick={() => m.mutate()}>Salvar</Botao></>}>
      <Campo rotulo="Nome do ponto" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Portaria principal" />
      <div className="grid grid-cols-2 gap-3">
        <Selecao rotulo="Prédio" value={f.predioId} onChange={(e) => setF({ ...f, predioId: e.target.value, andarId: '' })} opcoes={predios.filter((p) => p.ativo).map((p) => ({ valor: p.id, rotulo: `${p.codigo} · ${p.nome}` }))} />
        <Selecao rotulo="Andar" value={f.andarId} onChange={(e) => setF({ ...f, andarId: e.target.value })} opcoes={[{ valor: '', rotulo: '—' }, ...andares.map((a) => ({ valor: a.id, rotulo: a.nome }))]} />
      </div>
      <AreaTexto rotulo="Instruções para o vigilante (opcional)" value={f.instrucoes} onChange={(e) => setF({ ...f, instrucoes: e.target.value })} />
      <p className="text-xs text-texto2">Posição do ponto (opcional). O app de instalação também pode gravar a posição na hora de instalar a tag.</p>
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo="Latitude" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} />
        <Campo rotulo="Longitude" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} />
        <Campo rotulo="Tolerância (m)" value={f.raio} onChange={(e) => setF({ ...f, raio: e.target.value })} />
      </div>
      {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
    </Modal>
  );
}

function NovoAndar({ predio, aoFechar }: { predio: Predio; aoFechar: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const m = useMutation({
    mutationFn: () => api('/andares', { metodo: 'POST', corpo: { predioId: predio.id, nome, ordem: predio.andares.length } }),
    onSuccess: () => {
      qc.invalidateQueries();
      aoFechar();
    },
  });
  return (
    <Modal titulo={`Novo andar · ${predio.nome}`} aberto aoFechar={aoFechar} rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao carregando={m.isPending} disabled={!nome.trim()} onClick={() => m.mutate()}>Salvar</Botao></>}>
      <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: 2º andar" autoFocus />
      {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
    </Modal>
  );
}

export function Pontos() {
  const { eu } = useSessao();
  const admin = eu?.papel === 'ADMINISTRADOR';
  const qc = useQueryClient();
  const predios = useQuery({ queryKey: ['predios'], queryFn: () => api<Predio[]>('/predios') });
  const pontos = useQuery({ queryKey: ['pontos'], queryFn: () => api<Ponto[]>('/pontos-ronda') });
  const [form, setForm] = useState<{ tipo: 'predio'; v: Predio | null } | { tipo: 'ponto'; v: Ponto | null } | { tipo: 'andar'; v: Predio } | null>(null);
  const alternar = useMutation({
    mutationFn: ({ recurso, id, ativo }: { recurso: string; id: string; ativo: boolean }) =>
      api(`/${recurso}/${id}/${ativo ? 'desativacao' : 'reativacao'}`, { metodo: 'POST', corpo: ativo ? { motivo: 'Desativado pelo painel' } : undefined }),
    onSuccess: () => qc.invalidateQueries(),
  });
  if (predios.isLoading || pontos.isLoading) return <Carregando />;
  const ps = pontos.data ?? [];
  const semTag = ps.filter((p) => p.ativo && !p.tag).length;
  return (
    <>
      <Cabecalho
        titulo="Prédios, pontos e tags"
        subtitulo="Cada ponto recebe uma tag NFC. Para gravar, use o app com o usuário administrador: Perfil → Instalação de tags."
        acoes={admin ? <><Botao variante="secundario" onClick={() => setForm({ tipo: 'predio', v: null })}>Novo prédio</Botao><Botao onClick={() => setForm({ tipo: 'ponto', v: null })} disabled={!predios.data?.length}>Novo ponto</Botao></> : null}
      />
      <ErroCaixa erro={predios.error ?? pontos.error ?? alternar.error} />
      {semTag ? <div className="mb-4"><Aviso tom="aviso">{semTag} ponto(s) ativo(s) ainda sem tag gravada.</Aviso></div> : null}
      <div className="grid gap-4">
        {(predios.data ?? []).map((pr) => {
          const doPredio = ps.filter((p) => p.predioId === pr.id);
          return (
            <Cartao
              key={pr.id}
              titulo={<span className={pr.ativo ? '' : 'line-through'}>{pr.codigo} · {pr.nome}</span>}
              acao={
                admin ? (
                  <div className="flex gap-1">
                    <Botao variante="fantasma" onClick={() => setForm({ tipo: 'andar', v: pr })}>+ Andar</Botao>
                    <Botao variante="fantasma" onClick={() => setForm({ tipo: 'predio', v: pr })}>Editar</Botao>
                    <Botao variante="fantasma" onClick={() => alternar.mutate({ recurso: 'predios', id: pr.id, ativo: pr.ativo })}>{pr.ativo ? 'Desativar' : 'Reativar'}</Botao>
                  </div>
                ) : null
              }
            >
              {pr.andares.length ? <p className="text-xs text-texto2 mb-3">Andares: {pr.andares.map((a) => a.nome).join(', ')}</p> : null}
              {doPredio.length ? (
                <ul className="divide-y divide-borda -my-2">
                  {doPredio.map((p) => (
                    <li key={p.id} className={`flex flex-wrap items-center gap-3 py-3 ${p.ativo ? '' : 'opacity-50'}`}>
                      <div className="flex-1 min-w-48">
                        <div className="font-medium">{p.nome}</div>
                        <div className="text-xs text-texto2">{p.andarNome ?? 'Sem andar'}{p.instrucoes ? ` · ${p.instrucoes}` : ''}</div>
                      </div>
                      {p.tag ? (
                        <span title={`Gravada em ${fDataHora(p.tag.vinculadaEm)}`}><Selo tom="sucesso">Tag {p.tag.uidHex}</Selo></span>
                      ) : (
                        <Selo tom="aviso">Sem tag</Selo>
                      )}
                      {p.latitude != null ? <Selo tom="info">com posição</Selo> : null}
                      {admin ? (
                        <div className="flex gap-1">
                          <Botao variante="fantasma" onClick={() => setForm({ tipo: 'ponto', v: p })}>Editar</Botao>
                          <Botao variante="fantasma" onClick={() => alternar.mutate({ recurso: 'pontos-ronda', id: p.id, ativo: p.ativo })}>{p.ativo ? 'Desativar' : 'Reativar'}</Botao>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Vazio>Nenhum ponto neste prédio.</Vazio>
              )}
            </Cartao>
          );
        })}
        {!predios.data?.length ? <Cartao><Vazio>Comece cadastrando um prédio.</Vazio></Cartao> : null}
      </div>
      {form?.tipo === 'predio' ? <FormPredio inicial={form.v} aoFechar={() => setForm(null)} /> : null}
      {form?.tipo === 'ponto' ? <FormPonto inicial={form.v} predios={predios.data ?? []} aoFechar={() => setForm(null)} /> : null}
      {form?.tipo === 'andar' ? <NovoAndar predio={form.v} aoFechar={() => setForm(null)} /> : null}
    </>
  );
}
