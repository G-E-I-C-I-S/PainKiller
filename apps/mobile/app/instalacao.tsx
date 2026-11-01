// Modo instalação de tags (UC19): lê a tag, escolhe o ponto, vincula e pede uma leitura de teste.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { leitorNfcReal, registrarOuvinteSimulado, abrirConfiguracoesNfc } from '../src/core/nfc/LeitorNfc';
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
import { textos } from '../src/textos';

type Fase = { tipo: 'LER' } | { tipo: 'ESCOLHER'; leitura: LeituraNfc } | { tipo: 'TESTAR'; leitura: LeituraNfc; pontoNome: string } | { tipo: 'OK'; pontoNome: string };

export default function Instalacao() {
  const { sessao } = useSessao();
  const local = sessao?.modo === 'LOCAL';
  const pontos = useConsulta(lerPontos);
  const [fase, setFase] = useState<Fase>({ tipo: 'LER' });
  const [pontoId, setPontoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [usarPosicao, setUsarPosicao] = useState(local);
  const [erro, setErro] = useState<string | null>(null);
  const [nfcOk, setNfcOk] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const faseRef = useRef(fase);
  faseRef.current = fase;

  const aoLer = useCallback((l: LeituraNfc) => {
    const f = faseRef.current;
    if (f.tipo === 'LER' || f.tipo === 'OK') {
      retorno.leituraAceita();
      setErro(null);
      setFase({ tipo: 'ESCOLHER', leitura: l });
    } else if (f.tipo === 'TESTAR') {
      if (l.uidHex === f.leitura.uidHex) {
        retorno.sucessoGravado();
        setFase({ tipo: 'OK', pontoNome: f.pontoNome });
      } else {
        retorno.recusa();
        setErro(textos.instalacao.testeErrado);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      registrarOuvinteSimulado(aoLer);
      leitorNfcReal.disponivel().then((d) => {
        setNfcOk(d === 'OK');
        if (d === 'OK') leitorNfcReal.iniciar(aoLer, () => {});
      });
      return () => {
        registrarOuvinteSimulado(null);
        leitorNfcReal.parar();
      };
    }, [aoLer]),
  );

  useEffect(() => {
    if (usarPosicao) pedirPermissaoLocalizacao();
  }, [usarPosicao]);

  const vinculoAtual = fase.tipo === 'ESCOLHER' ? pontos?.find((p) => p.uidHex === fase.leitura.uidHex) : null;

  const vincular = async () => {
    if (fase.tipo !== 'ESCOLHER' || !pontoId) return;
    const ponto = pontos?.find((p) => p.id === pontoId);
    setSalvando(true);
    setErro(null);
    try {
      if (local) {
        const pos = usarPosicao ? await obterPosicaoNoEvento(100) : null;
        await vincularTagLocal(fase.leitura.uidHex, fase.leitura.tipo, pontoId, pos);
      } else {
        await chamar('/tags-nfc', {
          metodo: 'POST',
          corpo: { pontoRondaId: pontoId, uidHex: fase.leitura.uidHex, tipo: fase.leitura.tipo, leituraSun: fase.leitura.tipo === 'NTAG424_DNA' ? fase.leitura.payloadNfc : null },
        });
        await atualizarReferencias();
      }
      retorno.acao();
      setFase({ tipo: 'TESTAR', leitura: fase.leitura, pontoNome: ponto?.nome ?? '' });
    } catch (e) {
      setErro(e instanceof ErroApi ? `${e.codigo}: ${e.message}` : e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  const filtrados = (pontos ?? []).filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <View style={{ flex: 1 }}>
      <TemplateTela
        cabecalho={<CabecalhoTela voltar titulo={textos.instalacao.titulo} semSync />}
        barra={
          fase.tipo === 'ESCOLHER' ? (
            <Botao titulo={textos.instalacao.vincular} onPress={vincular} carregando={salvando} desabilitado={!pontoId} />
          ) : fase.tipo === 'OK' || fase.tipo === 'TESTAR' ? (
            <Botao variante="secundario" titulo={textos.instalacao.outra} onPress={() => { setFase({ tipo: 'LER' }); setPontoId(null); }} />
          ) : undefined
        }
      >
        {!nfcOk ? <AvisoInline tipo="erro" texto={textos.execucao.nfcDesligado} acao={{ titulo: textos.execucao.abrirConfiguracoes, onPress: () => abrirConfiguracoesNfc() }} /> : null}
        {erro ? <AvisoInline tipo="erro" texto={erro} /> : null}

        {fase.tipo === 'LER' ? (
          <Cartao style={{ alignItems: 'center', paddingVertical: esp[8] }}>
            <Texto style={{ fontSize: 56, lineHeight: 64 }}>📶</Texto>
            <Texto variante="titulo" centro>
              {textos.instalacao.encoste}
            </Texto>
          </Cartao>
        ) : null}

        {fase.tipo === 'ESCOLHER' ? (
          <>
            <Cartao>
              <Texto variante="legenda" cor="textoSecundario">
                {textos.instalacao.tagLida}
              </Texto>
              <Texto variante="titulo">{fase.leitura.uidHex}</Texto>
              <Texto variante="legenda" cor="textoSecundario">
                {fase.leitura.tipo} · {fase.leitura.payloadNfc.slice(0, 80)}
              </Texto>
              <Texto cor={vinculoAtual ? 'aviso' : 'sucesso'}>{vinculoAtual ? textos.instalacao.jaVinculada(vinculoAtual.nome) : textos.instalacao.livre}</Texto>
            </Cartao>
            <TituloSecao>{textos.instalacao.escolhaPonto.toUpperCase()}</TituloSecao>
            <Campo placeholder={textos.instalacao.buscar} value={busca} onChangeText={setBusca} />
            <SeletorOpcoes
              opcoes={filtrados.map((p) => ({ valor: p.id, rotulo: `${p.nome} · ${[p.predioNome, p.andarNome].filter(Boolean).join(' · ')}${p.uidHex ? ' 🏷' : ''}` }))}
              valor={pontoId}
              onChange={setPontoId}
            />
            {local ? (
              <SeletorOpcoes
                opcoes={[{ valor: 'sim' as const, rotulo: textos.instalacao.usarPosicao }]}
                valor={usarPosicao ? 'sim' : null}
                onChange={() => setUsarPosicao(!usarPosicao)}
              />
            ) : null}
          </>
        ) : null}

        {fase.tipo === 'TESTAR' ? <AvisoInline tipo="info" texto={textos.instalacao.leiaTeste} /> : null}
        {fase.tipo === 'OK' ? <AvisoInline tipo="sucesso" texto={textos.instalacao.testeOk(fase.pontoNome)} /> : null}
      </TemplateTela>
      <SimuladorNfc />
    </View>
  );
}
