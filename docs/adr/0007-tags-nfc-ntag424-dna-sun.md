# ADR-0007: Tags NFC NTAG 424 DNA com SUN validado no servidor

| | |
|---|---|
| **Situação** | **Proposta** (aguardando aprovação de orçamento pelo PO; a alternativa NTAG215 travada está prevista) |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S; aprovação de compra pelo PO e pela Coordenação de Vigilância |
| **Relacionados** | RF05, RF08, RF19 · RN01, RN07 · UC05, UC19 · HU-010, HU-018 · Riscos RK03, R02, RT03 |

## Contexto

A razão de existir do Guardião é comprovar que o vigilante passou pelo ponto (RN01). Tags NFC comuns (NTAG213/215/216) guardam um conteúdo fixo e um UID que podem ser lidos e copiados com qualquer celular: uma tag clonada, ou a simples cópia do conteúdo, permitiria "registrar" pontos sem estar lá. A validação geográfica ajuda, mas o GPS falha em ambientes internos ([ADR-0011](0011-validacao-geografica-sinaliza.md)). Tags com criptografia custam mais, e o orçamento ainda não está definido (premissa PR04).

## Decisão (proposta)

Usaremos tags **NXP NTAG 424 DNA** com o recurso **SUN** (*Secure Unique NFC*) habilitado:

- a cada leitura, a tag gera uma URL com UID e contador cifrados (`p`) e um CMAC (`m`);
- o **app não tem chaves** e apenas envia a URL bruta (`payloadNfc`);
- o **servidor** decifra, confere o UID com a tag ativa do ponto, valida o CMAC e o contador, e classifica a leitura como `VALIDA`, `INVALIDA` ou `REPLAY` (RN07);
- leituras `INVALIDA` ou `REPLAY` são gravadas, não contam para a conclusão e geram alerta;
- as chaves por tag são **diversificadas** a partir de uma chave mestra por lote; o banco guarda só a referência (`chave_sun_ref`); as chaves mestras ficam em arquivo de segredos na VM;
- o provisionamento é feito por script com leitor USB, em ambiente controlado.

**Alternativa aceita se o orçamento não sair:** NTAG215 com a memória travada contra escrita, cadastrada como `NTAG215_LEGADA`, com leituras `NAO_VERIFICAVEL` (contam para a conclusão) e mais peso na validação geográfica e na revisão. Uma implantação mista (424 nos pontos sensíveis) é permitida.

Detalhes técnicos em [11 · Tags NFC e SUN](../11-seguranca-e-lgpd.md#4-tags-nfc-e-sun).

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não (como principal) |
|---|---|---|---|
| NTAG213/215/216 sem trava | Baratas, fáceis de achar | Reescrita e clonagem triviais | Prova fraca |
| NTAG215 com trava de escrita | Baratas; impede reescrever a tag original | Clonagem do UID e do conteúdo continua possível | Mantida como plano B |
| MIFARE DESFire EV2/EV3 com autenticação mútua | Segurança alta | Autenticação exige chave no app (ou ida e volta online com o servidor a cada leitura); mais lenta | Chave no app é inaceitável e leitura online fere o offline |
| QR Code no ponto | Custo quase zero | Fotografável e copiável; exige mirar a câmera (mais toques) | Fere RN01 e RNF10 |
| Beacons BLE | Presença por proximidade | Bateria, custo, spoofing, precisão variável; ação passiva demais para prova | Não comprova intenção de vistoria |

## Consequências

**Positivas**

- Cópia da URL ou clonagem da tag são detectadas no servidor (QA-04), mesmo com leituras feitas offline.
- O app continua sem segredos: perder um aparelho não compromete as tags.

**Negativas e riscos**

- Custo por tag maior que o das NTAG215 e necessidade de leitor USB para provisionar.
- O provisionamento (troca de chaves, configuração do SDM) é trabalho novo para a equipe: spike na Sprint 1 (RT03).
- O vigilante não recebe, na V1, o resultado da validação SUN na hora (a validação é no servidor); leituras inválidas aparecem para o coordenador.
- Tag removida e lida em outro lugar continua `VALIDA`: a proteção contra isso é a validação geográfica e a fixação física (T03).

**O que muda no dia a dia**

- O desenvolvimento usa `LeitorNfcSimulado` e uma chave de teste recusada em produção.
- Mudança da situação deste ADR para "Aceita" depende da decisão de compra registrada na ata da Review.

## Referências

- NXP, NTAG 424 DNA — ficha técnica e nota de aplicação AN12196 (*features and hints*, com vetores de teste do SUN)
- NXP, AN10922 — diversificação de chaves simétricas
- [11 · Tags NFC e SUN](../11-seguranca-e-lgpd.md#4-tags-nfc-e-sun)
