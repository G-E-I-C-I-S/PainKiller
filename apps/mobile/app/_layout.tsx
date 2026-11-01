import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProvedorTema, useTema } from '../src/tema/Tema';
import { ProvedorSessao, useSessao } from '../src/features/sessao';
import { prepararSons } from '../src/core/retorno';
import { esp } from '../src/tema/tokens';
import { Texto } from '../src/ui/atomos';
import { Atualizador } from '../src/features/atualizacao';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navegacao() {
  const { estado, sessao, erroBanco, registrarAtividade } = useSessao();
  const { cores, nome } = useTema();

  useEffect(() => {
    if (estado !== 'CARREGANDO' || erroBanco) SplashScreen.hideAsync().catch(() => {});
  }, [estado, erroBanco]);

  if (erroBanco) {
    // A chave não abre o banco: não apaga nada, orienta e mostra o erro (docs/08 · 11).
    return (
      <View style={{ flex: 1, backgroundColor: cores.fundo, justifyContent: 'center', padding: esp[6], gap: esp[3] }}>
        <Texto variante="titulo">Não foi possível abrir os dados do aparelho.</Texto>
        <Texto>Procure o administrador. Nada foi apagado.</Texto>
        <Texto variante="legenda" cor="textoSecundario">
          {erroBanco}
        </Texto>
      </View>
    );
  }
  if (estado === 'CARREGANDO') return <View style={{ flex: 1, backgroundColor: cores.fundo }} />;

  const ativa = estado === 'ATIVA';
  const aviso = ativa && !!sessao?.avisoPendente;
  const admin = sessao?.usuario.papel === 'ADMINISTRADOR';

  return (
    <View style={{ flex: 1 }} onTouchStart={registrarAtividade}>
      <StatusBar style={nome === 'escuro' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo }, animation: 'fade' }}>
        <Stack.Protected guard={estado === 'SEM_SESSAO'}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={estado === 'BLOQUEADA'}>
          <Stack.Screen name="desbloqueio" />
        </Stack.Protected>
        <Stack.Protected guard={aviso}>
          <Stack.Screen name="aviso-privacidade" />
        </Stack.Protected>
        <Stack.Protected guard={ativa && !aviso}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="ronda/[id]/index" />
          <Stack.Screen name="ronda/[id]/ler" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="ronda/[id]/registrado/[pontoId]" options={{ animation: 'fade' }} />
          <Stack.Screen name="ronda/[id]/ponto/[pontoId]" />
          <Stack.Screen name="ronda/[id]/justificar/[pontoId]" />
          <Stack.Screen name="ronda/[id]/ocorrencia" />
          <Stack.Screen name="ronda/[id]/finalizar" />
          <Stack.Screen name="ronda/[id]/resumo" options={{ gestureEnabled: false }} />
          <Stack.Screen name="sincronizacao" />
          <Stack.Screen name="perfil" options={{ animation: 'none' }} />
          <Stack.Screen name="privacidade" />
          <Stack.Protected guard={admin}>
            <Stack.Screen name="instalacao" />
            <Stack.Screen name="diagnostico" />
          </Stack.Protected>
        </Stack.Protected>
      </Stack>
      <Atualizador />
    </View>
  );
}

export default function Raiz() {
  useEffect(() => {
    prepararSons();
  }, []);
  return (
    <SafeAreaProvider>
      <ProvedorTema>
        <ProvedorSessao>
          <Navegacao />
        </ProvedorSessao>
      </ProvedorTema>
    </SafeAreaProvider>
  );
}
