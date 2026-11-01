// Retorno ao vigilante: vibração e som (docs/08 · 13). A vibração ignora o modo silencioso; o som, não.
import { Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

type Som = 'sucesso' | 'erro' | 'conclusao';

const fontes: Record<Som, number> = {
  sucesso: require('../../assets/sons/sucesso.wav'),
  erro: require('../../assets/sons/erro.wav'),
  conclusao: require('../../assets/sons/conclusao.wav'),
};

const players: Partial<Record<Som, AudioPlayer>> = {};

export async function prepararSons() {
  await setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
  (Object.keys(fontes) as Som[]).forEach((s) => {
    players[s] = createAudioPlayer(fontes[s]);
  });
}

function tocar(s: Som) {
  const p = players[s];
  if (!p) return;
  p.seekTo(0).then(() => p.play()).catch(() => {});
}

export const retorno = {
  leituraAceita() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => Vibration.vibrate(60));
  },
  sucessoGravado() {
    tocar('sucesso');
  },
  jaRegistrado() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  recusa() {
    Vibration.vibrate(600);
    tocar('erro');
  },
  falhaLeitura() {
    Vibration.vibrate([0, 80, 100, 80]);
  },
  rondaCompleta() {
    Vibration.vibrate([0, 300, 150, 300]);
    tocar('conclusao');
  },
  acao() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
};
