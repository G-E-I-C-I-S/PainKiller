import { Texto } from '../src/ui/atomos';
import { CabecalhoTela, TemplateTela } from '../src/ui/organismos';
import { textos } from '../src/textos';

export default function Privacidade() {
  return (
    <TemplateTela cabecalho={<CabecalhoTela titulo={textos.aviso.titulo} voltar semSync />}>
      {textos.aviso.corpo.map((p) => (
        <Texto key={p}>{p}</Texto>
      ))}
    </TemplateTela>
  );
}
