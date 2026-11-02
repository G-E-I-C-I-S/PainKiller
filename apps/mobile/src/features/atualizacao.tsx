// Atualizador automático (como o do NewLife): ao abrir, procura uma versão nova no GitHub Pages,
// baixa mostrando a rodinha de progresso, reinicia e mostra "O que há de novo" uma vez só.
// Durante uma ronda em andamento, baixa em silêncio e aplica na próxima abertura (não interrompe o vigilante).
// Mudança nativa (ícone, permissão, lib nova) não vai por aí: o app baixa o APK novo e abre o instalador do Android.
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, View } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FS from 'expo-file-system/legacy';
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

interface ApkNovo { versionCode: number; versao: string; url: string; itens: string[] }

const URL_APK = (Constants.expoConfig?.updates?.url ?? '').replace(/manifest\.json$/, 'apk.json');

async function procurarApk(): Promise<ApkNovo | null> {
  if (Platform.OS !== 'android' || !URL_APK) return null;
  const r = await fetch(`${URL_APK}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!r.ok) return null;
  const apk = (await r.json()) as ApkNovo;
  return apk.versionCode > Number(Application.nativeBuildVersion ?? 0) ? apk : null;
}

async function instalarApk(apk: ApkNovo, aoProgredir: (p: number) => void) {
  const destino = `${FS.cacheDirectory}guardiao-${apk.versionCode}.apk`;
  const d = FS.createDownloadResumable(apk.url, destino, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) aoProgredir(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const r = await d.downloadAsync();
  if (!r || r.status !== 200) throw new Error(`Download do APK falhou (${r?.status ?? 'sem resposta'})`);
  const uri = await FS.getContentUriAsync(r.uri);
  // 1 = FLAG_GRANT_READ_URI_PERMISSION. Na primeira vez o Android pede para permitir instalar apps do Guardião.
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: uri, flags: 1, type: 'application/vnd.android.package-archive' });
}

export function Atualizador() {
  const { cores } = useTema();
  const { downloadProgress, isDownloading } = Updates.useUpdates();
  const [mostrando, setMostrando] = useState(false);
  const [progressoFinal, setProgressoFinal] = useState(0);
  const [novidades, setNovidades] = useState<typeof NOVIDADES>([]);
  const verificando = useRef(false);
  const [apk, setApk] = useState<ApkNovo | null>(null);
  const [baixandoApk, setBaixandoApk] = useState<number | null>(null);
  const [erroApk, setErroApk] = useState<string | null>(null);
  const adiadoApk = useRef(false);

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
        const novo = adiadoApk.current ? null : await procurarApk().catch(() => null);
        if (novo && !(await rondaEmAndamento().catch(() => null))) {
          setApk(novo);
          return;
        }
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
      <Modal visible={!!apk} transparent animationType="fade" statusBarTranslucent onRequestClose={() => baixandoApk === null && setApk(null)}>
        <View style={{ flex: 1, backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'center', gap: esp[5], padding: esp[6] }}>
          {baixandoApk !== null ? <Rodinha progresso={baixandoApk} /> : null}
          <Texto variante="titulo" centro>
            {baixandoApk === null ? `Versão nova do app: ${apk?.versao}` : 'Baixando a versão nova'}
          </Texto>
          {baixandoApk === null
            ? apk?.itens.map((i) => (
                <Texto key={i} cor="textoSecundario" centro>
                  • {i}
                </Texto>
              ))
            : null}
          <Texto variante="legenda" cor="textoSecundario" centro>
            Depois toque em Instalar na tela do Android. Seus registros continuam guardados.
          </Texto>
          {erroApk ? (
            <Texto cor="erro" centro>
              {erroApk}
            </Texto>
          ) : null}
          {baixandoApk === null ? (
            <View style={{ alignSelf: 'stretch', gap: esp[2] }}>
              <Botao
                titulo="Baixar e instalar"
                onPress={async () => {
                  if (!apk) return;
                  setErroApk(null);
                  setBaixandoApk(0);
                  try {
                    await instalarApk(apk, setBaixandoApk);
                  } catch (e) {
                    registrarErro('atualizacao-apk', e);
                    setErroApk('Não deu para baixar agora. Confira a internet e tente de novo.');
                  } finally {
                    setBaixandoApk(null);
                  }
                }}
              />
              <Botao
                titulo="Depois"
                variante="secundario"
                onPress={() => {
                  adiadoApk.current = true;
                  setApk(null);
                }}
              />
            </View>
          ) : null}
        </View>
      </Modal>
      <Modal visible={!mostrando && !apk && novidades.length > 0} transparent animationType="fade" onRequestClose={() => setNovidades([])}>
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
