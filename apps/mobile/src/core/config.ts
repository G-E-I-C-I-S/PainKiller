// Configuração por ambiente (app.config.ts → expo-constants) e endereço do servidor escolhido no login.
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const extra = (Constants.expoConfig?.extra ?? {}) as { ambiente?: string; apiUrl?: string; leitorSimulado?: boolean };

export const ambiente = extra.ambiente ?? 'desenvolvimento';
export const leitorSimuladoDisponivel = extra.leitorSimulado === true;
export const versaoApp = Constants.expoConfig?.version ?? '0.0.0';

let apiUrlAtual: string | null = null;

export async function carregarApiUrl(): Promise<string> {
  if (apiUrlAtual === null) apiUrlAtual = (await SecureStore.getItemAsync('api_url')) ?? extra.apiUrl ?? '';
  return apiUrlAtual;
}

export async function definirApiUrl(url: string) {
  apiUrlAtual = url.trim().replace(/\/+$/, '');
  await SecureStore.setItemAsync('api_url', apiUrlAtual);
}

/** Sem endereço de servidor = modo local (teste sem API). */
export const apiUrl = () => apiUrlAtual ?? '';
