import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConsulta } from '../../../src/dados/banco';
import { ocorrenciasDaRonda, pontosDaRonda, ronda as lerRonda, type PontoDaRonda } from '../../../src/dados/repositorios';
import { progresso, proximoEsperado } from '../../../src/dominio/regras';
import { useLeituraRonda } from '../../../src/features/useLeituraRonda';
import { SimuladorNfc } from '../../../src/features/SimuladorNfc';
import { abrirConfiguracoesNfc } from '../../../src/core/nfc/LeitorNfc';
import { useTema } from '../../../src/tema/Tema';
import { alvo, esp, raio } from '../../../src/tema/tokens';
import { Botao, Texto } from '../../../src/ui/atomos';
import { AvisoInline, BarraProgresso, ItemPonto } from '../../../src/ui/moleculas';
import { RetornoLeitura, TituloSecao } from '../../../src/ui/organismos';
import { Rotulo } from '../../../src/ui/novos';
import { Icone } from '../../../src/ui/icones';
import { hora, textos } from '../../../src/textos';

function agrupar(pontos: PontoDaRonda[]) {
  const grupos: { titulo: string; itens: PontoDaRonda[] }[] = [];
  for (const p of pontos) {
    const titulo = [p.predio?.nome, p.andarNome, p.setorNome].filter(Boolean).join(' · ').toUpperCase();
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === titulo) ultimo.itens.push(p);
    else grupos.push({ titulo, itens: [p] });
  }
  return grupos;
}

function Cronometro({ desde }: { desde: string | null }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = desde ? Math.max(0, Math.floor((agora - new Date(desde).getTime()) / 1000)) : 0;
  const dd = (n: number) => String(n).padStart(2, '0');
  return <Texto variante="relogio">{`${dd(Math.floor(s / 3600))}:${dd(Math.floor((s % 3600) / 60))}:${dd(s % 60)}`}</Texto>;
}

