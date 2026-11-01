import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSessao } from '../src/features/sessao';
import { apiUrl } from '../src/core/config';
import { useTema } from '../src/tema/Tema';
import { esp, raio } from '../src/tema/tokens';
import { Botao, Campo, Texto } from '../src/ui/atomos';
import { AvisoInline } from '../src/ui/moleculas';
import { Icone } from '../src/ui/icones';
import { textos } from '../src/textos';

export default function Login() {
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  const { entrar } = useSessao();
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [servidor, setServidor] = useState(apiUrl());
  const [verServidor, setVerServidor] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [semBloqueio, setSemBloqueio] = useState(false);

  useEffect(() => {
    LocalAuthentication.getEnrolledLevelAsync().then((n) => setSemBloqueio(n === LocalAuthentication.SecurityLevel.NONE));
  }, []);

  const enviar = async () => {
    if (!matricula || !senha) return;
    setErro(null);
    setCarregando(true);
    try {
      await entrar(matricula, senha, servidor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cores.fundo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: esp[6], paddingTop: ins.top + esp[12], gap: esp[4] }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: esp[2], marginBottom: esp[6] }}>
          <View style={{ width: 72, height: 72, borderRadius: raio.grande, backgroundColor: cores.primaria, alignItems: 'center', justifyContent: 'center' }}>
            <Icone nome="escudo" cor={cores.textoSobrePrimaria} tamanho={40} />
          </View>
          <Texto variante="tituloGrande" style={{ marginTop: esp[2] }}>
            Ronda
          </Texto>
          <Texto variante="legenda" cor="textoSecundario" centro>
            Segurança patrimonial{'\n'}IF Sul de Minas Muzambinho
          </Texto>
        </View>

        {erro ? <AvisoInline tipo="erro" texto={erro} /> : null}
        {semBloqueio ? <AvisoInline tipo="aviso" texto={textos.login.semBloqueioTela} /> : null}

        <Campo rotulo={textos.login.matricula} placeholder="Ex.: 102345" value={matricula} onChangeText={setMatricula} autoCapitalize="none" autoCorrect={false} />
        <Campo rotulo={textos.login.senha} placeholder="••••••" value={senha} onChangeText={setSenha} secureTextEntry onSubmitEditing={enviar} />
        <Botao titulo="Entrar" onPress={enviar} carregando={carregando} desabilitado={!matricula || !senha} style={{ marginTop: esp[2] }} />
        <Texto variante="legenda" cor="textoSecundario" centro>
          {textos.login.modoLocalAjuda}
        </Texto>

        <View style={{ flex: 1 }} />
        {verServidor ? (
          <View style={{ gap: esp[1] }}>
            <Campo
              rotulo={textos.login.servidor}
              value={servidor}
              onChangeText={setServidor}
              placeholder="http://192.168.0.10:3000/api/v1"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Texto variante="legenda" cor="textoSecundario">
              {servidor.trim() ? textos.login.servidorAjuda : textos.login.modoLocalAjuda}
            </Texto>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setVerServidor(true)} style={{ minHeight: 48, justifyContent: 'center' }}>
            <Texto variante="legenda" cor="textoSecundario" centro>
              {servidor ? `Servidor: ${servidor}` : 'Modo local · toque para configurar o servidor'}
            </Texto>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
