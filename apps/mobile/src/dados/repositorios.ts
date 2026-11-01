// Leituras do banco local. Escritas de negócio ficam em src/features (sempre com a fila, na mesma transação).
import { db, kvLer } from './banco';
import type {
  ConfiguracaoCampus,
  Gravidade,
  MotivoJustificativa,
  Ponto,
  Predio,
  ResultadoGeo,
  Ronda,
  RondaPonto,
  SituacaoPonto,
  StatusFila,
  TipoEvento,
  TipoOcorrencia,
  TipoTagNfc,
} from '../dominio/tipos';

export const CONFIG_PADRAO: ConfiguracaoCampus = {
  politicaGeo: 'SINALIZAR',
  precisaoMaximaM: 100,
  toleranciaInicioMin: 30,
  inatividadeBloqueioMin: 10,
  limiteDesvioRelogioMin: 5,
};

export async function configuracao(): Promise<ConfiguracaoCampus> {
  const v = await kvLer('configuracao');
  return v ? { ...CONFIG_PADRAO, ...JSON.parse(v) } : CONFIG_PADRAO;
}

const paraRonda = (r: any): Ronda => ({
  id: r.id,
  roteiroNome: r.roteiro_nome,
  exigeOrdem: !!r.exige_ordem,
  status: r.status,
  inicioPrevisto: r.inicio_previsto,
  fimPrevisto: r.fim_previsto,
  toleranciaInicioMin: r.tolerancia_inicio_min,
  iniciadaEm: r.iniciada_em,
  finalizadaEm: r.finalizada_em,
  canceladaEm: r.cancelada_em,
});

const paraPonto = (p: any): Ponto => ({
  id: p.id,
  predioId: p.predio_id,
  andarId: p.andar_id,
  setorId: p.setor_id,
  nome: p.nome,
  instrucoes: p.instrucoes,
  latitude: p.latitude,
  longitude: p.longitude,
  raioToleranciaM: p.raio_tolerancia_m,
});

export async function rondasDoTurno(): Promise<(Ronda & { totalPontos: number })[]> {
  // Turno: das 12 h antes até 18 h depois de agora.
  const agora = Date.now();
  const de = new Date(agora - 12 * 3600_000).toISOString();
  const ate = new Date(agora + 18 * 3600_000).toISOString();
  const linhas = await db().getAllAsync<any>(
    `SELECT r.*, (SELECT COUNT(*) FROM ronda_ponto rp WHERE rp.ronda_id = r.id) AS total
       FROM ronda r WHERE (r.inicio_previsto BETWEEN ? AND ?) OR r.status = 'EM_ANDAMENTO'
       ORDER BY r.inicio_previsto`,
    de,
    ate,
  );
  return linhas.map((l) => ({ ...paraRonda(l), totalPontos: l.total }));
}

export async function ronda(id: string): Promise<Ronda | null> {
  const r = await db().getFirstAsync<any>('SELECT * FROM ronda WHERE id = ?', id);
  return r ? paraRonda(r) : null;
}

export async function rondaEmAndamento(): Promise<Ronda | null> {
  const r = await db().getFirstAsync<any>("SELECT * FROM ronda WHERE status = 'EM_ANDAMENTO' LIMIT 1");
  return r ? paraRonda(r) : null;
}

export interface PontoDaRonda extends RondaPonto {
  ponto: Ponto;
  predio: Predio | null;
  andarNome: string | null;
  setorNome: string | null;
  situacao: SituacaoPonto;
  visitadoEm: string | null;
  justificativa: { motivo: MotivoJustificativa; descricao: string } | null;
}

