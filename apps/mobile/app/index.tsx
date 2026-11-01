import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessao } from '../src/features/sessao';
import { iniciarRonda } from '../src/features/acoes';
import { pedirPermissaoLocalizacao } from '../src/core/localizacao';
import { retorno } from '../src/core/retorno';
import { useConsulta } from '../src/dados/banco';
import { contagemFila, pontosDaRonda, rondasDoTurno } from '../src/dados/repositorios';
import { criarRondasTeste } from '../src/dados/pacote';
import { estadoDaRonda, progresso, proximaRonda } from '../src/dominio/regras';
import type { Ronda } from '../src/dominio/tipos';
import { useTema } from '../src/tema/Tema';
import { alvo, esp, raio } from '../src/tema/tokens';
import { Botao, Texto } from '../src/ui/atomos';
import { AvisoInline, BarraProgresso, IndicadorSincronizacao } from '../src/ui/moleculas';
import { Avatar, BarraAbas, Painel, Rotulo } from '../src/ui/novos';
import { Icone } from '../src/ui/icones';
import { hora, textos } from '../src/textos';

function useAgora(ms = 30_000) {
  const [agora, setAgora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}

const horaCheia = (iso: string) => `${new Date(iso).getHours()}h`;

export default function Inicio() {
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  const { sessao } = useSessao();
  const agora = useAgora();
  const rondas = useConsulta(rondasDoTurno);
  const fila = useConsulta(contagemFila);
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const local = sessao?.modo === 'LOCAL';

  const proxima = rondas ? proximaRonda(rondas, agora) : null;
  const estado = proxima ? estadoDaRonda(proxima, agora) : null;
  const emAndamento = proxima?.status === 'EM_ANDAMENTO' ? proxima : null;
  const pontosAndamento = useConsulta(async () => (emAndamento ? pontosDaRonda(emAndamento.id) : null), [emAndamento?.id]);
  const prog = pontosAndamento ? progresso(pontosAndamento, new Map(pontosAndamento.map((p) => [p.pontoRondaId, p.situacao]))) : null;

  const ativas = (rondas ?? []).filter((r) => r.status !== 'CANCELADA');
  const turno = ativas.length ? `${horaCheia(ativas[0].inicioPrevisto)} – ${horaCheia(ativas[ativas.length - 1].fimPrevisto)}` : null;

  const iniciar = async (r: Ronda) => {
    setErro(null);
    if (r.status === 'EM_ANDAMENTO') return router.push(`/ronda/${r.id}`);
    setIniciando(true);
    try {
      await pedirPermissaoLocalizacao();
      await iniciarRonda(r.id, r.roteiroNome);
      retorno.acao();
      router.push(`/ronda/${r.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setIniciando(false);
    }
  };

  const outras = (rondas ?? []).filter((r) => r.id !== proxima?.id);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <ScrollView contentContainerStyle={{ padding: esp[4], paddingTop: ins.top + esp[4], gap: esp[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2] }}>
          <View style={{ flex: 1 }}>
            <Texto variante="legenda" cor="textoSecundario">
              {textos.inicio.saudacao(agora.getHours())},
            </Texto>
            <Texto variante="titulo">{sessao?.usuario.nome}</Texto>
          </View>
          {fila && !local ? <IndicadorSincronizacao pendentes={fila.pendentes} rejeitados={fila.rejeitados} local={local} onPress={() => router.push('/sincronizacao')} /> : null}
          <Avatar nome={sessao?.usuario.nome ?? ''} onPress={() => router.replace('/perfil')} />
        </View>

        {turno ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2], backgroundColor: cores.superficie, borderRadius: raio.medio, borderWidth: 1, borderColor: cores.borda, paddingHorizontal: esp[3], minHeight: 40 }}>
            <Icone nome="relogio" cor={cores.textoSecundario} tamanho={18} />
            <Texto variante="legenda">
              Turno <Texto variante="legenda" style={{ fontWeight: '700' }}>{turno}</Texto>
            </Texto>
          </View>
        ) : null}

        {local ? <AvisoInline tipo="info" texto={textos.inicio.modoLocal} /> : null}
        {erro ? <AvisoInline tipo="erro" texto={erro} /> : null}

        <Painel>
          {emAndamento ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2] }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cores.sucesso }} />
                <Rotulo cor="sucesso">RONDA EM ANDAMENTO</Rotulo>
              </View>
              <Texto variante="corpoForte">{emAndamento.roteiroNome}</Texto>
              {prog ? <BarraProgresso valor={prog.visitados} total={prog.total} /> : null}
              <Botao style={{ marginTop: esp[2] }} titulo="Continuar ronda" icone={(c) => <Icone nome="play" cor={c} tamanho={18} />} onPress={() => iniciar(emAndamento)} />
            </>
          ) : proxima && estado ? (
            <>
              <Rotulo>NENHUMA RONDA EM ANDAMENTO</Rotulo>
              <Texto>
                Próxima ronda prevista às <Texto style={{ fontWeight: '700' }}>{hora(proxima.inicioPrevisto)}</Texto>
              </Texto>
              <Texto variante="legenda" cor="textoSecundario">
                {proxima.roteiroNome} · {textos.inicio.pontos(proxima.totalPontos)}
              </Texto>
              <Botao
                style={{ marginTop: esp[2] }}
                titulo="Iniciar ronda"
                icone={(c) => <Icone nome="play" cor={c} tamanho={18} />}
                onPress={() => iniciar(proxima)}
                carregando={iniciando}
                desabilitado={estado.tipo === 'ANTES_DA_JANELA'}
                motivoDesabilitado={estado.tipo === 'ANTES_DA_JANELA' ? textos.inicio.disponivelAPartir(hora(estado.disponivelEm)) : undefined}
              />
            </>
          ) : rondas ? (
            <>
              <Rotulo>NENHUMA RONDA EM ANDAMENTO</Rotulo>
              <Texto cor="textoSecundario">{textos.inicio.nenhuma}</Texto>
              {local ? <Botao variante="secundario" titulo={textos.inicio.gerarRondaTeste} onPress={() => criarRondasTeste()} /> : null}
            </>
          ) : null}
        </Painel>

        {outras.length ? <Rotulo>{textos.inicio.rondasDoTurno}</Rotulo> : null}
        {outras.map((r) => {
          const e = estadoDaRonda(r, agora);
          const feita = e.tipo === 'FINALIZADA';
          const status =
            feita ? (r.status === 'INCOMPLETA' ? 'Incompleta' : 'Concluída') : e.tipo === 'CANCELADA' ? 'Cancelada' : e.tipo === 'JANELA_ENCERRADA' ? textos.inicio.janelaEncerrada : `${textos.inicio.pontos(r.totalPontos)}`;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => (feita ? router.push(`/ronda/${r.id}/resumo`) : e.tipo === 'DISPONIVEL' ? iniciar(r) : undefined)}
              style={{ minHeight: alvo.minimo, flexDirection: 'row', alignItems: 'center', gap: esp[3], backgroundColor: cores.superficie, borderRadius: raio.medio, paddingHorizontal: esp[3], paddingVertical: esp[2] }}
            >
              <Texto variante="mono" cor={feita ? 'sucesso' : 'textoSecundario'}>
                {hora(r.inicioPrevisto)}
              </Texto>
              <View style={{ flex: 1 }}>
                <Texto numberOfLines={1}>{r.roteiroNome}</Texto>
                <Texto variante="legenda" cor={r.status === 'INCOMPLETA' ? 'aviso' : 'textoSecundario'}>
                  {feita ? '✓ ' : ''}
                  {status}
                </Texto>
              </View>
            </Pressable>
          );
        })}
        {local && proxima ? <Botao variante="texto" titulo={textos.inicio.gerarRondaTeste} onPress={() => criarRondasTeste()} /> : null}
      </ScrollView>
      <BarraAbas ativa="inicio" />
    </View>
  );
}
