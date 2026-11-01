// Botão flutuante do leitor simulado (dev e homologação): escolhe uma tag do pacote e dispara a leitura.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { leitorSimuladoDisponivel } from '../core/config';
import { simularLeitura } from '../core/nfc/LeitorNfc';
import { useConsulta } from '../dados/banco';
import { tags } from '../dados/repositorios';
import { useTema } from '../tema/Tema';
import { alvo, esp, raio } from '../tema/tokens';
import { Botao, Texto } from '../ui/atomos';
import { textos } from '../textos';

export function SimuladorNfc({ inferior = 140 }: { inferior?: number }) {
  const { cores } = useTema();
  const [aberto, setAberto] = useState(false);
  const lista = useConsulta(tags, [aberto]);
  if (!leitorSimuladoDisponivel) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={textos.execucao.simular}
        onPress={() => setAberto(true)}
        style={{ position: 'absolute', right: esp[4], bottom: inferior, backgroundColor: cores.superficieElevada, borderColor: cores.borda, borderWidth: 1, borderRadius: raio.pilula, paddingHorizontal: esp[4], minHeight: alvo.minimo, justifyContent: 'center' }}
      >
        <Texto variante="legenda" style={{ fontWeight: '700' }}>
          📶 {textos.execucao.simular}
        </Texto>
      </Pressable>
      <Modal visible={aberto} transparent animationType="slide" onRequestClose={() => setAberto(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
          <View style={{ backgroundColor: cores.superficie, borderTopLeftRadius: raio.grande, borderTopRightRadius: raio.grande, padding: esp[4], maxHeight: '70%', gap: esp[2] }}>
            <Texto variante="titulo">{textos.execucao.escolhaTag}</Texto>
            <ScrollView>
              {[...(lista ?? []), { uidHex: 'FFFFFFFFFFFFFF', pontoNome: textos.execucao.naoReconhecida, predioNome: null }].map((t) => (
                <Pressable
                  key={t.uidHex}
                  onPress={() => {
                    setAberto(false);
                    simularLeitura(t.uidHex);
                  }}
                  style={{ minHeight: alvo.minimo, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: cores.borda }}
                >
                  <Texto variante="corpoForte">{t.pontoNome}</Texto>
                  <Texto variante="legenda" cor="textoSecundario">
                    {[t.predioNome, t.uidHex].filter(Boolean).join(' · ')}
                  </Texto>
                </Pressable>
              ))}
            </ScrollView>
            <Botao variante="secundario" titulo={textos.geral.cancelar} onPress={() => setAberto(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
