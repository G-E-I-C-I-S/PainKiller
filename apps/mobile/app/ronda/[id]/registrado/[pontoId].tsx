// Depois da leitura: "Ponto registrado" + checklist "Como está o local?".
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConsulta } from '../../../../src/dados/banco';
import { pontosDaRonda, tiposOcorrencia, visitaDoPonto } from '../../../../src/dados/repositorios';
import { registrarChecklist, type ChecklistItem } from '../../../../src/features/acoes';
import { retorno } from '../../../../src/core/retorno';
import { useTema } from '../../../../src/tema/Tema';
import { esp, raio } from '../../../../src/tema/tokens';
import { Botao, Texto } from '../../../../src/ui/atomos';
import { LinhaOkProblema } from '../../../../src/ui/novos';
import { Icone } from '../../../../src/ui/icones';
import { hora, textos } from '../../../../src/textos';

// Cada item do checklist, quando marcado como Problema, sugere um tipo de ocorrência (pelo nome).
const ITENS = [
  { item: 'Portas trancadas', tipo: /porta/i },
  { item: 'Janelas fechadas', tipo: /janela/i },
  { item: 'Luzes apagadas', tipo: /luz|ilumina/i },
  { item: 'Sem pessoas no local', tipo: /pessoa/i },
];

const horaSeg = (iso: string) => {
  const d = new Date(iso);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
};

export default function Registrado() {
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  const { id, pontoId, foraDaOrdem } = useLocalSearchParams<{ id: string; pontoId: string; foraDaOrdem?: string }>();
  const pontos = useConsulta(() => pontosDaRonda(id), [id]);
  const visita = useConsulta(() => visitaDoPonto(id, pontoId), [id, pontoId]);
  const tipos = useConsulta(tiposOcorrencia);
  const [ok, setOk] = useState<boolean[]>(ITENS.map(() => true));
  const [salvando, setSalvando] = useState(false);
  const [carregouAnterior, setCarregouAnterior] = useState(false);

  // Se o checklist já foi respondido (reabrindo o ponto), mostra as respostas.
  useEffect(() => {
    if (!visita || carregouAnterior) return;
    setCarregouAnterior(true);
    if (visita.checklist) {
      const ant: ChecklistItem[] = JSON.parse(visita.checklist);
      setOk(ITENS.map((i) => ant.find((a) => a.item === i.item)?.ok ?? true));
    }
  }, [visita, carregouAnterior]);

  const p = pontos?.find((x) => x.pontoRondaId === pontoId);
  if (!p || !pontos) return <View style={{ flex: 1, backgroundColor: cores.fundo }} />;

  const posicao = pontos.filter((x) => x.situacao === 'VISITADO').length;
  const local = [p.predio?.nome, p.andarNome, p.ponto.nome].filter(Boolean).join(' · ');
  const temProblema = ok.some((v) => !v);
  const viaQr = visita?.payloadNfc.startsWith('QR:');

  const salvar = async () => {
    setSalvando(true);
    await registrarChecklist(id, pontoId, p.ponto.nome, ITENS.map((i, k) => ({ item: i.item, ok: ok[k] })));
    retorno.acao();
  };

  const confirmar = async () => {
    await salvar();
    if (temProblema) return abrirOcorrencia(true);
    router.back();
  };

  const abrirOcorrencia = async (jaSalvo = false) => {
    if (!jaSalvo) await salvar();
    const primeiro = ITENS.find((_, k) => !ok[k]);
    const tipo = primeiro ? tipos?.find((t) => primeiro.tipo.test(t.nome)) : null;
    router.replace(`/ronda/${id}/ocorrencia?ponto=${pontoId}${tipo ? `&tipo=${tipo.id}` : ''}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <View style={{ backgroundColor: '#123524', paddingTop: ins.top + esp[6], paddingBottom: esp[6], paddingHorizontal: esp[4], alignItems: 'center', gap: esp[2] }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: cores.sucesso, alignItems: 'center', justifyContent: 'center' }}>
          <Icone nome="check" cor={cores.textoSobreCor} tamanho={34} espessura={3} />
        </View>
        <Texto variante="titulo" centro>
          Ponto registrado
        </Texto>
        <Texto variante="corpoForte" cor="sucesso" centro>
          {local}
        </Texto>
        {visita ? (
          <Texto variante="legenda" cor="textoSecundario" centro style={{ fontFamily: 'monospace' }}>
            {horaSeg(visita.lidoEm)} · lido por {viaQr ? 'QR Code' : 'NFC'} · ponto {posicao} de {pontos.length}
          </Texto>
        ) : null}
        {foraDaOrdem ? (
          <Texto variante="legenda" cor="aviso" centro style={{ fontWeight: '700' }}>
            {textos.execucao.foraDaOrdem}
          </Texto>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: esp[4], gap: esp[3] }}>
        <View>
          <Texto variante="corpoForte">Como está o local?</Texto>
          <Texto variante="legenda" cor="textoSecundario">
            Toque em "Problema" no que estiver fora do normal.
          </Texto>
        </View>
        {ITENS.map((i, k) => (
          <LinhaOkProblema key={i.item} rotulo={i.item} ok={ok[k]} onChange={(v) => setOk(ok.map((x, j) => (j === k ? v : x)))} />
        ))}
        {temProblema ? (
          <View style={{ backgroundColor: '#3A1F16', borderRadius: raio.medio, padding: esp[3] }}>
            <Texto variante="legenda" cor="erro">
              Ao confirmar, abre o registro de ocorrência já com o local e o tipo preenchidos.
            </Texto>
          </View>
        ) : null}
        {visita ? (
          <Texto variante="legenda" cor="textoSecundario" centro>
            Lido às {hora(visita.lidoEm)}
          </Texto>
        ) : null}
      </ScrollView>

      <View style={{ padding: esp[4], paddingBottom: esp[4] + ins.bottom, gap: esp[3], alignItems: 'stretch' }}>
        <Botao titulo="Registrar ocorrência" onPress={() => abrirOcorrencia()} desabilitado={salvando} />
        <Botao variante="perigo" titulo="Confirmar" onPress={confirmar} carregando={salvando} />
      </View>
    </View>
  );
}
