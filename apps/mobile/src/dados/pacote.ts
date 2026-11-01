// Pacote offline (dados de referência) e rondas: aplicação do que vem da API e dados do modo local.
import { uuidv7 } from 'uuidv7';
import { db, transacao, kvGravar, kvLer, notificarMudanca } from './banco';
import type { ConfiguracaoCampus, Gravidade, StatusRonda, TipoTagNfc } from '../dominio/tipos';

export interface PacoteOffline {
  versao: string;
  campus: { id: string; nome: string; configuracao: Partial<ConfiguracaoCampus> };
  predios: { id: string; codigo: string; nome: string; latitude: number | null; longitude: number | null; raioGeofenceM: number | null }[];
  andares: { id: string; predioId: string; nome: string; ordem?: number }[];
  setores: { id: string; predioId: string; andarId: string | null; nome: string }[];
  pontos: {
    id: string;
    predioId: string;
    andarId: string | null;
    setorId: string | null;
    nome: string;
    instrucoes: string | null;
    latitude: number | null;
    longitude: number | null;
    raioToleranciaM: number;
  }[];
  tags: { uidHex: string; tipo: TipoTagNfc; pontoRondaId: string }[];
  tiposOcorrencia: { id: string; nome: string; gravidadePadrao: Gravidade; ordemExibicao: number }[];
}

export interface RondaApi {
  id: string;
  roteiro: { nome: string; exigeOrdem: boolean };
  status: StatusRonda;
  inicioPrevisto: string;
  fimPrevisto: string;
  toleranciaInicioMin: number;
  pontos: { pontoRondaId: string; ordem: number; obrigatorio: boolean }[];
  canceladaEm: string | null;
}

export async function aplicarPacote(p: PacoteOffline) {
  const d = db();
  await transacao(async (tx) => {
    for (const t of ['predio_ref', 'andar_ref', 'setor_ref', 'ponto_ronda_ref', 'tag_nfc_ref', 'tipo_ocorrencia_ref']) {
      await tx.runAsync(`DELETE FROM ${t}`);
    }
    for (const x of p.predios) {
      await tx.runAsync('INSERT INTO predio_ref VALUES (?, ?, ?, ?, ?, ?)', x.id, x.codigo, x.nome, x.latitude, x.longitude, x.raioGeofenceM);
    }
    for (const x of p.andares) await tx.runAsync('INSERT INTO andar_ref VALUES (?, ?, ?, ?)', x.id, x.predioId, x.nome, x.ordem ?? 0);
    for (const x of p.setores) await tx.runAsync('INSERT INTO setor_ref VALUES (?, ?, ?, ?)', x.id, x.andarId, x.predioId, x.nome);
    for (const x of p.pontos) {
      await tx.runAsync(
        'INSERT INTO ponto_ronda_ref VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        x.id, x.predioId, x.andarId, x.setorId, x.nome, x.instrucoes, x.latitude, x.longitude, x.raioToleranciaM,
      );
    }
    for (const x of p.tags) await tx.runAsync('INSERT INTO tag_nfc_ref VALUES (?, ?, ?)', normalizarUid(x.uidHex), x.tipo, x.pontoRondaId);
    for (const x of p.tiposOcorrencia) {
      await tx.runAsync('INSERT INTO tipo_ocorrencia_ref VALUES (?, ?, ?, ?)', x.id, x.nome, x.gravidadePadrao, x.ordemExibicao);
    }
    await tx.runAsync(
      "INSERT INTO kv VALUES ('configuracao', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
      JSON.stringify(p.campus.configuracao),
    );
    await tx.runAsync("INSERT INTO kv VALUES ('campus_nome', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor", p.campus.nome);
  });
  notificarMudanca();
}

