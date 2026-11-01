// Localização SOMENTE no evento (RN19, RNF14). Único lugar do app que chama expo-location.
import * as Location from 'expo-location';
import type { Localizacao } from '../dominio/tipos';

const TEMPO_MAXIMO_MS = 5_000;

const converter = (p: Location.LocationObject): Localizacao => ({
  latitude: p.coords.latitude,
  longitude: p.coords.longitude,
  precisaoM: p.coords.accuracy ?? 9999,
  simulada: p.mocked === true,
});

export async function pedirPermissaoLocalizacao(): Promise<boolean> {
  const atual = await Location.getForegroundPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

export async function obterPosicaoNoEvento(precisaoMaximaM: number): Promise<Localizacao | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const recente = await Location.getLastKnownPositionAsync({ maxAge: 30_000, requiredAccuracy: precisaoMaximaM });
    if (recente) return converter(recente);
    const atual = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => setTimeout(() => r(null), TEMPO_MAXIMO_MS)),
    ]);
    return atual ? converter(atual) : null;
  } catch {
    return null;
  }
}