export async function pontosDaRonda(rondaId: string): Promise<PontoDaRonda[]> {
  const linhas = await db().getAllAsync<any>(
    `SELECT rp.ponto_ronda_id, rp.ordem, rp.obrigatorio, p.*,
            pr.codigo AS pr_codigo, pr.nome AS pr_nome, pr.latitude AS pr_lat, pr.longitude AS pr_lon, pr.raio_geofence_m AS pr_raio,
            a.nome AS andar_nome, s.nome AS setor_nome,
            v.lido_em, j.motivo AS j_motivo, j.descricao AS j_descricao
       FROM ronda_ponto rp
       JOIN ponto_ronda_ref p ON p.id = rp.ponto_ronda_id
       LEFT JOIN predio_ref pr ON pr.id = p.predio_id
       LEFT JOIN andar_ref a ON a.id = p.andar_id
       LEFT JOIN setor_ref s ON s.id = p.setor_id
       LEFT JOIN visita v ON v.ronda_id = rp.ronda_id AND v.ponto_ronda_id = rp.ponto_ronda_id
       LEFT JOIN justificativa j ON j.ronda_id = rp.ronda_id AND j.ponto_ronda_id = rp.ponto_ronda_id
      WHERE rp.ronda_id = ?
      ORDER BY rp.ordem`,
    rondaId,
  );
  return linhas.map((l) => ({
    pontoRondaId: l.ponto_ronda_id,
    ordem: l.ordem,
    obrigatorio: !!l.obrigatorio,
    ponto: paraPonto(l),
    predio: l.pr_nome
      ? { id: l.predio_id, codigo: l.pr_codigo, nome: l.pr_nome, latitude: l.pr_lat, longitude: l.pr_lon, raioGeofenceM: l.pr_raio }
      : null,
    andarNome: l.andar_nome,
    setorNome: l.setor_nome,
    situacao: l.lido_em ? 'VISITADO' : l.j_motivo ? 'JUSTIFICADO' : 'PENDENTE',
    visitadoEm: l.lido_em,
    justificativa: l.j_motivo ? { motivo: l.j_motivo, descricao: l.j_descricao } : null,
  }));
}

export async function pontoDaTag(uidHex: string): Promise<string | null> {
  const r = await db().getFirstAsync<{ ponto_ronda_id: string }>('SELECT ponto_ronda_id FROM tag_nfc_ref WHERE uid_hex = ?', uidHex);
  return r?.ponto_ronda_id ?? null;
}

export interface TagComPonto {
  uidHex: string;
  tipo: TipoTagNfc;
  pontoRondaId: string;
  pontoNome: string;
  predioNome: string | null;
}

export async function tags(): Promise<TagComPonto[]> {
  const linhas = await db().getAllAsync<any>(
    `SELECT t.uid_hex, t.tipo, t.ponto_ronda_id, p.nome, pr.nome AS predio
       FROM tag_nfc_ref t JOIN ponto_ronda_ref p ON p.id = t.ponto_ronda_id LEFT JOIN predio_ref pr ON pr.id = p.predio_id
      ORDER BY pr.codigo, p.nome`,
  );
  return linhas.map((l) => ({ uidHex: l.uid_hex, tipo: l.tipo, pontoRondaId: l.ponto_ronda_id, pontoNome: l.nome, predioNome: l.predio }));
}

export interface PontoComLocal extends Ponto {
  predioNome: string | null;
  andarNome: string | null;
  uidHex: string | null;
}

export async function pontos(): Promise<PontoComLocal[]> {
  const linhas = await db().getAllAsync<any>(
    `SELECT p.*, pr.nome AS predio_nome, a.nome AS andar_nome, t.uid_hex
       FROM ponto_ronda_ref p LEFT JOIN predio_ref pr ON pr.id = p.predio_id LEFT JOIN andar_ref a ON a.id = p.andar_id
       LEFT JOIN tag_nfc_ref t ON t.ponto_ronda_id = p.id
      ORDER BY pr.codigo, a.ordem, p.nome`,
  );
  return linhas.map((l) => ({ ...paraPonto(l), predioNome: l.predio_nome, andarNome: l.andar_nome, uidHex: l.uid_hex }));
}

export async function tiposOcorrencia(): Promise<TipoOcorrencia[]> {
  const linhas = await db().getAllAsync<any>('SELECT * FROM tipo_ocorrencia_ref ORDER BY ordem_exibicao');
  return linhas.map((l) => ({ id: l.id, nome: l.nome, gravidadePadrao: l.gravidade_padrao as Gravidade, ordemExibicao: l.ordem_exibicao }));
}

export async function predios(): Promise<Predio[]> {
  const linhas = await db().getAllAsync<any>('SELECT * FROM predio_ref ORDER BY codigo');
  return linhas.map((l) => ({ id: l.id, codigo: l.codigo, nome: l.nome, latitude: l.latitude, longitude: l.longitude, raioGeofenceM: l.raio_geofence_m }));
}

export interface ItemFila {
  id: string;
  tipo: TipoEvento;
  resumo: string;
  criadoEm: string;
  status: StatusFila;
  tentativas: number;
  codigoErro: string | null;
  mensagemErro: string | null;
}

