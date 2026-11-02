// Leituras a revisar (docs/10 · 4.5) e registros do app recusados pelo servidor.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, mensagemErro } from '../api';
import { useSessao } from '../sessao';
import { fDataHora, GEO, TIPO_EVENTO, VALIDACAO_TAG } from '../textos';
import { AreaTexto, Aviso, Botao, Cabecalho, Cartao, Carregando, Celula, ErroCaixa, Modal, Selo, Tabela, Vazio } from '../ui/base';

interface Visita {
  id: string;
  rondaId: string;
  roteiro: string;
  vigilante: string;
  ponto: string;
  lidoEm: string;
  resultadoGeo: string;
  validacaoTag: string;
  localizacaoSimulada: boolean;
  foraDaOrdem: boolean;
  uidHex: string;
}

export function Visitas() {
  const { eu } = useSessao();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['visitas'], queryFn: () => api<{ itens: Visita[] }>('/visitas?statusRevisao=PENDENTE') });
  const [alvo, setAlvo] = useState<{ v: Visita; decisao: 'ACEITA' | 'REJEITADA' } | null>(null);
  const [obs, setObs] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/visitas/${alvo!.v.id}/revisao`, { metodo: 'POST', corpo: { decisao: alvo!.decisao, observacao: obs.trim() || undefined } }),
    onSuccess: () => {
      setAlvo(null);
      setObs('');
      qc.invalidateQueries();
    },
  });
  const pode = eu?.papel !== 'RESPONSAVEL';
  return (
    <>
      <Cabecalho
        titulo="Leituras a revisar"
        subtitulo="Leituras aceitas, mas sinalizadas: fora da área do ponto, tag que não está vinculada ao ponto, QR Code ou localização simulada. Confirme com o vigilante e aceite ou rejeite."
      />
      <Cartao>
        <ErroCaixa erro={q.error} />
        {q.isLoading ? (
          <Carregando />
        ) : q.data?.itens.length ? (
          <Tabela colunas={['Lida em', 'Ponto', 'Vigilante', 'Por que revisar', '']}>
            {q.data.itens.map((v) => (
              <tr key={v.id}>
                <Celula className="whitespace-nowrap tabular-nums">{fDataHora(v.lidoEm)}</Celula>
                <Celula>
                  <div className="font-medium">{v.ponto}</div>
                  <Link to={`/rondas/${v.rondaId}`} className="text-xs text-primaria hover:underline">{v.roteiro}</Link>
                </Celula>
                <Celula>{v.vigilante}</Celula>
                <Celula>
                  <div className="flex flex-wrap gap-1">
                    {v.validacaoTag !== 'VALIDA' ? <Selo tom="aviso">{VALIDACAO_TAG[v.validacaoTag] ?? v.validacaoTag}</Selo> : null}
                    {v.resultadoGeo === 'FORA_AREA' ? <Selo tom="erro">{GEO.FORA_AREA}</Selo> : null}
                    {v.localizacaoSimulada ? <Selo tom="critica">Localização simulada</Selo> : null}
                    {v.foraDaOrdem ? <Selo>Fora da ordem</Selo> : null}
                  </div>
                  <div className="text-xs text-texto2 mt-1">Tag {v.uidHex}</div>
                </Celula>
                <Celula>
                  {pode ? (
                    <div className="flex gap-2 justify-end">
                      <Botao variante="secundario" onClick={() => setAlvo({ v, decisao: 'ACEITA' })}>Aceitar</Botao>
                      <Botao variante="perigo" onClick={() => setAlvo({ v, decisao: 'REJEITADA' })}>Rejeitar</Botao>
                    </div>
                  ) : null}
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Nenhuma leitura para revisar.</Vazio>
        )}
      </Cartao>
      <Modal
        titulo={alvo?.decisao === 'ACEITA' ? 'Aceitar leitura' : 'Rejeitar leitura'}
        aberto={!!alvo}
        aoFechar={() => setAlvo(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAlvo(null)}>Voltar</Botao>
            <Botao variante={alvo?.decisao === 'ACEITA' ? 'primario' : 'perigo'} carregando={m.isPending} disabled={alvo?.decisao === 'REJEITADA' && obs.trim().length < 10} onClick={() => m.mutate()}>
              Confirmar
            </Botao>
          </>
        }
      >
        <p className="text-sm">{alvo?.v.ponto} · {alvo?.v.vigilante}</p>
        <AreaTexto rotulo={alvo?.decisao === 'REJEITADA' ? 'Motivo da rejeição (mínimo 10 caracteres)' : 'Observação (opcional)'} value={obs} onChange={(e) => setObs(e.target.value)} />
        {m.error ? <Aviso>{mensagemErro(m.error)}</Aviso> : null}
      </Modal>
    </>
  );
}

export function Recusados() {
  const q = useQuery({
    queryKey: ['recusados'],
    queryFn: () => api<{ itens: { id: string; tipo: string; usuario: string; codigo: string; mensagem: string; recebidoEm: string }[] }>('/sincronizacao/recusados'),
    refetchInterval: 60_000,
  });
  return (
    <>
      <Cabecalho
        titulo="Problemas de envio"
        subtitulo="Registros que o app mandou e o servidor recusou (ronda fora do horário, tag de outro ponto, etc.). O vigilante também vê esses itens na tela de envio do app."
      />
      <Cartao>
        <ErroCaixa erro={q.error} />
        {q.isLoading ? (
          <Carregando />
        ) : q.data?.itens.length ? (
          <Tabela colunas={['Recebido', 'Registro', 'Usuário', 'Motivo']}>
            {q.data.itens.map((e) => (
              <tr key={e.id}>
                <Celula className="whitespace-nowrap tabular-nums">{fDataHora(e.recebidoEm)}</Celula>
                <Celula>{TIPO_EVENTO[e.tipo] ?? e.tipo}</Celula>
                <Celula>{e.usuario}</Celula>
                <Celula>
                  <div className="font-medium">{e.mensagem}</div>
                  <div className="text-xs text-texto2">{e.codigo}</div>
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <Vazio>Nenhum envio recusado. Tudo o que o app mandou entrou.</Vazio>
        )}
      </Cartao>
    </>
  );
}
