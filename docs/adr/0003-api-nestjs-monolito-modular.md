# ADR-0003: API em NestJS como monólito modular

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RNF09, RNF13 · HU-001 · [ADR-0004](0004-postgresql-schemas-por-modulo-prisma.md), [ADR-0013](0013-filas-jobs-bullmq-redis.md) |

## Contexto

A V1 entrega o módulo de Vigilância Patrimonial, mas a plataforma vai receber outros módulos: Controle de Acesso de Veículos (V2, mais de mil veículos por dia), Patrimônio e Manutenção (RNF09). Ao mesmo tempo, a equipe é pequena, a infraestrutura é uma VM institucional e o prazo é de seis semanas. Microsserviços trariam rede, implantação e observabilidade distribuídas sem necessidade agora; um monólito sem fronteiras viraria um emaranhado na chegada do segundo módulo.

## Decisão

A API será um **monólito modular em NestJS** (Node.js 24 LTS, TypeScript), implantado como **um contêiner de API e um contêiner de worker** com o mesmo código.

- `src/nucleo/*`: módulos reutilizáveis (identidade, locais, auditoria, notificações, arquivos, eventos, saúde).
- `src/modulos/vigilancia/*`: módulo da V1 (pontos e tags, planejamento, execução, ocorrências, sincronização, painel).
- Cada módulo expõe um **serviço público** no seu `index.ts`; outros módulos só usam esse serviço.
- Comunicação assíncrona entre módulos por **eventos de domínio** publicados depois do commit ([04 · Eventos](../04-arquitetura.md#52-eventos-de-domínio)).
- Regras de dependência verificadas no CI com `dependency-cruiser`: `nucleo` não importa `modulos`; um módulo de domínio não importa outro.
- Validação e contrato com zod (`nestjs-zod`) e OpenAPI 3.1 gerado do código (RNF13).

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Microsserviços desde a V1 | Implantação e escala independentes | Complexidade operacional, consistência distribuída, mais infraestrutura | Desproporcional para a V1 e para a equipe |
| Monólito sem módulos (Express/Fastify "puro") | Rápido de começar | Sem fronteiras; o módulo de veículos tocaria o código da vigilância | Fere RNF09 |
| Fastify com estrutura própria | Leve e rápido | A equipe teria de inventar a modularização, injeção de dependências e padrões | O NestJS já traz módulos, DI, guards e interceptors prontos |
| Outra linguagem (Java/Spring, Python/Django) | Ecossistemas maduros | Perde o compartilhamento de tipos com app e painel | Monorepo TypeScript ([ADR-0001](0001-monorepo-pnpm-turborepo.md)) |

## Consequências

**Positivas**

- Uma implantação, um processo de log, transações locais simples (ex.: visita + auditoria + evento de sincronização na mesma transação).
- O módulo de veículos entra como `src/modulos/acesso-veiculos`, sem tocar a vigilância (QA-12).
- Extração futura de um módulo para serviço próprio continua possível, porque as fronteiras são explícitas ([04 · Quando extrair](../04-arquitetura.md#72-quando-extrair-um-serviço)).

**Negativas e riscos**

- A disciplina de fronteira depende de lint e revisão; o banco é compartilhado.
- Um pico de carga de um módulo afeta os outros até haver mais réplicas.

**O que muda no dia a dia**

- Código novo da vigilância vai para `src/modulos/vigilancia/<submodulo>`; código genérico só vai para `nucleo` se servir a outros módulos.
- Importar algo de outro módulo fora do `index.ts` quebra o lint.

## Referências

- [NestJS Modules](https://docs.nestjs.com/modules)
- [04 · Componentes da API](../04-arquitetura.md#43-nível-3-componentes-da-api)
