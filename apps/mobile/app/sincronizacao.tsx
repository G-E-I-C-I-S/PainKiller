import { useState } from 'react';
import { View } from 'react-native';
import { kvLer, useConsulta } from '../src/dados/banco';
import { fila, type ItemFila } from '../src/dados/repositorios';
import { useSessao } from '../src/features/sessao';
import { estaOnline, sincronizarAgora } from '../src/features/sincronizacao';
import { Botao, Texto } from '../src/ui/atomos';
import { AvisoInline } from '../src/ui/moleculas';
import { CabecalhoTela, TemplateTela, TituloSecao } from '../src/ui/organismos';
import { esp } from '../src/tema/tokens';
import { hora, textos } from '../src/textos';

function Item({ i, marca, cor }: { i: ItemFila; marca: string; cor: 'erro' | 'textoSecundario' | 'sucesso' }) {
  return (
    <View style={{ flexDirection: 'row', gap: esp[2], paddingVertical: esp[1] }}>
      <Texto cor={cor}>{marca}</Texto>
      <View style={{ flex: 1 }}>
        <Texto>
          {textos.evento[i.tipo]} · {i.resumo}
        </Texto>
        {i.status === 'REJEITADO' ? (
          <Texto variante="legenda" cor="erro">
            {(i.codigoErro && textos.rejeicao[i.codigoErro]) || i.mensagemErro} {textos.sync.avise}
          </Texto>
        ) : null}
      </View>
    </View>
  );
}

export default function Sincronizacao() {
  const { sessao } = useSessao();
  const itens = useConsulta(fila) ?? [];
  const ultima = useConsulta(() => kvLer('ultima_sincronizacao'));
  const [enviando, setEnviando] = useState(false);
  const local = sessao?.modo === 'LOCAL';
  const rejeitados = itens.filter((i) => i.status === 'REJEITADO');
  const pendentes = itens.filter((i) => i.status === 'PENDENTE');
  const aceitos = itens.filter((i) => i.status === 'ACEITO').slice(0, 20);

  return (
    <TemplateTela
      cabecalho={<CabecalhoTela voltar titulo={textos.sync.titulo} semSync />}
      barra={local ? undefined : <Botao titulo={textos.sync.sincronizar} carregando={enviando} onPress={() => { setEnviando(true); sincronizarAgora().finally(() => setEnviando(false)); }} />}
    >
      {local ? <AvisoInline tipo="info" texto={textos.sync.modoLocal} /> : !estaOnline() ? <AvisoInline tipo="aviso" texto={textos.sync.semRede} /> : null}
      {!local ? <Texto cor="textoSecundario">{ultima ? textos.sync.ultima(hora(ultima)) : textos.sync.nunca}</Texto> : null}
      {rejeitados.length ? <TituloSecao>{textos.sync.atencao(rejeitados.length)}</TituloSecao> : null}
      {rejeitados.map((i) => <Item key={i.id} i={i} marca="✕" cor="erro" />)}
      <TituloSecao>{textos.sync.aguardando(pendentes.length)}</TituloSecao>
      {pendentes.length ? pendentes.map((i) => <Item key={i.id} i={i} marca="•" cor="textoSecundario" />) : <Texto cor="textoSecundario">{textos.sync.vazio}</Texto>}
      {aceitos.length ? <TituloSecao>{textos.sync.enviados(aceitos.length)}</TituloSecao> : null}
      {aceitos.map((i) => <Item key={i.id} i={i} marca="✓" cor="sucesso" />)}
    </TemplateTela>
  );
}
