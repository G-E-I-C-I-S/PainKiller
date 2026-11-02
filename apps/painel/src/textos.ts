// Rótulos dos enums da API e formatos de data no fuso do campus.
export const STATUS_RONDA: Record<string, string> = {
  AGENDADA: 'Agendada', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', INCOMPLETA: 'Incompleta', NAO_REALIZADA: 'Não realizada', CANCELADA: 'Cancelada',
};
export const SITUACAO_PONTO: Record<string, string> = {
  PENDENTE: 'Não lido', VISITADO: 'Lido', VISITA_SINALIZADA: 'Lido · revisar', VISITA_INVALIDA: 'Leitura rejeitada', JUSTIFICADO: 'Justificado',
};
export const GRAVIDADE: Record<string, string> = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' };
export const STATUS_OCORRENCIA: Record<string, string> = { ABERTA: 'Aberta', EM_ATENDIMENTO: 'Em atendimento', RESOLVIDA: 'Resolvida', ARQUIVADA: 'Arquivada' };
export const MOTIVO: Record<string, string> = {
  ACESSO_BLOQUEADO: 'Acesso bloqueado', AREA_INTERDITADA: 'Área interditada', TAG_DANIFICADA_OU_AUSENTE: 'Tag danificada ou ausente',
  EMERGENCIA_EM_ATENDIMENTO: 'Emergência em atendimento', CONDICAO_INSEGURA: 'Condição insegura', OUTRO: 'Outro',
};
export const GEO: Record<string, string> = { DENTRO_AREA: 'Dentro da área', FORA_AREA: 'Fora da área', INDETERMINADO: 'Posição imprecisa', SEM_LOCALIZACAO: 'Sem localização' };
export const VALIDACAO_TAG: Record<string, string> = { VALIDA: 'Tag do ponto', NAO_VINCULADA: 'Tag não vinculada', QR_CODE: 'QR Code', INVALIDA: 'Tag inválida' };
export const PAPEL: Record<string, string> = { VIGILANTE: 'Vigilante', COORDENADOR: 'Coordenador', RESPONSAVEL: 'Responsável', ADMINISTRADOR: 'Administrador' };
export const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const TIPO_EVENTO: Record<string, string> = {
  RONDA_INICIADA: 'Início de ronda', PONTO_VISITADO: 'Leitura de ponto', PONTO_CONFERIDO: 'Checklist do ponto', PONTO_JUSTIFICADO: 'Justificativa',
  OCORRENCIA_REGISTRADA: 'Ocorrência', RONDA_FINALIZADA: 'Fim de ronda',
};

const FUSO = 'America/Sao_Paulo';
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...o });
const hora = fmt({ hour: '2-digit', minute: '2-digit' });
const horaSeg = fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dataCurta = fmt({ day: '2-digit', month: '2-digit' });
const dataLonga = fmt({ weekday: 'long', day: 'numeric', month: 'long' });

const d = (x: string | Date | null | undefined) => (x ? new Date(x) : null);
export const fHora = (x: string | Date | null | undefined) => (d(x) ? hora.format(d(x)!) : '—');
export const fHoraSeg = (x: string | Date | null | undefined) => (d(x) ? horaSeg.format(d(x)!) : '—');
export const fDataHora = (x: string | Date | null | undefined) => (d(x) ? `${dataCurta.format(d(x)!)} ${hora.format(d(x)!)}` : '—');
export const fDataLonga = (x: string | Date) => dataLonga.format(new Date(x));
export const hojeLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
export const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export function duracao(de: string | Date | null | undefined, ate: string | Date | null | undefined) {
  if (!de || !ate) return '—';
  const min = Math.round((new Date(ate).getTime() - new Date(de).getTime()) / 60000);
  return min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min` : `${min} min`;
}
