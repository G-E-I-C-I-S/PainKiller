// Tela "Ler ponto": NFC (padrão) ou QR Code. A leitura NFC também funciona direto na Execução.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConsulta } from '../../../src/dados/banco';
import { pontosDaRonda, ronda as lerRonda } from '../../../src/dados/repositorios';
import { proximoEsperado } from '../../../src/dominio/regras';
import { useLeituraRonda } from '../../../src/features/useLeituraRonda';
import { SimuladorNfc } from '../../../src/features/SimuladorNfc';
import { abrirConfiguracoesNfc } from '../../../src/core/nfc/LeitorNfc';
import { useTema } from '../../../src/tema/Tema';
import { alvo, esp, raio } from '../../../src/tema/tokens';
import { Texto } from '../../../src/ui/atomos';
import { AvisoInline } from '../../../src/ui/moleculas';
import { RetornoLeitura } from '../../../src/ui/organismos';
import { Icone } from '../../../src/ui/icones';
import { textos } from '../../../src/textos';

function Pulso() {
  const { cores } = useTema();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a]);
  const anel = (tam: number, atraso: number) => (
    <Animated.View
      style={{
        position: 'absolute',
        width: tam,
        height: tam,
        borderRadius: tam / 2,
        borderWidth: 1.5,
        borderColor: cores.borda,
        opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1 - atraso, 0.35] }),
      }}
    />
  );
  return (
    <View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}>
      {anel(240, 0.3)}
      {anel(180, 0)}
      <Animated.View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: cores.primaria, alignItems: 'center', justifyContent: 'center', transform: [{ scale: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] }) }] }}>
        <Icone nome="nfc" cor={cores.textoSobrePrimaria} tamanho={52} espessura={2.4} />
      </Animated.View>
    </View>
  );
}

function LeitorQr({ aoLer }: { aoLer: (codigo: string) => void }) {
  const { cores } = useTema();
  const [perm, pedir] = useCameraPermissions();
  const ultimo = useRef<{ c: string; em: number } | null>(null);
  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) pedir();
  }, [perm, pedir]);
  if (!perm?.granted) return <AvisoInline tipo="aviso" texto="Permita a câmera para ler o QR Code do ponto." acao={{ titulo: textos.ocorrencia.permitirCamera, onPress: pedir }} />;
  return (
    <View style={{ width: 260, height: 260, borderRadius: raio.grande, overflow: 'hidden', borderWidth: 2, borderColor: cores.primaria }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          const agora = Date.now();
          if (ultimo.current && ultimo.current.c === data && agora - ultimo.current.em < 3000) return;
          ultimo.current = { c: data, em: agora };
          aoLer(data);
        }}
      />
    </View>
  );
}

export default function LerPonto() {
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ronda = useConsulta(() => lerRonda(id), [id]);
  const pontos = useConsulta(() => pontosDaRonda(id), [id]);
  const [aba, setAba] = useState<'NFC' | 'QR'>('NFC');
  const aoAceitar = useCallback((pontoId: string, foraDaOrdem: boolean) => router.replace(`/ronda/${id}/registrado/${pontoId}${foraDaOrdem ? '?foraDaOrdem=1' : ''}`), [id]);
  const leitura = useLeituraRonda(id, aoAceitar);

  const situacao = new Map((pontos ?? []).map((p) => [p.pontoRondaId, p.situacao]));
  const sugeridoId = pontos ? proximoEsperado(pontos, situacao) : null;
  const sugerido = pontos?.find((p) => p.pontoRondaId === sugeridoId);

  const aba_ = (v: 'NFC' | 'QR', rotulo: string) => (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: aba === v }} onPress={() => setAba(v)} style={{ flex: 1, minHeight: 44, borderRadius: raio.medio, alignItems: 'center', justifyContent: 'center', backgroundColor: aba === v ? cores.superficieElevada : 'transparent' }}>
      <Texto variante="legenda" style={{ fontWeight: '700' }} cor={aba === v ? 'texto' : 'textoSecundario'}>
        {rotulo}
      </Texto>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: ins.top + esp[2], paddingBottom: ins.bottom + esp[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: esp[4], minHeight: alvo.minimo }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => router.back()} hitSlop={10} style={{ width: alvo.minimo }}>
          <Icone nome="x" cor={cores.texto} tamanho={24} />
        </Pressable>
        <Texto variante="corpoForte" centro style={{ flex: 1 }}>
          Ler ponto
        </Texto>
        <View style={{ width: alvo.minimo }} />
      </View>
      <View style={{ flexDirection: 'row', margin: esp[4], padding: 4, borderRadius: raio.medio, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda }}>
        {aba_('NFC', 'NFC')}
        {aba_('QR', 'QR Code')}
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: esp[4], paddingHorizontal: esp[6] }}>
        {leitura.nfc === 'NFC_DESLIGADO' && aba === 'NFC' ? (
          <AvisoInline tipo="erro" texto={textos.execucao.nfcDesligado} acao={{ titulo: textos.execucao.abrirConfiguracoes, onPress: () => abrirConfiguracoesNfc().then(() => leitura.religar()) }} />
        ) : null}
        {aba === 'NFC' ? <Pulso /> : <LeitorQr aoLer={leitura.lerCodigo} />}
        <Texto variante="titulo" centro>
          {aba === 'NFC' ? 'Aproxime o celular da tag' : 'Aponte para o QR Code do ponto'}
        </Texto>
        <Texto variante="legenda" cor="textoSecundario" centro>
          {aba === 'NFC' ? 'Encoste a parte de trás do aparelho na etiqueta fixada no local.' : 'O código fica na etiqueta do ponto, ao lado da tag.'}
        </Texto>
      </View>

      <View style={{ paddingHorizontal: esp[4], gap: esp[3] }}>
        {sugerido ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2], backgroundColor: cores.superficie, borderRadius: raio.medio, borderWidth: 1, borderColor: cores.borda, padding: esp[3] }}>
            <Icone nome="pin" cor={cores.primaria} tamanho={18} />
            <Texto variante="legenda" cor="textoSecundario" style={{ flex: 1 }}>
              Sugerido:{' '}
              <Texto variante="legenda" style={{ fontWeight: '700' }}>
                {[sugerido.andarNome, sugerido.ponto.nome].filter(Boolean).join(' · ')}
              </Texto>
            </Texto>
          </View>
        ) : null}
        {sugerido && ronda?.status === 'EM_ANDAMENTO' ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/ronda/${id}/justificar/${sugerido.pontoRondaId}?motivo=TAG_DANIFICADA_OU_AUSENTE`)} style={{ minHeight: alvo.minimo, justifyContent: 'center' }}>
            <Texto variante="legenda" cor="primaria" centro style={{ fontWeight: '700', textDecorationLine: 'underline' }}>
              Tag com problema? Justificar o ponto
            </Texto>
          </Pressable>
        ) : null}
      </View>
      <SimuladorNfc inferior={150 + ins.bottom} />
      <RetornoLeitura retorno={leitura.retorno} aoFechar={leitura.fecharRetorno} />
    </View>
  );
}
