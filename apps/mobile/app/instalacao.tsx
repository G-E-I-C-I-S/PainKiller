// Instalação de tags (UC19): grava o ponto DENTRO da tag e testa várias tags seguidas mostrando o que cada uma tem gravado.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { leitorNfcReal, registrarOuvinteSimulado, abrirConfiguracoesNfc, gravarPontoNaTag, cancelarGravacao } from '../src/core/nfc/LeitorNfc';
import type { LeituraNfc } from '../src/core/nfc/parser';
import { chamar, ErroApi } from '../src/core/api/cliente';
import { obterPosicaoNoEvento, pedirPermissaoLocalizacao } from '../src/core/localizacao';
import { retorno } from '../src/core/retorno';
import { useConsulta } from '../src/dados/banco';
import { pontos as lerPontos } from '../src/dados/repositorios';
import { vincularTagLocal } from '../src/dados/pacote';
import { atualizarReferencias } from '../src/features/sincronizacao';
import { useSessao } from '../src/features/sessao';
import { SimuladorNfc } from '../src/features/SimuladorNfc';
import { Botao, Campo, Cartao, Texto } from '../src/ui/atomos';
import { AvisoInline, SeletorOpcoes } from '../src/ui/moleculas';
import { CabecalhoTela, TemplateTela, TituloSecao } from '../src/ui/organismos';
import { esp } from '../src/tema/tokens';
import { hora, textos } from '../src/textos';

type Modo = 'TESTAR' | 'GRAVAR';
const t = textos.instalacao;

function mensagemErroGravacao(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m === 'TAG_SEM_NDEF') return t.semNdef;
  if (/cancel/i.test(m)) return t.cancelado;
  if (/size|capacity|too large|exceed/i.test(m)) return t.semEspaco;
  if (/read.?only|not writable/i.test(m)) return t.somenteLeitura;
  return `${t.falhaGravar} (${m})`;
}

