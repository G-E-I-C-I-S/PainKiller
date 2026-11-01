// Atualizador automático (como o do NewLife): ao abrir, procura uma versão nova no GitHub Pages,
// baixa mostrando a rodinha de progresso, reinicia e mostra "O que há de novo" uma vez só.
// Durante uma ronda em andamento, baixa em silêncio e aplica na próxima abertura (não interrompe o vigilante).
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, View } from 'react-native';
import * as Updates from 'expo-updates';
import * as SecureStore from 'expo-secure-store';
import Svg, { Circle } from 'react-native-svg';
import { useTema } from '../tema/Tema';
import { esp, raio } from '../tema/tokens';
import { Botao, Texto } from '../ui/atomos';
import { NOVIDADES, VERSAO } from './novidades';
import { rondaEmAndamento } from '../dados/repositorios';
import { registrarErro } from '../dados/banco';

const RAIO = 52;
const VOLTA = 2 * Math.PI * RAIO;

function Rodinha({ progresso }: { progresso: number }) {
  const { cores } = useTema();
  return (
    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={140} height={140} viewBox="0 0 120 120" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={60} cy={60} r={RAIO} stroke={cores.borda} strokeWidth={8} fill="none" />
        <Circle cx={60} cy={60} r={RAIO} stroke={cores.primaria} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={`${VOLTA}`} strokeDashoffset={VOLTA * (1 - progresso)} />
      </Svg>
      <Texto variante="relogio">{Math.round(progresso * 100)}%</Texto>
    </View>
  );
}

export function Atualizador() {
  const { cores } = useTema();
  const { downloadProgress, isDownloading } = Updates.useUpdates();
  const [mostrando, setMostrando] = useState(false);
  const [progressoFinal, setProgressoFinal] = useState(0);
  const [novidades, setNovidades] = useState<typeof NOVIDADES>([]);
  const verificando = useRef(false);

  // Depois de atualizar: mostra as novidades das versões que o aparelho ainda não viu.
  useEffect(() => {
    SecureStore.getItemAsync('versao_vista').then((vista) => {
      if (vista && vista !== VERSAO) {
        const i = NOVIDADES.findIndex((n) => n.v === vista);
        setNovidades(i === -1 ? NOVIDADES.slice(0, 1) : NOVIDADES.slice(0, i));
      }
      SecureStore.setItemAsync('versao_vista', VERSAO);
    });
  }, []);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const verificar = async () => {
      if (verificando.current) return;
      verificando.current = true;
      try {
        const r = await Updates.checkForUpdateAsync();
        if (!r.isAvailable) return;
        const emRonda = await rondaEmAndamento().catch(() => null);
        if (emRonda) {
          await Updates.fetchUpdateAsync(); // aplica na próxima abertura
          return;
        }
        setMostrando(true);
        await Updates.fetchUpdateAsync();
        // A rodinha chega a 100% mesmo quando o download foi rápido demais para ser visto.
        for (let p = 0.6; p <= 1; p += 0.05) {
          setProgressoFinal(p);
          await new Promise((res) => setTimeout(res, 60));
        }
        await Updates.reloadAsync();
      } catch (e) {
        setMostrando(false);
        registrarErro('atualizacao', e);
      } finally {
        verificando.current = false;
      }
    };
    verificar();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && verificar());
    return () => sub.remove();
  }, []);

  const progresso = Math.max(progressoFinal, isDownloading ? (downloadProgress ?? 0) * 0.6 : 0);

  return (
    <>
      <Modal visible={mostrando} transparent animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'center', gap: esp[6], padding: esp[6] }}>
          <Rodinha progresso={progresso} />
          <Texto variante="titulo" centro>
            Atualizando o Guardião
          </Texto>
          <Texto cor="textoSecundario" centro>
            Só um instante. Seus registros continuam guardados no aparelho.
          </Texto>
        </View>
      </Modal>
      <Modal visible={!mostrando && novidades.length > 0} transparent animationType="fade" onRequestClose={() => setNovidades([])}>
        <View style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: esp[5] }}>
          <View style={{ backgroundColor: cores.superficie, borderRadius: raio.grande, padding: esp[5], gap: esp[3], borderWidth: 1, borderColor: cores.borda }}>
            <Texto variante="titulo">App atualizado!</Texto>
            {novidades.map((n) => (
              <View key={n.v} style={{ gap: esp[1] }}>
                <Texto variante="corpoForte" cor="primaria">
                  {n.v} · {n.t}
                </Texto>
                {n.itens.map((i) => (
                  <Texto key={i} variante="legenda">
                    • {i}
                  </Texto>
                ))}
              </View>
            ))}
            <Botao titulo="Entendi" onPress={() => setNovidades([])} />
          </View>
        </View>
      </Modal>
    </>
  );
}
