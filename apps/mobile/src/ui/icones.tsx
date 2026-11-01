// Ícones de traço (estilo das telas aprovadas). Conjunto fechado, como pede o design system.
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

export type NomeIcone =
  | 'escudo' | 'nfc' | 'play' | 'bandeira' | 'alerta' | 'casa' | 'pessoa' | 'relogio' | 'pin'
  | 'camera' | 'check' | 'x' | 'voltar' | 'qr' | 'nuvem' | 'engrenagem';

export function Icone({ nome, cor, tamanho = 24, espessura = 2 }: { nome: NomeIcone; cor: string; tamanho?: number; espessura?: number }) {
  const p = { stroke: cor, strokeWidth: espessura, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      {nome === 'escudo' && (
        <>
          <Path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" {...p} />
          <Polyline points="9 12 11 14 15 10" {...p} />
        </>
      )}
      {nome === 'nfc' && (
        <>
          <Path d="M8 8.5a5 5 0 010 7" {...p} />
          <Path d="M11.5 6a8.5 8.5 0 010 12" {...p} />
          <Path d="M15 3.5a12 12 0 010 17" {...p} />
        </>
      )}
      {nome === 'play' && <Path d="M7 4.5v15l12-7.5-12-7.5z" fill={cor} stroke={cor} strokeWidth={1} strokeLinejoin="round" />}
      {nome === 'bandeira' && (
        <>
          <Path d="M5 21V4" {...p} />
          <Path d="M5 4h11l-2 4 2 4H5" {...p} />
        </>
      )}
      {nome === 'alerta' && (
        <>
          <Path d="M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" {...p} />
          <Path d="M12 9v4M12 17h.01" {...p} />
        </>
      )}
      {nome === 'casa' && (
        <>
          <Path d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10z" {...p} />
        </>
      )}
      {nome === 'pessoa' && (
        <>
          <Circle cx={12} cy={8} r={4} {...p} />
          <Path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" {...p} />
        </>
      )}
      {nome === 'relogio' && (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Polyline points="12 7 12 12 15 14" {...p} />
        </>
      )}
      {nome === 'pin' && (
        <>
          <Path d="M12 21s7-6.2 7-12a7 7 0 00-14 0c0 5.8 7 12 7 12z" {...p} />
          <Circle cx={12} cy={9} r={2.5} {...p} />
        </>
      )}
      {nome === 'camera' && (
        <>
          <Path d="M3 8a2 2 0 012-2h2.5l1.5-2h6l1.5 2H19a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" {...p} />
          <Circle cx={12} cy={13} r={3.5} {...p} />
        </>
      )}
      {nome === 'check' && <Polyline points="5 12.5 10 17.5 19 7" {...p} />}
      {nome === 'x' && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {nome === 'voltar' && <Polyline points="15 5 8 12 15 19" {...p} />}
      {nome === 'qr' && (
        <>
          <Rect x={3} y={3} width={7} height={7} rx={1} {...p} />
          <Rect x={14} y={3} width={7} height={7} rx={1} {...p} />
          <Rect x={3} y={14} width={7} height={7} rx={1} {...p} />
          <Path d="M14 14h3v3M21 14v7h-7v-3" {...p} />
        </>
      )}
      {nome === 'nuvem' && <Path d="M7 18a4.5 4.5 0 01-.6-9A6 6 0 0118 8.5a4.8 4.8 0 01-.5 9.5H7z" {...p} />}
      {nome === 'engrenagem' && (
        <>
          <Circle cx={12} cy={12} r={3} {...p} />
          <Path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 15H3a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 009 4.6V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0021 9h.1a2 2 0 110 4H21a1.7 1.7 0 00-1.6 2z" {...p} />
        </>
      )}
    </Svg>
  );
}