export default function Instalacao() {
  const { sessao } = useSessao();
  const local = sessao?.modo === 'LOCAL';
  const pontos = useConsulta(lerPontos);
  const [modo, setModo] = useState<Modo>('TESTAR');
  const [lidas, setLidas] = useState<LeituraNfc[]>([]);
  const [pontoId, setPontoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [usarPosicao, setUsarPosicao] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [gravado, setGravado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nfcOk, setNfcOk] = useState(true);
  const modoRef = useRef(modo);
  modoRef.current = modo;

  const aoLer = useCallback((l: LeituraNfc) => {
    if (modoRef.current !== 'TESTAR') return;
    if (l.pontoGravado) retorno.leituraAceita();
    else retorno.recusa();
    setLidas((a) => [l, ...a.filter((x) => x.uidHex !== l.uidHex)].slice(0, 20));
  }, []);

  // Modo testar: leitor contínuo ligado. Modo gravar: leitor parado (a gravação pede a tag sozinha).
  useFocusEffect(
    useCallback(() => {
      if (modo !== 'TESTAR') return;
      registrarOuvinteSimulado(aoLer);
      leitorNfcReal.disponivel().then((d) => {
        setNfcOk(d === 'OK');
        if (d === 'OK') leitorNfcReal.iniciar(aoLer, () => {});
      });
      return () => {
        registrarOuvinteSimulado(null);
        leitorNfcReal.parar();
      };
    }, [aoLer, modo]),
  );

  useEffect(() => () => void cancelarGravacao(), []);

  useEffect(() => {
    if (usarPosicao) pedirPermissaoLocalizacao();
  }, [usarPosicao]);

  const gravar = async () => {
    const ponto = pontos?.find((p) => p.id === pontoId);
    if (!ponto) return;
    setErro(null);
    setGravado(null);
    setGravando(true);
    try {
      await leitorNfcReal.parar();
      const localTexto = [ponto.predioNome, ponto.andarNome].filter(Boolean).join(' · ');
      const { uidHex } = await gravarPontoNaTag({ pontoId: ponto.id, nome: ponto.nome, local: localTexto });
      // Guarda também o UID, para o servidor e para tags que forem regravadas por outro app.
      if (local) {
        const pos = usarPosicao ? await obterPosicaoNoEvento(100) : null;
        await vincularTagLocal(uidHex, 'NTAG215_LEGADA', ponto.id, pos);
      } else {
        await chamar('/tags-nfc', { metodo: 'POST', corpo: { pontoRondaId: ponto.id, uidHex, tipo: 'NTAG215_LEGADA', leituraSun: null } }).catch((e) => {
          if (!(e instanceof ErroApi && e.codigo === 'TAG_JA_VINCULADA')) throw e;
        });
        await atualizarReferencias().catch(() => {});
      }
      retorno.sucessoGravado();
      setGravado(`${ponto.nome}${localTexto ? ` · ${localTexto}` : ''}`);
      setPontoId(null);
    } catch (e) {
      retorno.recusa();
      setErro(mensagemErroGravacao(e));
    } finally {
      setGravando(false);
    }
  };

  const cancelar = async () => {
    await cancelarGravacao();
    setGravando(false);
  };

  const trocarModo = async (m: Modo) => {
    if (gravando) await cancelar();
    setErro(null);
    setGravado(null);
    setModo(m);
  };

  const nomeDoBanco = (uid: string) => pontos?.find((p) => p.uidHex === uid);
  const filtrados = (pontos ?? []).filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <View style={{ flex: 1 }}>
      <TemplateTela
        cabecalho={<CabecalhoTela voltar titulo={t.titulo} semSync />}
        barra={
          modo === 'GRAVAR' ? (
            gravando ? (
              <Botao variante="secundario" titulo={t.cancelar} onPress={cancelar} />
            ) : (
              <Botao titulo={t.gravar} onPress={gravar} desabilitado={!pontoId} />
            )
          ) : lidas.length ? (
            <Botao variante="secundario" titulo={t.limpar} onPress={() => setLidas([])} />
          ) : undefined
        }
      >
        <SeletorOpcoes
          opcoes={[
            { valor: 'TESTAR' as const, rotulo: t.modoTestar },
            { valor: 'GRAVAR' as const, rotulo: t.modoGravar },
          ]}
          valor={modo}
          onChange={trocarModo}
        />
        {!nfcOk ? <AvisoInline tipo="erro" texto={textos.execucao.nfcDesligado} acao={{ titulo: textos.execucao.abrirConfiguracoes, onPress: () => abrirConfiguracoesNfc() }} /> : null}
        {erro ? <AvisoInline tipo="erro" texto={erro} /> : null}

        {modo === 'TESTAR' ? (
          <>
            <Cartao style={{ alignItems: 'center', paddingVertical: esp[6] }}>
              <Texto style={{ fontSize: 48, lineHeight: 56 }}>📶</Texto>
              <Texto variante="titulo" centro>
                {t.encosteTestar}
              </Texto>
            </Cartao>
            {lidas.map((l, i) => {
              const doBanco = nomeDoBanco(l.uidHex);
              return (
                <Cartao key={l.uidHex} style={{ gap: esp[1], opacity: i === 0 ? 1 : 0.7 }}>
                  {l.pontoGravado ? (
                    <>
                      <Texto variante="legenda" cor="sucesso">
                        {t.gravadoNaTag}
                      </Texto>
                      <Texto variante="titulo">{l.pontoGravado.nome}</Texto>
                      {l.pontoGravado.local ? <Texto cor="textoSecundario">{l.pontoGravado.local}</Texto> : null}
                    </>
                  ) : (
                    <>
                      <Texto variante="titulo" cor="aviso">
                        {t.tagVazia}
                      </Texto>
                      {doBanco ? <Texto cor="textoSecundario">{t.soNoCelular(doBanco.nome)}</Texto> : null}
                    </>
                  )}
                  <Texto variante="legenda" cor="textoSecundario">
                    UID {l.uidHex} · {hora(l.lidaEm.toISOString())}
                  </Texto>
                </Cartao>
              );
            })}
          </>
        ) : (
          <>
            {gravando ? <AvisoInline tipo="info" texto={t.encosteGravar} /> : null}
            {gravado ? <AvisoInline tipo="sucesso" texto={t.gravouOk(gravado)} /> : null}
            <TituloSecao>{t.escolhaPonto.toUpperCase()}</TituloSecao>
            <Campo placeholder={t.buscar} value={busca} onChangeText={setBusca} />
            <SeletorOpcoes
              opcoes={filtrados.map((p) => ({ valor: p.id, rotulo: `${p.nome} · ${[p.predioNome, p.andarNome].filter(Boolean).join(' · ')}${p.uidHex ? ' 🏷' : ''}` }))}
              valor={pontoId}
              onChange={(v) => !gravando && setPontoId(v)}
            />
            {local ? (
              <SeletorOpcoes opcoes={[{ valor: 'sim' as const, rotulo: t.usarPosicao }]} valor={usarPosicao ? 'sim' : null} onChange={() => setUsarPosicao(!usarPosicao)} />
            ) : null}
          </>
        )}
      </TemplateTela>
      {modo === 'TESTAR' ? <SimuladorNfc /> : null}
    </View>
  );
}
