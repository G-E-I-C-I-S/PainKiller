// Datas no fuso do campus: filtros por dia e horários de agenda são locais; o banco guarda UTC.

function deslocamentoMin(fuso: string, d: Date) {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: fuso, timeZoneName: 'longOffset' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
  const m = nome.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** "2026-11-04" + "21:30" no fuso do campus → instante UTC. */
export function localParaUtc(dia: string, hora: string, fuso: string) {
  const aprox = new Date(`${dia}T${hora}:00Z`);
  return new Date(aprox.getTime() - deslocamentoMin(fuso, aprox) * 60_000);
}

export const diaLocal = (d: Date, fuso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(d);

export const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Dia da semana (0 = domingo) de uma data local. */
export const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();

/** Intervalo [início, fim) de um dia local em UTC. */
export function intervaloDoDia(dia: string, fuso: string) {
  return { gte: localParaUtc(dia, '00:00', fuso), lt: localParaUtc(somarDias(dia, 1), '00:00', fuso) };
}

export const diaValido = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
