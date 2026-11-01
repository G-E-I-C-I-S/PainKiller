// Átomos do design system (docs/09 · 7.1). Só tokens, sem regra de negócio.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { useTema } from '../tema/Tema';
import { alvo, esp, raio, tipografia, type Gravidade, type VarianteTexto } from '../tema/tokens';
import type { Cores } from '../tema/tokens';

type CorSemantica = 'texto' | 'textoSecundario' | 'primaria' | 'sucesso' | 'aviso' | 'erro' | 'info' | 'textoSobrePrimaria' | 'textoSobreCor';

export function Texto({
  variante = 'corpo',
  cor = 'texto',
  children,
  style,
  centro,
  numberOfLines,
}: {
  variante?: VarianteTexto;
  cor?: CorSemantica;
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  centro?: boolean;
  numberOfLines?: number;
}) {
  const { cores } = useTema();
  return (
    <Text numberOfLines={numberOfLines} style={[tipografia[variante], { color: cores[cor] }, centro && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

export type VarianteBotao = 'primario' | 'secundario' | 'aviso' | 'perigo' | 'texto' | 'sucesso' | 'contornoErro';

function coresBotao(v: VarianteBotao, c: Cores) {
  switch (v) {
    case 'primario':
      return { fundo: c.primaria, texto: c.textoSobrePrimaria, borda: c.primaria };
    case 'sucesso':
      return { fundo: c.sucesso, texto: c.textoSobreCor, borda: c.sucesso };
    case 'aviso':
      return { fundo: c.aviso, texto: c.textoSobreCor, borda: c.aviso };
    case 'perigo':
      return { fundo: c.erro, texto: c.textoSobreCor, borda: c.erro };
    case 'contornoErro':
      return { fundo: 'transparent', texto: c.erro, borda: c.erro };
    case 'secundario':
      return { fundo: c.superficie, texto: c.texto, borda: c.borda };
    default:
      return { fundo: 'transparent', texto: c.primaria, borda: 'transparent' };
  }
}

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  desabilitado,
  motivoDesabilitado,
  carregando,
  style,
  icone,
}: {
  titulo: string;
  onPress?: () => void;
  variante?: VarianteBotao;
  desabilitado?: boolean;
  motivoDesabilitado?: string;
  carregando?: boolean;
  style?: StyleProp<ViewStyle>;
  icone?: (cor: string) => ReactNode;
}) {
  const { cores } = useTema();
  const c = coresBotao(variante, cores);
  const inativo = desabilitado || carregando;
  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={titulo}
        accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
        disabled={inativo}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: variante === 'primario' || variante === 'aviso' || variante === 'sucesso' ? alvo.primario : alvo.minimo,
          borderRadius: raio.grande - 4,
          backgroundColor: c.fundo,
          borderWidth: 1,
          borderColor: c.borda,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: esp[4],
          opacity: desabilitado ? 0.4 : pressed ? 0.8 : 1,
        })}
      >
        {carregando ? (
          <ActivityIndicator color={c.texto} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2] }}>
            {icone?.(c.texto)}
            <Text style={[tipografia.botao, { color: c.texto, textAlign: 'center' }]}>{titulo}</Text>
          </View>
        )}
      </Pressable>
      {desabilitado && motivoDesabilitado ? (
        <Texto variante="legenda" cor="textoSecundario" centro style={{ marginTop: esp[1] }}>
          {motivoDesabilitado}
        </Texto>
      ) : null}
    </View>
  );
}

export function Selo({ texto, cor }: { texto: string; cor: 'sucesso' | 'aviso' | 'erro' | 'info' | 'primaria' | Gravidade | 'neutro' }) {
  const { cores } = useTema();
  const fundo =
    cor === 'neutro' ? cores.superficieElevada : cor in cores.gravidade ? cores.gravidade[cor as Gravidade] : cores[cor as 'sucesso'];
  return (
    <View style={{ backgroundColor: fundo, borderRadius: raio.pilula, paddingHorizontal: esp[2], paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={[tipografia.legenda, { fontWeight: '700', color: cor === 'neutro' ? cores.texto : cores.textoSobreCor }]}>{texto}</Text>
    </View>
  );
}

export function Campo({ rotulo, contador, ...props }: TextInputProps & { rotulo?: string; contador?: string }) {
  const { cores } = useTema();
  return (
    <View style={{ gap: esp[1] }}>
      {rotulo ? (
        <Texto variante="legenda" cor="textoSecundario">
          {rotulo}
        </Texto>
      ) : null}
      <TextInput
        placeholderTextColor={cores.textoSecundario}
        accessibilityLabel={rotulo}
        {...props}
        style={[
          tipografia.corpo,
          {
            color: cores.texto,
            backgroundColor: cores.superficie,
            borderColor: cores.borda,
            borderWidth: 1,
            borderRadius: raio.medio,
            minHeight: alvo.minimo,
            paddingHorizontal: esp[3],
            paddingVertical: esp[2],
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          props.multiline && { minHeight: 110 },
          props.style,
        ]}
      />
      {contador ? (
        <Texto variante="legenda" cor="aviso">
          {contador}
        </Texto>
      ) : null}
    </View>
  );
}

export function Divisor() {
  const { cores } = useTema();
  return <View style={{ height: 1, backgroundColor: cores.borda, marginVertical: esp[2] }} />;
}

export function Indicador() {
  const { cores } = useTema();
  return <ActivityIndicator color={cores.primaria} size="large" />;
}

export function Cartao({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { cores } = useTema();
  return (
    <View style={[{ backgroundColor: cores.superficie, borderRadius: raio.grande, borderWidth: 1, borderColor: cores.borda, padding: esp[4], gap: esp[2] }, style]}>
      {children}
    </View>
  );
}
