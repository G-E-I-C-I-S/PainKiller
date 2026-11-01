// Design tokens do app (docs/09 · seção 6). Componentes usam só os semânticos.
export type Gravidade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export interface Cores {
  fundo: string;
  superficie: string;
  superficieElevada: string;
  borda: string;
  texto: string;
  textoSecundario: string;
  primaria: string;
  textoSobrePrimaria: string;
  sucesso: string;
  aviso: string;
  erro: string;
  info: string;
  textoSobreCor: string;
  gravidade: Record<Gravidade, string>;
}

// Paleta das telas aprovadas (docs/Telas.pdf): azul-noite com âmbar de destaque.
export const coresEscuro: Cores = {
  fundo: '#0E141B',
  superficie: '#161E27',
  superficieElevada: '#1D2631',
  borda: '#263241',
  texto: '#F2F4F7',
  textoSecundario: '#8C99A8',
  primaria: '#F2B33D',
  textoSobrePrimaria: '#1A1205',
  sucesso: '#34D17A',
  aviso: '#F2B33D',
  erro: '#FF8A5B',
  info: '#6EA8FE',
  textoSobreCor: '#0E141B',
  gravidade: { BAIXA: '#6EA8FE', MEDIA: '#F2B33D', ALTA: '#FF8A5B', CRITICA: '#FF5C5C' },
};

export const coresClaro: Cores = {
  fundo: '#FFFFFF',
  superficie: '#F4F6F8',
  superficieElevada: '#FFFFFF',
  borda: '#D0D7DE',
  texto: '#111827',
  textoSecundario: '#4B5563',
  primaria: '#B7791F',
  textoSobrePrimaria: '#FFFFFF',
  sucesso: '#12733E',
  aviso: '#8A5A00',
  erro: '#B42318',
  info: '#1E5A8C',
  textoSobreCor: '#FFFFFF',
  gravidade: { BAIXA: '#1E5A8C', MEDIA: '#8A6D00', ALTA: '#B54708', CRITICA: '#B42318' },
};

export const tipografia = {
  legenda: { fontSize: 15, fontWeight: '400' },
  corpo: { fontSize: 18, fontWeight: '400' },
  corpoForte: { fontSize: 18, fontWeight: '600' },
  titulo: { fontSize: 22, fontWeight: '600' },
  tituloGrande: { fontSize: 28, fontWeight: '700' },
  destaqueLeitura: { fontSize: 32, fontWeight: '700' },
  botao: { fontSize: 18, fontWeight: '700' },
  rotulo: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6 },
  relogio: { fontSize: 30, fontWeight: '700', fontFamily: 'monospace' },
  mono: { fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },
} as const;

export type VarianteTexto = keyof typeof tipografia;

export const esp = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 12: 48 } as const;
export const raio = { pequeno: 6, medio: 10, grande: 16, pilula: 999 } as const;
export const alvo = { primario: 56, minimo: 48 } as const;
export const icone = { pequeno: 20, medio: 24, grande: 32, retorno: 96 } as const;
export const duracao = { rapida: 120, normal: 200, retorno: 1500 } as const;
