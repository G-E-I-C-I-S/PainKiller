// Roda a API no próprio PC, sem Docker: PostgreSQL embutido em .dados/pg, migrações, dados iniciais e a API.
// Uso: npm run dev            (porta 3000; o celular acessa http://<IP-do-PC>:3000/api/v1 na mesma rede Wi-Fi)
//      npm run dev -- --so-banco   (só o PostgreSQL, para rodar prisma migrate dev)
import EmbeddedPostgres from 'embedded-postgres';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const dados = path.join(raiz, '.dados');
const pasta = path.join(dados, 'pg');
const PORTA_PG = 5433;
const BANCO = 'guardiao_api';
fs.mkdirSync(dados, { recursive: true });

// Segredo do JWT gerado uma vez e guardado ao lado do banco.
const arqSegredo = path.join(dados, 'jwt-segredo');
if (!fs.existsSync(arqSegredo)) fs.writeFileSync(arqSegredo, crypto.randomUUID() + crypto.randomUUID());

const pg = new EmbeddedPostgres({ databaseDir: pasta, user: 'guardiao', password: 'guardiao', port: PORTA_PG, persistent: true });
const novo = !fs.existsSync(path.join(pasta, 'PG_VERSION'));
if (novo) await pg.initialise();
await pg.start();
await pg.createDatabase(BANCO).catch(() => {}); // já existe

const env = {
  ...process.env,
  DATABASE_URL: `postgresql://guardiao:guardiao@localhost:${PORTA_PG}/${BANCO}`,
  JWT_SEGREDO: fs.readFileSync(arqSegredo, 'utf8'),
  PORTA: process.env.PORTA ?? '3000',
  SEED_DEMO: process.env.SEED_DEMO ?? '1',
  PAINEL_DIR: process.env.PAINEL_DIR ?? path.resolve(raiz, '..', 'painel', 'dist'),
};

const parar = async () => {
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', parar);
process.on('SIGTERM', parar);

if (process.argv.includes('--so-banco')) {
  console.log(`PostgreSQL no ar: ${env.DATABASE_URL}`);
} else {
  const rodar = (cmd) => execSync(cmd, { cwd: raiz, env, stdio: 'inherit' });
  rodar('npx prisma migrate deploy');
  rodar('npx tsc -p tsconfig.build.json');
  rodar('node dist/seed.js');
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\nPainel:  http://localhost:${env.PORTA}`);
  for (const ip of ips) console.log(`No app (mesma rede Wi-Fi), campo Servidor:  http://${ip}:${env.PORTA}/api/v1`);
  const api = spawn(process.execPath, ['dist/main.js'], { cwd: raiz, env, stdio: 'inherit' });
  api.on('exit', parar);
}
