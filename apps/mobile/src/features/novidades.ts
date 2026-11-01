// Novidades mostradas uma vez depois de cada atualização.
// Ao publicar uma versão: acrescente uma entrada NO TOPO (a primeira é a versão atual).
export const NOVIDADES: { v: string; d: string; t: string; itens: string[] }[] = [
  {
    v: '0.2.1',
    d: '01/11/2026',
    t: 'Login de teste corrigido',
    itens: ['admin / 1234 e vigilante / 1234 entram no modo local mesmo com um servidor salvo.'],
  },
  {
    v: '0.2.0',
    d: '01/11/2026',
    t: 'Telas novas e atualização automática',
    itens: [
      'Visual novo em todas as telas, com relógio da ronda e botão Ler ponto.',
      'Depois de ler o ponto, um checklist rápido do local (portas, janelas, luzes, pessoas).',
      'Ocorrência com tipos em botões, detalhe da sala e "Resolvido no local".',
      'Finalização com resumo, motivo dos pontos não lidos e observação geral.',
      'O app se atualiza sozinho ao abrir, sem instalar APK de novo.',
    ],
  },
  { v: '0.1.0', d: '01/11/2026', t: 'Primeira versão', itens: ['Rondas com NFC, ocorrências, justificativas e modo local de teste.'] },
];

export const VERSAO = NOVIDADES[0].v;
