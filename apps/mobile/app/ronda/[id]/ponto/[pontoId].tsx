import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useConsulta } from '../../../../src/dados/banco';
import { pontosDaRonda, ronda as lerRonda } from '../../../../src/dados/repositorios';
import { Botao, Cartao, Selo, Texto } from '../../../../src/ui/atomos';
import { AvisoInline } from '../../../../src/ui/moleculas';
import { CabecalhoTela, TemplateTela, TituloSecao } from '../../../../src/ui/organismos';
import { hora, textos } from '../../../../src/textos';

export default function TelaPonto() {
  const { id, pontoId } = useLocalSearchParams<{ id: string; pontoId: string }>();
  const ronda = useConsulta(() => lerRonda(id), [id]);
  const p = useConsulta(async () => (await pontosDaRonda(id)).find((x) => x.pontoRondaId === pontoId), [id, pontoId]);
  if (!p || !ronda) return <TemplateTela><View /></TemplateTela>;
  const podeJustificar = ronda.status === 'EM_ANDAMENTO' && p.situacao === 'PENDENTE';
  return (
    <TemplateTela
      cabecalho={<CabecalhoTela voltar titulo={p.ponto.nome} subtitulo={[p.predio?.nome, p.andarNome].filter(Boolean).join(' · ')} />}
      barra={podeJustificar ? <Botao variante="aviso" titulo={textos.ponto.justificar} onPress={() => router.push(`/ronda/${id}/justificar/${pontoId}`)} /> : undefined}
    >
      {p.situacao === 'VISITADO' && p.visitadoEm ? <Selo cor="sucesso" texto={`✓ ${textos.ponto.visitadoAs(hora(p.visitadoEm))}`} /> : null}
      {p.justificativa ? <Selo cor="aviso" texto={`⚑ ${textos.ponto.justificadoComo(textos.motivo[p.justificativa.motivo])}`} /> : null}
      <TituloSecao>{textos.ponto.instrucoes.toUpperCase()}</TituloSecao>
      <Cartao>
        <Texto>{p.ponto.instrucoes ?? textos.ponto.semInstrucoes}</Texto>
      </Cartao>
      {p.justificativa ? <Texto cor="textoSecundario">{p.justificativa.descricao}</Texto> : null}
      {p.situacao === 'PENDENTE' ? <AvisoInline tipo="info" texto={textos.ponto.soPorTag} /> : null}
    </TemplateTela>
  );
}
