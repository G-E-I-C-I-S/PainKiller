// Diagnóstico (administrador): erros locais e exportação da fila para conciliação do piloto.
import { Share } from 'react-native';
import { db, useConsulta } from '../src/dados/banco';
import { contagemFila, errosRecentes } from '../src/dados/repositorios';
import { ambiente, apiUrl, versaoApp } from '../src/core/config';
import { Botao, Cartao, Texto } from '../src/ui/atomos';
import { CabecalhoTela, TemplateTela, TituloSecao } from '../src/ui/organismos';
import { hora, textos } from '../src/textos';

async function exportarFila() {
  const linhas = await db().getAllAsync('SELECT id, seq, tipo, status, tentativas, codigo_erro, criado_em, enviado_em, payload FROM fila_eventos ORDER BY seq');
  await Share.share({ title: 'fila-guardiao.json', message: JSON.stringify({ versaoApp, ambiente, exportadoEm: new Date().toISOString(), eventos: linhas }, null, 1) });
}

export default function Diagnostico() {
  const erros = useConsulta(errosRecentes) ?? [];
  const fila = useConsulta(contagemFila);
  return (
    <TemplateTela cabecalho={<CabecalhoTela voltar titulo={textos.diagnostico.titulo} />} barra={<Botao variante="secundario" titulo={textos.diagnostico.exportar} onPress={exportarFila} />}>
      <Cartao>
        <Texto variante="legenda" cor="textoSecundario">
          {versaoApp} · {ambiente} · {apiUrl() || 'modo local'}
        </Texto>
        <Texto>
          {textos.diagnostico.fila}: {fila?.pendentes ?? 0} pendentes · {fila?.rejeitados ?? 0} rejeitados · {fila?.fotosPendentes ?? 0} fotos
        </Texto>
      </Cartao>
      <TituloSecao>{textos.diagnostico.erros}</TituloSecao>
      {erros.length === 0 ? <Texto cor="textoSecundario">{textos.diagnostico.semErros}</Texto> : null}
      {erros.map((e, i) => (
        <Texto key={i} variante="legenda">
          {hora(e.em)} [{e.origem}] {e.mensagem}
        </Texto>
      ))}
    </TemplateTela>
  );
}
