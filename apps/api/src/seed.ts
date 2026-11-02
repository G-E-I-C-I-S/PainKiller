// Dados iniciais. Roda em toda subida e só cria o que falta.
// SEED_DEMO=1 (uso local): usuários de teste com senha 1234, prédios, pontos, roteiro e agenda de exemplo.
// Sem SEED_DEMO (produção): só o campus e o administrador, com senha temporária mostrada uma única vez.
import { PrismaClient, type Gravidade } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { uuidv7 } from 'uuidv7';

const db = new PrismaClient();
const demo = process.env.SEED_DEMO === '1';

async function main() {
  if (await db.campus.count()) return;
  const campus = await db.campus.create({ data: { id: uuidv7(), nome: process.env.CAMPUS_NOME ?? 'IF Sul de Minas · Muzambinho' } });
  const usuario = async (nome: string, matricula: string, papel: 'VIGILANTE' | 'COORDENADOR' | 'ADMINISTRADOR', senha: string, trocar: boolean) =>
    db.usuario.create({ data: { id: uuidv7(), campusId: campus.id, nome, matricula, papel, senhaHash: await bcrypt.hash(senha, 10), deveTrocarSenha: trocar } });

  const tipos: [string, Gravidade][] = [
    ['Porta aberta', 'MEDIA'], ['Janela aberta', 'MEDIA'], ['Luz acesa', 'BAIXA'], ['Equipamento ligado', 'BAIXA'],
    ['Pessoas no local', 'ALTA'], ['Dano / vandalismo', 'ALTA'], ['Vazamento', 'ALTA'], ['Outro', 'MEDIA'],
  ];
  await db.tipoOcorrencia.createMany({ data: tipos.map(([nome, g], i) => ({ id: uuidv7(), campusId: campus.id, nome, gravidadePadrao: g, ordemExibicao: i + 1 })) });

  if (!demo) {
    const senha = String(randomInt(10_000_000, 100_000_000));
    await usuario('Administrador', 'admin', 'ADMINISTRADOR', senha, true);
    console.log(`\n>>> Administrador criado. Matrícula: admin  Senha temporária: ${senha}  (troque no primeiro acesso)\n`);
    return;
  }

  await usuario('Administrador de Teste', 'admin', 'ADMINISTRADOR', '1234', false);
  await usuario('Coordenador de Teste', 'coordenador', 'COORDENADOR', '1234', false);
  const vig = await usuario('Vigilante de Teste', 'vigilante', 'VIGILANTE', '1234', false);

  const p1 = await db.predio.create({ data: { id: uuidv7(), campusId: campus.id, codigo: 'P1', nome: 'Prédio 1' } });
  const p2 = await db.predio.create({ data: { id: uuidv7(), campusId: campus.id, codigo: 'P2', nome: 'Prédio 2' } });
  const andar = (predioId: string, nome: string, ordem: number) => db.andar.create({ data: { id: uuidv7(), predioId, nome, ordem } });
  const [p1t, p11, p2t] = [await andar(p1.id, 'Térreo', 0), await andar(p1.id, '1º andar', 1), await andar(p2.id, 'Térreo', 0)];
  const pontos = [
    [p1.id, p1t.id, 'Recepção', 'Conferir porta principal e alarme.'],
    [p1.id, p1t.id, 'Corredor norte', 'Conferir porta corta-fogo.'],
    [p1.id, p11.id, 'Laboratório de Química', 'Verificar se o gás está fechado.'],
    [p1.id, p11.id, 'Almoxarifado', null],
    [p2.id, p2t.id, 'Portaria', 'Conferir cancela e livro de visitas.'],
    [p2.id, p2t.id, 'Estacionamento', null],
  ] as const;
  const ids: string[] = [];
  for (const [predioId, andarId, nome, instrucoes] of pontos) {
    ids.push((await db.pontoRonda.create({ data: { id: uuidv7(), predioId, andarId, nome, instrucoes } })).id);
  }
  const roteiro = await db.roteiro.create({
    data: { id: uuidv7(), campusId: campus.id, nome: 'Ronda completa · P1 e P2', pontos: { create: ids.map((pontoRondaId, i) => ({ pontoRondaId, ordem: i + 1, obrigatorio: true })) } },
  });
  // Agenda de exemplo: todo dia às 22:00. A API gera as rondas dos próximos dias sozinha.
  await db.agenda.create({ data: { id: uuidv7(), roteiroId: roteiro.id, vigilanteId: vig.id, diasSemana: [0, 1, 2, 3, 4, 5, 6], horaInicio: '22:00', duracaoMin: 60 } });
  // E uma ronda que já está disponível, para testar na hora.
  const agora = new Date();
  await db.ronda.create({
    data: {
      id: uuidv7(), campusId: campus.id, roteiroId: roteiro.id, roteiroNome: roteiro.nome, exigeOrdem: false, vigilanteId: vig.id,
      inicioPrevisto: new Date(agora.getTime() - 10 * 60_000), fimPrevisto: new Date(agora.getTime() + 3 * 3600_000), toleranciaInicioMin: 30,
      pontos: { create: ids.map((pontoRondaId, i) => ({ pontoRondaId, ordem: i + 1, obrigatorio: true })) },
    },
  });
  console.log('Dados de teste criados: admin, coordenador e vigilante (senha 1234).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
