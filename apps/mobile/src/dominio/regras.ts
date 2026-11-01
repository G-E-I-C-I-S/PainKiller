// Regras puras de ronda, ordem e geolocalização. Sem React e sem I/O.
import type { ConfiguracaoCampus, Localizacao, Ponto, Predio, ResultadoGeo, Ronda, RondaPonto, SituacaoPonto } from './tipos';

export type EstadoCartao =
  | { tipo: 'DISPONIVEL' }
  | { tipo: 'ANTES_DA_JANELA'; disponivelEm: Date }
  | { tipo: 'EM_ANDAMENTO'; atrasada: boolean }
  | { tipo: 'JANELA_ENCERRADA' }
  | { tipo: 'CANCELADA' }
  | { tipo: 'FINALIZADA' };

/** Estado do cartão da ronda na tela Início (docs/09 · 4.1). */
export function estadoDaRonda(r: Ronda, agora: Date): EstadoCartao {
  if (r.status === 'CANCELADA' || r.canceladaEm) return { tipo: 'CANCELADA' };
  if (r.status === 'CONCLUIDA' || r.status === 'INCOMPLETA') return { tipo: 'FINALIZADA' };
  const fim = new Date(r.fimPrevisto);
  if (r.status === 'EM_ANDAMENTO') return { tipo: 'EM_ANDAMENTO', atrasada: agora > fim };
  if (r.status === 'NAO_REALIZADA') return { tipo: 'JANELA_ENCERRADA' };
  const disponivelEm = new Date(new Date(r.inicioPrevisto).getTime() - r.toleranciaInicioMin * 60_000);
  if (agora < disponivelEm) return { tipo: 'ANTES_DA_JANELA', disponivelEm };
  if (agora > fim) return { tipo: 'JANELA_ENCERRADA' };
  return { tipo: 'DISPONIVEL' };
}

/** Escolhe a ronda do cartão "Próxima ronda": a em andamento, senão a próxima disponível ou futura. */
export function proximaRonda<T extends Ronda>(rondas: T[], agora: Date): T | null {
  const emAndamento = rondas.find((r) => r.status === 'EM_ANDAMENTO');
  if (emAndamento) return emAndamento;
  const candidatas = rondas
    .filter((r) => {
      const e = estadoDaRonda(r, agora).tipo;
      return e === 'DISPONIVEL' || e === 'ANTES_DA_JANELA';
    })
    .sort((a, b) => a.inicioPrevisto.localeCompare(b.inicioPrevisto));
  return candidatas[0] ?? null;
}

export interface ProgressoRonda {
  total: number;
  visitados: number;
  obrigatoriosPendentes: RondaPonto[];
  completa: boolean;
}

export function progresso(pontos: RondaPonto[], situacao: Map<string, SituacaoPonto>): ProgressoRonda {
  const visitados = pontos.filter((p) => situacao.get(p.pontoRondaId) === 'VISITADO').length;
  const obrigatoriosPendentes = pontos.filter((p) => p.obrigatorio && situacao.get(p.pontoRondaId) !== 'VISITADO');
  return { total: pontos.length, visitados, obrigatoriosPendentes, completa: obrigatoriosPendentes.length === 0 };
}

/** Próximo ponto esperado num roteiro com ordem: o primeiro ainda pendente. */
export function proximoEsperado(pontos: RondaPonto[], situacao: Map<string, SituacaoPonto>): string | null {
  const ordenados = [...pontos].sort((a, b) => a.ordem - b.ordem);
  return ordenados.find((p) => (situacao.get(p.pontoRondaId) ?? 'PENDENTE') === 'PENDENTE')?.pontoRondaId ?? null;
}

export type ResultadoLeitura =
  | { tipo: 'ACEITA'; pontoRondaId: string; foraDaOrdem: boolean }
  | { tipo: 'JA_REGISTRADO'; pontoRondaId: string }
  | { tipo: 'FORA_DO_ROTEIRO' }
  | { tipo: 'NAO_RECONHECIDA' };

/** Validação local de uma leitura NFC (docs/08 · 8.1, passo 5). */
export function avaliarLeitura(
  pontoDaTag: string | null,
  pontos: RondaPonto[],
  situacao: Map<string, SituacaoPonto>,
  exigeOrdem: boolean,
): ResultadoLeitura {
  if (!pontoDaTag) return { tipo: 'NAO_RECONHECIDA' };
  if (!pontos.some((p) => p.pontoRondaId === pontoDaTag)) return { tipo: 'FORA_DO_ROTEIRO' };
  if (situacao.get(pontoDaTag) === 'VISITADO') return { tipo: 'JA_REGISTRADO', pontoRondaId: pontoDaTag };
  const esperado = exigeOrdem ? proximoEsperado(pontos, situacao) : null;
  return { tipo: 'ACEITA', pontoRondaId: pontoDaTag, foraDaOrdem: esperado !== null && esperado !== pontoDaTag };
}

export function distanciaM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Classifica a posição em relação ao ponto (ou ao prédio, se o ponto não tiver coordenadas). */
export function classificarGeo(
  pos: Localizacao | null,
  ponto: Pick<Ponto, 'latitude' | 'longitude' | 'raioToleranciaM'> | null,
  predio: Pick<Predio, 'latitude' | 'longitude' | 'raioGeofenceM'> | null,
  config: Pick<ConfiguracaoCampus, 'precisaoMaximaM'>,
): ResultadoGeo {
  if (!pos) return 'SEM_LOCALIZACAO';
  if (pos.precisaoM > config.precisaoMaximaM) return 'INDETERMINADO';
  let alvo: { lat: number; lon: number; raio: number } | null = null;
  if (ponto?.latitude != null && ponto.longitude != null) {
    alvo = { lat: ponto.latitude, lon: ponto.longitude, raio: ponto.raioToleranciaM };
  } else if (predio?.latitude != null && predio.longitude != null && predio.raioGeofenceM != null) {
    alvo = { lat: predio.latitude, lon: predio.longitude, raio: predio.raioGeofenceM };
  }
  if (!alvo) return 'INDETERMINADO';
  const d = distanciaM(pos.latitude, pos.longitude, alvo.lat, alvo.lon);
  return d - pos.precisaoM <= alvo.raio ? 'DENTRO_AREA' : 'FORA_AREA';
}

export const DESCRICAO_MINIMA_JUSTIFICATIVA = 10;
export const MAXIMO_FOTOS = 5;
export const INTERVALO_RELEITURA_MS = 3_000;
