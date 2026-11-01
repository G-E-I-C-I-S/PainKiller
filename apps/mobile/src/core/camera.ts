// Processamento da foto: redimensiona (lado maior 1600 px), regrava o JPEG (descarta o EXIF) e calcula o SHA-256.
// O JPEG fica dentro do banco SQLCipher (cifrado), nunca na galeria (docs/08 · 10).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';

const LADO_MAXIMO = 1600;

export interface FotoProcessada {
  base64: string;
  sha256: string;
  tamanhoBytes: number;
  capturadaEm: string;
}

export function base64ParaBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function processarFoto(uri: string, largura: number, altura: number): Promise<FotoProcessada> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(largura, altura) > LADO_MAXIMO) {
    ctx.resize(largura >= altura ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO });
  }
  const imagem = await ctx.renderAsync();
  const salvo = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  const base64 = salvo.base64 ?? '';
  const bytes = base64ParaBytes(base64);
  const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  const sha256 = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
  return { base64, sha256, tamanhoBytes: bytes.length, capturadaEm: new Date().toISOString() };
}
