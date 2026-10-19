# ADR-0005: Online-first com fila local (outbox) e caminho único de escrita

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RNF01 a RNF07 · RN15, RN16, RN17 · UC11 · HU-016, HU-029, HU-030, HU-031 · [ADR-0006](0006-armazenamento-local-cifrado.md), [ADR-0008](0008-uuidv7-gerado-no-cliente.md) |

## Contexto

Há locais sem sinal nos campi (subsolos, áreas externas, casas de máquinas), e o app pode ser fechado ou o aparelho reiniciado a qualquer momento. Os requisitos exigem envio imediato quando há rede (RNF01), guarda e envio automático sem rede (RNF02), persistência a fechamento e reinício (RNF03), sem duplicidade (RNF05) e confirmação explícita do servidor (RNF06). Ter dois caminhos de código (um "online", chamando a API, e um "offline", gravando local) dobra os casos de teste e cria defeitos justamente na transição entre os dois.

## Decisão

Adotaremos o padrão **outbox transacional no aparelho** com **caminho único de escrita**:

1. Toda ação do vigilante grava o registro no banco local cifrado **e** insere um evento em `fila_eventos` **na mesma transação**.
2. O retorno ao vigilante (✓) só acontece depois do commit local.
3. Um **motor de sincronização** envia os eventos em lotes ordenados para `POST /api/v1/sincronizacao/eventos` assim que há rede; sem rede, espera gatilhos (volta da conexão, primeiro plano, timer, segundo plano).
4. Cada evento tem um **UUIDv7 gerado no aparelho**, reaproveitado em todas as retentativas; o servidor registra os ids em `evento_sincronizacao` e responde `DUPLICADO` para id já recebido.
5. Um evento só vira `CONFIRMADO` com `ACEITO` ou `DUPLICADO` do servidor; erros temporários usam backoff com *jitter*; `REJEITADO` fica visível ao vigilante.
6. O app envia **fatos** (iniciei, li, justifiquei, registrei, finalizei), nunca edita registros já enviados.

Especificação completa em [06-sincronizacao-online-first.md](../06-sincronizacao-online-first.md).

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Chamada direta à API com fallback offline | Parece simples | Dois caminhos; janela de perda entre a falha da chamada e a gravação local | Fonte clássica de perda e duplicidade |
| Sincronização de estado (replicação de tabelas, ex.: banco com *sync* embutido) | Menos código de envio | Conflitos de edição, dependência de produto específico, difícil auditar fatos | O domínio é de fatos imutáveis, não de documentos editáveis |
| Fila só em memória com persistência periódica | Rápido | Perde dados no encerramento forçado | Fere RNF03 |
| Idempotência por hash do conteúdo | Sem id no cliente | Duas leituras legítimas iguais colidiriam; difícil depurar | O UUIDv7 é explícito e rastreável |

## Consequências

**Positivas**

- Online e offline executam o mesmo código: testar um é testar o outro.
- Nenhum registro existe sem o evento correspondente, e vice-versa (atomicidade local).
- Reenvios são seguros por construção.
- O servidor fica fora do caminho crítico do vigilante: uma queda do servidor não para as rondas (QA-03).

**Negativas e riscos**

- O status mostrado no app é provisório até a confirmação (ex.: ronda concluída que o servidor rebaixa para incompleta por `REPLAY`).
- A fila precisa de tela própria para pendências e rejeições (HU-032).
- O logout fica bloqueado enquanto houver pendências (RN17), o que exige orientação no posto com aparelho compartilhado.

**O que muda no dia a dia**

- Nenhum código do app chama a API para gravar dados fora do motor de sincronização (regra de lint).
- Toda história que grava dados no app tem teste com modo avião (DoD).

## Referências

- Chris Richardson, padrão [Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [06 · Sincronização online-first](../06-sincronizacao-online-first.md)
