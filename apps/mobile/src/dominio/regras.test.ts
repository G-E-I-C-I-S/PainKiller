import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarLeitura, classificarGeo, estadoDaRonda, progresso, proximaRonda } from './regras.ts';
import type { Ronda, RondaPonto, SituacaoPonto } from './tipos.ts';

const ronda = (o: Partial<Ronda> = {}): Ronda => ({
  id: 'r1', roteiroNome: 'R', exigeOrdem: false, status: 'AGENDADA',
  inicioPrevisto: '2026-11-01T22:00:00.000Z', fimPrevisto: '2026-11-01T23:00:00.000Z',
  toleranciaInicioMin: 30, iniciadaEm: null, finalizadaEm: null, canceladaEm: null, ...o,
});
const pontos: RondaPonto[] = [
  { pontoRondaId: 'a', ordem: 1, obrigatorio: true },
  { pontoRondaId: 'b', ordem: 2, obrigatorio: true },
  { pontoRondaId: 'c', ordem: 3, obrigatorio: false },
];

test('janela da ronda considera a tolerância de início', () => {
  assert.equal(estadoDaRonda(ronda(), new Date('2026-11-01T21:20:00Z')).tipo, 'ANTES_DA_JANELA');
  assert.equal(estadoDaRonda(ronda(), new Date('2026-11-01T21:31:00Z')).tipo, 'DISPONIVEL');
  assert.equal(estadoDaRonda(ronda(), new Date('2026-11-01T23:01:00Z')).tipo, 'JANELA_ENCERRADA');
  assert.deepEqual(estadoDaRonda(ronda({ status: 'EM_ANDAMENTO' }), new Date('2026-11-01T23:01:00Z')), { tipo: 'EM_ANDAMENTO', atrasada: true });
});

test('próxima ronda prefere a em andamento', () => {
  const r = proximaRonda([ronda({ id: 'x' }), ronda({ id: 'y', status: 'EM_ANDAMENTO' })], new Date('2026-11-01T22:00:00Z'));
  assert.equal(r?.id, 'y');
});

test('leitura: desconhecida, fora do roteiro, repetida, fora da ordem', () => {
  const s = new Map<string, SituacaoPonto>([['a', 'VISITADO']]);
  assert.equal(avaliarLeitura(null, pontos, s, false).tipo, 'NAO_RECONHECIDA');
  assert.equal(avaliarLeitura('z', pontos, s, false).tipo, 'FORA_DO_ROTEIRO');
  assert.equal(avaliarLeitura('a', pontos, s, false).tipo, 'JA_REGISTRADO');
  assert.deepEqual(avaliarLeitura('c', pontos, s, true), { tipo: 'ACEITA', pontoRondaId: 'c', foraDaOrdem: true });
  assert.deepEqual(avaliarLeitura('b', pontos, s, true), { tipo: 'ACEITA', pontoRondaId: 'b', foraDaOrdem: false });
});

test('justificado não conta como visitado na conclusão', () => {
  const s = new Map<string, SituacaoPonto>([['a', 'VISITADO'], ['b', 'JUSTIFICADO']]);
  const p = progresso(pontos, s);
  assert.equal(p.completa, false);
  assert.equal(p.obrigatoriosPendentes.length, 1);
  s.set('b', 'VISITADO');
  assert.equal(progresso(pontos, s).completa, true);
});

test('geo: dentro, fora, imprecisa e sem posição', () => {
  const cfg = { precisaoMaximaM: 100 };
  const ponto = { latitude: -22.3123, longitude: -46.3279, raioToleranciaM: 30 };
  const perto = { latitude: -22.3124, longitude: -46.3279, precisaoM: 10, simulada: false };
  const longe = { latitude: -22.32, longitude: -46.3279, precisaoM: 10, simulada: false };
  assert.equal(classificarGeo(perto, ponto, null, cfg), 'DENTRO_AREA');
  assert.equal(classificarGeo(longe, ponto, null, cfg), 'FORA_AREA');
  assert.equal(classificarGeo({ ...perto, precisaoM: 500 }, ponto, null, cfg), 'INDETERMINADO');
  assert.equal(classificarGeo(null, ponto, null, cfg), 'SEM_LOCALIZACAO');
});
