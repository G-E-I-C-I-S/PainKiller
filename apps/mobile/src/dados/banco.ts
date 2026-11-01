// Banco local cifrado (SQLCipher via expo-sqlite). A chave fica no expo-secure-store (docs/08 · 11).
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';

const OPCOES_SEGURAS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const MIGRACOES: string[] = [
  `
  CREATE TABLE kv (chave TEXT PRIMARY KEY NOT NULL, valor TEXT);
  CREATE TABLE predio_ref (id TEXT PRIMARY KEY NOT NULL, codigo TEXT NOT NULL, nome TEXT NOT NULL,
    latitude REAL, longitude REAL, raio_geofence_m REAL);
  CREATE TABLE andar_ref (id TEXT PRIMARY KEY NOT NULL, predio_id TEXT NOT NULL, nome TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE setor_ref (id TEXT PRIMARY KEY NOT NULL, andar_id TEXT, predio_id TEXT NOT NULL, nome TEXT NOT NULL);
  CREATE TABLE ponto_ronda_ref (id TEXT PRIMARY KEY NOT NULL, predio_id TEXT NOT NULL, andar_id TEXT, setor_id TEXT,
    nome TEXT NOT NULL, instrucoes TEXT, latitude REAL, longitude REAL, raio_tolerancia_m REAL NOT NULL DEFAULT 30);
  CREATE TABLE tag_nfc_ref (uid_hex TEXT PRIMARY KEY NOT NULL, tipo TEXT NOT NULL, ponto_ronda_id TEXT NOT NULL);
  CREATE TABLE tipo_ocorrencia_ref (id TEXT PRIMARY KEY NOT NULL, nome TEXT NOT NULL, gravidade_padrao TEXT NOT NULL,
    ordem_exibicao INTEGER NOT NULL);

  CREATE TABLE ronda (id TEXT PRIMARY KEY NOT NULL, roteiro_nome TEXT NOT NULL, exige_ordem INTEGER NOT NULL,
    status TEXT NOT NULL, inicio_previsto TEXT NOT NULL, fim_previsto TEXT NOT NULL, tolerancia_inicio_min INTEGER NOT NULL,
    iniciada_em TEXT, finalizada_em TEXT, finalizada_com_pendencias INTEGER, cancelada_em TEXT);
  CREATE TABLE ronda_ponto (ronda_id TEXT NOT NULL, ponto_ronda_id TEXT NOT NULL, ordem INTEGER NOT NULL,
    obrigatorio INTEGER NOT NULL, PRIMARY KEY (ronda_id, ponto_ronda_id));
  CREATE TABLE visita (id TEXT PRIMARY KEY NOT NULL, ronda_id TEXT NOT NULL, ponto_ronda_id TEXT NOT NULL,
    uid_hex TEXT NOT NULL, payload_nfc TEXT NOT NULL, lido_em TEXT NOT NULL, latitude REAL, longitude REAL,
    precisao_m REAL, localizacao_simulada INTEGER NOT NULL DEFAULT 0, resultado_geo TEXT NOT NULL, fora_da_ordem INTEGER NOT NULL);
  CREATE UNIQUE INDEX ux_visita ON visita (ronda_id, ponto_ronda_id);
  CREATE TABLE justificativa (id TEXT PRIMARY KEY NOT NULL, ronda_id TEXT NOT NULL, ponto_ronda_id TEXT NOT NULL,
    motivo TEXT NOT NULL, descricao TEXT NOT NULL, justificada_em TEXT NOT NULL, latitude REAL, longitude REAL, precisao_m REAL);
  CREATE UNIQUE INDEX ux_justificativa ON justificativa (ronda_id, ponto_ronda_id);
  CREATE TABLE ocorrencia (id TEXT PRIMARY KEY NOT NULL, ronda_id TEXT NOT NULL, tipo_ocorrencia_id TEXT NOT NULL,
    gravidade TEXT NOT NULL, descricao TEXT, predio_id TEXT NOT NULL, ponto_ronda_id TEXT, registrada_em TEXT NOT NULL,
    latitude REAL, longitude REAL, precisao_m REAL);
  CREATE TABLE foto_local (id TEXT PRIMARY KEY NOT NULL, ocorrencia_id TEXT NOT NULL, ordem INTEGER NOT NULL,
    jpeg_base64 TEXT NOT NULL, sha256 TEXT NOT NULL, tamanho_bytes INTEGER NOT NULL, capturada_em TEXT NOT NULL,
    status_upload TEXT NOT NULL DEFAULT 'PENDENTE');

  CREATE TABLE fila_eventos (id TEXT PRIMARY KEY NOT NULL, seq INTEGER NOT NULL, tipo TEXT NOT NULL, payload TEXT NOT NULL,
    resumo TEXT NOT NULL, criado_em TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDENTE', tentativas INTEGER NOT NULL DEFAULT 0,
    proxima_tentativa_em TEXT, codigo_erro TEXT, mensagem_erro TEXT, enviado_em TEXT);
  CREATE INDEX ix_fila_status ON fila_eventos (status, seq);
  CREATE TABLE erro_log (id INTEGER PRIMARY KEY AUTOINCREMENT, em TEXT NOT NULL, origem TEXT NOT NULL, mensagem TEXT NOT NULL);
  `,
  // 0.2.0: checklist do local após a leitura, detalhes da ocorrência e observação geral da ronda (telas aprovadas).
  `
  ALTER TABLE visita ADD COLUMN checklist TEXT;
  ALTER TABLE ocorrencia ADD COLUMN detalhe_local TEXT;
  ALTER TABLE ocorrencia ADD COLUMN resolvido_no_local INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE ronda ADD COLUMN observacao TEXT;
  `,
];

