// Novidades mostradas uma vez depois de cada atualização.
// Ao publicar uma versão: acrescente uma entrada NO TOPO (a primeira é a versão atual).
export const NOVIDADES: { v: string; d: string; t: string; itens: string[] }[] = [
  {
    v: '0.3.0',
    d: '01/11/2026',
    t: 'Ícone novo e app que se instala sozinho',
    itens: ['Ícone e tela de abertura novos.', 'Quando sair uma versão com mudança no aparelho (como ícone), o app baixa e abre a instalação sozinho.'],
  },
  {
    v: '0.2.6',
    d: '01/11/2026',
    t: 'Cada conta com seus dados',
    itens: [
      'Rondas, leituras, ocorrências e envios agora ficam separados por conta no celular.',
    ],
  },
  {
    v: '0.2.5',
    d: '01/11/2026',
    t: 'Limpar tag',
    itens: [
      'Botão Limpar tag no modo Gravar, com confirmação.',
      'Segurança: o app só grava ou apaga em tag vazia ou gravada por ele; tag de outro sistema fica intacta.',
      'Tag já gravada com outro ponto não é sobrescrita: limpe antes.',
    ],
  },
  {
    v: '0.2.4',
    d: '01/11/2026',
    t: 'Leitura NFC contínua',
    itens: ['O leitor se religa sozinho depois de cada leitura e ao voltar do segundo plano: não para mais depois de algumas tags.'],
  },
  {
    v: '0.2.3',
    d: '01/11/2026',
    t: 'Ponto gravado na tag',
    itens: [
      'Instalação de tags grava o ponto dentro da própria tag.',
      'Modo Testar: encoste várias tags seguidas e veja o ponto gravado em cada uma.',
      'Na ronda, o ponto é reconhecido pelo que está gravado na tag.',
    ],
  },
  {
    v: '0.2.2',
    d: '01/11/2026',
    t: 'Erro do banco corrigido',
    itens: ['Corrigido o erro "file is not a database" ao entrar e ao registrar.'],
  },
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
