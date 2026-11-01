// Leitor NFC real (react-native-nfc-manager) em modo leitor, mais o leitor simulado de desenvolvimento.
import { AppState, Platform, type NativeEventSubscription } from 'react-native';
import NfcManager, { Ndef, NfcEvents, NfcTech, type TagEvent } from 'react-native-nfc-manager';
import { conteudoDaTag, interpretarTag, textoGravacao, type LeituraNfc, type PontoGravado, type RegistroNdef } from './parser';

export type DisponibilidadeNfc = 'OK' | 'SEM_NFC' | 'NFC_DESLIGADO';
export type ErroNfc = { codigo: 'FALHA_LEITURA' | 'SEM_NFC' | 'NFC_DESLIGADO'; mensagem?: string };

export interface LeitorNfc {
  disponivel(): Promise<DisponibilidadeNfc>;
  iniciar(aoLer: (l: LeituraNfc) => void, aoFalhar: (e: ErroNfc) => void): Promise<void>;
  parar(): Promise<void>;
}

// Bits do NfcAdapter do Android: NFC_A | NFC_B | NFC_F | NFC_V. Sem FLAG_READER_SKIP_NDEF_CHECK,
// para o Android entregar a mensagem NDEF (URL SUN) junto com o UID.
const FLAGS_LEITOR = 0x1 | 0x2 | 0x4 | 0x8;

let iniciado = false;

async function garantirInicio() {
  if (!iniciado) {
    await NfcManager.start();
    iniciado = true;
  }
}

export const leitorNfcReal: LeitorNfc = {
  async disponivel() {
    try {
      if (!(await NfcManager.isSupported())) return 'SEM_NFC';
      await garantirInicio();
      return (await NfcManager.isEnabled()) ? 'OK' : 'NFC_DESLIGADO';
    } catch {
      return 'SEM_NFC';
    }
  },

  async iniciar(aoLer, aoFalhar) {
    await garantirInicio();
    await leitorNfcReal.parar();
    ativo = true;
    let ultima = { uid: '', em: 0 };
    NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
      const leitura = interpretarTag(tag.id, tag.ndefMessage as RegistroNdef[] | undefined);
      // Depois de cada leitura o leitor é religado (alguns Android param de entregar tags após algumas leituras);
      // a mesma tag ainda encostada não conta de novo.
      agendarRearme(1000);
      if (!leitura) return aoFalhar({ codigo: 'FALHA_LEITURA' });
      const agora = Date.now();
      const repetida = leitura.uidHex === ultima.uid && agora - ultima.em < 2500;
      ultima = { uid: leitura.uidHex, em: agora }; // tag parada no celular continua "vista" e não repete
      if (!repetida) aoLer(leitura);
    });
    NfcManager.setEventListener(NfcEvents.StateChanged, (e: { state?: string }) => {
      if (e?.state === 'off') aoFalhar({ codigo: 'NFC_DESLIGADO' });
      if (e?.state === 'on') agendarRearme(300);
    });
    // Tela desligada/voltando do segundo plano desliga o modo leitor: religa ao voltar, e a cada 20 s por garantia.
    subApp = AppState.addEventListener('change', (s) => s === 'active' && agendarRearme(300));
    vigia = setInterval(() => agendarRearme(0), 20_000);
    try {
      await registrar();
    } catch (e) {
      aoFalhar({ codigo: 'FALHA_LEITURA', mensagem: e instanceof Error ? e.message : String(e) });
    }
  },

  async parar() {
    ativo = false;
    if (rearme) clearTimeout(rearme);
    if (vigia) clearInterval(vigia);
    subApp?.remove();
    rearme = vigia = null;
    subApp = null;
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    NfcManager.setEventListener(NfcEvents.StateChanged, null);
    await NfcManager.unregisterTagEvent().catch(() => {});
  },
};

let ativo = false;
let rearme: ReturnType<typeof setTimeout> | null = null;
let vigia: ReturnType<typeof setInterval> | null = null;
let subApp: NativeEventSubscription | null = null;

async function registrar() {
  await NfcManager.unregisterTagEvent().catch(() => {});
  if (!ativo) return;
  await NfcManager.registerTagEvent(
    Platform.OS === 'android'
      ? { isReaderModeEnabled: true, readerModeFlags: FLAGS_LEITOR, readerModeDelay: 250 }
      : { alertMessage: 'Encoste o celular na tag', invalidateAfterFirstRead: true },
  );
}

