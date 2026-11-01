import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conteudoDaTag, interpretarTag, textoGravacao } from '../core/nfc/parser.ts';

// Registro de texto NDEF como o Android entrega: status (tamanho do idioma), "pt", texto UTF-8.
const registroTexto = (texto: string) => ({ tnf: 1, type: 'T', payload: [2, 0x70, 0x74, ...new TextEncoder().encode(texto)] });

test('lê o ponto gravado na tag, com acentos', () => {
  const texto = textoGravacao({ pontoId: 'p-1', nome: 'Portão principal', local: 'Prédio A · Térreo' });
  const l = interpretarTag('04:A1:B2', [registroTexto(texto)]);
  assert.deepEqual(l?.pontoGravado, { pontoId: 'p-1', nome: 'Portão principal', local: 'Prédio A · Térreo' });
  assert.equal(l?.uidHex, '04A1B2');
});

test('tag sem gravação do app não tem ponto', () => {
  assert.equal(interpretarTag('04A1', [registroTexto('olá')])?.pontoGravado, undefined);
  assert.equal(interpretarTag('04A1', undefined)?.pontoGravado, undefined);
});

test('limpar: só tag vazia ou gravada pelo app', () => {
  const ponto = registroTexto(textoGravacao({ pontoId: 'p-1', nome: 'Portaria', local: '' }));
  const url = { tnf: 1, type: 'U', payload: [4, ...new TextEncoder().encode('exemplo.com/?p=00&m=11')] };
  assert.equal(conteudoDaTag(undefined).tipo, 'VAZIA');
  assert.equal(conteudoDaTag([{ tnf: 0, type: '', payload: [] }]).tipo, 'VAZIA');
  assert.equal(conteudoDaTag([ponto]).tipo, 'PONTO');
  assert.equal(conteudoDaTag([url]).tipo, 'OUTRO');
  assert.equal(conteudoDaTag([ponto, url]).tipo, 'OUTRO');
  assert.equal(conteudoDaTag([registroTexto('olá')]).tipo, 'OUTRO');
});
