// Componentes das telas aprovadas (Telas.pdf): barra de abas, seletor em lista, caixa de marcação,
// alternador OK/Problema, grade de opções, cartão de número e avatar.
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../tema/Tema';
import { alvo, esp, raio } from '../tema/tokens';
import { Botao, Texto } from './atomos';
import { Icone, type NomeIcone } from './icones';

export function BarraAbas({ ativa }: { ativa: 'inicio' | 'perfil' }) {
  const { cores } = useTema();
  const ins = useSafeAreaInsets();
  const abas: { id: 'inicio' | 'perfil'; rotulo: string; icone: NomeIcone; rota: '/' | '/perfil' }[] = [
    { id: 'inicio', rotulo: 'Início', icone: 'casa', rota: '/' },
    { id: 'perfil', rotulo: 'Perfil', icone: 'pessoa', rota: '/perfil' },
  ];
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: cores.borda, backgroundColor: cores.fundo, paddingBottom: ins.bottom }}>
      {abas.map((a) => {
        const sel = a.id === ativa;
        const cor = sel ? cores.primaria : cores.textoSecundario;
        return (
          <Pressable
            key={a.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={a.rotulo}
            onPress={() => !sel && router.replace(a.rota)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 60, gap: 2 }}
          >
            <Icone nome={a.icone} cor={cor} tamanho={22} />
            <Texto variante="legenda" style={{ color: cor, fontWeight: '700', fontSize: 13 }}>
              {a.rotulo}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({ nome, onPress }: { nome: string; onPress?: () => void }) {
  const { cores } = useTema();
  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Perfil" onPress={onPress} style={{ width: alvo.minimo, height: alvo.minimo, borderRadius: alvo.minimo / 2, backgroundColor: cores.superficieElevada, borderWidth: 1, borderColor: cores.borda, alignItems: 'center', justifyContent: 'center' }}>
      <Texto variante="corpoForte" style={{ fontSize: 15 }}>
        {iniciais}
      </Texto>
    </Pressable>
  );
}

/** Campo que abre uma lista para escolher (substitui o "select" das telas). */
export function Seletor<T extends string>({ valor, opcoes, onChange, placeholder, titulo, link }: { valor: T | null; opcoes: { valor: T; rotulo: string }[]; onChange: (v: T) => void; placeholder?: string; titulo?: string; link?: string }) {
  const { cores } = useTema();
  const [aberto, setAberto] = useState(false);
  const atual = opcoes.find((o) => o.valor === valor);
  return (
    <>
      {link ? (
        <Pressable accessibilityRole="button" accessibilityLabel={titulo ?? link} onPress={() => setAberto(true)} hitSlop={10} style={{ minHeight: alvo.minimo, justifyContent: 'center' }}>
          <Texto variante="legenda" cor="primaria" style={{ fontWeight: '700' }}>
            {link}
          </Texto>
        </Pressable>
      ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={titulo ?? placeholder}
        onPress={() => setAberto(true)}
        style={{ minHeight: alvo.minimo, borderRadius: raio.medio, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.fundo, flexDirection: 'row', alignItems: 'center', paddingHorizontal: esp[3] }}
      >
        <Texto style={{ flex: 1 }} cor={atual ? 'texto' : 'textoSecundario'} numberOfLines={1}>
          {atual?.rotulo ?? placeholder ?? 'Escolher'}
        </Texto>
        <Texto cor="textoSecundario">▾</Texto>
      </Pressable>
      )}
      <Modal visible={aberto} transparent animationType="slide" onRequestClose={() => setAberto(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' }}>
          <View style={{ backgroundColor: cores.superficie, borderTopLeftRadius: raio.grande, borderTopRightRadius: raio.grande, padding: esp[4], maxHeight: '75%', gap: esp[2] }}>
            {titulo ? <Texto variante="titulo">{titulo}</Texto> : null}
            <ScrollView>
              {opcoes.map((o) => (
                <Pressable
                  key={o.valor}
                  onPress={() => {
                    onChange(o.valor);
                    setAberto(false);
                  }}
                  style={{ minHeight: alvo.minimo, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: cores.borda }}
                >
                  <Texto variante={o.valor === valor ? 'corpoForte' : 'corpo'} cor={o.valor === valor ? 'primaria' : 'texto'}>
                    {o.rotulo}
                  </Texto>
                </Pressable>
              ))}
            </ScrollView>
            <Botao variante="secundario" titulo="Cancelar" onPress={() => setAberto(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

export function CaixaMarcacao({ marcado, onChange, titulo, ajuda }: { marcado: boolean; onChange: (v: boolean) => void; titulo: string; ajuda?: string }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado }}
      onPress={() => onChange(!marcado)}
      style={{ flexDirection: 'row', gap: esp[3], alignItems: 'center', backgroundColor: cores.superficie, borderRadius: raio.medio, padding: esp[3], minHeight: alvo.minimo }}
    >
      <View style={{ width: 26, height: 26, borderRadius: raio.pequeno, borderWidth: 2, borderColor: marcado ? cores.sucesso : cores.borda, backgroundColor: marcado ? cores.sucesso : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {marcado ? <Icone nome="check" cor={cores.textoSobreCor} tamanho={18} espessura={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Texto variante="corpoForte">{titulo}</Texto>
        {ajuda ? (
          <Texto variante="legenda" cor="textoSecundario">
            {ajuda}
          </Texto>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Linha do checklist "Como está o local?" com OK / Problema. */
export function LinhaOkProblema({ rotulo, ok, onChange }: { rotulo: string; ok: boolean; onChange: (ok: boolean) => void }) {
  const { cores } = useTema();
  const botao = (sel: boolean, cor: string, texto: string, valor: boolean) => (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: sel }}
      accessibilityLabel={`${rotulo}: ${texto}`}
      onPress={() => onChange(valor)}
      style={{ minHeight: alvo.minimo - 4, minWidth: valor ? 56 : 92, paddingHorizontal: esp[3], borderRadius: raio.medio, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? cor : cores.superficieElevada }}
    >
      <Texto variante="legenda" style={{ fontWeight: '700', color: sel ? cores.textoSobreCor : cores.textoSecundario }}>
        {texto}
      </Texto>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: esp[2], backgroundColor: cores.superficie, borderRadius: raio.medio, padding: esp[3], borderWidth: 1, borderColor: ok ? cores.borda : cores.erro }}>
      <Texto variante="corpoForte" style={{ flex: 1 }}>
        {rotulo}
      </Texto>
      {botao(ok, cores.sucesso, 'OK', true)}
      {botao(!ok, cores.erro, 'Problema', false)}
    </View>
  );
}

/** Grade de 2 colunas de opções (tipos de ocorrência). */
export function GradeOpcoes<T extends string>({ opcoes, valor, onChange }: { opcoes: { valor: T; rotulo: string }[]; valor: T | null; onChange: (v: T) => void }) {
  const { cores } = useTema();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: esp[2] }}>
      {opcoes.map((o) => {
        const sel = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            onPress={() => onChange(o.valor)}
            style={{ width: '48.5%', minHeight: alvo.minimo, borderRadius: raio.medio, borderWidth: 1.5, borderColor: sel ? cores.erro : cores.borda, backgroundColor: sel ? '#3A1F16' : cores.superficie, justifyContent: 'center', paddingHorizontal: esp[3] }}
          >
            <Texto variante="legenda" style={{ fontWeight: '700', color: sel ? cores.erro : cores.texto }}>
              {o.rotulo}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CartaoNumero({ valor, total, rotulo, cor }: { valor: number; total?: number; rotulo: string; cor?: 'erro' | 'texto' }) {
  const { cores } = useTema();
  return (
    <View style={{ flex: 1, backgroundColor: cores.superficie, borderRadius: raio.grande, borderWidth: 1, borderColor: cores.borda, padding: esp[4], gap: esp[1] }}>
      <Texto>
        <Texto variante="tituloGrande" cor={cor ?? 'texto'} style={{ fontFamily: 'monospace' }}>
          {valor}
        </Texto>
        {total != null ? (
          <Texto variante="corpoForte" cor="textoSecundario" style={{ fontFamily: 'monospace' }}>
            /{total}
          </Texto>
        ) : null}
      </Texto>
      <Texto variante="legenda" cor="textoSecundario">
        {rotulo}
      </Texto>
    </View>
  );
}

export function Painel({ children, cor }: { children: ReactNode; cor?: string }) {
  const { cores } = useTema();
  return <View style={{ backgroundColor: cor ?? cores.superficie, borderRadius: raio.grande, borderWidth: 1, borderColor: cores.borda, padding: esp[4], gap: esp[2] }}>{children}</View>;
}

export function Rotulo({ children, cor }: { children: ReactNode; cor?: 'textoSecundario' | 'sucesso' | 'primaria' | 'aviso' }) {
  return (
    <Texto variante="rotulo" cor={cor ?? 'textoSecundario'}>
      {children}
    </Texto>
  );
}