function agendarRearme(ms: number) {
  if (!ativo || Platform.OS !== 'android') return;
  if (rearme) clearTimeout(rearme);
  rearme = setTimeout(() => {
    rearme = null;
    registrar().catch(() => {});
  }, ms);
}

/**
 * Grava o ponto dentro da tag (registro de texto NDEF). Espera a tag ser encostada.
 * Pare o leitor contínuo antes: o Android só entrega a tag para uma sessão por vez.
 */
export async function gravarPontoNaTag(p: PontoGravado): Promise<{ uidHex: string }> {
  await garantirInicio();
  const bytes = Ndef.encodeMessage([Ndef.textRecord(textoGravacao(p))]);
  try {
    const tech = await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NdefFormatable, NfcTech.MifareClassic, NfcTech.NfcA]);
    const tag = await NfcManager.getTag();
    const uidHex = (tag?.id ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    const techs = tag?.techTypes ?? [];
    if (techs.some((t) => t.endsWith('.Ndef'))) {
      // Não sobrescreve conteúdo de outro sistema nem outro ponto: para trocar, limpe a tag antes.
      const c = conteudoDaTag(tag?.ndefMessage as RegistroNdef[] | undefined);
      if (c.tipo === 'OUTRO') throw new Error('TAG_COM_OUTRO_CONTEUDO');
      if (c.tipo === 'PONTO' && c.ponto.pontoId !== p.pontoId) throw new Error(`TAG_JA_GRAVADA:${c.ponto.nome}`);
    }
    if (tech === NfcTech.NdefFormatable || (!techs.some((t) => t.endsWith('.Ndef')) && techs.some((t) => t.endsWith('.NdefFormatable')))) {
      await NfcManager.ndefFormatableHandlerAndroid.formatNdef(bytes);
    } else if (techs.some((t) => t.endsWith('.Ndef')) || tech === NfcTech.Ndef) {
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
    } else {
      throw new Error('TAG_SEM_NDEF');
    }
    return { uidHex };
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

/**
 * Apaga o ponto gravado na tag. Por segurança só mexe em tag vazia ou gravada pelo app:
 * outro conteúdo (URL SUN, cartão de outro sistema) gera TAG_COM_OUTRO_CONTEUDO e nada é escrito.
 * Nunca bloqueia a tag contra gravação.
 */
export async function limparTag(): Promise<{ uidHex: string; apagado: PontoGravado | null }> {
  await garantirInicio();
  try {
    await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NdefFormatable, NfcTech.MifareClassic, NfcTech.NfcA]);
    const tag = await NfcManager.getTag();
    const uidHex = (tag?.id ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    const techs = tag?.techTypes ?? [];
    if (!techs.some((t) => t.endsWith('.Ndef'))) {
      // Sem NDEF (formatável ou MIFARE Classic sem suporte): não há gravação do app para apagar.
      if (techs.some((t) => t.endsWith('.NdefFormatable'))) return { uidHex, apagado: null };
      throw new Error('TAG_SEM_NDEF');
    }
    const c = conteudoDaTag(tag?.ndefMessage as RegistroNdef[] | undefined);
    if (c.tipo === 'OUTRO') throw new Error('TAG_COM_OUTRO_CONTEUDO');
    if (c.tipo === 'VAZIA') return { uidHex, apagado: null };
    await NfcManager.ndefHandler.writeNdefMessage(Ndef.encodeMessage([Ndef.record(Ndef.TNF_EMPTY, '', [], [])]));
    return { uidHex, apagado: c.ponto };
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export const cancelarGravacao = () => NfcManager.cancelTechnologyRequest().catch(() => {});

export const abrirConfiguracoesNfc = () => NfcManager.goToNfcSetting().catch(() => false);

// ---------- Leitor simulado (dev e homologação; desligado em produção pelo app.config.ts) ----------

type Ouvinte = (l: LeituraNfc) => void;
let ouvinteSimulado: Ouvinte | null = null;

/** Dispara uma leitura falsa, como se a tag tivesse sido encostada. */
export function simularLeitura(uidHex: string) {
  ouvinteSimulado?.({ uidHex, payloadNfc: `UID:${uidHex}`, tipo: 'NTAG215_LEGADA', lidaEm: new Date() });
}

export function registrarOuvinteSimulado(f: Ouvinte | null) {
  ouvinteSimulado = f;
}