let banco: SQLite.SQLiteDatabase | null = null;
const ouvintes = new Set<() => void>();

async function chaveDoBanco(): Promise<string> {
  let chave = await SecureStore.getItemAsync('chave_banco', OPCOES_SEGURAS);
  if (!chave) {
    const bytes = Crypto.getRandomBytes(32);
    chave = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync('chave_banco', chave, OPCOES_SEGURAS);
  }
  return chave;
}

export async function abrirBanco(): Promise<SQLite.SQLiteDatabase> {
  if (banco) return banco;
  const chave = await chaveDoBanco();
  const db = await SQLite.openDatabaseAsync('guardiao.db');
  await db.execAsync(`PRAGMA key = "x'${chave}'";`);
  // Falha aqui = chave não abre o banco (ex.: backup restaurado em outro aparelho). Nada é apagado.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const versao = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  for (let i = versao; i < MIGRACOES.length; i++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRACOES[i]);
      await db.execAsync(`PRAGMA user_version = ${i + 1}`);
    });
  }
  banco = db;
  return db;
}

/**
 * Transação na mesma conexão já destravada com a chave.
 * withExclusiveTransactionAsync abre outra conexão sem o PRAGMA key e o SQLCipher responde "file is not a database".
 */
export function transacao(fn: (tx: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
  const d = db();
  return d.withTransactionAsync(() => fn(d));
}

export function db(): SQLite.SQLiteDatabase {
  if (!banco) throw new Error('Banco não aberto');
  return banco;
}

/** Avisa as telas que o banco mudou (equivalente simples ao useLiveQuery). */
export function notificarMudanca() {
  ouvintes.forEach((f) => f());
}

export function useConsulta<T>(consulta: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [valor, setValor] = useState<T>();
  useEffect(() => {
    let ativo = true;
    const executar = () => {
      consulta()
        .then((v) => ativo && setValor(v))
        .catch((e) => registrarErro('consulta', e));
    };
    executar();
    ouvintes.add(executar);
    return () => {
      ativo = false;
      ouvintes.delete(executar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return valor;
}

export async function kvLer(chave: string): Promise<string | null> {
  const r = await db().getFirstAsync<{ valor: string | null }>('SELECT valor FROM kv WHERE chave = ?', chave);
  return r?.valor ?? null;
}

export async function kvGravar(chave: string, valor: string | null) {
  await db().runAsync('INSERT INTO kv (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', chave, valor);
}

export function registrarErro(origem: string, e: unknown) {
  const mensagem = e instanceof Error ? e.message : String(e);
  if (!banco) return;
  banco
    .runAsync('INSERT INTO erro_log (em, origem, mensagem) VALUES (?, ?, ?)', new Date().toISOString(), origem, mensagem.slice(0, 1000))
    .catch(() => {});
}
