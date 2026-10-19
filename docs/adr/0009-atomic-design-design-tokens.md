# ADR-0009: Atomic Design com design tokens compartilhados

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RNF08, RNF10, RNF12 · HU-004 · [ADR-0001](0001-monorepo-pnpm-turborepo.md), [ADR-0010](0010-painel-web-react-vite-spa.md) |

## Contexto

O app é usado à noite, com uma mão, por pessoas pouco familiarizadas com tecnologia; o painel é usado em mesa de trabalho. Os dois precisam falar a mesma linguagem visual (cores de gravidade, selos de status, ícones) para que o coordenador reconheça no painel o que o vigilante viu no app. RNF12 exige componentização com componentes reutilizáveis sobre tokens compartilhados, e a acessibilidade (contraste, alvos de toque, fonte base de 18 sp) precisa ser garantida uma vez, não em cada tela.

## Decisão

- Um pacote **`@painkiller/design-tokens`** é a única fonte de cores, tipografia, espaçamentos, raios, tamanhos de alvo e durações, com **tokens primitivos** (paleta) e **semânticos** (papéis como `fundo`, `primaria`, `gravidade.CRITICA`). O pacote gera um tema para React Native, variáveis CSS e um preset do Tailwind.
- O app organiza seus componentes em **Atomic Design** (átomos, moléculas, organismos, templates e páginas) em `apps/mobile/src/ui`.
- O painel usa **shadcn/ui** como base de átomos e moléculas, estilizada pelo preset dos tokens, e componentes próprios em Atomic Design para o domínio (selos, linha do tempo, mapa).
- Regras: nenhum literal de cor, fonte ou espaçamento fora dos tokens (lint); componentes sem regra de negócio; todo componente com teste e story no Storybook; script de contraste no CI.

Detalhes em [09-ux-e-design-system.md](../09-ux-e-design-system.md).

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Biblioteca pronta no app (React Native Paper, NativeBase, Tamagui) | Rapidez inicial | Visual e tamanhos padrão pensados para outro contexto; customização para 56 dp, 18 sp e alto contraste exige brigar com a biblioteca | Componentes próprios simples são mais previsíveis |
| Estilos por tela, sem design system | Zero investimento inicial | Inconsistência, acessibilidade irregular | Fere RNF12 |
| Tokens separados para app e painel | Independência | Divergência de cores de gravidade e selos | O valor está na linguagem única |

## Consequências

**Positivas**

- Uma mudança de token (ex.: a cor de `CRITICA`) muda app e painel sem tocar nos componentes (cenário da HU-004).
- Acessibilidade verificada no nível do componente e do token.
- Telas montadas rapidamente a partir de organismos prontos.

**Negativas e riscos**

- Custo inicial na Sprint 0 (HU-004, 5 pontos). Plano de corte: só os átomos usados na V1 e Storybook do painel adiado ([14 · Plano de corte](../14-backlog-e-roadmap.md#11-plano-de-corte)).
- Disciplina de revisão para não criar componentes duplicados.

**O que muda no dia a dia**

- Antes de criar um componente, procure no Storybook.
- Componente novo vem com teste e story no mesmo PR (DoD).

## Referências

- Brad Frost, *Atomic Design*
- [W3C Design Tokens Community Group](https://www.designtokens.org/)
- [shadcn/ui](https://ui.shadcn.com/)
