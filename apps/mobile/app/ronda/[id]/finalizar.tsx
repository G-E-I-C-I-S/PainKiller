import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConsulta } from '../../../src/dados/banco';
import { ocorrenciasDaRonda, pontosDaRonda, ronda as lerRonda } from '../../../src/dados/repositorios';
import { progresso } from '../../../src/dominio/regras';
import type { MotivoJustificativa } from '../../../src/dominio/tipos';
import { finalizarRonda } from '../../../src/features/acoes';
import { retorno } from '../../../src/core/retorno';
import { useTema } from '../../../src/tema/Tema';
import { alvo, esp, raio } from '../../../src/tema/tokens';
import { Botao, Campo, Texto } from '../../../src/ui/atomos';
import { AvisoInline } from '../../../src/ui/moleculas';
import { CartaoNumero, Painel, Seletor } from '../../../src/ui/novos';
import { Icone } from '../../../src/ui/icones';
import { hora, textos } from '../../../src/textos';

const MOTIVOS = Object.entries(textos.motivo).map(([valor, rotulo]) => ({ valor: valor as MotivoJustificativa, rotulo }));

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Texto variante="legenda" cor="textoSecundario" style={{ fontSize: 13 }}>
        {rotulo}
      </Texto>
      <Texto variante="mono">{valor}</Texto>
    </View>
  );
}

