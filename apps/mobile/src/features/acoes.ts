// Caminho único de escrita: grava o registro e o evento da fila na MESMA transação (ADR-0005).
import { uuidv7 } from 'uuidv7';
import { db, notificarMudanca } from '../dados/banco';
import { configuracao } from '../dados/repositorios';
import { obterPosicaoNoEvento } from '../core/localizacao';
import type { FotoProcessada } from '../core/camera';
import type { LeituraNfc } from '../core/nfc/parser';
import type { Gravidade, Localizacao, MotivoJustificativa, ResultadoGeo, TipoEvento } from '../dominio/tipos';
import { textos, hora } from '../textos';
import { pedirSincronizacao } from './sincronizacao';

type Tx = Parameters<Parameters<ReturnType<typeof db>['withExclusiveTransactionAsync']>[0]>[0];

const loc = (l: Localizacao | null) => (l ? { latitude: l.latitude, longitude: l.longitude, precisaoM: l.precisaoM } : null);

async function enfileirar(tx: Tx, id: string, tipo: TipoEvento, dados: object, resumo: string) {
  const agora = new Date().toISOString();
  const seq = (await tx.getFirstAsync<{ s: number }>('SELECT COALESCE(MAX(seq), 0) + 1 AS s FROM fila_eventos'))?.s ?? 1;
  await tx.runAsync(
    'INSERT INTO fila_eventos (id, seq, tipo, payload, resumo, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
    id, seq, tipo, JSON.stringify({ id, tipo, criadoEmDispositivo: agora, dados }), resumo, agora,
  );
}

async function posicao() {
  const cfg = await configuracao();
  return obterPosicaoNoEvento(cfg.precisaoMaximaM);
}

function concluir() {
  notificarMudanca();
  pedirSincronizacao();
}

export async function iniciarRonda(rondaId: string, nome: string) {
  const outra = await db().getFirstAsync("SELECT id FROM ronda WHERE status = 'EM_ANDAMENTO' AND id <> ?", rondaId);
  if (outra) throw new Error(textos.inicio.outraEmAndamento);
  const l = await posicao();
  const agora = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync("UPDATE ronda SET status = 'EM_ANDAMENTO', iniciada_em = ? WHERE id = ? AND status = 'AGENDADA'", agora, rondaId);
    await enfileirar(tx, uuidv7(), 'RONDA_INICIADA', { rondaId, iniciadaEmDispositivo: agora, localizacao: loc(l) }, `${nome} · ${hora(agora)}`);
  });
  concluir();
}

export async function registrarVisita(p: {
  rondaId: string;
  pontoRondaId: string;
  pontoNome: string;
  leitura: LeituraNfc;
  localizacao: Localizacao | null;
  resultadoGeo: ResultadoGeo;
  foraDaOrdem: boolean;
}) {
  const id = uuidv7();
  const lido = p.leitura.lidaEm.toISOString();
  await db().withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO visita (id, ronda_id, ponto_ronda_id, uid_hex, payload_nfc, lido_em, latitude, longitude, precisao_m,
         localizacao_simulada, resultado_geo, fora_da_ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, p.rondaId, p.pontoRondaId, p.leitura.uidHex, p.leitura.payloadNfc, lido,
      p.localizacao?.latitude ?? null, p.localizacao?.longitude ?? null, p.localizacao?.precisaoM ?? null,
      p.localizacao?.simulada ? 1 : 0, p.resultadoGeo, p.foraDaOrdem ? 1 : 0,
    );
    await enfileirar(tx, id, 'PONTO_VISITADO', {
      rondaId: p.rondaId,
      pontoRondaId: p.pontoRondaId,
      uidHex: p.leitura.uidHex,
      payloadNfc: p.leitura.payloadNfc,
      lidoEmDispositivo: lido,
      localizacao: loc(p.localizacao),
      localizacaoSimulada: p.localizacao?.simulada ?? false,
      resultadoGeoDispositivo: p.resultadoGeo,
      foraDaOrdem: p.foraDaOrdem,
    }, `${p.pontoNome} · ${hora(lido)}`);
  });
  concluir();
}

export async function justificarPonto(rondaId: string, pontoRondaId: string, pontoNome: string, motivo: MotivoJustificativa, descricao: string) {
  const l = await posicao();
  const id = uuidv7();
  const agora = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      'INSERT INTO justificativa VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, rondaId, pontoRondaId, motivo, descricao, agora, l?.latitude ?? null, l?.longitude ?? null, l?.precisaoM ?? null,
    );
    await enfileirar(tx, id, 'PONTO_JUSTIFICADO', {
      rondaId, pontoRondaId, motivo, descricao, justificadaEmDispositivo: agora, localizacao: loc(l),
    }, `${pontoNome} · ${hora(agora)}`);
  });
  concluir();
}

