import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useConsulta } from '../../../../src/dados/banco';
import { pontosDaRonda } from '../../../../src/dados/repositorios';
import { justificarPonto } from '../../../../src/features/acoes';
import { DESCRICAO_MINIMA_JUSTIFICATIVA } from '../../../../src/dominio/regras';
import type { MotivoJustificativa } from '../../../../src/dominio/tipos';
import { retorno } from '../../../../src/core/retorno';
import { Botao, Campo } from '../../../../src/ui/atomos';
import { AvisoInline, SeletorOpcoes } from '../../../../src/ui/moleculas';
import { CabecalhoTela, TemplateTela, TituloSecao } from '../../../../src/ui/organismos';
import { textos } from '../../../../src/textos';

const MOTIVOS = Object.entries(textos.motivo).map(([valor, rotulo]) => ({ valor: valor as MotivoJustificativa, rotulo }));

export default function Justificar() {
  const { id, pontoId, motivo: motivoInicial } = useLocalSearchParams<{ id: string; pontoId: string; motivo?: MotivoJustificativa }>();
  const p = useConsulta(async () => (await pontosDaRonda(id)).find((x) => x.pontoRondaId === pontoId), [id, pontoId]);
  const [motivo, setMotivo] = useState<MotivoJustificativa | null>(motivoInicial ?? null);
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const faltam = Math.max(0, DESCRICAO_MINIMA_JUSTIFICATIVA - descricao.trim().length);

  if (!p) return <TemplateTela><View /></TemplateTela>;

  const salvar = async () => {
    if (!motivo || faltam) return;
    setSalvando(true);
    try {
      await justificarPonto(id, pontoId, p.ponto.nome, motivo, descricao.trim());
      retorno.acao();
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setSalvando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TemplateTela
        cabecalho={<CabecalhoTela voltar titulo={textos.justificar.titulo} subtitulo={p.ponto.nome} />}
        barra={<Botao variante="aviso" titulo={textos.justificar.salvar} onPress={salvar} carregando={salvando} desabilitado={!motivo || faltam > 0} />}
      >
        {erro ? <AvisoInline tipo="erro" texto={erro} /> : null}
        <TituloSecao>{textos.justificar.motivo}</TituloSecao>
        <SeletorOpcoes opcoes={MOTIVOS} valor={motivo} onChange={setMotivo} />
        <TituloSecao>{textos.justificar.descricao}</TituloSecao>
        <Campo multiline value={descricao} onChangeText={setDescricao} maxLength={1000} contador={faltam ? textos.justificar.faltam(faltam) : undefined} />
      </TemplateTela>
    </KeyboardAvoidingView>
  );
}
