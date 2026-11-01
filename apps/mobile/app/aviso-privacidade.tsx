import { useState } from 'react';
import { useSessao } from '../src/features/sessao';
import { Botao, Texto } from '../src/ui/atomos';
import { CabecalhoTela, TemplateTela } from '../src/ui/organismos';
import { textos } from '../src/textos';

export default function AvisoPrivacidade() {
  const { confirmarAviso } = useSessao();
  const [salvando, setSalvando] = useState(false);
  return (
    <TemplateTela
      cabecalho={<CabecalhoTela titulo={textos.aviso.titulo} semSync />}
      barra={<Botao titulo={textos.aviso.entendi} carregando={salvando} onPress={() => { setSalvando(true); confirmarAviso(); }} />}
    >
      {textos.aviso.corpo.map((p) => (
        <Texto key={p}>{p}</Texto>
      ))}
    </TemplateTela>
  );
}
