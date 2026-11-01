// Organismos e template de tela (docs/09 · 7.1).
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTema } from '../tema/Tema';
import { alvo, duracao, esp, icone, raio } from '../tema/tokens';
import { Texto } from './atomos';
import { IndicadorSincronizacao } from './moleculas';
import { useConsulta } from '../dados/banco';
import { contagemFila } from '../dados/repositorios';
import { useSessao } from '../features/sessao';
import { textos } from '../textos';

export function CabecalhoTela({ titulo, subtitulo, voltar, direita, semSync }: { titulo: string; subtitulo?: string; voltar?: boolean; direita?: ReactNode; semSync?: boolean }) {
  const { cores } = useTema();
  const { sessao } = useSessao();
  const fila = useConsulta(contagemFila);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2], paddingHorizontal: esp[4], paddingVertical: esp[2], borderBottomWidth: 1, borderBottomColor: cores.borda }}>
      {voltar ? (
        <Pressable accessibilityRole="button" accessibilityLabel={textos.geral.voltar} onPress={() => router.back()} hitSlop={8} style={{ minWidth: alvo.minimo, minHeight: alvo.minimo, justifyContent: 'center' }}>
          <Texto variante="titulo">←</Texto>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Texto variante="titulo" numberOfLines={1}>
          {titulo}
        </Texto>
        {subtitulo ? (
          <Texto variante="legenda" cor="textoSecundario" numberOfLines={1}>
            {subtitulo}
          </Texto>
        ) : null}
      </View>
      {!semSync && fila ? (
        <IndicadorSincronizacao pendentes={fila.pendentes} rejeitados={fila.rejeitados} local={sessao?.modo === 'LOCAL'} onPress={() => router.push('/sincronizacao')} />
      ) : null}
      {direita}
    </View>
  );
}

/** Cabeçalho + conteúdo rolável + barra de ação fixa embaixo. */
export function TemplateTela({ cabecalho, children, barra, rolavel = true }: { cabecalho?: ReactNode; children: ReactNode; barra?: ReactNode; rolavel?: boolean }) {
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: ins.top }}>
      {cabecalho}
      {rolavel ? (
        <ScrollView contentContainerStyle={{ padding: esp[4], gap: esp[3], paddingBottom: esp[8] }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {barra ? (
        <View style={{ padding: esp[4], paddingBottom: esp[4] + ins.bottom, gap: esp[2], borderTopWidth: 1, borderTopColor: cores.borda, backgroundColor: cores.fundo }}>{barra}</View>
      ) : (
        <View style={{ height: ins.bottom }} />
      )}
    </View>
  );
}

export type Retorno =
  | { tipo: 'SUCESSO'; nome: string; local: string; progresso: string; aviso?: string }
  | { tipo: 'INFO' | 'ERRO' | 'AVISO'; texto: string };

/** Sobreposição do ✓ (1,5 s) e faixas de retorno da leitura (docs/09 · 5.1). Um toque fecha. */
export function RetornoLeitura({ retorno, aoFechar }: { retorno: Retorno | null; aoFechar: () => void }) {
  const { cores } = useTema();
  useEffect(() => {
    if (!retorno) return;
    const ms = retorno.tipo === 'SUCESSO' ? duracao.retorno : retorno.tipo === 'ERRO' ? 4000 : retorno.tipo === 'AVISO' ? 3000 : 2000;
    const t = setTimeout(aoFechar, ms);
    return () => clearTimeout(t);
  }, [retorno, aoFechar]);
  if (!retorno) return null;
  if (retorno.tipo === 'SUCESSO') {
    return (
      <Pressable
        accessibilityLiveRegion="assertive"
        accessibilityLabel={`${retorno.nome} registrado. ${retorno.progresso}`}
        onPress={aoFechar}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: cores.superficieElevada, alignItems: 'center', justifyContent: 'center', padding: esp[6], gap: esp[3] }}
      >
        <Texto style={{ fontSize: icone.retorno, lineHeight: icone.retorno + 8, color: cores.sucesso, fontWeight: '700' }}>✓</Texto>
        <Texto variante="destaqueLeitura" centro>
          {retorno.nome}
        </Texto>
        <Texto cor="textoSecundario" centro>
          {retorno.local}
        </Texto>
        <Texto variante="titulo" centro>
          {retorno.progresso}
        </Texto>
        {retorno.aviso ? (
          <Texto cor="aviso" centro variante="corpoForte">
            {retorno.aviso}
          </Texto>
        ) : null}
      </Pressable>
    );
  }
  const cor = retorno.tipo === 'ERRO' ? cores.erro : retorno.tipo === 'AVISO' ? cores.aviso : cores.superficieElevada;
  return (
    <Pressable accessibilityLiveRegion="assertive" onPress={aoFechar} style={{ position: 'absolute', left: esp[4], right: esp[4], top: esp[4], backgroundColor: cor, borderRadius: raio.medio, padding: esp[4] }}>
      <Texto variante="corpoForte" style={{ color: retorno.tipo === 'INFO' ? cores.texto : cores.textoSobreCor }} centro>
        {retorno.texto}
      </Texto>
    </Pressable>
  );
}

export function TituloSecao({ children }: { children: ReactNode }) {
  return (
    <Texto variante="legenda" cor="textoSecundario" style={{ fontWeight: '700', marginTop: esp[2] }}>
      {children}
    </Texto>
  );
}
