// Histórico de rondas (docs/10 · 4.2) e detalhe com pontos e linha do tempo (4.3).
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, mensagemErro } from '../api';
import { useSessao } from '../sessao';
import { duracao, fDataHora, fHora, fHoraSeg, GEO, GRAVIDADE, hojeLocal, MOTIVO, SITUACAO_PONTO, somarDias, STATUS_OCORRENCIA, STATUS_RONDA, VALIDACAO_TAG } from '../textos';
import {
  AreaTexto, Aviso, Botao, Cabecalho, Cartao, Carregando, Celula, ErroCaixa, Modal, Selecao, Selo, Tabela, Campo, tomGravidade, tomOcorrencia, tomSituacao, tomStatusRonda, Vazio,
} from '../ui/base';
import { ProgressoRonda, type Progresso } from './Inicio';

interface Linha {
  id: string;
  roteiro: string;
  vigilante: string;
  status: string;
  inicioPrevisto: string;
  fimPrevisto: string;
  iniciadaEm: string | null;
  finalizadaEm: string | null;
  atrasoMin: number;
  progresso: Progresso;
}

export function Rondas() {
  const [p, setP] = useSearchParams();
  const nav = useNavigate();
  const de = p.get('de') ?? somarDias(hojeLocal(), -7);
  const ate = p.get('ate') ?? somarDias(hojeLocal(), 2);
  const status = p.get('status') ?? '';
  const pagina = Number(p.get('pagina') ?? 1);
  const mudar = (k: string, v: string) => {
    const n = new URLSearchParams(p);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setP(n);
  };
  const q = useQuery({
    queryKey: ['rondas', de, ate, status, pagina],
    queryFn: () => api<{ itens: Linha[]; total: number; tamanho: number }>(`/rondas?de=${de}&ate=${ate}&status=${status}&pagina=${pagina}&tamanho=30`),
  });
  const paginas = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.tamanho)) : 1;
  return (
    <>
      <Cabecalho titulo="Rondas" subtitulo="Histórico com o progresso de cada ronda. Toque numa ronda para ver ponto a ponto." />
      <Cartao>
        <div className="flex flex-wrap gap-3 mb-4">
          <Campo rotulo="De" type="date" value={de} onChange={(e) => mudar('de', e.target.value)} />
          <Campo rotulo="Até" type="date" value={ate} onChange={(e) => mudar('ate', e.target.value)} />
          <Selecao rotulo="Situação" value={status} onChange={(e) => mudar('status', e.target.value)} opcoes={[{ valor: '', rotulo: 'Todas' }, ...Object.entries(STATUS_RONDA).map(([valor, rotulo]) => ({ valor, rotulo }))]} />
        </div>
        <ErroCaixa erro={q.error} />
        {q.isLoading ? (
          <Carregando />
        ) : q.data?.itens.length ? (
          <Tabela colunas={['Previsto', 'Roteiro', 'Vigilante', 'Progresso', 'Duração', 'Situação']}>
            {q.data.itens.map((r) => (
              <tr key={r.id} className="hover:bg-elevada cursor-pointer" onClick={() => nav(`/rondas/${r.id}`)}>
                <Celula className="whitespace-nowrap tabular-nums">{fDataHora(r.inicioPrevisto)}</Celula>
                <Celula className="font-medium">{r.roteiro}</Celula>
                <Celula>{r.vigilante}</Celula>
                <Celula><ProgressoRonda p={r.progresso} /></Celula>
                <Celula className="whitespace-nowrap text-texto2">{duracao(r.iniciadaEm, r.finalizadaEm)}</Celula>
                <Celula>
                  <div className="flex flex-wrap gap-1">
                    <Selo tom={tomStatusRonda(r.status)}>{STATUS_RONDA[r.status]}</Selo>
                    {r.atrasoMin ? <Selo tom="erro">atrasada</Selo> : null}
                    {r.progresso.ocorrencias ? <Selo tom="aviso">{r.progresso.ocorrencias} ocorr.</Selo> : null}
                  </div>
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Nenhuma ronda nesse período.</Vazio>
        )}
        {paginas > 1 ? (
          <div className="flex items-center justify-end gap-2 mt-4 text-sm">
            <Botao variante="secundario" disabled={pagina <= 1} onClick={() => mudar('pagina', String(pagina - 1))}>Anterior</Botao>
            <span className="text-texto2">{pagina} de {paginas}</span>
            <Botao variante="secundario" disabled={pagina >= paginas} onClick={() => mudar('pagina', String(pagina + 1))}>Próxima</Botao>
          </div>
        ) : null}
      </Cartao>
    </>
  );
}

interface Detalhe {
  id: string;
  roteiro: string;
  exigeOrdem: boolean;
  vigilante: string;
  status: string;
  atrasoMin: number;
  inicioPrevisto: string;
  fimPrevisto: string;
  iniciadaEmDispositivo: string | null;
  finalizadaEmDispositivo: string | null;
  observacao: string | null;
  cancelada: { em: string; por: string } | null;
  encerramento: { motivo: string; por: string } | null;
  pontos: { pontoRondaId: string; nome: string; local: string; ordem: number; obrigatorio: boolean; situacao: string }[];
  linhaDoTempo: ({ tipo: string; id?: string; emDispositivo: string; recebidoEmServidor: string } & Record<string, unknown>)[];
}

function ItemTempo({ e }: { e: Detalhe['linhaDoTempo'][number] }) {
  const s = (k: string) => e[k] as string;
  const conteudo = (() => {
    switch (e.tipo) {
      case 'INICIO':
        return <span className="font-semibold">Ronda iniciada</span>;
      case 'FIM':
        return (
          <>
            <span className="font-semibold">Ronda finalizada</span> {e.finalizadaComPendencias ? <Selo tom="aviso">com pendências</Selo> : <Selo tom="sucesso">completa</Selo>}
            {s('observacao') ? <p className="text-sm text-texto2 mt-1">“{s('observacao')}”</p> : null}
          </>
        );
      case 'VISITA': {
        const checklist = e.checklist as { item: string; ok: boolean }[] | null;
        return (
          <>
            <span className="font-semibold">{s('ponto')}</span> <span className="text-texto2">lido</span>
            <div className="flex flex-wrap gap-1 mt-1">
              <Selo tom={s('validacaoTag') === 'VALIDA' ? 'sucesso' : 'aviso'}>{VALIDACAO_TAG[s('validacaoTag')] ?? s('validacaoTag')}</Selo>
              <Selo tom={s('resultadoGeo') === 'FORA_AREA' ? 'erro' : s('resultadoGeo') === 'DENTRO_AREA' ? 'sucesso' : 'neutro'}>{GEO[s('resultadoGeo')]}</Selo>
              {e.foraDaOrdem ? <Selo tom="aviso">fora da ordem</Selo> : null}
              {e.localizacaoSimulada ? <Selo tom="critica">localização simulada</Selo> : null}
              {e.statusRevisao === 'PENDENTE' ? <Selo tom="aviso">a revisar</Selo> : null}
              {e.statusRevisao === 'ACEITA' ? <Selo tom="sucesso">aceita por {s('revisadaPor')}</Selo> : null}
              {e.statusRevisao === 'REJEITADA' ? <Selo tom="erro">rejeitada por {s('revisadaPor')}</Selo> : null}
            </div>
            {checklist?.length ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
                {checklist.map((c) => (
                  <span key={c.item} className={c.ok ? 'text-sucesso' : 'text-erro'}>{c.ok ? '✓' : '✗'} {c.item}</span>
                ))}
              </div>
            ) : null}
            {s('observacaoRevisao') ? <p className="text-xs text-texto2 mt-1">Revisão: {s('observacaoRevisao')}</p> : null}
            <p className="text-xs text-texto2 mt-1">Tag {s('uidHex')}</p>
          </>
        );
      }
      case 'JUSTIFICATIVA':
        return (
          <>
            <span className="font-semibold">{s('ponto')}</span> <span className="text-texto2">justificado:</span> {MOTIVO[s('motivo')]}
            <p className="text-sm text-texto2 mt-1">“{s('descricao')}”</p>
          </>
        );
      case 'OCORRENCIA':
        return (
          <Link to={`/ocorrencias/${e.id}`} className="hover:text-primaria">
            <span className="font-semibold">Ocorrência: {s('tipoOcorrencia')}</span>
            {s('ponto') ? <span className="text-texto2"> em {s('ponto')}</span> : null}{' '}
            <Selo tom={tomGravidade(s('gravidade'))}>{GRAVIDADE[s('gravidade')]}</Selo> <Selo tom={tomOcorrencia(s('status'))}>{STATUS_OCORRENCIA[s('status')]}</Selo>
          </Link>
        );
      default:
        return e.tipo;
    }
  })();
  const cor = { INICIO: 'bg-info', FIM: 'bg-sucesso', VISITA: 'bg-primaria', JUSTIFICATIVA: 'bg-texto2', OCORRENCIA: 'bg-erro' }[e.tipo] ?? 'bg-texto2';
  return (
    <li className="relative pl-7 pb-5 last:pb-0">
      <span className={`absolute left-0 top-1.5 size-3 rounded-full ${cor}`} />
      <div className="text-xs text-texto2 tabular-nums mb-0.5">
        {fHoraSeg(e.emDispositivo)} no celular · chegou às {fHoraSeg(e.recebidoEmServidor)}
      </div>
      <div className="text-sm">{conteudo}</div>
    </li>
  );
}

export function Ronda() {
  const { id } = useParams();
  const { eu } = useSessao();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ronda', id], queryFn: () => api<Detalhe>(`/rondas/${id}`), refetchInterval: 30_000 });
  const [acao, setAcao] = useState<'encerrar' | 'cancelar' | null>(null);
  const [motivo, setMotivo] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/rondas/${id}/${acao === 'encerrar' ? 'encerramento' : 'cancelamento'}`, { metodo: 'POST', corpo: { motivo } }),
    onSuccess: () => {
      setAcao(null);
      setMotivo('');
      qc.invalidateQueries();
    },
  });
  if (q.isLoading) return <Carregando />;
  if (!q.data) return <ErroCaixa erro={q.error} />;
  const r = q.data;
  const gerencia = eu?.papel !== 'RESPONSAVEL';
  const lidos = r.pontos.filter((p) => p.situacao.startsWith('VISITA')).length;
  return (
    <>
      <Link to="/rondas" className="text-sm text-texto2 hover:text-texto">← Rondas</Link>
      <Cabecalho
        titulo={r.roteiro}
        subtitulo={<>{r.vigilante} · previsto {fDataHora(r.inicioPrevisto)}–{fHora(r.fimPrevisto)}{r.exigeOrdem ? ' · exige ordem' : ''}</>}
        acoes={
          gerencia ? (
            <>
              {r.status === 'EM_ANDAMENTO' ? <Botao variante="perigo" onClick={() => setAcao('encerrar')}>Encerrar ronda</Botao> : null}
              {r.status === 'AGENDADA' ? <Botao variante="perigo" onClick={() => setAcao('cancelar')}>Cancelar ronda</Botao> : null}
            </>
          ) : null
        }
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <Selo tom={tomStatusRonda(r.status)}>{STATUS_RONDA[r.status]}</Selo>
        {r.atrasoMin ? <Selo tom="erro">{r.atrasoMin} min de atraso</Selo> : null}
        <Selo>Início {fHora(r.iniciadaEmDispositivo)}</Selo>
        <Selo>Fim {fHora(r.finalizadaEmDispositivo)}</Selo>
        <Selo>Duração {duracao(r.iniciadaEmDispositivo, r.finalizadaEmDispositivo)}</Selo>
      </div>
      {r.encerramento ? <div className="mb-4"><Aviso tom="aviso">Encerrada por {r.encerramento.por}: {r.encerramento.motivo}</Aviso></div> : null}
      {r.cancelada ? <div className="mb-4"><Aviso tom="info">Cancelada por {r.cancelada.por} em {fDataHora(r.cancelada.em)}</Aviso></div> : null}

      <div className="grid lg:grid-cols-5 gap-4">
        <Cartao titulo={`Pontos · ${lidos} de ${r.pontos.length} lidos`} className="lg:col-span-2">
          <ul className="divide-y divide-borda -my-2">
            {r.pontos.map((p) => (
              <li key={p.pontoRondaId} className="flex items-center gap-3 py-2.5">
                <span className="text-xs tabular-nums text-texto2 w-5">{p.ordem}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{p.nome}{p.obrigatorio ? '' : ' (opcional)'}</span>
                  <span className="block text-xs text-texto2 truncate">{p.local}</span>
                </span>
                <Selo tom={tomSituacao(p.situacao)}>{SITUACAO_PONTO[p.situacao]}</Selo>
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao titulo="Linha do tempo" className="lg:col-span-3">
          {r.linhaDoTempo.length ? <ol className="relative">{r.linhaDoTempo.map((e, i) => <ItemTempo key={e.id ?? `${e.tipo}${i}`} e={e} />)}</ol> : <Vazio>Nada registrado ainda.</Vazio>}
        </Cartao>
      </div>

      <Modal
        titulo={acao === 'encerrar' ? 'Encerrar ronda em andamento' : 'Cancelar ronda'}
        aberto={!!acao}
        aoFechar={() => setAcao(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAcao(null)}>Voltar</Botao>
            <Botao variante="perigo" carregando={m.isPending} disabled={motivo.trim().length < (acao === 'encerrar' ? 10 : 3)} onClick={() => m.mutate()}>
              Confirmar
            </Botao>
          </>
        }
      >
        <p className="text-sm text-texto2">
          {acao === 'encerrar'
            ? 'A ronda fica Incompleta. O que o vigilante ainda enviar continua sendo recebido e marcado como recebido após o encerramento.'
            : 'A ronda some do celular do vigilante.'}
        </p>
        <AreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
      </Modal>
    </>
  );
}
