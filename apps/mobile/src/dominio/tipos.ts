// Enums e tipos de domínio (docs/05 · seção 5).
import type { Gravidade } from '../tema/tokens';

export type { Gravidade };
export type PapelUsuario = 'VIGILANTE' | 'COORDENADOR' | 'RESPONSAVEL' | 'ADMINISTRADOR';
export type PoliticaGeo = 'SINALIZAR' | 'BLOQUEAR';
export type TipoTagNfc = 'NTAG424_DNA' | 'NTAG215_LEGADA';
export type StatusRonda = 'AGENDADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'INCOMPLETA' | 'NAO_REALIZADA' | 'CANCELADA';
export type ResultadoGeo = 'DENTRO_AREA' | 'FORA_AREA' | 'INDETERMINADO' | 'SEM_LOCALIZACAO';
export type MotivoJustificativa =
  | 'ACESSO_BLOQUEADO'
  | 'AREA_INTERDITADA'
  | 'TAG_DANIFICADA_OU_AUSENTE'
  | 'EMERGENCIA_EM_ATENDIMENTO'
  | 'CONDICAO_INSEGURA'
  | 'OUTRO';
export type TipoEvento = 'RONDA_INICIADA' | 'PONTO_VISITADO' | 'PONTO_CONFERIDO' | 'PONTO_JUSTIFICADO' | 'OCORRENCIA_REGISTRADA' | 'RONDA_FINALIZADA';
export type StatusFila = 'PENDENTE' | 'ACEITO' | 'REJEITADO';

export interface Localizacao {
  latitude: number;
  longitude: number;
  precisaoM: number;
  simulada: boolean;
}

export interface ConfiguracaoCampus {
  politicaGeo: PoliticaGeo;
  precisaoMaximaM: number;
  toleranciaInicioMin: number;
  inatividadeBloqueioMin: number;
  limiteDesvioRelogioMin: number;
}

export interface Predio {
  id: string;
  codigo: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
  raioGeofenceM: number | null;
}

export interface Ponto {
  id: string;
  predioId: string;
  andarId: string | null;
  setorId: string | null;
  nome: string;
  instrucoes: string | null;
  latitude: number | null;
  longitude: number | null;
  raioToleranciaM: number;
}

export interface Ronda {
  id: string;
  roteiroNome: string;
  exigeOrdem: boolean;
  status: StatusRonda;
  inicioPrevisto: string;
  fimPrevisto: string;
  toleranciaInicioMin: number;
  iniciadaEm: string | null;
  finalizadaEm: string | null;
  canceladaEm: string | null;
}

export interface RondaPonto {
  pontoRondaId: string;
  ordem: number;
  obrigatorio: boolean;
}

export type SituacaoPonto = 'PENDENTE' | 'VISITADO' | 'JUSTIFICADO';

export interface TipoOcorrencia {
  id: string;
  nome: string;
  gravidadePadrao: Gravidade;
  ordemExibicao: number;
}
