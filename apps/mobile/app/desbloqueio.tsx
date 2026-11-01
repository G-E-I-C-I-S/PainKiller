import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSessao } from '../src/features/sessao';
import { Botao, Texto } from '../src/ui/atomos';
import { TemplateTela } from '../src/ui/organismos';
import { esp } from '../src/tema/tokens';
import { textos } from '../src/textos';

export default function Desbloqueio() {
  const { desbloquear, sessao, sair } = useSessao();
  const [tentando, setTentando] = useState(false);

  const tentar = async () => {
    setTentando(true);
    await desbloquear().finally(() => setTentando(false));
  };

  // Biometria automática ao abrir (UC02).
  useEffect(() => {
    tentar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TemplateTela barra={<Botao titulo={textos.desbloqueio.desbloquear} onPress={tentar} carregando={tentando} />}>
      <View style={{ alignItems: 'center', gap: esp[3], marginTop: esp[12] }}>
        <Texto style={{ fontSize: 64, lineHeight: 76 }}>🔒</Texto>
        <Texto variante="titulo" centro>
          {textos.desbloqueio.titulo}
        </Texto>
        <Texto cor="textoSecundario" centro>
          {sessao?.usuario.nome}
        </Texto>
      </View>
      <Botao variante="texto" titulo={textos.desbloqueio.sair} onPress={() => sair()} style={{ marginTop: esp[8] }} />
    </TemplateTela>
  );
}
