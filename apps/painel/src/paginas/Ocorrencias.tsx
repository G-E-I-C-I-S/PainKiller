// Ocorrências (docs/10 · 4.4): lista com filtros e detalhe com fotos, histórico e mudança de status.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, imagem, mensagemErro } from '../api';
import { useSessao } from '../sessao';
import { fDataHora, GRAVIDADE, STATUS_OCORRENCIA } from '../textos';
import { AreaTexto, Aviso, Botao, Cabecalho, Cartao, Carregando, Celula, ErroCaixa, Modal, Selecao, Selo, Tabela, tomGravidade, tomOcorrencia, Vazio } from '../ui/base';

interface Linha {
  id: string;
  tipo: string;
  gravidade: string;
  status: string;
  predio: string;
  detalheLocal: string | null;
  descricao: string | null;
  autor: string;
  roteiro: string;
  registradaEm: string;
  fotos: number;
}

export function Ocorrencias() {
  const [p, setP] = useSearchParams();
  const nav = useNavigate();
  const status = p.get('status') ?? '';
  const gravidade = p.get('gravidade') ?? '';
  const mudar = (k: string, v: string) => {
    const n = new URLSearchParams(p);
    if (v) n.set(k, v);
    else n.delete(k);
    setP(n);
  };
  const q = useQuery({ queryKey: ['ocorrencias', status, gravidade], queryFn: () => api<{ itens: Linha[]; total: number }>(`/ocorrencias?status=${status}&gravidade=${gravidade}&tamanho=100`) });
  return (
    <>
      <Cabecalho titulo="Ocorrências" subtitulo="O que os vigilantes registraram nas rondas." />
      <Cartao>
        <div className="flex flex-wrap gap-3 mb-4">
          <Selecao rotulo="Status" value={status} onChange={(e) => mudar('status', e.target.value)} opcoes={[{ valor: '', rotulo: 'Todos' }, ...Object.entries(STATUS_OCORRENCIA).map(([valor, rotulo]) => ({ valor, rotulo }))]} />
          <Selecao rotulo="Gravidade" value={gravidade} onChange={(e) => mudar('gravidade', e.target.value)} opcoes={[{ valor: '', rotulo: 'Todas' }, ...Object.entries(GRAVIDADE).map(([valor, rotulo]) => ({ valor, rotulo }))]} />
        </div>
        <ErroCaixa erro={q.error} />
        {q.isLoading ? (
          <Carregando />
        ) : q.data?.itens.length ? (
          <Tabela colunas={['Quando', 'Tipo', 'Local', 'Vigilante', 'Gravidade', 'Status']}>
            {q.data.itens.map((o) => (
              <tr key={o.id} className="hover:bg-elevada cursor-pointer" onClick={() => nav(`/ocorrencias/${o.id}`)}>
                <Celula className="whitespace-nowrap tabular-nums">{fDataHora(o.registradaEm)}</Celula>
                <Celula>
                  <div className="font-medium">{o.tipo}{o.fotos ? <span className="text-texto2 font-normal"> · {o.fotos} foto(s)</span> : null}</div>
                  {o.descricao ? <div className="text-xs text-texto2 line-clamp-1">{o.descricao}</div> : null}
                </Celula>
                <Celula>{o.predio}{o.detalheLocal ? ` · ${o.detalheLocal}` : ''}</Celula>
                <Celula>{o.autor}</Celula>
                <Celula><Selo tom={tomGravidade(o.gravidade)}>{GRAVIDADE[o.gravidade]}</Selo></Celula>
                <Celula><Selo tom={tomOcorrencia(o.status)}>{STATUS_OCORRENCIA[o.status]}</Selo></Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Nenhuma ocorrência com esses filtros.</Vazio>
        )}
      </Cartao>
    </>
  );
}

interface Detalhe {
  id: string;
  tipo: string;
  gravidade: string;
  status: string;
  descricao: string | null;
  predio: string;
  ponto: string | null;
  detalheLocal: string | null;
  resolvidoNoLocal: boolean;
  autor: string;
  rondaId: string;
  roteiro: string;
  registradaEm: string;
  recebidoEmServidor: string;
  localizacao: { latitude: number; longitude: number; precisaoM: number } | null;
  localizacaoSimulada: boolean;
  fotos: { id: string; tamanhoBytes: number }[];
  fotosPendentes: number;
  historico: { de: string; para: string; comentario: string | null; por: string; em: string }[];
}

function Foto({ ocorrenciaId, fotoId, aoAbrir }: { ocorrenciaId: string; fotoId: string; aoAbrir: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let u: string | null = null;
    imagem(`/ocorrencias/${ocorrenciaId}/fotos/${fotoId}`)
      .then((x) => setUrl((u = x)))
      .catch(() => setErro(true));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [ocorrenciaId, fotoId]);
  if (erro) return <div className="aspect-square rounded-lg bg-elevada flex items-center justify-center text-xs text-erro">Erro na foto</div>;
  if (!url) return <div className="aspect-square rounded-lg bg-elevada animate-pulse" />;
  return (
    <button onClick={() => aoAbrir(url)} className="aspect-square rounded-lg overflow-hidden border border-borda hover:border-primaria">
      <img src={url} alt="Foto da ocorrência" className="w-full h-full object-cover" />
    </button>
  );
}

const PROXIMOS: Record<string, string[]> = { ABERTA: ['EM_ATENDIMENTO', 'RESOLVIDA', 'ARQUIVADA'], EM_ATENDIMENTO: ['RESOLVIDA'], RESOLVIDA: ['ARQUIVADA'], ARQUIVADA: [] };

export function Ocorrencia() {
  const { id } = useParams();
  const { eu } = useSessao();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ocorrencia', id], queryFn: () => api<Detalhe>(`/ocorrencias/${id}`) });
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [novo, setNovo] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/ocorrencias/${id}/status`, { metodo: 'POST', corpo: { statusNovo: novo, comentario: comentario.trim() || undefined } }),
    onSuccess: () => {
      setNovo(null);
      setComentario('');
      qc.invalidateQueries();
    },
  });
  if (q.isLoading) return <Carregando />;
  if (!q.data) return <ErroCaixa erro={q.error} />;
  const o = q.data;
  const pode = eu?.papel !== 'RESPONSAVEL';
  return (
    <>
      <Link to="/ocorrencias" className="text-sm text-texto2 hover:text-texto">← Ocorrências</Link>
      <Cabecalho
        titulo={o.tipo}
        subtitulo={<>{o.predio}{o.ponto ? ` · ${o.ponto}` : ''}{o.detalheLocal ? ` · ${o.detalheLocal}` : ''}</>}
        acoes={pode ? PROXIMOS[o.status].map((s) => <Botao key={s} variante={s === 'ARQUIVADA' ? 'secundario' : 'primario'} onClick={() => setNovo(s)}>{STATUS_OCORRENCIA[s]}</Botao>) : null}
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <Selo tom={tomGravidade(o.gravidade)}>Gravidade {GRAVIDADE[o.gravidade].toLowerCase()}</Selo>
        <Selo tom={tomOcorrencia(o.status)}>{STATUS_OCORRENCIA[o.status]}</Selo>
        {o.resolvidoNoLocal ? <Selo tom="sucesso">Resolvido no local pelo vigilante</Selo> : null}
        {o.localizacaoSimulada ? <Selo tom="critica">Localização simulada</Selo> : null}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Cartao titulo="Registro" className="lg:col-span-2">
          <p className="whitespace-pre-wrap">{o.descricao || <span className="text-texto2">Sem descrição.</span>}</p>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
            <div><dt className="text-texto2 text-xs">Vigilante</dt><dd>{o.autor}</dd></div>
            <div><dt className="text-texto2 text-xs">Ronda</dt><dd><Link className="text-primaria hover:underline" to={`/rondas/${o.rondaId}`}>{o.roteiro}</Link></dd></div>
            <div><dt className="text-texto2 text-xs">Registrada no celular</dt><dd>{fDataHora(o.registradaEm)}</dd></div>
            <div><dt className="text-texto2 text-xs">Recebida no servidor</dt><dd>{fDataHora(o.recebidoEmServidor)}</dd></div>
            {o.localizacao ? (
              <div className="sm:col-span-2">
                <dt className="text-texto2 text-xs">Localização</dt>
                <dd>
                  <a className="text-primaria hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${o.localizacao.latitude}&mlon=${o.localizacao.longitude}#map=19/${o.localizacao.latitude}/${o.localizacao.longitude}`}>
                    {o.localizacao.latitude.toFixed(5)}, {o.localizacao.longitude.toFixed(5)}
                  </a>{' '}
                  <span className="text-texto2">(± {Math.round(o.localizacao.precisaoM)} m)</span>
                </dd>
              </div>
            ) : null}
          </dl>
        </Cartao>
        <Cartao titulo="Histórico">
          {o.historico.length ? (
            <ol className="flex flex-col gap-3 text-sm">
              {o.historico.map((h, i) => (
                <li key={i}>
                  <div><Selo tom={tomOcorrencia(h.para)}>{STATUS_OCORRENCIA[h.para]}</Selo> <span className="text-xs text-texto2">{h.por} · {fDataHora(h.em)}</span></div>
                  {h.comentario ? <p className="text-texto2 mt-1">{h.comentario}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <Vazio>Sem mudanças de status.</Vazio>
          )}
        </Cartao>
        <Cartao titulo={`Fotos (${o.fotos.length})`} className="lg:col-span-3">
          {o.fotosPendentes ? <div className="mb-3"><Aviso tom="info">{o.fotosPendentes} foto(s) ainda sendo enviada(s) pelo celular.</Aviso></div> : null}
          {o.fotos.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">{o.fotos.map((f) => <Foto key={f.id} ocorrenciaId={o.id} fotoId={f.id} aoAbrir={setAmpliada} />)}</div>
          ) : !o.fotosPendentes ? (
            <Vazio>Sem fotos.</Vazio>
          ) : null}
        </Cartao>
      </div>

      {ampliada ? (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="Foto ampliada" className="max-w-full max-h-full rounded-lg" />
        </div>
      ) : null}

      <Modal
        titulo={`Mudar para ${novo ? STATUS_OCORRENCIA[novo] : ''}`}
        aberto={!!novo}
        aoFechar={() => setNovo(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setNovo(null)}>Voltar</Botao>
            <Botao carregando={m.isPending} disabled={(novo === 'RESOLVIDA' || novo === 'ARQUIVADA') && !comentario.trim()} onClick={() => m.mutate()}>Confirmar</Botao>
          </>
        }
      >
        <AreaTexto rotulo={novo === 'EM_ATENDIMENTO' ? 'Comentário (opcional)' : 'Comentário'} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Ex.: equipe de manutenção acionada" />
        {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
      </Modal>
    </>
  );
}
