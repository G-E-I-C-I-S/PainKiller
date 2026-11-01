// Leitura NFC durante a Execução da ronda (docs/08 · 8.1 e UC05).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { leitorNfcReal, registrarOuvinteSimulado, type DisponibilidadeNfc } from '../core/nfc/LeitorNfc';
import type { LeituraNfc } from '../core/nfc/parser';
import { obterPosicaoNoEvento } from '../core/localizacao';
import { retorno as sinal } from '../core/retorno';
import { configuracao, pontoDaTag, pontosDaRonda, ronda as lerRonda } from '../dados/repositorios';
import { avaliarLeitura, classificarGeo, INTERVALO_RELEITURA_MS, progresso } from '../dominio/regras';
import type { SituacaoPonto } from '../dominio/tipos';
import { registrarVisita } from './acoes';
import { useSessao } from './sessao';
import { textos } from '../textos';
import type { Retorno } from '../ui/organismos';

/** aoAceitar recebe o ponto registrado; a tela leva o vigilante para 'Ponto registrado'. */
export function useLeituraRonda(rondaId: string, aoAceitar: (pontoRondaId: string, foraDaOrdem: boolean) => void) {
  const { registrarAtividade } = useSessao();
  const [nfc, setNfc] = useState<DisponibilidadeNfc | 'VERIFICANDO'>('VERIFICANDO');
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const ultima = useRef<{ uid: string; em: number } | null>(null);
  const ocupado = useRef(false);

  const aoLer = useCallback(
    async (l: LeituraNfc) => {
      registrarAtividade();
      const agora = Date.now();
      if (ultima.current && ultima.current.uid === l.uidHex && agora - ultima.current.em < INTERVALO_RELEITURA_MS) return;
      ultima.current = { uid: l.uidHex, em: agora };
      if (ocupado.current) return;
      ocupado.current = true;
      try {
        const r = await lerRonda(rondaId);
        if (!r || r.status !== 'EM_ANDAMENTO') return;
        const pontos = await pontosDaRonda(rondaId);
        const situacao = new Map<string, SituacaoPonto>(pontos.map((p) => [p.pontoRondaId, p.situacao]));
        const resultado = avaliarLeitura(l.pontoGravado?.pontoId ?? (await pontoDaTag(l.uidHex)), pontos, situacao, r.exigeOrdem);
        if (resultado.tipo === 'NAO_RECONHECIDA' || resultado.tipo === 'FORA_DO_ROTEIRO') {
          sinal.recusa();
          setRetorno({ tipo: 'ERRO', texto: resultado.tipo === 'NAO_RECONHECIDA' ? `${textos.execucao.naoReconhecida}\n${l.uidHex}` : textos.execucao.foraDoRoteiro });
          return;
        }
        if (resultado.tipo === 'JA_REGISTRADO') {
          sinal.jaRegistrado();
          setRetorno({ tipo: 'INFO', texto: textos.execucao.jaRegistrado });
          return;
        }
        const alvo = pontos.find((p) => p.pontoRondaId === resultado.pontoRondaId)!;
        const cfg = await configuracao();
        if (cfg.politicaGeo === 'SINALIZAR') sinal.leituraAceita(); // vibração antes da posição (meta de 1 s)
        const pos = await obterPosicaoNoEvento(cfg.precisaoMaximaM);
        const geo = classificarGeo(pos, alvo.ponto, alvo.predio, cfg);
        if (cfg.politicaGeo === 'BLOQUEAR' && geo === 'FORA_AREA') {
          sinal.recusa();
          setRetorno({ tipo: 'ERRO', texto: textos.execucao.foraDaArea });
          return;
        }
        if (cfg.politicaGeo === 'BLOQUEAR') sinal.leituraAceita();
        await registrarVisita({
          rondaId,
          pontoRondaId: alvo.pontoRondaId,
          pontoNome: alvo.ponto.nome,
          leitura: l,
          localizacao: pos,
          resultadoGeo: geo,
          foraDaOrdem: resultado.foraDaOrdem,
        });
        situacao.set(alvo.pontoRondaId, 'VISITADO');
        if (progresso(pontos, situacao).completa) sinal.rondaCompleta();
        else sinal.sucessoGravado();
        aoAceitar(alvo.pontoRondaId, resultado.foraDaOrdem);
      } catch {
        sinal.falhaLeitura();
        setRetorno({ tipo: 'AVISO', texto: textos.execucao.falhaLeitura });
      } finally {
        ocupado.current = false;
      }
    },
    [rondaId, registrarAtividade, aoAceitar],
  );

  const ligar = useCallback(async () => {
    registrarOuvinteSimulado(aoLer);
    const d = await leitorNfcReal.disponivel();
    setNfc(d);
    if (d === 'OK' && Platform.OS === 'android') {
      await leitorNfcReal.iniciar(aoLer, (e) => {
        if (e.codigo === 'NFC_DESLIGADO') setNfc('NFC_DESLIGADO');
        else {
          sinal.falhaLeitura();
          setRetorno({ tipo: 'AVISO', texto: textos.execucao.falhaLeitura });
        }
      });
    }
  }, [aoLer]);

  // Leitor ativo só com a tela em foco e o app em primeiro plano.
  useFocusEffect(
    useCallback(() => {
      ligar();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') ligar();
        else leitorNfcReal.parar();
      });
      return () => {
        sub.remove();
        registrarOuvinteSimulado(null);
        leitorNfcReal.parar();
      };
    }, [ligar]),
  );

  // iOS: 1 toque por ponto (folha de leitura do sistema).
  const lerNoIos = useCallback(() => leitorNfcReal.iniciar(aoLer, () => {}), [aoLer]);
  // Leitura por QR Code (aba QR da tela Ler ponto): o código impresso é o identificador da tag.
  const lerCodigo = useCallback(
    (codigo: string) => aoLer({ uidHex: codigo.replace(/[^0-9a-fA-F]/g, '').toUpperCase() || codigo, payloadNfc: `QR:${codigo}`, tipo: 'NTAG215_LEGADA', lidaEm: new Date() }),
    [aoLer],
  );

  useEffect(() => () => registrarOuvinteSimulado(null), []);

  return { nfc, retorno, fecharRetorno: useCallback(() => setRetorno(null), []), religar: ligar, lerNoIos, lerCodigo };
}
