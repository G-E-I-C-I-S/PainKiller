# ADR-0012: Autenticação com JWT curto, refresh rotativo e biometria local

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RF01, RNF10, RNF11 · RN17, RN18 · UC01, UC02, UC21 · HU-005 a HU-008 |

## Contexto

O vigilante precisa de login individual (RF01), mas também de abrir o app rápido, à noite, muitas vezes sem internet (RNF10), e o app deve continuar registrando offline depois do primeiro login. Um aparelho perdido precisa ser bloqueado em minutos (RNF11, QA-05). O painel é usado no navegador, onde tokens em `localStorage` ficam expostos a XSS. Não há, por enquanto, SSO institucional disponível para a V1.

## Decisão

- **Login** com matrícula e senha (argon2id) em `POST /auth/login`, sempre online no primeiro acesso do aparelho.
- **Access token** JWT assinado com EdDSA, válido por **15 minutos**, contendo `sub`, `sid` (sessão), `papel`, `campus` e `dsp` (dispositivo). A API confere em toda requisição se a sessão não foi revogada (cache de 30 s).
- **Refresh token** opaco de 256 bits, válido por **30 dias**, **rotativo**: cada uso gera um novo e invalida o anterior; reapresentar um refresh já trocado revoga a **família** inteira.
- **App:** sessão vinculada ao **dispositivo**; tokens no `expo-secure-store`; aberturas seguintes desbloqueadas por **biometria ou PIN do aparelho** (`expo-local-authentication`), que funcionam offline; bloqueio por inatividade de 10 min; logout só com a fila vazia (RN17).
- **Painel:** access token só em memória; refresh em cookie `__Host-` `HttpOnly`, `Secure`, `SameSite=Strict`, restrito a `/api/v1/auth`, com header customizado no refresh.
- **Revogação:** o administrador revoga o aparelho e todas as sessões vinculadas; o efeito vale em até 1 minuto.
- **SSO institucional:** avaliado para a V1.1; a camada de identidade (`nucleo/identidade`) isola o método de login para permitir a troca.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Sessão em servidor com cookie (sem JWT) | Revogação imediata, simples no navegador | No app, exige ida ao servidor para cada validação; cookies em apps nativos são incômodos | O JWT curto + checagem de sessão dá revogação rápida e funciona igual no app e no painel |
| JWT longo sem refresh | Simples | Revogação depende de lista negra; token roubado vale por muito tempo | Fere RNF11 |
| Senha a cada abertura do app | Mais "forte" | Lento, com luvas e lanterna; fere RNF10 | A biometria local entrega o mesmo controle com 1 toque |
| PIN próprio do app | Independe da biometria do aparelho | Mais um segredo para lembrar; suporte a esquecimento | O PIN/biometria do sistema já existe e é obrigatório (E7 do UC01) |
| Tokens do painel em `localStorage` | Simples | Exposição a XSS | Cookie `HttpOnly` + memória é mais seguro |

## Consequências

**Positivas**

- Abrir o app custa 1 toque (biometria) e funciona sem rede.
- Um aparelho perdido é bloqueado rapidamente e não abre sem a biometria do dono.
- Roubo de refresh token é detectado pela rotação.

**Negativas e riscos**

- A checagem de sessão a cada requisição custa uma consulta (com cache); aceitável no volume da V1.
- Várias abas do painel precisam coordenar o refresh para não disparar a detecção de reuso (resolvido com `BroadcastChannel`).
- Exige que o aparelho tenha bloqueio de tela configurado; aparelhos de posto precisam ser preparados pela TI.

**O que muda no dia a dia**

- Testes de integração cobrem login, limite de tentativas, refresh, reuso e revogação (HU-005 a HU-008).
- Chave de assinatura e *pepper* ficam em segredos da VM ([11 · Segredos](../11-seguranca-e-lgpd.md#11-segredos)).

## Referências

- [OWASP ASVS — Session Management](https://owasp.org/www-project-application-security-verification-standard/)
- [OAuth 2.0 Security Best Current Practice — refresh token rotation (RFC 9700)](https://www.rfc-editor.org/rfc/rfc9700)
- [07 · Autenticação e sessão](../07-api.md#2-autenticação-e-sessão)
