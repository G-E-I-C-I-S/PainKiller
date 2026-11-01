import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConsulta } from '../../../src/dados/banco';
import { pontosDaRonda, tiposOcorrencia, ultimaVisita } from '../../../src/dados/repositorios';
import { registrarOcorrencia } from '../../../src/features/acoes';
import { processarFoto, type FotoProcessada } from '../../../src/core/camera';
import { retorno } from '../../../src/core/retorno';
import { MAXIMO_FOTOS } from '../../../src/dominio/regras';
import type { Gravidade } from '../../../src/dominio/tipos';
import { useTema } from '../../../src/tema/Tema';
import { alvo, esp, raio } from '../../../src/tema/tokens';
import { Botao, Campo, Indicador, Texto } from '../../../src/ui/atomos';
import { AvisoInline } from '../../../src/ui/moleculas';
import { CaixaMarcacao, GradeOpcoes, Seletor } from '../../../src/ui/novos';
import { Icone } from '../../../src/ui/icones';
import { hora, textos } from '../../../src/textos';

function Camera({ aoCapturar, aoFechar }: { aoCapturar: (f: FotoProcessada) => void; aoFechar: () => void }) {
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  const [perm, pedir] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [pronta, setPronta] = useState(false);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) pedir();
  }, [perm, pedir]);

  const capturar = async () => {
    if (!ref.current || processando) return;
    setProcessando(true);
    try {
      const foto = await ref.current.takePictureAsync({ quality: 1, exif: false, skipProcessing: false });
      aoCapturar(await processarFoto(foto.uri, foto.width, foto.height));
    } finally {
      setProcessando(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {perm?.granted ? (
        <CameraView ref={ref} style={{ flex: 1 }} facing="back" onCameraReady={() => setPronta(true)} />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', padding: esp[6] }}>
          <AvisoInline tipo="aviso" texto={textos.ocorrencia.precisaCamera} acao={{ titulo: textos.ocorrencia.permitirCamera, onPress: pedir }} />
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar câmera" onPress={aoFechar} style={{ position: 'absolute', top: ins.top + esp[2], left: esp[4], width: alvo.minimo, height: alvo.minimo, justifyContent: 'center' }}>
        <Icone nome="x" cor="#fff" tamanho={28} />
      </Pressable>
      {perm?.granted ? (
        <View style={{ position: 'absolute', bottom: ins.bottom + esp[8], left: 0, right: 0, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={textos.ocorrencia.tirarFoto}
            disabled={!pronta || processando}
            onPress={capturar}
            style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 6, borderColor: '#fff', backgroundColor: processando ? cores.textoSecundario : cores.primaria, alignItems: 'center', justifyContent: 'center' }}
          >
            {processando ? <Indicador /> : null}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const GRAVIDADES: Gravidade[] = ['BAIXA', 'MEDIA', 'ALTA'];

export default function Ocorrencia() {
  usePreventScreenCapture('ocorrencia');
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  const { id, ponto, tipo: tipoParam } = useLocalSearchParams<{ id: string; ponto?: string; tipo?: string }>();
  const tipos = useConsulta(tiposOcorrencia);
  const pontos = useConsulta(() => pontosDaRonda(id), [id]);
  const ultima = useConsulta(() => ultimaVisita(id), [id]);
  const [camera, setCamera] = useState(false);
  const [fotos, setFotos] = useState<FotoProcessada[]>([]);
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [gravidade, setGravidade] = useState<Gravidade>('MEDIA');
  const [pontoId, setPontoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState('');
  const [descricao, setDescricao] = useState('');
  const [resolvido, setResolvido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const escolherTipo = (tid: string) => {
    const t = tipos?.find((x) => x.id === tid);
    setTipoId(tid);
    if (t) setGravidade(t.gravidadePadrao === 'CRITICA' ? 'ALTA' : t.gravidadePadrao);
  };

  useEffect(() => {
    if (tipos?.length && !tipoId && tipoParam) escolherTipo(tipoParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos, tipoParam]);
  useEffect(() => {
    if (pontos?.length && !pontoId) setPontoId(ponto ?? ultima?.pontoRondaId ?? pontos[0].pontoRondaId);
  }, [pontos, ultima, pontoId, ponto]);

  const tipo = tipos?.find((t) => t.id === tipoId);
  const local = pontos?.find((p) => p.pontoRondaId === pontoId);
  const ehUltimo = !!ultima && ultima.pontoRondaId === pontoId;

  const enviar = async () => {
    if (!tipo || !local) return;
    setEnviando(true);
    try {
      await registrarOcorrencia({
        rondaId: id,
        tipoOcorrenciaId: tipo.id,
        tipoNome: tipo.nome,
        gravidade,
        descricao: descricao.trim() || null,
        predioId: local.ponto.predioId,
        pontoRondaId: local.pontoRondaId,
        detalheLocal: detalhe.trim() || null,
        resolvidoNoLocal: resolvido,
        fotos,
      });
      retorno.leituraAceita();
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setEnviando(false);
    }
  };

  const rotulo = (t: string) => (
    <Texto variante="corpoForte" style={{ fontSize: 15, marginTop: esp[2] }}>
      {t}
    </Texto>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cores.fundo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2], paddingTop: ins.top + esp[2], paddingHorizontal: esp[4], paddingBottom: esp[2] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={textos.geral.voltar} onPress={() => router.back()} style={{ width: alvo.minimo, height: alvo.minimo, justifyContent: 'center' }}>
          <Icone nome="voltar" cor={cores.texto} />
        </Pressable>
        <Texto variante="titulo">Nova ocorrência</Texto>
      </View>

      <ScrollView contentContainerStyle={{ padding: esp[4], paddingTop: 0, gap: esp[2], paddingBottom: esp[8] }} keyboardShouldPersistTaps="handled">
        {erro ? <AvisoInline tipo="erro" texto={erro} /> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[3], backgroundColor: cores.superficie, borderRadius: raio.medio, borderWidth: 1, borderColor: cores.borda, padding: esp[3] }}>
          <Icone nome="pin" cor={cores.primaria} tamanho={20} />
          <View style={{ flex: 1 }}>
            <Texto variante="corpoForte" style={{ fontSize: 15 }}>
              {[local?.predio?.nome, local?.andarNome, local?.ponto.nome].filter(Boolean).join(' · ')}
            </Texto>
            {ehUltimo && ultima ? (
              <Texto variante="legenda" cor="textoSecundario">
                Último ponto lido · {hora(ultima.lidoEm)}
              </Texto>
            ) : null}
          </View>
          {pontos ? (
            <Seletor
                link="Alterar"
                titulo="Onde foi?"
                valor={pontoId}
                opcoes={pontos.map((p) => ({ valor: p.pontoRondaId, rotulo: [p.ponto.nome, p.predio?.codigo, p.andarNome].filter(Boolean).join(' · ') }))}
                onChange={setPontoId}
              />
          ) : null}
        </View>

        {rotulo('O que aconteceu?')}
        <GradeOpcoes opcoes={(tipos ?? []).map((t) => ({ valor: t.id, rotulo: t.nome }))} valor={tipoId} onChange={escolherTipo} />

        {rotulo('Sala ou detalhe do local')}
        <Campo value={detalhe} onChangeText={setDetalhe} placeholder="Ex.: Sala 204" maxLength={200} />

        {rotulo('Gravidade')}
        <View style={{ flexDirection: 'row', gap: esp[2] }}>
          {GRAVIDADES.map((g) => {
            const sel = g === gravidade;
            return (
              <Pressable
                key={g}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                onPress={() => setGravidade(g)}
                style={{ flex: 1, minHeight: alvo.minimo, borderRadius: raio.medio, borderWidth: 1.5, borderColor: sel ? cores.gravidade[g] : cores.borda, backgroundColor: cores.superficie, alignItems: 'center', justifyContent: 'center' }}
              >
                <Texto variante="legenda" style={{ fontWeight: '700', color: sel ? cores.gravidade[g] : cores.textoSecundario }}>
                  {textos.gravidade[g]}
                </Texto>
              </Pressable>
            );
          })}
        </View>

        {rotulo('Descrição')}
        <Campo multiline value={descricao} onChangeText={setDescricao} maxLength={2000} placeholder="O que você viu?" />

        {rotulo('Fotos')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: esp[2] }}>
          {fotos.map((f, i) => (
            <Pressable key={f.sha256 + i} accessibilityLabel={`Foto ${i + 1}. Toque e segure para remover`} onLongPress={() => setFotos(fotos.filter((_, j) => j !== i))}>
              <Image source={{ uri: `data:image/jpeg;base64,${f.base64}` }} style={{ width: 84, height: 84, borderRadius: raio.medio }} />
            </Pressable>
          ))}
          {fotos.length < MAXIMO_FOTOS ? (
            <Pressable accessibilityRole="button" accessibilityLabel={textos.ocorrencia.tirarFoto} onPress={() => setCamera(true)} style={{ width: 84, height: 84, borderRadius: raio.medio, borderWidth: 1.5, borderStyle: 'dashed', borderColor: cores.borda, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Icone nome="camera" cor={cores.primaria} tamanho={22} />
              <Texto variante="legenda" cor="primaria" style={{ fontWeight: '700', fontSize: 13 }}>
                Câmera
              </Texto>
            </Pressable>
          ) : (
            <Texto variante="legenda" cor="textoSecundario">
              {textos.ocorrencia.limiteFotos}
            </Texto>
          )}
        </View>

        <View style={{ marginTop: esp[2] }}>
          <CaixaMarcacao marcado={resolvido} onChange={setResolvido} titulo="Resolvido no local" ajuda="Ex.: apaguei a luz, tranquei a porta" />
        </View>
      </ScrollView>

      <View style={{ padding: esp[4], paddingBottom: esp[4] + ins.bottom, borderTopWidth: 1, borderTopColor: cores.borda }}>
        <Botao titulo="Registrar ocorrência" onPress={enviar} carregando={enviando} desabilitado={!tipo || !local} motivoDesabilitado={!tipo ? 'Escolha o que aconteceu' : undefined} />
      </View>

      <Modal visible={camera} animationType="slide" onRequestClose={() => setCamera(false)}>
        <Camera
          aoCapturar={(f) => {
            setFotos((x) => [...x, f]);
            setCamera(false);
          }}
          aoFechar={() => setCamera(false)}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
}
