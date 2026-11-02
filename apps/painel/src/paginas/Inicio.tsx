// Painel do dia (docs/10 · 4.1): números, rondas em andamento com progresso, atrasos, alertas e ocorrências recentes.
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useSessao } from '../sessao';
import { fDataLonga, fHora, GRAVIDADE, STATUS_OCORRENCIA, STATUS_RONDA } from '../textos';
import { Aviso, Barra, Cabecalho, Cartao, Carregando, ErroCaixa, Numero, Selo, tomGravidade, tomOcorrencia, tomStatusRonda, Vazio } from '../ui/base';

export interface Progresso {
  total: number;
  lidos: number;
  justificados: number;
  ocorrencias: number;
  sinalizadas: number;
}
interface LinhaRonda {
  id: string;
  roteiro: string;
  vigilante: string;
  status: string;
  inicioPrevisto: string;
  fimPrevisto: string;
  iniciadaEm: string | null;
  atrasoMin: number;
  progresso: Progresso;
}
interface Resumo {
  data: string;
  atualizadoEm: string;
  rondas: Record<'agendadas' | 'emAndamento' | 'atrasadas' | 'concluidas' | 'incompletas' | 'naoRealizadas' | 'canceladas' | 'total', number>;
  alertas: { visitasPendentesRevisao: number; ocorrenciasAbertasAltaOuCritica: number; eventosRecusados24h: number };
  listas: {
    emAndamento: LinhaRonda[];
    atrasadas: LinhaRonda[];
    doDia: LinhaRonda[];
    ocorrenciasRecentes: { id: string; tipo: string; gravidade: string; status: string; predio: string; recebidoEmServidor: string }[];
  };
}

export function ProgressoRonda({ p }: { p: Progresso }) {
  const feitos = p.lidos + p.justificados;
  return (
    <div className="flex flex-col gap-1 min-w-36">
      <Barra valor={feitos} total={p.total} tom={feitos >= p.total && p.total ? 'sucesso' : 'primaria'} />
      <span className="text-xs text-texto2 tabular-nums">
        {p.lidos}/{p.total} lidos{p.justificados ? ` · ${p.justificados} just.` : ''}
        {p.sinalizadas ? <span className="text-aviso"> · {p.sinalizadas} a revisar</span> : null}
      </span>
    </div>
  );
}

function CartaoRonda({ r }: { r: LinhaRonda }) {
  return (
    <Link to={`/rondas/${r.id}`} className="block rounded-lg border border-borda bg-fundo px-4 py-3 hover:border-texto2 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{r.roteiro}</div>
          <div className="text-xs text-texto2">{r.vigilante} · {fHora(r.inicioPrevisto)}–{fHora(r.fimPrevisto)}</div>
        </div>
        {r.atrasoMin ? <Selo tom="erro">{r.atrasoMin} min de atraso</Selo> : <Selo tom={tomStatusRonda(r.status)}>{STATUS_RONDA[r.status]}</Selo>}
      </div>
      <div className="mt-3"><ProgressoRonda p={r.progresso} /></div>
    </Link>
  );
}

