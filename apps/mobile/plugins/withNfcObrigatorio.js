// Declara o NFC como obrigatório no manifesto (impede instalação pela loja em aparelhos sem NFC).
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNfcObrigatorio(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = manifest['uses-feature'] ?? [];
    if (!features.some((f) => f.$['android:name'] === 'android.hardware.nfc')) {
      features.push({ $: { 'android:name': 'android.hardware.nfc', 'android:required': 'true' } });
    }
    manifest['uses-feature'] = features;
    return cfg;
  });
};
