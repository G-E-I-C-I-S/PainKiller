# ADR-0006: Armazenamento local cifrado (SQLCipher e AES-256-GCM)

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RNF03, RNF04, RNF11 · RN12, RN17 · HU-024, HU-029 · [ADR-0005](0005-online-first-fila-local-outbox.md) |

## Contexto

O app guarda temporariamente registros de ronda, localizações dos eventos e fotos de ocorrências até a confirmação do servidor. RNF04 exige criptografia desses dados, e RNF11 pede o perfil L2 do OWASP MASVS para armazenamento e criptografia. Celulares podem ser perdidos, compartilhados por posto ou ter o armazenamento copiado. Ao mesmo tempo, perder a chave significa perder registros não enviados.

## Decisão

- **Banco local:** SQLite com **SQLCipher** (banco inteiro cifrado com AES-256), via `expo-sqlite` com SQLCipher habilitado e Drizzle ORM.
- **Fotos:** arquivos JPEG cifrados com **AES-256-GCM** (IV aleatório de 12 bytes por arquivo, tag de autenticação guardada no banco), no armazenamento privado do app, apagados depois da confirmação do upload.
- **Chaves:** duas chaves aleatórias de 256 bits (banco e fotos) geradas na primeira execução e guardadas no **Android Keystore / iOS Keychain** via `expo-secure-store`, com acesso "somente com o aparelho desbloqueado, somente neste aparelho".
- As chaves **não** exigem autenticação biométrica a cada uso. A biometria protege a interface (sessão), não a chave, para não perder o banco quando o usuário cadastra uma nova digital.
- `android:allowBackup="false"`: banco e fotos não vão para backups do sistema.
- Tokens também ficam no `expo-secure-store`; nada sensível em `AsyncStorage`.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| SQLite sem cifra + cifra de campos sensíveis | Mais simples | Fácil esquecer um campo; metadados (horários, ids) ficam expostos | Não atende RNF04 de forma robusta |
| Realm / WatermelonDB com cifra | Bons recursos de sync | Modelos próprios; cifra e manutenção variam | Drizzle + SQLCipher é mais simples e tipado |
| Chave derivada de PIN do usuário | Chave fora do aparelho | Exige PIN próprio a cada abertura (piora RNF10); PIN esquecido perde dados | Fere a simplicidade |
| Chave vinculada à biometria | Mais forte | Troca de digital pode invalidar a chave e perder dados não enviados | Risco de perda (RT07) maior que o ganho |
| Fotos no banco (BLOB) | Um só arquivo | Banco grande e lento; backup e limpeza piores | Arquivos separados são mais eficientes |

## Consequências

**Positivas**

- Um banco copiado do aparelho é ilegível sem a chave do Keystore (QA-05).
- Fotos nunca ficam legíveis no armazenamento nem na galeria.

**Negativas e riscos**

- SQLCipher tem custo de desempenho pequeno; validar em aparelho de entrada (RT06).
- Em aparelho com root, um atacante com o aparelho desbloqueado pode extrair a chave. Mitigação: bloqueio por inatividade, revogação remota e permanência curta dos dados no aparelho.
- Restaurar o app em outro aparelho não traz os dados (intencional).

**O que muda no dia a dia**

- `src/core/crypto` concentra chaves e cifra, com revisão obrigatória do mantenedor (CODEOWNERS).
- O checklist MASVS de cada release inclui extrair o banco de um aparelho de teste e confirmar que não abre.

## Referências

- [SQLCipher](https://www.zetetic.net/sqlcipher/) · [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) · [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [OWASP MASVS-STORAGE e MASVS-CRYPTO](https://mas.owasp.org/MASVS/)
- [08 · Criptografia e armazenamento seguro](../08-app-mobile.md#11-criptografia-e-armazenamento-seguro)