export default function Execucao() {
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ronda = useConsulta(() => lerRonda(id), [id]);
  const pontos = useConsulta(() => pontosDaRonda(id), [id]);
  const ocorrencias = useConsulta(() => ocorrenciasDaRonda(id), [id]);
  const [soPendentes, setSoPendentes] = useState(false);
  const aoAceitar = useCallback((pontoId: string, foraDaOrdem: boolean) => router.push(`/ronda/${id}/registrado/${pontoId}${foraDaOrdem ? '?foraDaOrdem=1' : ''}`), [id]);
  const leitura = useLeituraRonda(id, aoAceitar);

  if (!ronda || !pontos) return <View style={{ flex: 1, backgroundColor: cores.fundo }} />;

  const situacao = new Map(pontos.map((p) => [p.pontoRondaId, p.situacao]));
  const prog = progresso(pontos, situacao);
  const esperado = ronda.exigeOrdem ? proximoEsperado(pontos, situacao) : null;
  const emAndamento = ronda.status === 'EM_ANDAMENTO';
  const visiveis = soPendentes ? pontos.filter((p) => p.situacao !== 'VISITADO') : pontos;
  const nOcorrencias = ocorrencias?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={{ backgroundColor: cores.superficie, paddingTop: ins.top + esp[3], paddingHorizontal: esp[4], paddingBottom: esp[4], gap: esp[2], borderBottomWidth: 1, borderBottomColor: cores.borda }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2] }}>
          <Pressable accessibilityRole="button" accessibilityLabel={textos.geral.voltar} onPress={() => router.back()} hitSlop={10}>
            <Icone nome="voltar" cor={cores.textoSecundario} tamanho={20} />
          </Pressable>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: emAndamento ? cores.sucesso : cores.textoSecundario }} />
          <Rotulo cor={emAndamento ? 'sucesso' : 'textoSecundario'}>{emAndamento ? 'RONDA EM ANDAMENTO' : 'RONDA FINALIZADA'}</Rotulo>
          <View style={{ flex: 1 }} />
          {emAndamento ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/ronda/${id}/finalizar`)} style={{ flexDirection: 'row', alignItems: 'center', gap: esp[1], minHeight: alvo.minimo }}>
              <Icone nome="bandeira" cor={cores.primaria} tamanho={18} />
              <Texto variante="corpoForte" cor="primaria" style={{ fontSize: 15 }}>
                Finalizar
              </Texto>
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: esp[2] }}>
          <View style={{ flex: 1 }}>
            <Texto variante="corpoForte" numberOfLines={2}>
              {ronda.roteiroNome}
            </Texto>
            <Texto variante="legenda" cor="textoSecundario">
              {ronda.iniciadaEm ? `Iniciada às ${hora(ronda.iniciadaEm)}` : ''}
              {new Date() > new Date(ronda.fimPrevisto) ? ` · ${textos.inicio.atrasada}` : ` · até ${hora(ronda.fimPrevisto)}`}
            </Texto>
          </View>
          {emAndamento ? <Cronometro desde={ronda.iniciadaEm} /> : null}
        </View>
        <BarraProgresso valor={prog.visitados} total={prog.total} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Texto variante="legenda">
            <Texto variante="legenda" style={{ fontWeight: '700' }}>
              {prog.visitados} de {prog.total}
            </Texto>{' '}
            pontos lidos
          </Texto>
          <Texto variante="legenda" cor="textoSecundario">
            {nOcorrencias} {nOcorrencias === 1 ? 'ocorrência' : 'ocorrências'}
          </Texto>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: esp[4], gap: esp[2], paddingBottom: esp[8] }}>
        {leitura.nfc === 'NFC_DESLIGADO' ? (
          <AvisoInline tipo="erro" texto={textos.execucao.nfcDesligado} acao={{ titulo: textos.execucao.abrirConfiguracoes, onPress: () => abrirConfiguracoesNfc().then(() => leitura.religar()) }} />
        ) : leitura.nfc === 'SEM_NFC' ? (
          <AvisoInline tipo="aviso" texto={textos.execucao.semNfc} />
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => setSoPendentes(!soPendentes)} style={{ alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: esp[3], borderRadius: raio.pilula, borderWidth: 1, borderColor: soPendentes ? cores.primaria : cores.borda }}>
          <Texto variante="legenda" cor={soPendentes ? 'primaria' : 'textoSecundario'} style={{ fontWeight: '700' }}>
            {textos.execucao.soPendentes}
          </Texto>
        </Pressable>
        {agrupar(visiveis).map((g) => (
          <View key={g.titulo}>
            <TituloSecao>{g.titulo}</TituloSecao>
            {g.itens.map((p) => (
              <ItemPonto
                key={p.pontoRondaId}
                nome={p.ponto.nome}
                ordem={ronda.exigeOrdem ? p.ordem : undefined}
                obrigatorio={p.obrigatorio}
                situacao={p.situacao}
                proximo={esperado === p.pontoRondaId}
                auxiliar={p.visitadoEm ? hora(p.visitadoEm) : undefined}
                onPress={() => router.push(p.situacao === 'VISITADO' ? `/ronda/${id}/registrado/${p.pontoRondaId}` : `/ronda/${id}/ponto/${p.pontoRondaId}`)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {emAndamento ? (
        <View style={{ padding: esp[4], paddingBottom: esp[4] + ins.bottom, borderTopWidth: 1, borderTopColor: cores.borda, backgroundColor: cores.superficie, gap: esp[2] }}>
          {Platform.OS === 'android' && leitura.nfc === 'OK' ? (
            <Texto variante="legenda" cor="textoSecundario" centro>
              {textos.execucao.dica}
            </Texto>
          ) : null}
          <View style={{ flexDirection: 'row', gap: esp[3] }}>
            <Botao style={{ flex: 1 }} variante="contornoErro" titulo="Ocorrência" icone={(c) => <Icone nome="alerta" cor={c} tamanho={18} />} onPress={() => router.push(`/ronda/${id}/ocorrencia`)} />
            <Botao
              style={{ flex: 1.3 }}
              variante={prog.completa ? 'sucesso' : 'primario'}
              titulo={prog.completa ? 'Finalizar' : 'Ler ponto'}
              icone={(c) => <Icone nome={prog.completa ? 'bandeira' : 'nfc'} cor={c} tamanho={20} />}
              onPress={() => (prog.completa ? router.push(`/ronda/${id}/finalizar`) : Platform.OS === 'ios' ? leitura.lerNoIos() : router.push(`/ronda/${id}/ler`))}
            />
          </View>
        </View>
      ) : (
        <View style={{ padding: esp[4], paddingBottom: esp[4] + ins.bottom }}>
          <Botao titulo={textos.resumo.voltarInicio} onPress={() => router.dismissTo('/')} />
        </View>
      )}
      {emAndamento ? <SimuladorNfc inferior={140 + ins.bottom} /> : null}
      <RetornoLeitura retorno={leitura.retorno} aoFechar={leitura.fecharRetorno} />
    </View>
  );
}
