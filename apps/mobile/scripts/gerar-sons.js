// Gera os sons curtos de retorno (assets/sons/*.wav). Rode com: node scripts/gerar-sons.js
const fs = require('fs');
const path = require('path');

const TAXA = 22050;

function wav(notas) {
  const amostras = [];
  for (const [freq, ms] of notas) {
    const n = Math.round((TAXA * ms) / 1000);
    for (let i = 0; i < n; i++) {
      const envelope = Math.min(1, i / 200, (n - i) / 400);
      amostras.push(freq ? Math.sin((2 * Math.PI * freq * i) / TAXA) * 0.6 * envelope : 0);
    }
  }
  const dados = Buffer.alloc(amostras.length * 2);
  amostras.forEach((a, i) => dados.writeInt16LE(Math.round(a * 32767), i * 2));
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0);
  cab.writeUInt32LE(36 + dados.length, 4);
  cab.write('WAVEfmt ', 8);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(TAXA, 24);
  cab.writeUInt32LE(TAXA * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write('data', 36);
  cab.writeUInt32LE(dados.length, 40);
  return Buffer.concat([cab, dados]);
}

const pasta = path.join(__dirname, '..', 'assets', 'sons');
fs.mkdirSync(pasta, { recursive: true });
fs.writeFileSync(path.join(pasta, 'sucesso.wav'), wav([[880, 90], [1320, 140]]));
fs.writeFileSync(path.join(pasta, 'erro.wav'), wav([[220, 220], [0, 60], [180, 260]]));
fs.writeFileSync(path.join(pasta, 'conclusao.wav'), wav([[660, 120], [880, 120], [1320, 260]]));
console.log('Sons gerados em', pasta);
