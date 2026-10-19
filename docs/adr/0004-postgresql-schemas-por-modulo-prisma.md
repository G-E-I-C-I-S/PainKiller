# ADR-0004: PostgreSQL com um schema por módulo e Prisma

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RF18, RNF05, RNF09 · RN03, RN04, RN07, RN14 · HU-003, HU-009, HU-037 · [ADR-0003](0003-api-nestjs-monolito-modular.md) |

## Contexto

O sistema precisa de integridade forte: regras de negócio que dependem de restrições do banco (uma ronda em andamento por vigilante, uma visita válida por ponto, contador SUN único, uma tag ativa por ponto), trilha de auditoria append-only e proibição de exclusão física com garantia no próprio banco (RN14). Também precisa separar o núcleo compartilhado dos módulos, para que novos módulos (veículos, patrimônio) tenham dados próprios (RNF09). Tudo roda numa VM institucional, sem serviços gerenciados.

## Decisão

Usaremos **PostgreSQL 17** com **um schema por módulo**: `nucleo` (compartilhado) e `vigilancia` (V1); módulos futuros ganham schemas próprios (ex.: `acesso_veiculos`). O acesso será feito com **Prisma** (`multiSchema`), e o que o Prisma não expressa ficará em migrations com SQL cru revisado:

- índices únicos **parciais** (RN03, RN04, tag ativa única);
- triggers de imutabilidade e de limite de fotos;
- função `SECURITY DEFINER` que grava a auditoria com hash encadeado;
- **papéis de banco** separados: `guardiao_owner` (migrations), `guardiao_api` (sem `DELETE` em lugar nenhum e sem `UPDATE` na auditoria), `guardiao_leitura`, `guardiao_backup`.

Detalhes em [05-modelo-de-dados.md](../05-modelo-de-dados.md).

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Um banco por módulo | Isolamento máximo | Transações e consultas entre núcleo e módulo ficam complexas; mais operação | Exagero para uma VM e uma equipe |
| Tudo no schema `public` | Simples | Sem fronteira visível entre núcleo e módulos | Fere RNF09 |
| MySQL/MariaDB | Conhecido | Sem índices parciais nativos; permissões e funções menos flexíveis | Restrições parciais são centrais aqui |
| MongoDB | Flexível | Integridade relacional e restrições fracas para este domínio | O domínio é relacional e exige integridade |
| TypeORM ou Drizzle na API | Mais controle sobre SQL | Prisma tem migrações maduras e tipos gerados que a equipe já conhece | Prisma + SQL cru onde precisa atende |

## Consequências

**Positivas**

- Regras críticas garantidas mesmo se houver bug na API (o banco recusa).
- A exclusão física é impossível para o usuário da aplicação, não só "não implementada".
- Schemas tornam visível o que pertence a cada módulo.

**Negativas e riscos**

- Migrations com SQL cru exigem revisão cuidadosa (item da DoD).
- O Prisma não modela índices parciais nem triggers; o schema Prisma não é a descrição completa do banco. Mitigação: [05](../05-modelo-de-dados.md) documenta tudo e os testes de integração rodam contra o banco real.

**O que muda no dia a dia**

- Mudança de modelo = migration Prisma + SQL cru quando necessário + atualização do [05](../05-modelo-de-dados.md) no mesmo PR.
- Testes de integração usam Testcontainers com PostgreSQL real e o usuário `guardiao_api`.

## Referências

- [Prisma multiSchema](https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema)
- [PostgreSQL: índices parciais](https://www.postgresql.org/docs/17/indexes-partial.html)
