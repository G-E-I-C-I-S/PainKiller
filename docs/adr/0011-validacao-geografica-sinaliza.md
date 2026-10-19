# ADR-0011: Validação geográfica que sinaliza em vez de bloquear

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S; política a confirmar pelo PO para o campus piloto (PE02) |
| **Relacionados** | RF07 · RN06, RN08, RN19 · UC05, UC15 · HU-019, HU-040 · Riscos RK04, R07, RT04 |

## Contexto

RF07 pede registrar a localização aproximada na leitura NFC e validar se está dentro da área permitida. Na prática, o GPS dos celulares é impreciso dentro de prédios, em subsolos e perto de paredes de concreto: a posição pode vir com dezenas ou centenas de metros de erro, ou não vir. Se o app **recusar** leituras por causa disso, o vigilante fica impedido de registrar uma passagem verdadeira, a ronda fica incompleta sem culpa dele e a confiança no sistema cai. Se o app **ignorar** a localização, perde-se uma camada de proteção contra leituras fora do lugar.

## Decisão

1. A classificação geográfica (`ResultadoGeo`) segue a RN06, na ordem: `SEM_LOCALIZACAO` → `INDETERMINADO` (precisão pior que a máxima) → `DENTRO_AREA` → `FORA_AREA` (fora com certeza: distância − precisão > raio) → `INDETERMINADO` (ambíguo).
2. A política padrão do campus é **`SINALIZAR`**: a visita é sempre registrada; qualquer resultado diferente de `DENTRO_AREA`, ou localização simulada, deixa a visita **pendente de revisão** do coordenador.
3. A política **`BLOQUEAR`** é opcional por campus e só bloqueia `FORA_AREA`. `INDETERMINADO` e `SEM_LOCALIZACAO` nunca bloqueiam (D04).
4. O mesmo algoritmo (`classificarGeo` em `@painkiller/shared`) roda no app (retorno imediato) e no servidor; **o resultado do servidor prevalece** e é recalculado com o cadastro vigente.
5. A espera pela posição é limitada a 5 s; a leitura nunca fica presa ao GPS.
6. Visitas sinalizadas por geolocalização contam para a conclusão da ronda; a decisão do coordenador na revisão não muda o status da ronda, mas fica visível (D03).

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Bloquear sempre fora da área | Mais rigor aparente | Bloqueia passagens reais por limitação do GPS; frustra o vigilante | Fere RNF08 e o princípio "sinalizar, não travar" |
| Não validar (só registrar a posição) | Simples | Sem alerta de leituras suspeitas | Fere RF07 |
| Validação só no app | Retorno imediato | Fácil de contornar; regra muda só com nova versão do app | O servidor é a autoridade |
| Geofence do prédio em vez do ponto | Menos cadastro | Pouco útil em prédios grandes | Raio por ponto, com o do prédio como sugestão e referência de reserva |

## Consequências

**Positivas**

- O trabalho do vigilante não para por causa do GPS.
- As leituras suspeitas chegam a quem tem contexto (o coordenador), com o motivo e o mapa.
- A política pode endurecer por campus sem mudar código.

**Negativas e riscos**

- Pode haver muitas visitas sinalizadas no início (meta M02 ≤ 10%). Mitigação: calibração de raios e da precisão máxima no piloto.
- A revisão é trabalho a mais para o coordenador; a tela foi desenhada para ser rápida (atalhos de teclado, [10 · Visitas sinalizadas](../10-painel-web.md#45-visitas-sinalizadas-visitas-sinalizadas)).
- A localização simulada pode ser escondida em aparelhos com root. A proteção principal da prova é o SUN ([ADR-0007](0007-tags-nfc-ntag424-dna-sun.md)).

**O que muda no dia a dia**

- O cadastro de pontos sugere o raio do prédio; o piloto ajusta.
- A meta M02 é acompanhada nas Reviews da Sprint 5 em diante.

## Referências

- [02 · RN06](../02-requisitos.md#rn06--validação-geográfica)
- [03 · UC15](../03-casos-de-uso.md#uc15--revisar-visitas-sinalizadas)