/** Atualiza as rondas vindas da API sem sobrescrever o estado local de rondas já iniciadas no aparelho. */
export async function aplicarRondas(rondas: RondaApi[]) {
  await transacao(async (tx) => {
    for (const r of rondas) {
      const local = await tx.getFirstAsync<{ status: string }>('SELECT status FROM ronda WHERE id = ?', r.id);
      if (!local) {
        await tx.runAsync(
          'INSERT INTO ronda (id, roteiro_nome, exige_ordem, status, inicio_previsto, fim_previsto, tolerancia_inicio_min, cancelada_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          r.id, r.roteiro.nome, r.roteiro.exigeOrdem ? 1 : 0, r.status, r.inicioPrevisto, r.fimPrevisto, r.toleranciaInicioMin, r.canceladaEm,
        );
        for (const p of r.pontos) {
          await tx.runAsync('INSERT INTO ronda_ponto VALUES (?, ?, ?, ?)', r.id, p.pontoRondaId, p.ordem, p.obrigatorio ? 1 : 0);
        }
      } else if (local.status === 'AGENDADA') {
        await tx.runAsync(
          'UPDATE ronda SET status = ?, inicio_previsto = ?, fim_previsto = ?, cancelada_em = ? WHERE id = ?',
          r.status, r.inicioPrevisto, r.fimPrevisto, r.canceladaEm, r.id,
        );
      } else if (r.canceladaEm) {
        await tx.runAsync('UPDATE ronda SET cancelada_em = ? WHERE id = ?', r.canceladaEm, r.id);
      }
    }
  });
  await kvGravar('rondas_atualizadas_em', new Date().toISOString());
  notificarMudanca();
}

export const normalizarUid = (uid: string) => uid.replace(/[^0-9a-fA-F]/g, '').toUpperCase();

// ---------- Modo local (sem servidor) ----------

const ID = {
  p1: '0192ef90-0000-7000-8000-00000000b001',
  p2: '0192ef90-0000-7000-8000-00000000b002',
  p1t: '0192ef90-0000-7000-8000-00000000a011',
  p11: '0192ef90-0000-7000-8000-00000000a012',
  p2t: '0192ef90-0000-7000-8000-00000000a021',
};

const pontoId = (n: number) => `0192ef90-0000-7000-8000-00000000c${String(n).padStart(3, '0')}`;
const tipoId = (n: number) => `0192ef90-0000-7000-8000-00000000d${String(n).padStart(3, '0')}`;

export const PACOTE_LOCAL: PacoteOffline = {
  versao: 'local-2',
  campus: { id: 'local', nome: 'Campus de teste (modo local)', configuracao: {} },
  predios: [
    { id: ID.p1, codigo: 'P1', nome: 'Prédio 1', latitude: null, longitude: null, raioGeofenceM: null },
    { id: ID.p2, codigo: 'P2', nome: 'Prédio 2', latitude: null, longitude: null, raioGeofenceM: null },
  ],
  andares: [
    { id: ID.p1t, predioId: ID.p1, nome: 'Térreo', ordem: 0 },
    { id: ID.p11, predioId: ID.p1, nome: '1º andar', ordem: 1 },
    { id: ID.p2t, predioId: ID.p2, nome: 'Térreo', ordem: 0 },
  ],
  setores: [],
  pontos: [
    { id: pontoId(1), predioId: ID.p1, andarId: ID.p1t, setorId: null, nome: 'Recepção', instrucoes: 'Conferir porta principal e alarme.', latitude: null, longitude: null, raioToleranciaM: 30 },
    { id: pontoId(2), predioId: ID.p1, andarId: ID.p1t, setorId: null, nome: 'Corredor norte', instrucoes: 'Conferir porta corta-fogo.', latitude: null, longitude: null, raioToleranciaM: 30 },
    { id: pontoId(3), predioId: ID.p1, andarId: ID.p11, setorId: null, nome: 'Laboratório de Química', instrucoes: 'Verificar se o gás está fechado.', latitude: null, longitude: null, raioToleranciaM: 30 },
    { id: pontoId(4), predioId: ID.p1, andarId: ID.p11, setorId: null, nome: 'Almoxarifado', instrucoes: null, latitude: null, longitude: null, raioToleranciaM: 30 },
    { id: pontoId(5), predioId: ID.p2, andarId: ID.p2t, setorId: null, nome: 'Portaria', instrucoes: 'Conferir cancela e livro de visitas.', latitude: null, longitude: null, raioToleranciaM: 30 },
    { id: pontoId(6), predioId: ID.p2, andarId: ID.p2t, setorId: null, nome: 'Estacionamento', instrucoes: null, latitude: null, longitude: null, raioToleranciaM: 50 },
  ],
  // Tags fictícias, só para o leitor simulado. Tags reais são vinculadas em Perfil → Instalação de tags.
  tags: [1, 2, 3, 4, 5, 6].map((n) => ({ uidHex: `F00000000000${String(n).padStart(2, '0')}`, tipo: 'NTAG215_LEGADA' as const, pontoRondaId: pontoId(n) })),
  tiposOcorrencia: (
    [
      ['Porta aberta', 'MEDIA'],
      ['Janela aberta', 'MEDIA'],
      ['Luz acesa', 'BAIXA'],
      ['Equipamento ligado', 'BAIXA'],
      ['Pessoas no local', 'ALTA'],
      ['Dano / vandalismo', 'ALTA'],
      ['Vazamento', 'ALTA'],
      ['Outro', 'MEDIA'],
    ] as const
  ).map(([nome, g], i) => ({ id: tipoId(i + 1), nome, gravidadePadrao: g, ordemExibicao: i + 1 })),
};

