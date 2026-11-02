// Gera a atualização automática (só JS/telas) no formato do expo-updates, pronta para o GitHub Pages.
// Uso: node scripts/publicar-atualizacao.mjs [pasta-de-saida]   (padrão: ../../site)
// O app procura <site>/updates/android/manifest.json ao abrir (app.config.ts → updates.url).
import { execSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const saida = path.resolve(process.argv[2] ?? path.join(raiz, '..', '..', 'site'));
const base = (process.env.APP_UPDATES_BASE ?? 'https://g-e-i-c-i-s.github.io/PainKiller').replace(/\/$/, '');

const config = JSON.parse(execSync('npx expo config --json --type public', { cwd: raiz, encoding: 'utf8' }));
const runtimeVersion = config.runtimeVersion;
if (typeof runtimeVersion !== 'string') throw new Error('runtimeVersion precisa ser um texto fixo no app.config.ts');

const dist = path.join(raiz, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
execSync('npx expo export --platform android --output-dir dist', { cwd: raiz, stdio: 'inherit' });

const id = randomUUID();
const pastaUpdate = path.join(saida, 'updates', 'android', id);
const meta = JSON.parse(fs.readFileSync(path.join(dist, 'metadata.json'), 'utf8')).fileMetadata.android;

const hash = (buf) => createHash('sha256').update(buf).digest('base64url');
const tipos = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', wav: 'audio/wav', ttf: 'font/ttf', otf: 'font/otf', json: 'application/json' };

function copiar(rel) {
  const buf = fs.readFileSync(path.join(dist, rel));
  const destino = path.join(pastaUpdate, rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, buf);
  return { buf, url: `${base}/updates/android/${id}/${rel.split(path.sep).join('/')}` };
}

const bundle = copiar(meta.bundle);
const manifesto = {
  id,
  createdAt: new Date().toISOString(),
  runtimeVersion,
  launchAsset: { key: hash(bundle.buf), contentType: 'application/javascript', url: bundle.url, hash: hash(bundle.buf) },
  assets: meta.assets.map((a) => {
    const c = copiar(a.path);
    return { key: hash(c.buf), fileExtension: `.${a.ext}`, contentType: tipos[a.ext] ?? 'application/octet-stream', url: c.url, hash: hash(c.buf) };
  }),
  metadata: {},
  // expoClient vira o Constants.expoConfig do app depois de atualizado (ambiente, apiUrl, simulador).
  extra: { expoClient: config, versao: config.version },
};

fs.writeFileSync(path.join(saida, 'updates', 'android', 'manifest.json'), JSON.stringify(manifesto));
fs.writeFileSync(path.join(saida, '.nojekyll'), '');
// APK atual: o app compara com o próprio versionCode e oferece baixar e instalar (ícone, permissões, libs nativas).
// O arquivo fica num release do GitHub com a tag apk-v<versionCode> (gh release create apk-vN guardiao.apk).
const repo = process.env.APP_REPO ?? 'G-E-I-C-I-S/PainKiller';
const versionCode = config.android?.versionCode ?? 1;
const notas = JSON.parse(fs.readFileSync(path.join(raiz, 'scripts', 'apk-notas.json'), 'utf8'));
fs.writeFileSync(
  path.join(saida, 'updates', 'android', 'apk.json'),
  JSON.stringify({ versionCode, versao: config.version, url: `https://github.com/${repo}/releases/download/apk-v${versionCode}/guardiao.apk`, itens: notas.itens }),
);
console.log(`Atualização ${id} (runtime ${runtimeVersion}) gerada em ${saida}`);
