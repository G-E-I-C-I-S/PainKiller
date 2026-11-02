// Componentes do painel: botões, campos, selos, cartões, tabela, modal e estados de carregamento.
import { useEffect, type ReactNode } from 'react';
import { mensagemErro } from '../api';

type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma';
const estilosBotao: Record<VarianteBotao, string> = {
  primario: 'bg-primaria text-sobre-primaria hover:brightness-110',
  secundario: 'bg-elevada text-texto border border-borda hover:border-texto2',
  perigo: 'border border-erro text-erro hover:bg-erro/10',
  fantasma: 'text-texto2 hover:text-texto',
};

export function Botao({ variante = 'primario', carregando, className = '', children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; carregando?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 h-10 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${estilosBotao[variante]} ${className}`}
    >
      {carregando ? <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : null}
      {children}
    </button>
  );
}

const estiloCampo = 'w-full rounded-lg bg-fundo border border-borda px-3 h-10 text-sm text-texto placeholder:text-texto2 focus:border-primaria outline-none';

export function Campo({ rotulo, ajuda, className = '', ...p }: React.InputHTMLAttributes<HTMLInputElement> & { rotulo?: string; ajuda?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {rotulo ? <span className="text-xs font-medium text-texto2">{rotulo}</span> : null}
      <input {...p} className={estiloCampo} />
      {ajuda ? <span className="text-xs text-texto2">{ajuda}</span> : null}
    </label>
  );
}

export function AreaTexto({ rotulo, className = '', ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {rotulo ? <span className="text-xs font-medium text-texto2">{rotulo}</span> : null}
      <textarea {...p} className={`${estiloCampo} h-auto min-h-20 py-2`} />
    </label>
  );
}

export function Selecao({ rotulo, opcoes, className = '', ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { rotulo?: string; opcoes: { valor: string; rotulo: string }[] }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {rotulo ? <span className="text-xs font-medium text-texto2">{rotulo}</span> : null}
      <select {...p} className={estiloCampo}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

export type Tom = 'neutro' | 'sucesso' | 'aviso' | 'erro' | 'info' | 'critica' | 'primaria';
const tons: Record<Tom, string> = {
  neutro: 'bg-elevada text-texto2 border-borda',
  sucesso: 'bg-sucesso/12 text-sucesso border-sucesso/30',
  aviso: 'bg-aviso/12 text-aviso border-aviso/30',
  erro: 'bg-erro/12 text-erro border-erro/30',
  info: 'bg-info/12 text-info border-info/30',
  critica: 'bg-critica/15 text-critica border-critica/40',
  primaria: 'bg-primaria/15 text-primaria border-primaria/30',
};

export function Selo({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tons[tom]}`}>{children}</span>;
}

export const tomStatusRonda = (s: string): Tom =>
  ({ AGENDADA: 'neutro', EM_ANDAMENTO: 'info', CONCLUIDA: 'sucesso', INCOMPLETA: 'aviso', NAO_REALIZADA: 'erro', CANCELADA: 'neutro' })[s] as Tom ?? 'neutro';
export const tomGravidade = (g: string): Tom => ({ BAIXA: 'info', MEDIA: 'aviso', ALTA: 'erro', CRITICA: 'critica' })[g] as Tom ?? 'neutro';
export const tomOcorrencia = (s: string): Tom => ({ ABERTA: 'erro', EM_ATENDIMENTO: 'aviso', RESOLVIDA: 'sucesso', ARQUIVADA: 'neutro' })[s] as Tom ?? 'neutro';
export const tomSituacao = (s: string): Tom => ({ VISITADO: 'sucesso', VISITA_SINALIZADA: 'aviso', VISITA_INVALIDA: 'erro', JUSTIFICADO: 'info', PENDENTE: 'neutro' })[s] as Tom ?? 'neutro';

export function Cartao({ titulo, acao, children, className = '' }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl bg-superficie border border-borda ${className}`}>
      {titulo ? (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="text-xs font-bold tracking-wider text-texto2 uppercase">{titulo}</h2>
          {acao}
        </header>
      ) : null}
      <div className={titulo ? 'px-5 pb-5' : 'p-5'}>{children}</div>
    </section>
  );
}

export function Cabecalho({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {subtitulo ? <p className="text-sm text-texto2 mt-1">{subtitulo}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
    </div>
  );
}

export function Barra({ valor, total, tom = 'primaria' }: { valor: number; total: number; tom?: 'primaria' | 'sucesso' | 'aviso' }) {
  const pct = total ? Math.min(100, Math.round((valor / total) * 100)) : 0;
  const cor = { primaria: 'bg-primaria', sucesso: 'bg-sucesso', aviso: 'bg-aviso' }[tom];
  return (
    <div className="h-1.5 w-full rounded-full bg-elevada overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${cor} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tabela({ colunas, children }: { colunas: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-texto2 border-b border-borda">
            {colunas.map((c) => (
              <th key={c} className="font-medium px-5 py-2 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">{children}</tbody>
      </table>
    </div>
  );
}

export const Celula = ({ children, className = '' }: { children: ReactNode; className?: string }) => <td className={`px-5 py-3 align-middle ${className}`}>{children}</td>;

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-texto2 py-6 text-center">{children}</p>;
}

export function Carregando() {
  return (
    <div className="flex justify-center py-12">
      <span className="size-6 rounded-full border-2 border-primaria border-t-transparent animate-spin" />
    </div>
  );
}

export function Aviso({ tom = 'erro', children }: { tom?: 'erro' | 'aviso' | 'sucesso' | 'info'; children: ReactNode }) {
  const c = { erro: 'border-erro text-erro', aviso: 'border-aviso text-aviso', sucesso: 'border-sucesso text-sucesso', info: 'border-info text-info' }[tom];
  return <div className={`rounded-lg border-l-4 bg-elevada px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export const ErroCaixa = ({ erro }: { erro: unknown }) => (erro ? <Aviso>{mensagemErro(erro)}</Aviso> : null);

export function Modal({ titulo, aberto, aoFechar, children, rodape }: { titulo: string; aberto: boolean; aoFechar: () => void; children: ReactNode; rodape?: ReactNode }) {
  useEffect(() => {
    if (!aberto) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={aoFechar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-superficie border border-borda" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-borda">
          <h2 className="font-semibold">{titulo}</h2>
          <button className="text-texto2 hover:text-texto text-xl leading-none" onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="p-5 flex flex-col gap-4">{children}</div>
        {rodape ? <footer className="flex justify-end gap-2 px-5 py-4 border-t border-borda">{rodape}</footer> : null}
      </div>
    </div>
  );
}

export function Numero({ rotulo, valor, tom, onClick }: { rotulo: string; valor: number | string; tom?: Tom; onClick?: () => void }) {
  const cor = tom ? { neutro: 'text-texto', sucesso: 'text-sucesso', aviso: 'text-aviso', erro: 'text-erro', info: 'text-info', critica: 'text-critica', primaria: 'text-primaria' }[tom] : 'text-texto';
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} className={`rounded-xl bg-superficie border border-borda px-4 py-3 text-left ${onClick ? 'hover:border-texto2 transition' : ''}`}>
      <div className={`text-3xl font-bold tabular-nums ${cor}`}>{valor}</div>
      <div className="text-xs text-texto2 mt-0.5">{rotulo}</div>
    </C>
  );
}
