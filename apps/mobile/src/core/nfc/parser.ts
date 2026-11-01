// Identifica o tipo da tag e monta o payload enviado ao servidor (docs/08 · 8.1 e 8.3).
// O app não valida o SUN: só repassa a URL; o servidor confere CMAC e contador.
import type { TipoTagNfc } from '../../dominio/tipos';

export interface LeituraNfc {
  uidHex: string;
  payloadNfc: string;
  tipo: TipoTagNfc;
  lidaEm: Date;
  /** Ponto gravado dentro da tag pela instalação (registro de texto NDEF). */
  pontoGravado?: PontoGravado;
}

export interface PontoGravado {
  pontoId: string;
  nome: string;
  local: string;
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

// Conteúdo gravado na tag: registro de texto "GUARDIAO1|<pontoId>|<nome>|<prédio · andar>".
const PREFIXO_GRAVACAO = 'GUARDIAO1';

export function textoGravacao(p: PontoGravado): string {
  const limpo = (t: string) => t.replace(/\|/g, '/');
  return [PREFIXO_GRAVACAO, p.pontoId, limpo(p.nome), limpo(p.local)].join('|');
}

function utf8(bytes: number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) s += String.fromCharCode(b);
    else if (b >= 0xe0) s += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f));
    else s += String.fromCharCode(((b & 0x1f) << 6) | (bytes[++i] & 0x3f));
  }
  return s;
}

export function pontoGravadoDoRegistro(r: RegistroNdef): PontoGravado | null {
  const tipo = typeof r.type === 'string' ? r.type : String.fromCharCode(...r.type);
  // TNF 1 = Well-known, tipo "T" = texto: 1 byte de status (tamanho do idioma), idioma, texto UTF-8.
  if (r.tnf !== 1 || tipo !== 'T' || r.payload.length === 0) return null;
  const partes = utf8(r.payload.slice(1 + (r.payload[0] & 0x3f))).split('|');
  if (partes[0] !== PREFIXO_GRAVACAO || !partes[1]) return null;
  return { pontoId: partes[1], nome: partes[2] ?? '', local: partes[3] ?? '' };
}

/**
 * O que a tag tem gravado, para decidir se pode ser limpa:
 * só apagamos tag vazia ou com gravação do app; qualquer outro conteúdo (ex.: URL SUN do NTAG 424) fica intacto.
 */
export function conteudoDaTag(ndef: RegistroNdef[] | undefined): { tipo: 'VAZIA' } | { tipo: 'PONTO'; ponto: PontoGravado } | { tipo: 'OUTRO' } {
  const registros = (ndef ?? []).filter((r) => r.tnf !== 0);
  if (!registros.length) return { tipo: 'VAZIA' };
  const pontos = registros.map(pontoGravadoDoRegistro);
  if (pontos.every((p) => p)) return { tipo: 'PONTO', ponto: pontos[0]! };
  return { tipo: 'OUTRO' };
}

export function interpretarTag(idHex: string | undefined, ndef: RegistroNdef[] | undefined, lidaEm = new Date()): LeituraNfc | null {
  const uidHex = (idHex ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (!uidHex) return null;
  const pontoGravado = (ndef ?? []).map(pontoGravadoDoRegistro).find((p): p is PontoGravado => !!p);
  const urlSun = (ndef ?? []).map(uriDoRegistro).find((u): u is string => !!u && ehUrlSun(u));
  if (urlSun) return { uidHex, payloadNfc: urlSun, tipo: 'NTAG424_DNA', lidaEm, pontoGravado };
  // Tag legada (NTAG215, MIFARE, cartões RFID 13,56 MHz): reconhecida pelo ponto gravado ou pelo UID.
  return { uidHex, payloadNfc: `UID:${uidHex}`, tipo: 'NTAG215_LEGADA', lidaEm, pontoGravado };
}
