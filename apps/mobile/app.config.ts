import type { ExpoConfig } from 'expo/config';

type Ambiente = 'desenvolvimento' | 'homologacao' | 'producao';

const ambiente = (process.env.APP_AMBIENTE ?? 'desenvolvimento') as Ambiente;

const porAmbiente: Record<Ambiente, { nome: string; id: string; apiUrl: string; leitorSimulado: boolean }> = {
  desenvolvimento: {
    nome: 'Guardião (dev)',
    id: 'br.edu.ifsuldeminas.guardiao.dev',
    apiUrl: process.env.APP_API_URL ?? '',
    leitorSimulado: true,
  },
  homologacao: {
    nome: 'Guardião (hml)',
    id: 'br.edu.ifsuldeminas.guardiao.hml',
    apiUrl: process.env.APP_API_URL ?? '',
    leitorSimulado: true,
  },
  producao: {
    nome: 'Guardião',
    id: 'br.edu.ifsuldeminas.guardiao',
    apiUrl: process.env.APP_API_URL ?? '',
    leitorSimulado: false,
  },
};

const atual = porAmbiente[ambiente];

const config: ExpoConfig = {
  name: atual.nome,
  slug: 'guardiao',
  scheme: 'guardiao',
  version: '0.3.0',
  // Mude o runtimeVersion SEMPRE que mudar algo nativo (lib nova, permissão, plugin): aí precisa de APK novo.
  // Mudança só de telas/JS vai pelo atualizador automático (scripts/publicar-atualizacao.mjs).
  runtimeVersion: '0.3.0',
  updates: {
    url: process.env.APP_UPDATES_URL ?? 'https://g-e-i-c-i-s.github.io/PainKiller/updates/android/manifest.json',
    checkAutomatically: 'NEVER',
    fallbackToCacheTimeout: 0,
  },
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#0E141B',
  ios: {
    bundleIdentifier: atual.id,
    infoPlist: {
      NFCReaderUsageDescription: 'O Guardião lê as tags NFC dos pontos de ronda.',
    },
  },
  android: {
    package: atual.id,
    versionCode: 3,
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: '#0E141B',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.NFC',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.CAMERA',
      'android.permission.VIBRATE',
      'android.permission.USE_BIOMETRIC',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.REQUEST_INSTALL_PACKAGES',
    ],
    blockedPermissions: [
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-updates',
    ['expo-sqlite', { useSQLCipher: true }],
    'expo-secure-store',
    'expo-audio',
    ['expo-camera', { cameraPermission: 'O Guardião usa a câmera para fotografar ocorrências.', recordAudioAndroid: false }],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'A localização é registrada só ao iniciar e finalizar a ronda, ler uma tag, justificar um ponto e registrar uma ocorrência.',
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    ['expo-local-authentication', { faceIDPermission: 'Use o Face ID para desbloquear o Guardião.' }],
    ['react-native-nfc-manager', { nfcPermission: 'O Guardião lê as tags NFC dos pontos de ronda.' }],
    ['expo-build-properties', { android: { usesCleartextTraffic: ambiente !== 'producao' } }],
    ['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#0E141B', imageWidth: 180 }],
    './plugins/withNfcObrigatorio',
  ],
  experiments: { typedRoutes: false },
  extra: {
    ambiente,
    apiUrl: atual.apiUrl,
    leitorSimulado: atual.leitorSimulado,
  },
};

export default config;
