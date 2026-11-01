// Moléculas (docs/09 · 7.1).
import { Pressable, View } from 'react-native';
import { useTema } from '../tema/Tema';
import { alvo, esp, raio, type Gravidade } from '../tema/tokens';
import { Texto } from './atomos';
import type { SituacaoPonto } from '../dominio/tipos';
import { textos } from '../textos';

const ICONE_SITUACAO: Record<SituacaoPonto | 'PROXIMO', string> = { PENDENTE: '○', PROXIMO: '●', VISITADO: '✓', JUSTIFICADO: '⚑' };

export function ItemPonto({
  nome,
  ordem,
  obrigatorio,
  situacao,
  proximo,
  auxiliar,
  onPress,
}: {
  nome: string;
  ordem?: number;
  obrigatorio: boolean;
  situacao: SituacaoPonto;
  proximo?: boolean;
  auxiliar?: string;
  onPress?: () => void;
}) {
  const { cores } = useTema();
  const cor = situacao === 'VISITADO' ? cores.sucesso : situacao === 'JUSTIFICADO' ? cores.aviso : proximo ? cores.primaria : cores.textoSecundario;
  const icone = proximo && situacao === 'PENDENTE' ? ICONE_SITUACAO.PROXIMO : ICONE_SITUACAO[situacao];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nome}, ${situacao.toLowerCase()}${obrigatorio ? '' : ', opcional'}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: alvo.minimo,
        flexDirection: 'row',
        alignItems: 'center',
        gap: esp[3],
        paddingVertical: esp[2],
        paddingHorizontal: esp[2],
        borderRadius: raio.pequeno,
        backgroundColor: pressed ? cores.superficieElevada : 'transparent',
      })}
    >
      <Texto variante="titulo" style={{ color: cor, width: 28, textAlign: 'center' }}>
        {icone}
      </Texto>
      <View style={{ flex: 1 }}>
        <Texto variante="corpoForte" numberOfLines={2}>
          {ordem != null ? `${ordem} ` : ''}
          {nome}
          {obrigatorio ? '' : '  (opcional)'}
        </Texto>
        {auxiliar ? (
          <Texto variante="legenda" cor="textoSecundario">
            {auxiliar}
          </Texto>
        ) : null}
      </View>
      {situacao === 'JUSTIFICADO' ? (
        <Texto variante="legenda" cor="aviso" style={{ fontWeight: '700' }}>
          {textos.execucao.justificado}
        </Texto>
      ) : proximo && situacao === 'PENDENTE' ? (
        <Texto variante="legenda" cor="primaria" style={{ fontWeight: '700' }}>
          {textos.execucao.proximo}
        </Texto>
      ) : null}
    </Pressable>
  );
}

export function BarraProgresso({ valor, total, atrasada }: { valor: number; total: number; atrasada?: boolean }) {
  const { cores } = useTema();
  const fracao = total ? valor / total : 0;
  const cor = fracao >= 1 ? cores.sucesso : atrasada ? cores.aviso : cores.primaria;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[3] }} accessibilityLabel={textos.execucao.progresso(valor, total)}>
      <View style={{ flex: 1, height: 12, borderRadius: raio.pilula, backgroundColor: cores.superficieElevada, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(fracao * 100)}%`, height: '100%', backgroundColor: cor }} />
      </View>
      <Texto variante="corpoForte">{textos.execucao.progresso(valor, total)}</Texto>
    </View>
  );
}

const GRAVIDADES: Gravidade[] = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

export function SeletorGravidade({ valor, onChange }: { valor: Gravidade; onChange: (g: Gravidade) => void }) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: esp[2] }}>
      {GRAVIDADES.map((g) => {
        const sel = g === valor;
        return (
          <Pressable
            key={g}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={textos.gravidade[g]}
            onPress={() => onChange(g)}
            style={{
              flex: 1,
              minHeight: alvo.minimo,
              borderRadius: raio.medio,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: cores.gravidade[g],
              backgroundColor: sel ? cores.gravidade[g] : 'transparent',
            }}
          >
            <Texto variante="legenda" style={{ fontWeight: '700', color: sel ? cores.textoSobreCor : cores.texto }}>
              {textos.gravidade[g]}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SeletorOpcoes<T extends string>({ opcoes, valor, onChange }: { opcoes: { valor: T; rotulo: string }[]; valor: T | null; onChange: (v: T) => void }) {
  const { cores } = useTema();
  return (
    <View style={{ gap: esp[2] }}>
      {opcoes.map((o) => {
        const sel = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            onPress={() => onChange(o.valor)}
            style={{
              minHeight: alvo.minimo,
              borderRadius: raio.medio,
              borderWidth: 2,
              borderColor: sel ? cores.primaria : cores.borda,
              backgroundColor: sel ? cores.superficieElevada : cores.superficie,
              justifyContent: 'center',
              paddingHorizontal: esp[4],
            }}
          >
            <Texto variante={sel ? 'corpoForte' : 'corpo'}>{(sel ? '● ' : '○ ') + o.rotulo}</Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AvisoInline({ tipo, texto, acao }: { tipo: 'info' | 'aviso' | 'erro' | 'sucesso'; texto: string; acao?: { titulo: string; onPress: () => void } }) {
  const { cores } = useTema();
  return (
    <View accessibilityRole="alert" style={{ borderLeftWidth: 4, borderLeftColor: cores[tipo], backgroundColor: cores.superficie, padding: esp[3], borderRadius: raio.pequeno, gap: esp[2] }}>
      <Texto>{texto}</Texto>
      {acao ? (
        <Pressable accessibilityRole="button" onPress={acao.onPress} style={{ minHeight: alvo.minimo, justifyContent: 'center' }}>
          <Texto variante="corpoForte" cor="primaria">
            {acao.titulo}
          </Texto>
        </Pressable>
      ) : null}
    </View>
  );
}

export function IndicadorSincronizacao({ pendentes, rejeitados, local, onPress }: { pendentes: number; rejeitados: number; local: boolean; onPress: () => void }) {
  const { cores } = useTema();
  const texto = rejeitados > 0 ? `☁! ${rejeitados}` : pendentes > 0 ? `☁ ${pendentes}` : '☁✓';
  const cor = rejeitados > 0 ? cores.erro : pendentes > 0 ? (local ? cores.textoSecundario : cores.aviso) : cores.sucesso;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Envio de registros: ${pendentes} pendentes, ${rejeitados} com problema`} onPress={onPress} hitSlop={8} style={{ minHeight: alvo.minimo, minWidth: alvo.minimo, alignItems: 'center', justifyContent: 'center' }}>
      <Texto variante="corpoForte" style={{ color: cor }}>
        {texto}
      </Texto>
    </Pressable>
  );
}
