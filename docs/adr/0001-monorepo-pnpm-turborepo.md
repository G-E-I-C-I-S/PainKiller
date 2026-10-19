# ADR-0001: Monorepo com pnpm workspaces e Turborepo

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S (mantenedor @madeiragab) |
| **Relacionados** | RNF09, RNF12, RNF13 · HU-001, HU-002 · [ADR-0003](0003-api-nestjs-monolito-modular.md), [ADR-0009](0009-atomic-design-design-tokens.md) |

## Contexto

O Guardião tem três aplicações (app mobile, API e painel web) que precisam concordar exatamente sobre enums (`StatusRonda`, `TipoEvento`), formatos de eventos de sincronização, regras puras (classificação geográfica, janela da ronda) e tokens visuais. A equipe é pequena, só o mantenedor faz merge e o prazo da V1 é curto (13/11/2026). Divergência entre app e API num contrato de sincronização pode significar registros rejeitados em campo.

## Decisão

Usaremos **um único repositório** (`G-E-I-C-I-S/PainKiller`) organizado com **pnpm workspaces** e orquestrado pelo **Turborepo**, todo em TypeScript:

```
apps/mobile · apps/api · apps/web
packages/shared · packages/design-tokens · packages/config
infra/ · docs/
```

- `@painkiller/shared`: tipos, enums, schemas zod, contratos da API e regras puras usadas no app e no servidor.
- `@painkiller/design-tokens`: tokens visuais do app e do painel.
- `packages/config`: ESLint, Prettier e `tsconfig` comuns.
- Um único `pnpm-lock.yaml` na raiz; tarefas `lint`, `typecheck`, `test` e `build` com cache do Turborepo.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Um repositório por aplicação | Isolamento, pipelines independentes | Contratos duplicados ou publicados como pacote npm; PRs coordenados em vários repositórios | Custo de coordenação alto para equipe pequena e mantenedor único |
| Monorepo com npm/Yarn workspaces sem orquestrador | Simples | Sem cache de tarefas; CI mais lento | O cache do Turborepo compensa o pouco de configuração |
| Nx | Muito completo, geradores, grafo de dependências | Curva de aprendizado e mais convenções próprias | Mais do que o necessário para 3 apps e 3 pacotes |

## Consequências

**Positivas**

- Uma mudança de contrato aparece no mesmo PR para app, API e painel; o typecheck quebra onde precisa (cenário da HU-001).
- Um só pipeline de CI e um só lugar para revisar.
- Regras puras escritas uma vez e testadas uma vez.

**Negativas e riscos**

- O Metro (bundler do React Native) precisa de configuração para resolver pacotes do workspace com pnpm (`node-linker` e `watchFolders`). Mitigação: configuração documentada na HU-001.
- O repositório público expõe todo o código; a segurança não pode depender de segredo no código ([11](../11-seguranca-e-lgpd.md)).

**O que muda no dia a dia**

- `pnpm install` na raiz instala tudo; `pnpm dev` sobe API, painel e Metro.
- Pacotes internos são importados por nome (`@painkiller/shared`), nunca por caminho relativo entre apps.

## Referências

- [pnpm workspaces](https://pnpm.io/workspaces) · [Turborepo](https://turborepo.com/)
- [04 · Visão geral](../04-arquitetura.md#1-visão-geral)
