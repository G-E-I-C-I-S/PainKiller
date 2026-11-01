import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useSessao } from '../src/features/sessao';
import { useTema } from '../src/tema/Tema';
import * as Updates from 'expo-updates';
import { ambiente, apiUrl } from '../src/core/config';
import { VERSAO } from '../src/features/novidades';
import { BarraAbas } from '../src/ui/novos';
import { Botao, Cartao, Texto } from '../src/ui/atomos';
import { AvisoInline, SeletorOpcoes } from '../src/ui/moleculas';
import { CabecalhoTela, TemplateTela, TituloSecao } from '../src/ui/organismos';
import { esp } from '../src/tema/tokens';
import { textos } from '../src/textos';

export default function Perfil() {
  usePreventScreenCapture('perfil');
  const { sessao, sair } = useSessao();
  const { nome, definir } = useTema();
  const [aviso, setAviso] = useState<string | null>(null);
  const admin = sessao?.usuario.papel === 'ADMINISTRADOR';

  return (
    <View style={{ flex: 1 }}>
    <TemplateTela cabecalho={<CabecalhoTela titulo={textos.perfil.titulo} />}>
      {aviso ? <AvisoInline tipo="aviso" texto={aviso} /> : null}
      <Cartao>
        <Texto variante="titulo">{sessao?.usuario.nome}</Texto>
        <Texto cor="textoSecundario">
          {sessao?.usuario.matricula} · {sessao?.usuario.papel}
        </Texto>
        <Texto variante="legenda" cor="textoSecundario">
          {textos.perfil.modo}: {sessao?.modo === 'LOCAL' ? textos.perfil.modoLocal : apiUrl()}
        </Texto>
      </Cartao>
      <TituloSecao>{textos.perfil.tema.toUpperCase()}</TituloSecao>
      <SeletorOpcoes opcoes={[{ valor: 'escuro' as const, rotulo: textos.perfil.escuro }, { valor: 'claro' as const, rotulo: textos.perfil.claro }]} valor={nome} onChange={definir} />
      <View style={{ gap: esp[2], marginTop: esp[3] }}>
        <Botao variante="secundario" titulo={textos.perfil.envio} onPress={() => router.push('/sincronizacao')} />
        <Botao variante="secundario" titulo={textos.perfil.aviso} onPress={() => router.push('/privacidade')} />
        {admin ? <Botao variante="secundario" titulo={textos.perfil.instalacao} onPress={() => router.push('/instalacao')} /> : null}
        {admin ? <Botao variante="secundario" titulo={textos.perfil.diagnostico} onPress={() => router.push('/diagnostico')} /> : null}
      </View>
      <Botao
        variante="contornoErro"
        style={{ marginTop: esp[4] }}
        titulo={textos.perfil.sair}
        onPress={async () => {
          const r = await sair();
          if (!r.ok) setAviso(textos.perfil.logoutComPendencias(r.pendentes));
        }}
      />
      <Texto variante="legenda" cor="textoSecundario" centro>
        {textos.perfil.versao} {VERSAO} · {ambiente}
        {Updates.updateId ? ` · ${Updates.updateId.slice(0, 8)}` : ' · APK'}
      </Texto>
    </TemplateTela>
    <BarraAbas ativa="perfil" />
    </View>
  );
}