export function Inicio() {
  const { eu } = useSessao();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['resumo'], queryFn: () => api<Resumo>('/painel/resumo'), refetchInterval: 30_000 });
  if (q.isLoading) return <Carregando />;
  if (!q.data) return <ErroCaixa erro={q.error} />;
  const { rondas, alertas, listas } = q.data;
  const tudoCerto = !rondas.atrasadas && !alertas.visitasPendentesRevisao && !alertas.ocorrenciasAbertasAltaOuCritica && !alertas.eventosRecusados24h && !rondas.naoRealizadas;
  return (
    <>
      <Cabecalho
        titulo={`Olá, ${eu?.nome.split(' ')[0]}`}
        subtitulo={<>Hoje, {fDataLonga(q.data.data + 'T12:00:00Z')} · atualiza sozinho a cada 30 s (última às {fHora(q.data.atualizadoEm)})</>}
      />
      {q.error ? <div className="mb-4"><ErroCaixa erro={q.error} /></div> : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Numero rotulo="Rondas hoje" valor={rondas.total} />
        <Numero rotulo="Em andamento" valor={rondas.emAndamento} tom="info" />
        <Numero rotulo="Atrasadas" valor={rondas.atrasadas} tom={rondas.atrasadas ? 'erro' : undefined} />
        <Numero rotulo="Concluídas" valor={rondas.concluidas} tom="sucesso" />
        <Numero rotulo="Incompletas" valor={rondas.incompletas} tom={rondas.incompletas ? 'aviso' : undefined} />
        <Numero rotulo="Não realizadas" valor={rondas.naoRealizadas} tom={rondas.naoRealizadas ? 'erro' : undefined} />
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {tudoCerto ? <Aviso tom="sucesso">Tudo certo até agora: nenhum atraso, nada para revisar e nenhum envio recusado.</Aviso> : null}
        {alertas.visitasPendentesRevisao ? (
          <Link to="/visitas"><Aviso tom="aviso">{alertas.visitasPendentesRevisao} leitura(s) de ponto a revisar (fora da área, tag não vinculada ou localização simulada) →</Aviso></Link>
        ) : null}
        {alertas.ocorrenciasAbertasAltaOuCritica ? (
          <Link to="/ocorrencias?status=ABERTA"><Aviso>{alertas.ocorrenciasAbertasAltaOuCritica} ocorrência(s) grave(s) em aberto →</Aviso></Link>
        ) : null}
        {alertas.eventosRecusados24h ? (
          <Link to="/envios"><Aviso tom="info">{alertas.eventosRecusados24h} registro(s) do app recusados pelo servidor nas últimas 24 h →</Aviso></Link>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Cartao titulo={`Em andamento (${listas.emAndamento.length})`}>
          {listas.emAndamento.length ? <div className="flex flex-col gap-2">{listas.emAndamento.map((r) => <CartaoRonda key={r.id} r={r} />)}</div> : <Vazio>Nenhuma ronda em andamento agora.</Vazio>}
        </Cartao>
        <Cartao titulo={`Atrasadas (${listas.atrasadas.length})`}>
          {listas.atrasadas.length ? <div className="flex flex-col gap-2">{listas.atrasadas.map((r) => <CartaoRonda key={r.id} r={r} />)}</div> : <Vazio>Nenhuma ronda atrasada.</Vazio>}
        </Cartao>
        <Cartao titulo="Rondas do dia" acao={<Link to="/rondas" className="text-xs text-primaria hover:underline">Histórico</Link>}>
          {listas.doDia.length ? (
            <ul className="divide-y divide-borda -my-2">
              {listas.doDia.map((r) => (
                <li key={r.id}>
                  <button onClick={() => nav(`/rondas/${r.id}`)} className="w-full flex items-center gap-3 py-2.5 text-left hover:text-primaria">
                    <span className="text-sm tabular-nums text-texto2 w-12">{fHora(r.inicioPrevisto)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{r.roteiro}</span>
                      <span className="block text-xs text-texto2">{r.vigilante} · {r.progresso.lidos}/{r.progresso.total} pontos</span>
                    </span>
                    <Selo tom={tomStatusRonda(r.status)}>{STATUS_RONDA[r.status]}</Selo>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Nenhuma ronda prevista para hoje. Crie uma agenda em Roteiros e agendas.</Vazio>
          )}
        </Cartao>
        <Cartao titulo="Ocorrências recentes" acao={<Link to="/ocorrencias" className="text-xs text-primaria hover:underline">Ver todas</Link>}>
          {listas.ocorrenciasRecentes.length ? (
            <ul className="divide-y divide-borda -my-2">
              {listas.ocorrenciasRecentes.map((o) => (
                <li key={o.id}>
                  <Link to={`/ocorrencias/${o.id}`} className="flex items-center gap-3 py-2.5 hover:text-primaria">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{o.tipo}</span>
                      <span className="block text-xs text-texto2">{o.predio} · {fHora(o.recebidoEmServidor)}</span>
                    </span>
                    <Selo tom={tomGravidade(o.gravidade)}>{GRAVIDADE[o.gravidade]}</Selo>
                    <Selo tom={tomOcorrencia(o.status)}>{STATUS_OCORRENCIA[o.status]}</Selo>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Nenhuma ocorrência registrada.</Vazio>
          )}
        </Cartao>
      </div>
    </>
  );
}
