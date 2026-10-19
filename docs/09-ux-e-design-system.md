# UX e design system

Parte da [documentação do Guardião](README.md).

Este documento define como o Guardião deve ser usado e como ele se parece: o contexto de uso do vigilante, a **regra dos 2 toques** (RNF10), os wireframes das telas do app, o padrão de retorno ao usuário, os **design tokens** compartilhados por app e painel, o inventário de componentes (Atomic Design, RNF12), as regras de acessibilidade (RNF08) e o tom dos textos. A decisão de usar Atomic Design com tokens compartilhados está no [ADR-0009](adr/0009-atomic-design-design-tokens.md).

## Sumário

1. [Contexto de uso](#1-contexto-de-uso)
2. [Princípios de UX](#2-princípios-de-ux)
3. [Regra dos 2 toques](#3-regra-dos-2-toques)
4. [Wireframes do app](#4-wireframes-do-app)
5. [Feedback e estados](#5-feedback-e-estados)
6. [Design tokens](#6-design-tokens)
7. [Inventário de componentes](#7-inventário-de-componentes)
8. [Acessibilidade](#8-acessibilidade)
9. [Textos da interface](#9-textos-da-interface)
10. [Painel web](#10-painel-web)
11. [Checklist de UX para PRs](#11-checklist-de-ux-para-prs)

---

## 1. Contexto de uso

O desenho parte da persona fictícia José ([01 · Personas](01-visao-do-produto.md#personas)):

| Condição | Consequência no desenho |
|---|---|
| Rondas noturnas, pouca luz | Tema escuro de alto contraste como padrão; brilho moderado para não ofuscar |
| Lanterna numa mão, celular na outra | Ações na metade inferior da tela, alcançáveis com o polegar; alvos grandes |
| Frio, chuva, às vezes luvas | Alvos de 56 dp na ação primária; nada de gestos finos (arrastar, pinçar) |
| Pressa e atenção dividida | Uma ação primária por tela; retorno por vibração e som, não só visual |
| Pouca familiaridade com apps | Textos curtos e diretos, sem jargão; ícone sempre acompanhado de texto |
| Locais sem sinal | Nenhuma tela depende de rede, exceto login e modo instalação |
| Medo de ser vigiado | Comunicação clara de que a localização só é coletada nos eventos |

## 2. Princípios de UX

1. **Dois toques, no máximo**, nas funções principais. A leitura NFC não exige nenhum.
2. **Uma ação primária por tela**, grande, embaixo, sempre no mesmo lugar (barra de ação fixa).
3. **O corpo sente antes de ver**: toda leitura tem retorno háptico imediato.
4. **Nunca esconder o caminho da exceção**: justificar e finalizar com pendências têm mais passos, mas estão sempre visíveis.
5. **Nada de digitação obrigatória** no caminho principal. Texto só na justificativa (mínimo de 10 caracteres, com ditado do teclado) e na descrição opcional da ocorrência.
6. **Estado sempre visível**: progresso da ronda, atraso e pendências de envio aparecem sem precisar procurar.
7. **Erros dizem o que fazer**: toda mensagem de erro traz a próxima ação ("Encoste de novo e segure por 1 segundo").

## 3. Regra dos 2 toques

Contagem a partir da tela **Início**, com o app já desbloqueado. É medida nos fluxos do Maestro e observada no piloto (M06, RNF10).

| Tarefa | Caminho | Toques | Meta |
|---|---|---|---|
| Iniciar a ronda | INICIAR RONDA no cartão "Próxima ronda" | **1** | ≤ 2 |
| Registrar um ponto (Android) | Encostar o celular na tag | **0** | ≤ 2 |
| Registrar um ponto (iOS) | Ler ponto → encostar | **1** | ≤ 2 |
| Finalizar ronda completa (já na Execução) | FINALIZAR RONDA | **1** | ≤ 2 |
| Finalizar ronda completa (a partir da Início) | Cartão da ronda → FINALIZAR RONDA | **2** | ≤ 2 |
| Ocorrência expressa | OCORRÊNCIA → foto → ENVIAR | **3** | ≤ 3 (exceção documentada) |
| Ocorrência sem foto | OCORRÊNCIA → Sem foto → ENVIAR | **3** | ≤ 3 |
| Justificar ponto | Ponto → Justificar → motivo → descrição → SALVAR | 4 + texto | Fluxo de exceção |
| Finalizar com pendências | Menu → Finalizar → FINALIZAR COM PENDÊNCIAS → confirmar | 4 | Fluxo de exceção |
| Desbloquear | Biometria (toque no sensor ou olhar) | 1 | — |

Como a regra é aplicada:

- A história que muda uma dessas tarefas registra a contagem no PR (DoD).
- O fluxo Maestro de cada tarefa falha se o número de `tapOn` passar da meta.
- Um botão de confirmação ("Tem certeza?") no caminho principal é proibido. Confirmação só existe nos fluxos de exceção (finalizar com pendências).

## 4. Wireframes do app

Os wireframes são de baixa fidelidade e mostram hierarquia e posição. Medidas e cores vêm dos tokens.

### 4.1 Início

```
┌──────────────────────────────────┐
│ Guardião              ☁ 3   ⚙    │  ← indicador de sincronização
│ Boa noite, José                  │
├──────────────────────────────────┤
│ PRÓXIMA RONDA                    │
│ ┌──────────────────────────────┐ │
│ │ Noturna P1 e P2              │ │
│ │ 22:00 – 23:00 · 8 pontos     │ │
│ │                              │ │
│ │ ┌──────────────────────────┐ │ │
│ │ │      INICIAR RONDA       │ │ │  ← 56 dp, ação primária
│ │ └──────────────────────────┘ │ │
│ └──────────────────────────────┘ │
│                                  │
│ RONDAS DO TURNO                  │
│ ○ 23:30  Externa estacionamento  │
│ ○ 01:00  Noturna P1 e P2         │
│ ✓ 20:00  Abertura bloco C        │
│                                  │
│ Atualizado às 21:42              │
└──────────────────────────────────┘
```

Estados do cartão: disponível (botão habilitado), antes da janela ("Disponível a partir de 21:30", botão desabilitado), em andamento ("CONTINUAR RONDA"), janela encerrada, cancelada, nenhuma ronda ("Nenhuma ronda para este turno").

### 4.2 Execução da ronda

```
┌──────────────────────────────────┐
│ ← Noturna P1 e P2         ☁ 0  ⋮ │  ← ⋮: Finalizar, Ver instruções
│ 22:04 · termina às 23:00         │
│ ████████████░░░░░░  5 de 8       │  ← BarraProgresso
│ [ Só pendentes ]                 │
├──────────────────────────────────┤
│ PRÉDIO 1 · TÉRREO                │
│ ✓ 1 Recepção                     │
│ ✓ 2 Corredor norte               │
│ ● 3 Escada leste       PRÓXIMO   │  ← destaque se exige ordem
│ PRÉDIO 1 · 1º ANDAR              │
│ ○ 4 Laboratório de Química       │
│ ⚑ 5 Almoxarifado   JUSTIFICADO   │
│ PRÉDIO 2                         │
│ ✓ 6 Portaria                     │
│ ...                              │
├──────────────────────────────────┤
│  Encoste o celular na tag        │  ← dica fixa (Android)
│ ┌───────────────┐ ┌────────────┐ │
│ │  OCORRÊNCIA   │ │ FINALIZAR  │ │  ← FINALIZAR só em destaque
│ └───────────────┘ └────────────┘ │     quando todos os obrigatórios
└──────────────────────────────────┘     forem lidos
```

No iOS, a dica fixa vira o botão **Ler ponto**.

### 4.3 Retorno da leitura

```
┌──────────────────────────────────┐
│                                  │
│              ✓                   │  ← ícone grande, cor sucesso
│                                  │
│         Corredor norte           │  ← 32 sp, negrito
│        Prédio 1 · Térreo         │
│                                  │
│            6 de 8                │
│                                  │
└──────────────────────────────────┘
 sobreposição por 1,5 s; um toque fecha antes
```

### 4.4 Ocorrência: confirmação

```
┌──────────────────────────────────┐
│ ← Nova ocorrência                │
├──────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐             │
│ │foto│ │ +  │                    │  ← miniaturas; + até 5
│ └────┘ └────┘                    │
│ TIPO                             │
│ [ Porta ou janela aberta ▾ ]     │
│ GRAVIDADE                        │
│ [BAIXA] [MÉDIA] [ALTA] [CRÍTICA] │  ← texto + cor, 1 toque
│ LOCAL                            │
│ Corredor norte · P1 · Térreo  ✎  │
│ DESCRIÇÃO (opcional)             │
│ [                              ] │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │           ENVIAR             │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

### 4.5 Finalização com pendências

```
┌──────────────────────────────────┐
│ ← Finalizar ronda                │
├──────────────────────────────────┤
│ Faltam 2 pontos obrigatórios     │
│                                  │
│ ○ Laboratório de Química         │
│   [ Justificar ]                 │
│ ⚑ Almoxarifado · Justificado     │
│                                  │
│ A ronda ficará INCOMPLETA.       │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │   FINALIZAR COM PENDÊNCIAS   │ │  ← cor de aviso
│ └──────────────────────────────┘ │
│        Voltar para a ronda       │
└──────────────────────────────────┘
```

### 4.6 Sincronização

```
┌──────────────────────────────────┐
│ ← Envio de registros             │
├──────────────────────────────────┤
│ Última sincronização: 22:41      │
│                                  │
│ ATENÇÃO (1)                      │
│ ✕ Início da ronda 01:00          │
│   Ronda cancelada pelo           │
│   coordenador. Avise a           │
│   coordenação.                   │
│                                  │
│ AGUARDANDO ENVIO (3)             │
│ • Visita · Portaria · 22:47      │
│ • Ocorrência · 22:49             │
│ • Foto 1 de 2 · 22:49            │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │      SINCRONIZAR AGORA       │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

## 5. Feedback e estados

### 5.1 Retornos da leitura NFC

| Situação | Vibração | Som | Visual | Duração |
|---|---|---|---|---|
| Sucesso | Curta e forte | Sucesso | Sobreposição verde com ✓, nome do ponto e progresso | 1,5 s |
| Já registrado | Leve | — | Faixa neutra "Ponto já registrado" | 2 s |
| Fora do roteiro / não reconhecida | Longa | Erro | Faixa vermelha com o texto do caso | Até o próximo toque ou 4 s |
| Fora da área (`BLOQUEAR`) | Longa | Erro | Faixa vermelha com orientação | Até o próximo toque |
| Falha de leitura | Dupla curta | — | Faixa de aviso "Leitura falhou..." | 3 s |
| Fora da ordem | Curta (sucesso) + leve | Sucesso | Sucesso + faixa de aviso "Fora da ordem prevista" | 1,5 s + 3 s |

A localização imprecisa, a ausência de localização e a localização simulada **não** geram aviso ao vigilante na política `SINALIZAR`: a visita é registrada e a revisão fica com o coordenador (princípio "sinalizar, não travar").

### 5.2 Estados de componentes

| Estado | Regra visual |
|---|---|
| Desabilitado | Opacidade 40% + texto explicando por quê ("Disponível a partir de 21:30"). Nunca desabilitar sem explicar |
| Carregando | Indicador no próprio botão; o botão mantém o tamanho |
| Vazio | Ilustração simples (ícone) + frase + próxima ação, quando houver |
| Erro de rede | No app, não existe: tudo grava localmente. No painel, faixa no topo com "Sem conexão. Tentando de novo..." |
| Pendências de envio | Nuvem com contador no cabeçalho; nuvem com ✓ quando zerado; nuvem com ! quando há rejeitados |

### 5.3 Ponto: situações

| Situação | Ícone | Cor | Texto auxiliar |
|---|---|---|---|
| Pendente | ○ | Neutra | — |
| Próximo (roteiro com ordem) | ● | Primária | "PRÓXIMO" |
| Visitado | ✓ | Sucesso | Horário da leitura |
| Justificado | ⚑ | Aviso | "JUSTIFICADO" |

A cor nunca é o único indicador: sempre há ícone e, quando necessário, texto.

## 6. Design tokens

Os tokens ficam em `packages/design-tokens` e são a **única** fonte de cores, tipografia, espaçamentos, raios e tamanhos para o app e o painel (HU-004, RNF12).

### 6.1 Organização

```
packages/design-tokens/
├── src/
│   ├── primitivos.ts      # paleta bruta (cinza-950, azul-400...)
│   ├── semanticos.ts      # papéis: fundo, texto, primaria, sucesso, gravidade.CRITICA...
│   ├── tipografia.ts
│   ├── espacamento.ts
│   └── index.ts
├── build/
│   ├── tema-native.ts     # objeto para o app (StyleSheet)
│   ├── tokens.css         # variáveis CSS para o painel (claro e escuro)
│   └── tailwind-preset.ts # preset do Tailwind usado pelo shadcn/ui
└── scripts/
    └── verificar-contraste.ts   # falha o CI se algum par texto/fundo < 4,5:1
```

Componentes só usam **tokens semânticos**. Primitivos não são importados fora do pacote.

### 6.2 Cores semânticas

| Token | Tema escuro (padrão do app) | Tema claro (padrão do painel) | Uso |
|---|---|---|---|
| `fundo` | `#0B0F14` | `#FFFFFF` | Fundo da tela |
| `superficie` | `#151B23` | `#F4F6F8` | Cartões, listas |
| `superficieElevada` | `#1F2732` | `#FFFFFF` | Diálogos, sobreposições |
| `borda` | `#2E3946` | `#D0D7DE` | Divisores, contornos |
| `texto` | `#F5F7FA` | `#111827` | Texto principal |
| `textoSecundario` | `#B8C2CC` | `#4B5563` | Texto auxiliar |
| `primaria` | `#4DA3FF` | `#0B5CAD` | Ação primária, links, destaque |
| `textoSobrePrimaria` | `#0B0F14` | `#FFFFFF` | Texto do botão primário |
| `sucesso` | `#3DDC84` | `#12733E` | Leitura aceita, concluída |
| `aviso` | `#FFC24D` | `#8A5A00` | Justificado, atraso, finalizar com pendências |
| `erro` | `#FF6B6B` | `#B42318` | Leitura recusada, rejeitado |
| `info` | `#7CC4FF` | `#1E5A8C` | Avisos neutros |

### 6.3 Cores de gravidade

| Gravidade | Token | Cor (escuro) | Cor (claro) | Texto sobre a cor | Rótulo |
|---|---|---|---|---|---|
| `BAIXA` | `gravidade.BAIXA` | `#3DDC84` | `#12733E` | `#0B0F14` / `#FFFFFF` | "Baixa" |
| `MEDIA` | `gravidade.MEDIA` | `#FFD84D` | `#8A6D00` | `#0B0F14` / `#FFFFFF` | "Média" |
| `ALTA` | `gravidade.ALTA` | `#FF9F43` | `#B54708` | `#0B0F14` / `#FFFFFF` | "Alta" |
| `CRITICA` | `gravidade.CRITICA` | `#FF5C5C` | `#B42318` | `#0B0F14` / `#FFFFFF` | "Crítica" |

O `Selo` de gravidade mostra sempre o rótulo em texto (CA12.3). Os valores acima são o ponto de partida; o script de contraste do CI é a fonte de verdade e qualquer ajuste de cor passa por ele.

### 6.4 Tipografia

| Token | App (sp) | Painel (px) | Peso | Uso |
|---|---|---|---|---|
| `legenda` | 15 | 13 | 400 | Horários, metadados (nunca para ações) |
| `corpo` | **18** | 15 | 400 | Texto base (RNF08) |
| `corpoForte` | 18 | 15 | 600 | Nomes de pontos em listas |
| `titulo` | 22 | 20 | 600 | Título de tela |
| `tituloGrande` | 28 | 28 | 700 | Números do Painel do dia |
| `destaqueLeitura` | 32 | — | 700 | Nome do ponto no retorno da leitura |
| `botao` | 18 | 15 | 700 | Texto de botões, em maiúsculas na ação primária do app |

Fonte: a do sistema no app (Roboto no Android, SF no iOS), para respeitar a escala de fonte do usuário; Inter no painel. O app respeita a fonte grande do sistema até 200% sem cortar texto (HU-017).

### 6.5 Espaçamento, raios e tamanhos

| Grupo | Tokens |
|---|---|
| Espaçamento (base 4) | `esp.1` 4 · `esp.2` 8 · `esp.3` 12 · `esp.4` 16 · `esp.5` 20 · `esp.6` 24 · `esp.8` 32 · `esp.12` 48 |
| Raios | `raio.pequeno` 6 · `raio.medio` 10 · `raio.grande` 16 · `raio.pilula` 999 |
| Alvos de toque | `alvo.primario` 56 dp · `alvo.minimo` 48 dp |
| Ícones | `icone.pequeno` 20 · `icone.medio` 24 · `icone.grande` 32 · `icone.retorno` 96 |
| Elevação | `sombra.1` (cartões), `sombra.2` (sobreposições). No tema escuro, a elevação usa `superficieElevada` em vez de sombra |
| Duração | `duracao.rapida` 120 ms · `duracao.normal` 200 ms · `duracao.retorno` 1500 ms |

## 7. Inventário de componentes

### 7.1 App

| Nível | Componente | Variantes e estados | Usado em |
|---|---|---|---|
| Átomo | `Texto` | `legenda`, `corpo`, `corpoForte`, `titulo`, `destaqueLeitura`; cor semântica | Todas |
| Átomo | `Botao` | `primario` (56 dp), `secundario`, `aviso`, `perigo`, `texto`; desabilitado com motivo; carregando | Todas |
| Átomo | `Icone` | Conjunto fechado (ex.: `check`, `pendente`, `bandeira`, `nuvem`, `camera`, `alerta`) | Todas |
| Átomo | `Selo` | `gravidade`, `status`, `neutro` | Ocorrência, Início |
| Átomo | `Campo` | Texto de uma linha, multilinha com contador de caracteres | Login, Justificar, Ocorrência |
| Átomo | `Indicador` | Giratório, ponto de status | Botões, listas |
| Átomo | `Divisor` | Horizontal | Listas |
| Molécula | `ItemPonto` | Pendente, Próximo, Visitado, Justificado | Execução, Finalização |
| Molécula | `BarraProgresso` | Normal, completa, atrasada | Execução |
| Molécula | `SeletorGravidade` | 4 opções com texto e cor | Ocorrência |
| Molécula | `SeletorMotivo` | Lista de motivos de justificativa | Justificar |
| Molécula | `MiniaturaFoto` | Com botão remover, adicionar (+), limite atingido | Ocorrência |
| Molécula | `IndicadorSincronizacao` | Zerado, pendente com contador, com rejeitados | Cabeçalho |
| Molécula | `AvisoInline` | `info`, `aviso`, `erro` | Todas |
| Molécula | `CabecalhoTela` | Com voltar, com menu | Todas |
| Organismo | `CartaoProximaRonda` | Disponível, antes da janela, em andamento, encerrada, cancelada, vazio | Início |
| Organismo | `ListaPontosAgrupada` | Agrupada por prédio/andar/setor; filtro "Só pendentes" | Execução |
| Organismo | `BarraAcaoRonda` | Leitura ativa; ronda completa (FINALIZAR em destaque); iOS (Ler ponto) | Execução |
| Organismo | `RetornoLeitura` | Sucesso, já registrado, recusa, falha | Execução |
| Organismo | `FormularioOcorrencia` | Com e sem leitura recente; enviando | Ocorrência |
| Organismo | `ListaPendenciasSync` | Rejeitados, aguardando, enviando | Sincronização |
| Organismo | `ResumoRonda` | Concluída, incompleta; com pendências de envio | Resumo |
| Template | `TemplateTelaVigilante` | Cabeçalho + conteúdo rolável + barra de ação fixa | Telas do vigilante |
| Template | `TemplateFormulario` | Campos + ação primária fixa | Login, Justificar |
| Template | `TemplateCamera` | Tela cheia, obturador central | Ocorrência |

### 7.2 Painel

O painel usa o **shadcn/ui** como base de átomos e moléculas (botão, campo, seleção, diálogo, tabela, abas, tooltip), estilizado pelo preset Tailwind dos tokens. Componentes próprios:

| Nível | Componente | Usado em |
|---|---|---|
| Molécula | `SeloGravidade`, `SeloStatusRonda`, `SeloResultadoGeo`, `SeloValidacaoTag`, `SeloRevisao` | Listas e detalhes |
| Molécula | `DoisHorarios` (servidor em destaque, aparelho ao lado, alerta de desvio) | Linha do tempo, listas (RN15) |
| Molécula | `CartaoIndicador` (número grande + rótulo + link) | Painel do dia |
| Organismo | `TabelaRondas`, `TabelaOcorrencias`, `TabelaAuditoria` (paginação, filtros) | Histórico, auditoria |
| Organismo | `FiltrosPeriodoLocal` (período, vigilante, prédio, andar, setor) | Histórico |
| Organismo | `LinhaDoTempoRonda` | Detalhe da ronda |
| Organismo | `MapaRonda` (Leaflet: leituras, círculos de tolerância, geofence) | Detalhe da ronda, revisão |
| Organismo | `GaleriaFotos` (URL assinada, carregamento sob demanda) | Ocorrência |
| Organismo | `PainelRevisaoVisita` (mapa, dados da tag, ACEITAR/REJEITAR) | Visitas sinalizadas |
| Organismo | `FormularioCadastro` genérico com desativação por motivo | Cadastros |

Todo componente novo (app ou painel) tem story no Storybook com todos os estados da tabela (DoD).

## 8. Acessibilidade

| Requisito | Valor | Verificação |
|---|---|---|
| Contraste de texto | ≥ 4,5:1 (WCAG 2.2 AA); ≥ 3:1 para ícones e bordas de componentes | Script de contraste no CI |
| Alvos de toque | 56 dp (primária), 48 dp (demais) | Teste de componente do `Botao` (HU-004) |
| Fonte | Base 18 sp; respeita o tamanho de fonte do sistema até 200% | Teste manual por tela |
| Cor | Nunca é o único indicador (ícone e texto juntos) | Revisão de PR |
| Leitores de tela | `accessibilityLabel` em todo elemento interativo; ordem de foco lógica; TalkBack anuncia o resultado da leitura NFC | Teste manual com TalkBack nas telas principais |
| Movimento | Animações curtas; respeita "remover animações" do sistema | Revisão |
| Retornos não visuais | Toda leitura tem vibração; erros têm som (salvo modo silencioso) | Teste em aparelho |
| Painel | Navegação completa por teclado, foco visível, `aria-*` nos componentes do shadcn/ui, tabelas com cabeçalhos | Playwright com `@axe-core/playwright` |

## 9. Textos da interface

**Tom:** direto, respeitoso, no presente, em segunda pessoa implícita. Frases curtas. Sem culpa ("Você errou"), sem jargão técnico ("sincronização" só aparece na tela de envio, como "Envio de registros").

| Situação | Texto |
|---|---|
| Dica na Execução (Android) | "Encoste o celular na tag" |
| Leitura aceita | Nome do ponto (sem frase extra) |
| Já registrado | "Ponto já registrado" |
| Tag de outro roteiro | "Este ponto não faz parte desta ronda" |
| Tag desconhecida | "Tag não reconhecida" |
| Falha de leitura | "Leitura falhou. Encoste de novo e segure por 1 segundo." |
| NFC desligado | "Ative o NFC" + botão "Abrir configurações" |
| Antes da janela | "Disponível a partir de 21:30" |
| Outra ronda em andamento | "Finalize a ronda em andamento antes de iniciar outra" |
| Ronda atrasada | "Atrasada" |
| Descrição curta | "Faltam 4 caracteres" |
| Limite de fotos | "Máximo de 5 fotos" |
| Ocorrência registrada | "Ocorrência registrada" |
| Logout com pendências | "Ainda há 3 registros para enviar. Conecte-se à internet e toque em Sincronizar agora." |
| Item rejeitado | Mensagem do `codigo` + "Avise a coordenação" |
| Credenciais inválidas | "Matrícula ou senha inválida" |
| Aparelho revogado | "Este aparelho foi bloqueado. Procure o administrador." |

Os textos ficam em `apps/mobile/src/textos` e `apps/web/src/textos`, agrupados por tela. Mudança de texto é revisada pelo PO quando afeta o vigilante. Esta tabela é a referência: critérios de aceitação e histórias usam os mesmos textos.

## 10. Painel web

O painel tem outro contexto: mesa de trabalho, horário administrativo, mouse e teclado. Por isso:

- tema **claro** por padrão, com tema escuro disponível;
- densidade maior (fonte base 15 px, tabelas compactas);
- layout com menu lateral recolhível e conteúdo em até 1440 px de largura; responsivo até 360 px para consulta rápida no celular do coordenador;
- os mesmos tokens semânticos, as mesmas cores de gravidade e os mesmos selos do app.

Telas, rotas e componentes estão em [10-painel-web.md](10-painel-web.md).

## 11. Checklist de UX para PRs

Copiado no template de PR quando a mudança tem interface.

- [ ] Funções principais com no máximo 2 toques a partir da Início (contagem registrada no PR).
- [ ] Uma ação primária por tela, na barra inferior, com 56 dp.
- [ ] Alvos de toque de pelo menos 48 dp.
- [ ] Testado em tema escuro e claro, com fonte grande do sistema.
- [ ] Nenhuma cor, fonte ou espaçamento fora dos tokens.
- [ ] Texto em todo ícone de ação; cor nunca é o único indicador.
- [ ] Estados vazio, desabilitado (com motivo), carregando e erro desenhados.
- [ ] Retorno háptico nas ações do vigilante.
- [ ] Textos revisados segundo a [seção 9](#9-textos-da-interface).
- [ ] Story no Storybook para cada componente novo ou alterado.