export default function Finalizar() {
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ronda = useConsulta(() => lerRonda(id), [id]);
  const pontos = useConsulta(() => pontosDaRonda(id), [id]);
  const ocorrencias = useConsulta(() => ocorrenciasDaRonda(id), [id]);
  const [motivos, setMotivos] = useState<Record<string, MotivoJustificativa>>({});
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!ronda || !pontos) return <View style={{ flex: 1, backgroundColor: cores.fundo }} />;

  const prog = progresso(pontos, new Map(pontos.map((p) => [p.pontoRondaId, p.situacao])));
  const naoLidos = pontos.filter((p) => prog.obrigatoriosPendentes.some((o) => o.pontoRondaId === p.pontoRondaId));
  const semMotivo = naoLidos.filter((p) => !p.justificativa && !motivos[p.pontoRondaId]);
  const agora = new Date();
  const minutos = ronda.iniciadaEm ? Math.round((agora.getTime() - new Date(ronda.iniciadaEm).getTime()) / 60_000) : 0;

  const concluir = async () => {
    setSalvando(true);
    try {
      await finalizarRonda(id, ronda.roteiroNome, !prog.completa, {
        observacao,
        justificativas: naoLidos.filter((p) => !p.justificativa && motivos[p.pontoRondaId]).map((p) => ({ pontoRondaId: p.pontoRondaId, pontoNome: p.ponto.nome, motivo: motivos[p.pontoRondaId] })),
      });
      retorno.rondaCompleta();
      router.dismissTo(`/ronda/${id}/resumo`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cores.fundo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2], paddingTop: ins.top + esp[2], paddingHorizontal: esp[4], paddingBottom: esp[2] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={textos.geral.voltar} onPress={() => router.back()} style={{ width: alvo.minimo, height: alvo.minimo, justifyContent: 'center' }}>
          <Icone nome="voltar" cor={cores.texto} />
        </Pressable>
        <Texto variante="titulo">Finalizar ronda</Texto>
      </View>

      <ScrollView contentContainerStyle={{ padding: esp[4], paddingTop: 0, gap: esp[3], paddingBottom: esp[6] }} keyboardShouldPersistTaps="handled">
        {erro ? <AvisoInline tipo="erro" texto={erro} /> : null}
        <Painel>
          <Texto variante="corpoForte">{ronda.roteiroNome}</Texto>
          <View style={{ flexDirection: 'row', gap: esp[2] }}>
            <Dado rotulo="Início" valor={ronda.iniciadaEm ? hora(ronda.iniciadaEm) : '--:--'} />
            <Dado rotulo="Fim" valor={hora(agora)} />
            <Dado rotulo="Duração" valor={`${minutos} min`} />
          </View>
        </Painel>

        <View style={{ flexDirection: 'row', gap: esp[3] }}>
          <CartaoNumero valor={prog.visitados} total={prog.total} rotulo="Pontos lidos" />
          <CartaoNumero valor={ocorrencias?.length ?? 0} rotulo="Ocorrências" cor={ocorrencias?.length ? 'erro' : 'texto'} />
        </View>

        {naoLidos.length ? (
          <View style={{ backgroundColor: '#2E2410', borderRadius: raio.grande, borderWidth: 1, borderColor: '#5C4716', padding: esp[4], gap: esp[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2] }}>
              <Icone nome="alerta" cor={cores.aviso} tamanho={20} />
              <Texto variante="corpoForte" cor="aviso" style={{ fontSize: 15 }}>
                {naoLidos.length === 1 ? '1 ponto não foi lido' : `${naoLidos.length} pontos não foram lidos`}
              </Texto>
            </View>
            {naoLidos.map((p) => (
              <View key={p.pontoRondaId} style={{ gap: esp[1] }}>
                <Texto variante="corpoForte" style={{ fontSize: 15 }}>
                  {p.ponto.nome}
                </Texto>
                <Texto variante="legenda" cor="aviso" style={{ fontWeight: '700', fontSize: 13 }}>
                  Motivo
                </Texto>
                {p.justificativa ? (
                  <Texto variante="legenda" cor="textoSecundario">
                    ⚑ {textos.motivo[p.justificativa.motivo]} (já justificado)
                  </Texto>
                ) : (
                  <Seletor titulo={`Por que ${p.ponto.nome} não foi lido?`} placeholder="Escolha o motivo" valor={motivos[p.pontoRondaId] ?? null} opcoes={MOTIVOS} onChange={(m) => setMotivos({ ...motivos, [p.pontoRondaId]: m })} />
                )}
              </View>
            ))}
          </View>
        ) : null}

        {ocorrencias?.length ? (
          <View style={{ gap: esp[2] }}>
            <Texto variante="corpoForte" style={{ fontSize: 15 }}>
              Ocorrências registradas
            </Texto>
            {ocorrencias.map((o) => (
              <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2], backgroundColor: cores.superficie, borderRadius: raio.medio, padding: esp[3] }}>
                <Texto variante="legenda" style={{ flex: 1 }}>
                  <Texto variante="legenda" style={{ fontWeight: '700' }}>
                    {o.tipoNome}
                  </Texto>
                  {o.local ? ` · ${o.local}` : ''}
                </Texto>
                <View style={{ borderRadius: raio.pequeno, paddingHorizontal: esp[2], paddingVertical: 2, backgroundColor: o.resolvidoNoLocal ? '#123524' : '#3A1F16' }}>
                  <Texto variante="legenda" style={{ fontSize: 12, fontWeight: '700', color: o.resolvidoNoLocal ? cores.sucesso : cores.erro }}>
                    {o.resolvidoNoLocal ? 'Resolvida' : 'Pendente'}
                  </Texto>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Texto variante="corpoForte" style={{ fontSize: 15 }}>
          Observação geral (opcional)
        </Texto>
        <Campo multiline value={observacao} onChangeText={setObservacao} placeholder="Algo a passar para o próximo turno?" maxLength={1000} />
      </ScrollView>

      <View style={{ padding: esp[4], paddingBottom: esp[2] + ins.bottom, gap: esp[1], borderTopWidth: 1, borderTopColor: cores.borda }}>
        <Botao titulo="Concluir ronda" onPress={concluir} carregando={salvando} desabilitado={semMotivo.length > 0} motivoDesabilitado="Escolha o motivo dos pontos não lidos" />
        <Botao variante="texto" titulo="Voltar à ronda" onPress={() => router.back()} />
      </View>
    </KeyboardAvoidingView>
  );
}
