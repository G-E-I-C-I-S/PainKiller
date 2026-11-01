// Leitor NFC real (react-native-nfc-manager) em modo leitor, mais o leitor simulado de desenvolvimento.
import { Platform } from 'react-native';
import NfcManager, { Ndef, NfcEvents, NfcTech, type TagEvent } from 'react-native-nfc-manager';
import { interpretarTag, textoGravacao, type LeituraNfc, type PontoGravado, type RegistroNdef } from './parser';

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
    NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
      const leitura = interpretarTag(tag.id, tag.ndefMessage as RegistroNdef[] | undefined);
      if (leitura) aoLer(leitura);
      else aoFalhar({ codigo: 'FALHA_LEITURA' });
    });
    NfcManager.setEventListener(NfcEvents.StateChanged, (e: { state?: string }) => {
      if (e?.state === 'off') aoFalhar({ codigo: 'NFC_DESLIGADO' });
    });
    try {
      await NfcManager.unregisterTagEvent().catch(() => {});
      await NfcManager.registerTagEvent(
        Platform.OS === 'android'
          ? { isReaderModeEnabled: true, readerModeFlags: FLAGS_LEITOR, readerModeDelay: 250 }
          : { alertMessage: 'Encoste o celular na tag', invalidateAfterFirstRead: true },
      );
    } catch (e) {
      aoFalhar({ codigo: 'FALHA_LEITURA', mensagem: e instanceof Error ? e.message : String(e) });
    }
  },

  async parar() {
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    NfcManager.setEventListener(NfcEvents.StateChanged, null);
    await NfcManager.unregisterTagEvent().catch(() => {});
  },
};

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
