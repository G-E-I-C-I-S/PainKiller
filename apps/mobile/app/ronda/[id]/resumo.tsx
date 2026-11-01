import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useConsulta } from '../../../src/dados/banco';
import { pontosDaRonda, resumoRonda, ronda as lerRonda } from '../../../src/dados/repositorios';
import { useSessao } from '../../../src/features/sessao';
import { Botao, Cartao, Texto } from '../../../src/ui/atomos';
import { CabecalhoTela, TemplateTela } from '../../../src/ui/organismos';
import { esp } from '../../../src/tema/tokens';
import { textos } from '../../../src/textos';

export default function Resumo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao } = useSessao();
  const ronda = useConsulta(() => lerRonda(id), [id]);
  const pontos = useConsulta(() => pontosDaRonda(id), [id]);
  const dados = useConsulta(() => resumoRonda(id), [id]);
  if (!ronda || !pontos || !dados) return <TemplateTela><View /></TemplateTela>;
  const concluida = ronda.status === 'CONCLUIDA';
  const visitados = pontos.filter((p) => p.situacao === 'VISITADO').length;
  const minutos = ronda.iniciadaEm && ronda.finalizadaEm ? Math.round((+new Date(ronda.finalizadaEm) - +new Date(ronda.iniciadaEm)) / 60_000) : null;
  return (
    <TemplateTela cabecalho={<CabecalhoTela titulo={ronda.roteiroNome} />} barra={<Botao titulo={textos.resumo.voltarInicio} onPress={() => router.dismissTo('/')} />}>
      <View style={{ alignItems: 'center', gap: esp[2], marginVertical: esp[6] }}>
        <Texto style={{ fontSize: 72, lineHeight: 84 }} cor={concluida ? 'sucesso' : 'aviso'}>
          {concluida ? '✓' : '⚑'}
        </Texto>
        <Texto variante="tituloGrande" centro>
          {concluida ? textos.resumo.concluida : textos.resumo.incompleta}
        </Texto>
      </View>
      <Cartao>
        <Texto variante="corpoForte">{textos.resumo.pontos(visitados, pontos.length)}</Texto>
        {dados.justificados ? <Texto>{textos.resumo.justificados(dados.justificados)}</Texto> : null}
        <Texto>{textos.resumo.ocorrencias(dados.ocorrencias)}</Texto>
        {minutos != null ? <Texto>{textos.resumo.duracao(minutos)}</Texto> : null}
        {sessao?.modo === 'API' ? (
          <Texto cor={dados.pendentesEnvio ? 'aviso' : 'sucesso'}>{dados.pendentesEnvio ? textos.resumo.pendenciasEnvio(dados.pendentesEnvio) : textos.resumo.tudoEnviado}</Texto>
        ) : null}
      </Cartao>
    </TemplateTela>
  );
}
