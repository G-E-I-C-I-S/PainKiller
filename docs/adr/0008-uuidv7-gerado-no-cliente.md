# ADR-0008: UUIDv7 gerado no cliente como identificador

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RF06, RNF05, RNF06 · CA06.2 · HU-029, HU-030 · [ADR-0005](0005-online-first-fila-local-outbox.md) |

## Contexto

Registros são criados no aparelho, muitas vezes sem conexão, e enviados depois, possivelmente mais de uma vez (resposta perdida, reenvio manual, tarefa em segundo plano concorrente). O registro precisa de identidade antes de existir no servidor, e o servidor precisa reconhecer reenvios sem duplicar (RNF05). Ids sequenciais do banco só existem depois do `INSERT` no servidor. UUIDv4 aleatórios funcionam, mas espalham as inserções pelos índices B-tree e não são ordenáveis por tempo.

## Decisão

Todas as chaves primárias serão **UUIDv7** (RFC 9562):

- registros criados no app (visitas, justificativas, ocorrências, fotos, eventos da fila) recebem o UUIDv7 **no aparelho**, no momento da ação;
- o id do registro é **o mesmo id do evento** que o cria (`visita_ponto.id = evento.id`), o que liga `fila_eventos`, `evento_sincronizacao` e o registro final;
- registros criados no servidor (cadastros, rondas geradas, auditoria) recebem UUIDv7 gerado na API;
- o servidor usa `evento_sincronizacao.id` (chave primária) para responder `DUPLICADO` a reenvios.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Id sequencial do servidor + id temporário no app | Ids curtos | Mapeamento temporário → definitivo no app, mais estados e mais defeitos | Complexidade desnecessária |
| UUIDv4 | Padrão conhecido, sem colisão prática | Não ordenável; índices fragmentados | O v7 tem as mesmas garantias e é ordenável |
| ULID | Ordenável, compacto | Fora do tipo `uuid` nativo do PostgreSQL | UUIDv7 cabe no tipo `uuid` |
| Chave de idempotência separada do id | Desacopla | Duas identidades para a mesma coisa | Um id só é mais rastreável |

## Consequências

**Positivas**

- Idempotência simples e auditável de ponta a ponta.
- A ordem de criação no aparelho é preservada no próprio id (útil para enviar a fila em ordem).
- Índices com inserção quase sequencial.

**Negativas e riscos**

- O id carrega o instante de criação (precisão de milissegundos): revela aproximadamente quando o registro foi criado. Isso é aceitável, porque o horário já é um dado do registro.
- O relógio do aparelho pode estar errado; o id não é usado como fonte de horário (os horários oficiais são os campos `*_em_dispositivo` e `recebido_em_servidor`, RN15).
- O servidor deve validar que o id é um UUID válido e nunca confiar nele para autorização.

**O que muda no dia a dia**

- Biblioteca `uuidv7` no app e na API; função utilitária única em `@painkiller/shared`.
- Testes de reenvio usam o mesmo id deliberadamente.

## Referências

- [RFC 9562 — UUIDs (inclui a versão 7)](https://www.rfc-editor.org/rfc/rfc9562)
- [06 · Fila de eventos](../06-sincronizacao-online-first.md#3-fila-de-eventos)
