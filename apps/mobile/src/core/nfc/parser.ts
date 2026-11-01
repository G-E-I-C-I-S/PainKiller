// Identifica o tipo da tag e monta o payload enviado ao servidor (docs/08 · 8.1 e 8.3).
// O app não valida o SUN: só repassa a URL; o servidor confere CMAC e contador.
import type { TipoTagNfc } from '../../dominio/tipos';

export interface LeituraNfc {
  uidHex: string;
  payloadNfc: string;
  tipo: TipoTagNfc;
  lidaEm: Date;
}

export interface RegistroNdef {
  tnf: number;
  type: number[] | string;
  payload: number[];
}

const PREFIXOS_URI = [
  '', 'http://www.', 'https://www.', 'http://', 'https://', 'tel:', 'mailto:', 'ftp://anonymous:anonymous@', 'ftp://ftp.',
  'ftps://', 'sftp://', 'smb://', 'nfs://', 'ftp://', 'dav://', 'news:', 'telnet://', 'imap:', 'rtsp://', 'urn:',
  'pop:', 'sip:', 'sips:', 'tftp:', 'btspp://', 'btl2cap://', 'btgoep://', 'tcpobex://', 'irdaobex://', 'file://',
  'urn:epc:id:', 'urn:epc:tag:', 'urn:epc:pat:', 'urn:epc:raw:', 'urn:epc:', 'urn:nfc:',
];

export function uriDoRegistro(r: RegistroNdef): string | null {
  const tipo = typeof r.type === 'string' ? r.type : String.fromCharCode(...r.type);
  // TNF 1 = Well-known, tipo "U" = URI.
  if (r.tnf !== 1 || tipo !== 'U' || r.payload.length === 0) return null;
  const prefixo = PREFIXOS_URI[r.payload[0]] ?? '';
  return prefixo + String.fromCharCode(...r.payload.slice(1));
}

/** URL SUN do NTAG 424 DNA: traz os parâmetros cifrados (p/picc_data e m/cmac). */
export function ehUrlSun(url: string): boolean {
  return /[?&](p|picc_data|e)=[0-9A-Fa-f]{16,}/.test(url) && /[?&](m|cmac|c)=[0-9A-Fa-f]{16}/.test(url);
}

export function interpretarTag(idHex: string | undefined, ndef: RegistroNdef[] | undefined, lidaEm = new Date()): LeituraNfc | null {
  const uidHex = (idHex ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (!uidHex) return null;
  const urlSun = (ndef ?? []).map(uriDoRegistro).find((u): u is string => !!u && ehUrlSun(u));
  if (urlSun) return { uidHex, payloadNfc: urlSun, tipo: 'NTAG424_DNA', lidaEm };
  // Tag legada (NTAG215, MIFARE, cartões RFID 13,56 MHz): reconhecida só pelo UID.
  return { uidHex, payloadNfc: `UID:${uidHex}`, tipo: 'NTAG215_LEGADA', lidaEm };
}
