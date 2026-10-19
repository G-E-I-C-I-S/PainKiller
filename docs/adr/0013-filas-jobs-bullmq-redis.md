# ADR-0013: Filas e jobs com BullMQ e Redis

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RF15, RF16 · RN09, RN13 · UC12, UC13, UC17 · HU-013, HU-026, HU-037 · [ADR-0003](0003-api-nestjs-monolito-modular.md) |

## Contexto

Várias tarefas não devem acontecer dentro da requisição do app: enviar e-mails (o SMTP pode estar lento ou fora), gerar miniaturas de fotos, gerar as rondas das agendas duas vezes ao dia, marcar rondas não realizadas a cada 5 minutos e verificar a cadeia de auditoria diariamente. Essas tarefas precisam de novas tentativas com espera crescente, registro de falha e execução única mesmo com mais de uma instância. O módulo futuro de veículos terá picos de processamento.

## Decisão

Usaremos **BullMQ** sobre **Redis 7** (com AOF ligado), executado por um processo **worker** com o mesmo código da API (`MODO=worker`):

| Fila | Jobs |
|---|---|
| `notificacoes` | `enviar-email`, `enviar-whatsapp` (V1.1); 8 tentativas com backoff exponencial |
| `fotos` | `gerar-miniatura` |
| `agendamento` | `gerar-rondas` (00:05 e 12:05), `marcar-nao-realizadas` (5 min), `reconciliar-notificacoes` (5 min), `verificar-cadeia-auditoria` (03:30) |

- Todo job é **idempotente** (ex.: `UNIQUE(agenda_ronda_id, inicio_previsto)`, `UNIQUE` de notificação por destinatário e canal).
- A **verdade fica no PostgreSQL** (ex.: `notificacao.status`), não no Redis: se o Redis perder dados, o job `reconciliar-notificacoes` recria o que faltar.
- O mesmo Redis guarda os contadores de limite de tentativas de login.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Fazer tudo dentro da requisição | Sem infraestrutura extra | Resposta lenta, falhas de SMTP afetam a sincronização | Fere RNF01 indiretamente |
| `@nestjs/schedule` (cron em memória) | Simples | Sem fila, sem tentativas; duplicaria execução com mais de uma réplica | Insuficiente |
| Fila no PostgreSQL (pg-boss, Graphile Worker) | Um componente a menos | Boa alternativa; menos ferramentas de painel e de padrões no ecossistema Nest | BullMQ tem integração oficial com Nest (`@nestjs/bullmq`) e já atende limites de taxa |
| RabbitMQ | Mensageria robusta | Mais um serviço complexo para operar | Desproporcional |

## Consequências

**Positivas**

- A API responde rápido; e-mails e miniaturas saem em segundo plano com tentativas.
- Jobs repetíveis com execução única entre réplicas.
- Base pronta para os picos do módulo de veículos.

**Negativas e riscos**

- Mais um serviço (Redis) para operar e monitorar.
- Jobs precisam ser idempotentes por projeto; revisão de PR verifica isso.

**O que muda no dia a dia**

- Trabalho lento ou externo vira job; o serviço de domínio só enfileira.
- Testes de integração rodam o worker no mesmo processo com Redis real (Testcontainers).

## Referências

- [BullMQ](https://docs.bullmq.io/) · [@nestjs/bullmq](https://docs.nestjs.com/techniques/queues)
- [04 · Filas do worker](../04-arquitetura.md#53-filas-do-worker)