export async function registrarOcorrencia(o: {
  rondaId: string;
  tipoOcorrenciaId: string;
  tipoNome: string;
  gravidade: Gravidade;
  descricao: string | null;
  predioId: string;
  pontoRondaId: string | null;
  detalheLocal: string | null;
  resolvidoNoLocal: boolean;
  fotos: FotoProcessada[];
}) {
  const l = await posicao();
  const id = uuidv7();
  const agora = new Date().toISOString();
  const fotos = o.fotos.map((f) => ({ ...f, fotoId: uuidv7() }));
  await db().withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO ocorrencia (id, ronda_id, tipo_ocorrencia_id, gravidade, descricao, predio_id, ponto_ronda_id, registrada_em,
         latitude, longitude, precisao_m, detalhe_local, resolvido_no_local) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, o.rondaId, o.tipoOcorrenciaId, o.gravidade, o.descricao, o.predioId, o.pontoRondaId, agora,
      l?.latitude ?? null, l?.longitude ?? null, l?.precisaoM ?? null, o.detalheLocal, o.resolvidoNoLocal ? 1 : 0,
    );
    for (const [i, f] of fotos.entries()) {
      await tx.runAsync(
        "INSERT INTO foto_local (id, ocorrencia_id, ordem, jpeg_base64, sha256, tamanho_bytes, capturada_em) VALUES (?, ?, ?, ?, ?, ?, ?)",
        f.fotoId, id, i + 1, f.base64, f.sha256, f.tamanhoBytes, f.capturadaEm,
      );
    }
    await enfileirar(tx, id, 'OCORRENCIA_REGISTRADA', {
      rondaId: o.rondaId,
      tipoOcorrenciaId: o.tipoOcorrenciaId,
      gravidade: o.gravidade,
      descricao: o.descricao,
      predioId: o.predioId,
      andarId: null,
      setorId: null,
      pontoRondaId: o.pontoRondaId,
      detalheLocal: o.detalheLocal,
      resolvidoNoLocal: o.resolvidoNoLocal,
      registradaEmDispositivo: agora,
      localizacao: loc(l),
      localizacaoSimulada: l?.simulada ?? false,
      fotos: fotos.map((f) => ({ fotoId: f.fotoId, sha256: f.sha256, tamanhoBytes: f.tamanhoBytes })),
    }, `${o.tipoNome} · ${textos.gravidade[o.gravidade]} · ${hora(agora)}`);
  });
  concluir();
}

export interface ChecklistItem {
  item: string;
  ok: boolean;
}

/** Checklist "Como está o local?" respondido depois da leitura. Evento PONTO_CONFERIDO (extensão do contrato). */
export async function registrarChecklist(rondaId: string, pontoRondaId: string, pontoNome: string, itens: ChecklistItem[]) {
  const agora = new Date().toISOString();
  await db().withExclusiveTransactionAsync(async (tx) => {
    const v = await tx.getFirstAsync<{ id: string }>('SELECT id FROM visita WHERE ronda_id = ? AND ponto_ronda_id = ?', rondaId, pontoRondaId);
    await tx.runAsync('UPDATE visita SET checklist = ? WHERE ronda_id = ? AND ponto_ronda_id = ?', JSON.stringify(itens), rondaId, pontoRondaId);
    const problemas = itens.filter((i) => !i.ok).length;
    await enfileirar(tx, uuidv7(), 'PONTO_CONFERIDO', { rondaId, pontoRondaId, visitaId: v?.id ?? null, itens, conferidoEmDispositivo: agora },
      `${pontoNome} · ${problemas ? `${problemas} problema(s)` : 'tudo OK'} · ${hora(agora)}`);
  });
  concluir();
}

export async function finalizarRonda(
  rondaId: string,
  nome: string,
  comPendencias: boolean,
  extras: { observacao?: string | null; justificativas?: { pontoRondaId: string; pontoNome: string; motivo: MotivoJustificativa }[] } = {},
) {
  const l = await posicao();
  const agora = new Date().toISOString();
  const observacao = extras.observacao?.trim() || null;
  await db().withExclusiveTransactionAsync(async (tx) => {
    for (const j of extras.justificativas ?? []) {
      const id = uuidv7();
      const descricao = `Informado na finalização: ${textos.motivo[j.motivo]}`;
      await tx.runAsync(
        'INSERT OR IGNORE INTO justificativa VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, rondaId, j.pontoRondaId, j.motivo, descricao, agora, l?.latitude ?? null, l?.longitude ?? null, l?.precisaoM ?? null,
      );
      await enfileirar(tx, id, 'PONTO_JUSTIFICADO', {
        rondaId, pontoRondaId: j.pontoRondaId, motivo: j.motivo, descricao, justificadaEmDispositivo: agora, localizacao: loc(l),
      }, `${j.pontoNome} · ${hora(agora)}`);
    }
    await tx.runAsync(
      "UPDATE ronda SET status = ?, finalizada_em = ?, finalizada_com_pendencias = ?, observacao = ? WHERE id = ? AND status = 'EM_ANDAMENTO'",
      comPendencias ? 'INCOMPLETA' : 'CONCLUIDA', agora, comPendencias ? 1 : 0, observacao, rondaId,
    );
    await enfileirar(tx, uuidv7(), 'RONDA_FINALIZADA', {
      rondaId, finalizadaEmDispositivo: agora, localizacao: loc(l), finalizadaComPendencias: comPendencias, observacao,
    }, `${nome} · ${hora(agora)}`);
  });
  concluir();
}
