// Motor de sincronização online-first (docs/06): envia a fila em ordem, em lotes, com backoff; depois as fotos.
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { db, transacao, kvGravar, kvLer, notificarMudanca, registrarErro } from '../dados/banco';
import { aplicarPacote, aplicarRondas, type PacoteOffline, type RondaApi } from '../dados/pacote';
import { apiUrl } from '../core/config';
import { chamar, ErroApi } from '../core/api/cliente';
import { base64ParaBytes } from '../core/camera';

const LOTE = 50;
const INTERVALO_MS = 60_000;

let rodando = false;
let pedido = false;
let online = true;
let ativo = false;

type Resultado = { id: string; resultado: 'ACEITO' | 'DUPLICADO' } | { id: string; resultado: 'REJEITADO'; codigo: string; mensagem: string };

const backoffMs = (tentativas: number) => Math.min(15 * 60_000, 5_000 * 2 ** tentativas);

async function enviarEventos() {
  for (;;) {
    const agora = new Date().toISOString();
    const linhas = await db().getAllAsync<{ id: string; payload: string; tentativas: number }>(
      `SELECT id, payload, tentativas FROM fila_eventos
        WHERE status = 'PENDENTE' AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?)
        ORDER BY seq LIMIT ?`,
      agora,
      LOTE,
    );
    if (linhas.length === 0) return;
    let resp;
    try {
      resp = await chamar<{ resultados: Resultado[] } | Resultado[]>('/sincronizacao/eventos', {
        metodo: 'POST',
        corpo: { eventos: linhas.map((l) => JSON.parse(l.payload)) },
        headers: { 'X-Enviado-Em-Dispositivo': new Date().toISOString() },
      });
    } catch (e) {
      // Falha do lote inteiro (rede, 5xx): agenda nova tentativa com backoff.
      for (const l of linhas) {
        await db().runAsync(
          'UPDATE fila_eventos SET tentativas = tentativas + 1, proxima_tentativa_em = ? WHERE id = ?',
          new Date(Date.now() + backoffMs(l.tentativas)).toISOString(),
          l.id,
        );
      }
      throw e;
    }
    const resultados = Array.isArray(resp.dados) ? resp.dados : resp.dados.resultados;
    const enviadoEm = new Date().toISOString();
    await transacao(async (tx) => {
      for (const r of resultados) {
        if (r.resultado === 'REJEITADO') {
          await tx.runAsync(
            "UPDATE fila_eventos SET status = 'REJEITADO', codigo_erro = ?, mensagem_erro = ?, enviado_em = ? WHERE id = ?",
            r.codigo, r.mensagem, enviadoEm, r.id,
          );
        } else {
          await tx.runAsync("UPDATE fila_eventos SET status = 'ACEITO', enviado_em = ? WHERE id = ?", enviadoEm, r.id);
        }
      }
    });
    notificarMudanca();
    if (linhas.length < LOTE) return;
  }
}

async function enviarFotos() {
  const fotos = await db().getAllAsync<{ id: string; ocorrencia_id: string; jpeg_base64: string; sha256: string; capturada_em: string }>(
    `SELECT f.id, f.ocorrencia_id, f.jpeg_base64, f.sha256, f.capturada_em FROM foto_local f
       JOIN fila_eventos e ON e.id = f.ocorrencia_id AND e.status = 'ACEITO'
      WHERE f.status_upload = 'PENDENTE' ORDER BY f.ocorrencia_id, f.ordem`,
  );
  for (const f of fotos) {
    const bytes = base64ParaBytes(f.jpeg_base64);
    try {
      await chamar(`/ocorrencias/${f.ocorrencia_id}/fotos/${f.id}`, {
        metodo: 'PUT',
        corpoBruto: bytes as unknown as BodyInit,
        headers: { 'Content-Type': 'image/jpeg', 'Content-SHA256': f.sha256, 'X-Capturada-Em-Dispositivo': f.capturada_em },
      });
      await db().runAsync("UPDATE foto_local SET status_upload = 'ENVIADA' WHERE id = ?", f.id);
    } catch (e) {
      if (e instanceof ErroApi && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 404) {
        await db().runAsync("UPDATE foto_local SET status_upload = 'REJEITADA' WHERE id = ?", f.id);
        registrarErro('foto', `${e.codigo}: ${e.message}`);
      } else throw e;
    }
    notificarMudanca();
  }
}

export async function atualizarReferencias() {
  const etag = await kvLer('pacote_etag');
  const r = await chamar<PacoteOffline>('/vigilante/pacote-offline', { headers: etag ? { 'If-None-Match': etag } : {} });
  if (r.status === 200 && r.dados) {
    await aplicarPacote(r.dados);
    await kvGravar('pacote_etag', r.headers.get('ETag'));
    await kvGravar('pacote_versao', r.dados.versao);
  }
  const hoje = new Date();
  const de = new Date(hoje.getTime() - 86_400_000).toISOString().slice(0, 10);
  const ate = new Date(hoje.getTime() + 86_400_000).toISOString().slice(0, 10);
  const rondas = await chamar<{ itens: RondaApi[] }>(`/vigilante/rondas?de=${de}&ate=${ate}`);
  await aplicarRondas(rondas.dados.itens);
}

export async function sincronizar(): Promise<void> {
  if (!apiUrl()) return;
  if (rodando) {
    pedido = true;
    return;
  }
  rodando = true;
  try {
    do {
      pedido = false;
      await enviarEventos();
      await enviarFotos();
      await atualizarReferencias();
      await kvGravar('ultima_sincronizacao', new Date().toISOString());
      notificarMudanca();
    } while (pedido);
  } catch (e) {
    if (!(e instanceof ErroApi && e.codigo === 'SEM_CONEXAO')) registrarErro('sincronizacao', e);
  } finally {
    rodando = false;
  }
}

export function pedirSincronizacao() {
  if (online && ativo) sincronizar();
}

/** Liga o motor: dispara ao voltar a rede, ao voltar ao app e a cada minuto. Devolve a função de desligar. */
export function ligarMotor(): () => void {
  ativo = true;
  const tiraRede = NetInfo.addEventListener((s) => {
    const agora = !!s.isConnected && s.isInternetReachable !== false;
    if (agora && !online) {
      // Rede voltou: libera os itens em backoff.
      db().runAsync("UPDATE fila_eventos SET proxima_tentativa_em = NULL WHERE status = 'PENDENTE'").finally(() => sincronizar());
    }
    online = agora;
  });
  const tiraApp = AppState.addEventListener('change', (s) => s === 'active' && pedirSincronizacao());
  const timer = setInterval(pedirSincronizacao, INTERVALO_MS);
  pedirSincronizacao();
  return () => {
    ativo = false;
    tiraRede();
    tiraApp.remove();
    clearInterval(timer);
  };
}

export async function sincronizarAgora() {
  await db().runAsync("UPDATE fila_eventos SET proxima_tentativa_em = NULL WHERE status = 'PENDENTE'");
  await sincronizar();
}

export const estaOnline = () => online;