/** Prepara o banco do modo local na primeira vez (pacote de referência). */
export async function prepararModoLocal() {
  const anterior = await kvLer('pacote_versao');
  if (anterior === PACOTE_LOCAL.versao) return;
  // Preserva as tags reais já vinculadas e a posição gravada dos pontos.
  const reais = await db().getAllAsync<{ uid_hex: string; tipo: TipoTagNfc; ponto_ronda_id: string }>("SELECT * FROM tag_nfc_ref WHERE uid_hex NOT LIKE 'F000%'");
  const posicoes = await db().getAllAsync<{ id: string; latitude: number; longitude: number }>('SELECT id, latitude, longitude FROM ponto_ronda_ref WHERE latitude IS NOT NULL');
  await aplicarPacote(PACOTE_LOCAL);
  for (const t of reais) await vincularTagLocal(t.uid_hex, t.tipo, t.ponto_ronda_id, null);
  for (const p of posicoes) await db().runAsync('UPDATE ponto_ronda_ref SET latitude = ?, longitude = ? WHERE id = ?', p.latitude, p.longitude, p.id);
  await kvGravar('pacote_versao', PACOTE_LOCAL.versao);
  if (!anterior) await criarRondasTeste();
}

/** Cria duas rondas que começam agora: uma livre com todos os pontos e uma com ordem no Prédio 1. */
export async function criarRondasTeste() {
  const inicio = new Date();
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  const todos = PACOTE_LOCAL.pontos.map((p, i) => ({ pontoRondaId: p.id, ordem: i + 1, obrigatorio: i < 5 }));
  const p1 = PACOTE_LOCAL.pontos.filter((p) => p.predioId === ID.p1).map((p, i) => ({ pontoRondaId: p.id, ordem: i + 1, obrigatorio: true }));
  await aplicarRondas([
    {
      id: uuidv7(),
      roteiro: { nome: 'Ronda de teste · todos os pontos', exigeOrdem: false },
      status: 'AGENDADA',
      inicioPrevisto: inicio.toISOString(),
      fimPrevisto: fim.toISOString(),
      toleranciaInicioMin: 30,
      pontos: todos,
      canceladaEm: null,
    },
    {
      id: uuidv7(),
      roteiro: { nome: 'Ronda com ordem · Prédio 1', exigeOrdem: true },
      status: 'AGENDADA',
      inicioPrevisto: new Date(inicio.getTime() + 60_000).toISOString(),
      fimPrevisto: fim.toISOString(),
      toleranciaInicioMin: 30,
      pontos: p1,
      canceladaEm: null,
    },
  ]);
}

/** Modo instalação local: vincula a tag ao ponto (substitui a tag anterior do ponto). */
export async function vincularTagLocal(uidHex: string, tipo: TipoTagNfc, pontoRondaId: string, posicao: { latitude: number; longitude: number } | null) {
  await transacao(async (tx) => {
    await tx.runAsync('DELETE FROM tag_nfc_ref WHERE uid_hex = ? OR ponto_ronda_id = ?', uidHex, pontoRondaId);
    await tx.runAsync('INSERT INTO tag_nfc_ref VALUES (?, ?, ?)', uidHex, tipo, pontoRondaId);
    if (posicao) {
      await tx.runAsync('UPDATE ponto_ronda_ref SET latitude = ?, longitude = ? WHERE id = ?', posicao.latitude, posicao.longitude, pontoRondaId);
    }
  });
  notificarMudanca();
}