export async function fila(): Promise<ItemFila[]> {
  const linhas = await db().getAllAsync<any>('SELECT * FROM fila_eventos ORDER BY seq DESC LIMIT 200');
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    resumo: l.resumo,
    criadoEm: l.criado_em,
    status: l.status,
    tentativas: l.tentativas,
    codigoErro: l.codigo_erro,
    mensagemErro: l.mensagem_erro,
  }));
}

export interface ContagemFila {
  pendentes: number;
  rejeitados: number;
  fotosPendentes: number;
}

export async function contagemFila(): Promise<ContagemFila> {
  const r = await db().getFirstAsync<any>(
    `SELECT (SELECT COUNT(*) FROM fila_eventos WHERE status = 'PENDENTE') AS p,
            (SELECT COUNT(*) FROM fila_eventos WHERE status = 'REJEITADO') AS r,
            (SELECT COUNT(*) FROM foto_local WHERE status_upload = 'PENDENTE') AS f`,
  );
  return { pendentes: r?.p ?? 0, rejeitados: r?.r ?? 0, fotosPendentes: r?.f ?? 0 };
}

export interface ResumoRondaDados {
  ocorrencias: number;
  justificados: number;
  pendentesEnvio: number;
}

export async function resumoRonda(rondaId: string): Promise<ResumoRondaDados> {
  const r = await db().getFirstAsync<any>(
    `SELECT (SELECT COUNT(*) FROM ocorrencia WHERE ronda_id = ?1) AS o,
            (SELECT COUNT(*) FROM justificativa WHERE ronda_id = ?1) AS j,
            (SELECT COUNT(*) FROM fila_eventos WHERE status = 'PENDENTE' AND payload LIKE '%' || ?1 || '%') AS p`,
    rondaId,
  );
  return { ocorrencias: r?.o ?? 0, justificados: r?.j ?? 0, pendentesEnvio: r?.p ?? 0 };
}

export async function ultimaVisita(rondaId: string): Promise<{ pontoRondaId: string; lidoEm: string } | null> {
  const r = await db().getFirstAsync<any>('SELECT ponto_ronda_id, lido_em FROM visita WHERE ronda_id = ? ORDER BY lido_em DESC LIMIT 1', rondaId);
  return r ? { pontoRondaId: r.ponto_ronda_id, lidoEm: r.lido_em } : null;
}

export async function errosRecentes(): Promise<{ em: string; origem: string; mensagem: string }[]> {
  return db().getAllAsync('SELECT em, origem, mensagem FROM erro_log ORDER BY id DESC LIMIT 50');
}

export type { ResultadoGeo };

export interface OcorrenciaDaRonda {
  id: string;
  tipoNome: string;
  local: string;
  gravidade: Gravidade;
  resolvidoNoLocal: boolean;
  registradaEm: string;
}

export async function ocorrenciasDaRonda(rondaId: string): Promise<OcorrenciaDaRonda[]> {
  const linhas = await db().getAllAsync<any>(
    `SELECT o.id, o.gravidade, o.resolvido_no_local, o.registrada_em, o.detalhe_local, t.nome AS tipo, p.nome AS ponto
       FROM ocorrencia o LEFT JOIN tipo_ocorrencia_ref t ON t.id = o.tipo_ocorrencia_id LEFT JOIN ponto_ronda_ref p ON p.id = o.ponto_ronda_id
      WHERE o.ronda_id = ? ORDER BY o.registrada_em`,
    rondaId,
  );
  return linhas.map((l) => ({
    id: l.id,
    tipoNome: l.tipo ?? 'Ocorrência',
    local: l.detalhe_local || l.ponto || '',
    gravidade: l.gravidade,
    resolvidoNoLocal: !!l.resolvido_no_local,
    registradaEm: l.registrada_em,
  }));
}

export async function visitaDoPonto(rondaId: string, pontoRondaId: string): Promise<{ lidoEm: string; payloadNfc: string; checklist: string | null } | null> {
  const r = await db().getFirstAsync<any>('SELECT lido_em, payload_nfc, checklist FROM visita WHERE ronda_id = ? AND ponto_ronda_id = ?', rondaId, pontoRondaId);
  return r ? { lidoEm: r.lido_em, payloadNfc: r.payload_nfc, checklist: r.checklist } : null;
}
