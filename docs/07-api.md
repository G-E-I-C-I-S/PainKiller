# API

Parte da [documentação do Guardião](README.md).

Este documento descreve a API REST do Guardião IFSULDEMINAS: convenções, autenticação, formato de erros, a lista de endpoints da V1, os contratos principais e a matriz de permissões por papel. O contrato executável é o documento **OpenAPI 3.1** gerado a partir do código (RNF13), publicado no Swagger UI de homologação. Quando este documento e o OpenAPI divergirem, o OpenAPI vale e este documento deve ser corrigido no mesmo PR.

## Sumário

1. [Convenções](#1-convenções)
2. [Autenticação e sessão](#2-autenticação-e-sessão)
3. [Erros (RFC 9457)](#3-erros-rfc-9457)
4. [Listas, filtros e paginação](#4-listas-filtros-e-paginação)
5. [Mapa de endpoints](#5-mapa-de-endpoints)
6. [Contratos do app](#6-contratos-do-app)
7. [Sincronização](#7-sincronização)
8. [Contratos do painel](#8-contratos-do-painel)
9. [Cadastros](#9-cadastros)
10. [Permissões (RBAC)](#10-permissões-rbac)
11. [Limites e proteção](#11-limites-e-proteção)
12. [Versionamento e compatibilidade](#12-versionamento-e-compatibilidade)
13. [OpenAPI e Swagger UI](#13-openapi-e-swagger-ui)

---

## 1. Convenções

| Item | Convenção |
|---|---|
| Base | `https://<dominio-institucional>/api/v1` (produção), `http://localhost:3000/api/v1` (local) |
| Formato | JSON UTF-8. Fotos em `image/jpeg` |
| Nomes | Recursos no plural e em `kebab-case` (`pontos-ronda`, `tags-nfc`). Campos em `camelCase` (`lidoEmDispositivo`). Enums em `MAIUSCULAS` iguais aos do banco |
| Identificadores | UUIDv7 em texto |
| Datas | ISO 8601 em UTC com `Z` (`2026-10-26T01:12:44.020Z`). Datas sem hora em `AAAA-MM-DD` no fuso do campus |
| Ações que não são CRUD | Sub-recurso com substantivo: `POST /rondas/{id}/encerramento`, `POST /dispositivos/{id}/revogacao` |
| Exclusão | **Não existe `DELETE`** (RN14). Desativação é `POST /{recurso}/{id}/desativacao` com motivo; reativação é `POST /{recurso}/{id}/reativacao` |
| Atualização parcial | `PATCH` com somente os campos alterados |
| Concorrência otimista | Recursos editáveis no painel devolvem `ETag`. `PATCH` exige `If-Match`; versão divergente responde `412` |
| Correlação | Header `X-Request-Id` aceito e devolvido (gerado pela API se ausente); aparece nos logs e na auditoria |
| Versão do app | O app envia `X-Versao-App` em todas as requisições |

## 2. Autenticação e sessão

A estratégia completa está no [ADR-0012](adr/0012-autenticacao-jwt-refresh-biometria.md) e em [11-seguranca-e-lgpd.md](11-seguranca-e-lgpd.md).

| Item | App | Painel |
|---|---|---|
| Login | `POST /auth/login` com matrícula, senha e dados do aparelho | `POST /auth/login` com matrícula e senha |
| Access token | JWT de 15 min no corpo da resposta, guardado em memória e no `expo-secure-store` | JWT de 15 min no corpo da resposta, **só em memória** |
| Refresh token | Opaco, 30 dias, no corpo da resposta, guardado no `expo-secure-store` | Opaco, 30 dias, em cookie `__Host-guardiao_refresh` (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth`) |
| Envio | `Authorization: Bearer <token>` | `Authorization: Bearer <token>` |
| Renovação | `POST /auth/refresh` com o refresh no corpo | `POST /auth/refresh` com o cookie e o header `X-Requested-With: guardiao-painel` |
| Rotação | Todo refresh gera um novo par e invalida o anterior. Reuso de um refresh já trocado revoga a família inteira (HU-006) | Igual |

Conteúdo do access token (sem dados pessoais além do id):

```json
{
  "sub": "0192ef90-0000-7000-8000-0000000000u1",
  "sid": "0192ef90-0000-7000-8000-0000000000s1",
  "papel": "VIGILANTE",
  "campus": "0192ef90-0000-7000-8000-0000000000c1",
  "dsp": "0192ef90-0000-7000-8000-0000000000d1",
  "iat": 1792980000,
  "exp": 1792980900
}
```

Assinatura `EdDSA` (Ed25519) com chave privada só na API. Em toda requisição, a API confere se a sessão `sid` não foi revogada (cache de 30 s), o que permite revogar um aparelho em até 1 minuto.

### `POST /auth/login`

```json
{
  "matricula": "20230001",
  "senha": "••••••••",
  "dispositivo": {
    "identificadorInstalacao": "8f1c0b7e-3a5d-4d2e-9f6a-2b7c1d0e4f5a",
    "plataforma": "android",
    "modelo": "Modelo de referência",
    "versaoSo": "14",
    "versaoApp": "0.2.0"
  }
}
```

Resposta `200`:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "rt_...",
  "expiraEm": "2026-10-13T22:15:00.000Z",
  "usuario": {
    "id": "0192ef90-0000-7000-8000-0000000000u1",
    "nome": "Vigilante de Teste",
    "papel": "VIGILANTE",
    "campusId": "0192ef90-0000-7000-8000-0000000000c1",
    "deveTrocarSenha": false
  },
  "avisoPrivacidadePendente": { "versao": 1 }
}
```

| Situação | Status | `codigo` |
|---|---|---|
| Matrícula ou senha incorretas | 401 | `CREDENCIAIS_INVALIDAS` (mesma mensagem para os dois casos) |
| Usuário desativado | 403 | `USUARIO_INATIVO` |
| Aparelho revogado | 403 | `DISPOSITIVO_REVOGADO` |
| Papel sem acesso ao canal (ex.: `COORDENADOR` no app) | 403 | `PAPEL_SEM_ACESSO_AO_CANAL` |
| Muitas tentativas | 429 | `MUITAS_TENTATIVAS`, com `Retry-After` |
| App abaixo da versão mínima | 426 | `VERSAO_APP_NAO_SUPORTADA` |

O canal é identificado pela presença do objeto `dispositivo` (app) ou pelo header `X-Requested-With: guardiao-painel` (painel).

## 3. Erros (RFC 9457)

Todas as respostas de erro usam `Content-Type: application/problem+json`.

```json
{
  "type": "https://<dominio-institucional>/problemas/ronda-fora-da-janela",
  "title": "Ronda fora da janela",
  "status": 422,
  "detail": "A ronda só pode ser iniciada a partir de 21:30.",
  "instance": "/api/v1/rondas/0192ef90-0000-7000-8000-000000000001",
  "codigo": "RONDA_FORA_DA_JANELA",
  "requestId": "req_01J9...",
  "erros": [
    { "campo": "inicioPrevisto", "mensagem": "..." }
  ]
}
```

| Status | Uso |
|---|---|
| 400 | JSON malformado |
| 401 | Sem token, token inválido ou expirado, sessão revogada |
| 403 | Papel ou escopo sem permissão |
| 404 | Recurso inexistente **ou fora do escopo** do usuário (para não revelar existência) |
| 409 | Conflito de estado (matrícula duplicada, ronda já iniciada, revisão concorrente) |
| 412 | `If-Match` divergente |
| 413 | Lote ou foto acima do limite |
| 422 | Validação de campos ou regra de negócio |
| 426 | Versão do app não suportada |
| 429 | Limite de requisições |
| 500 | Erro inesperado (sem detalhes internos; o `requestId` permite achar o log) |
| 503 | Dependência indisponível (banco, MinIO) |

O campo `codigo` é estável e documentado no OpenAPI. O app e o painel decidem o texto exibido pelo `codigo`, não pelo `detail`.

## 4. Listas, filtros e paginação

```http
GET /api/v1/rondas?de=2026-11-01&ate=2026-11-07&vigilanteId=...&predioId=...&status=INCOMPLETA&pagina=1&tamanho=20&ordenar=-recebidoEmServidor
```

```json
{
  "itens": [ /* ... */ ],
  "pagina": 1,
  "tamanho": 20,
  "total": 45
}
```

- Paginação por página e tamanho (padrão 20, máximo 100). Para a auditoria, que cresce mais, há também paginação por cursor (`?apos=<seq>`).
- `ordenar` aceita campos permitidos por recurso; prefixo `-` para ordem decrescente. O padrão das listas operacionais é o horário do servidor (RN15).
- Filtros de período usam a data local do campus; a API converte para UTC.
- Filtros fora do escopo do usuário não são erro: simplesmente não retornam dados (CA17.4). Um filtro explícito por um prédio fora do escopo responde `403` (HU-006).

## 5. Mapa de endpoints

Legenda de papéis: **V** vigilante, **C** coordenador, **R** responsável, **A** administrador. A matriz completa está na [seção 10](#10-permissões-rbac).

### Sistema

| Método e rota | Descrição | Papéis | HU |
|---|---|---|---|
| `GET /saude` | Vivacidade (processo no ar) e versão | público | HU-042 |
| `GET /saude/prontidao` | Banco, Redis e MinIO disponíveis | público (sem detalhes internos) | HU-042 |

### Identidade

| Método e rota | Descrição | Papéis | HU |
|---|---|---|---|
| `POST /auth/login` | Login | público | HU-005, HU-006 |
| `POST /auth/refresh` | Renova o par de tokens | público (com refresh) | HU-005, HU-006 |
| `POST /auth/logout` | Revoga a sessão atual | todos | HU-005 |
| `GET /auth/eu` | Dados do usuário autenticado e escopo | todos | HU-006 |
| `POST /auth/troca-senha` | Troca a própria senha | todos | HU-007 |
| `GET /aviso-privacidade/vigente` | Texto e versão vigentes | todos | HU-044 |
| `POST /aviso-privacidade/ciencia` | Registra a ciência da versão | todos | HU-044 |
| `GET /usuarios` · `POST /usuarios` · `GET /usuarios/{id}` · `PATCH /usuarios/{id}` | Usuários | A (C consulta vigilantes do campus) | HU-007 |
| `POST /usuarios/{id}/redefinicao-senha` | Gera senha temporária | A | HU-007 |
| `POST /usuarios/{id}/desativacao` · `/reativacao` | Desativação lógica | A | HU-007, HU-039 |
| `GET /dispositivos` · `GET /dispositivos/{id}` | Aparelhos registrados | A | HU-007 |
| `POST /dispositivos/{id}/revogacao` | Revoga o aparelho e as sessões | A | HU-007 |

### App do vigilante

| Método e rota | Descrição | Papéis | HU |
|---|---|---|---|
| `GET /vigilante/rondas?de=&ate=` | Rondas atribuídas ao usuário do token, com os pontos copiados | V | HU-015 |
| `GET /vigilante/pacote-offline` | Dados de referência com ETag | V, A | HU-015, HU-018 |
| `POST /sincronizacao/eventos` | Lote de eventos | V | HU-016, HU-030 |
| `PUT /ocorrencias/{ocorrenciaId}/fotos/{fotoId}` | Upload idempotente da foto | V (autor da ocorrência) | HU-031 |
| `GET /tags-nfc?uid={uidHex}` | Consulta de vínculo no modo instalação | A | HU-010 |
| `POST /tags-nfc` | Vincula tag a ponto | A | HU-010 |
| `POST /tags-nfc/{id}/substituicao` | Substitui a tag de um ponto | A | HU-010 |

### Locais e cadastros

| Método e rota | Descrição | Papéis | HU |
|---|---|---|---|
| `GET/POST /campi`, `GET/PATCH /campi/{id}` | Campi | A (C, R consultam o próprio) | HU-009 |
| `GET/PATCH /campi/{id}/configuracao` | Configuração do campus | A (C consulta) | HU-009 |
| `GET/POST /predios`, `GET/PATCH /predios/{id}` | Prédios com geofence | A (C consulta) | HU-009 |
| `GET/POST /andares`, `GET/PATCH /andares/{id}` | Andares | A (C consulta) | HU-009 |
| `GET/POST /setores`, `GET/PATCH /setores/{id}` | Setores | A (C consulta) | HU-009 |
| `GET/POST /pontos-ronda`, `GET/PATCH /pontos-ronda/{id}` | Pontos de ronda | A (C consulta) | HU-010 |
| `GET /tags-nfc`, `GET /tags-nfc/{id}` | Tags | A (C consulta) | HU-010 |
| `GET/POST /responsaveis-locais`, `PATCH /responsaveis-locais/{id}` | Responsáveis por local | A | HU-011 |
| `GET/POST /tipos-ocorrencia`, `PATCH /tipos-ocorrencia/{id}` | Tipos de ocorrência | A (C consulta) | HU-011 |
| `GET/PUT /campi/{id}/regra-notificacao` | Regra de notificação | A | HU-027 |
| `POST /{recurso}/{id}/desativacao` · `/reativacao` | Para todos os cadastros acima | A | HU-039 |

### Planejamento

| Método e rota | Descrição | Papéis | HU |
|---|---|---|---|
| `GET/POST /roteiros`, `GET/PATCH /roteiros/{id}` | Roteiros com pontos, ordem e obrigatoriedade | C (A consulta) | HU-012 |
| `GET/POST /agendas`, `GET/PATCH /agendas/{id}` | Agendas recorrentes | C | HU-013 |
| `POST /rondas` | Ronda avulsa | C | HU-014 |
| `POST /rondas/{id}/cancelamento` | Cancela ronda `AGENDADA` | C | HU-014 |
| `POST /rondas/{id}/encerramento` | Encerramento administrativo | C | HU-035 |

### Painel e acompanhamento

| Método e rota | Descrição | Papéis | HU |
|---|---|---|---|
| `GET /painel/resumo?data=` | Indicadores e alertas do dia | C, R | HU-034 |
| `GET /rondas` | Histórico filtrável de rondas | C, R | HU-036 |
| `GET /rondas/{id}` | Detalhe com linha do tempo | C, R | HU-035 |
| `GET /visitas?statusRevisao=PENDENTE` | Visitas sinalizadas | C | HU-040 |
| `GET /visitas/{id}` | Detalhe da visita | C, R | HU-040 |
| `POST /visitas/{id}/revisao` | Aceitar ou rejeitar | C | HU-040 |
| `GET /ocorrencias`, `GET /ocorrencias/{id}` | Ocorrências | C, R | HU-025, HU-036 |
| `POST /ocorrencias/{id}/status` | Muda o status com comentário | C | HU-025 |
| `GET /ocorrencias/{id}/fotos/{fotoId}/url` | URL assinada de 5 min (auditada) | C, R | HU-025 |
| `GET /ocorrencias/{id}/notificacoes` | Status dos envios | C, A | HU-026 |
| `POST /notificacoes/{id}/reenvio` | Nova tentativa de uma notificação `FALHOU` (auditada) | A | HU-026 |
| `GET /auditoria` | Trilha com filtros | A | HU-038 |
| `GET /auditoria/verificacao` | Resultado da última verificação da cadeia | A | HU-038 |
| `POST /auditoria/verificacao` | Enfileira uma verificação imediata da cadeia | A | HU-038 |

## 6. Contratos do app

### `GET /vigilante/rondas?de=2026-10-26&ate=2026-10-27`

```json
{
  "itens": [
    {
      "id": "0192ef90-0000-7000-8000-000000000001",
      "roteiro": { "id": "...", "nome": "Noturna P1 e P2", "exigeOrdem": false },
      "status": "AGENDADA",
      "inicioPrevisto": "2026-10-27T01:00:00.000Z",
      "fimPrevisto": "2026-10-27T02:00:00.000Z",
      "toleranciaInicioMin": 30,
      "pontos": [
        { "pontoRondaId": "...", "ordem": 1, "obrigatorio": true },
        { "pontoRondaId": "...", "ordem": 2, "obrigatorio": false }
      ],
      "canceladaEm": null
    }
  ],
  "atualizadoEm": "2026-10-26T21:00:03.120Z"
}
```

Os detalhes dos pontos (nome, prédio, referência, raio) vêm do pacote offline.

### `GET /vigilante/pacote-offline`

```http
GET /api/v1/vigilante/pacote-offline
If-None-Match: "pk-9f2c1a"
```

Resposta `304` (nada mudou) ou `200` com `ETag`:

```json
{
  "versao": "pk-a71b03",
  "geradoEm": "2026-10-26T21:00:00.000Z",
  "campus": {
    "id": "...", "nome": "Campus Fictício",
    "configuracao": { "politicaGeo": "SINALIZAR", "precisaoMaximaM": 100, "toleranciaInicioMin": 30, "inatividadeBloqueioMin": 10, "limiteDesvioRelogioMin": 5 }
  },
  "predios": [ { "id": "...", "codigo": "P1", "nome": "Prédio 1", "latitude": -21.785, "longitude": -46.561, "raioGeofenceM": 80 } ],
  "andares": [ ],
  "setores": [ ],
  "pontos": [ { "id": "...", "predioId": "...", "andarId": null, "setorId": null, "nome": "Corredor norte", "instrucoes": "Conferir porta corta-fogo", "latitude": null, "longitude": null, "raioToleranciaM": 30 } ],
  "tags": [ { "uidHex": "04A1B2C3D4E5F6", "tipo": "NTAG424_DNA", "pontoRondaId": "..." } ],
  "tiposOcorrencia": [ { "id": "...", "nome": "Vazamento de água", "gravidadePadrao": "ALTA", "ordemExibicao": 3, "icone": "gota" } ],
  "avisoPrivacidade": { "versao": 1 }
}
```

### `PUT /ocorrencias/{ocorrenciaId}/fotos/{fotoId}`

```http
PUT /api/v1/ocorrencias/0192.../fotos/0192...
Content-Type: image/jpeg
Content-Length: 412331
Content-SHA256: 6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b
X-Capturada-Em-Dispositivo: 2026-10-26T01:15:02.000Z

<bytes JPEG>
```

| Resposta | Quando |
|---|---|
| `201` | Foto nova gravada |
| `200` | Mesmo `fotoId` e mesmo hash já recebidos (idempotência) |
| `404 OCORRENCIA_NAO_ENCONTRADA` | Ocorrência ainda não aceita ou de outro usuário |
| `409 FOTO_CONFLITO` | Mesmo `fotoId` com outro hash |
| `413 FOTO_MUITO_GRANDE` | Acima de 2 MB |
| `422 FOTO_HASH_DIVERGENTE` | Hash do corpo diferente do header |
| `422 FOTO_NAO_ANUNCIADA` | `fotoId` não estava na lista do evento |
| `422 LIMITE_DE_FOTOS` | Já há 5 fotos |

### Modo instalação: `POST /tags-nfc`

```json
{
  "pontoRondaId": "...",
  "uidHex": "04A1B2C3D4E5F6",
  "tipo": "NTAG424_DNA",
  "leituraSun": "https://<dominio-institucional>/t?p=...&m=..."
}
```

A API localiza a chave SUN pelo UID (arquivo de segredos gerado no provisionamento), valida a leitura, grava `chave_sun_ref` e responde `201` com a tag. Erros: `409 TAG_JA_VINCULADA`, `409 PONTO_JA_TEM_TAG_ATIVA` (use a substituição), `422 SUN_INVALIDO`.

## 7. Sincronização

O comportamento completo (ordem, backoff, dependências, cenários de falha) está em [06-sincronizacao-online-first.md](06-sincronizacao-online-first.md). Aqui fica o contrato.

### `POST /sincronizacao/eventos`

| Item | Valor |
|---|---|
| Headers obrigatórios | `Authorization`, `X-Enviado-Em-Dispositivo`, `X-Versao-App` |
| Corpo | `{ "eventos": EventoSincronizacao[] }`, 1 a 50 eventos, até 512 KB |
| Resposta | `200` com um resultado por evento, na mesma ordem |
| Idempotência | Pelo `id` de cada evento |

```ts
// packages/shared/src/sincronizacao/contrato.ts (ilustrativo)
const Localizacao = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  precisaoM: z.number().nonnegative(),
}).nullable();

const Base = z.object({
  id: z.string().uuid(),
  criadoEmDispositivo: z.string().datetime(),
});

export const EventoSincronizacao = z.discriminatedUnion('tipo', [
  Base.extend({ tipo: z.literal('RONDA_INICIADA'), dados: z.object({
    rondaId: z.string().uuid(), iniciadaEmDispositivo: z.string().datetime(), localizacao: Localizacao,
  }) }),
  Base.extend({ tipo: z.literal('PONTO_VISITADO'), dados: z.object({
    rondaId: z.string().uuid(), pontoRondaId: z.string().uuid(), uidHex: z.string().regex(/^[0-9A-F]{14}$/),
    payloadNfc: z.string().max(512), lidoEmDispositivo: z.string().datetime(), localizacao: Localizacao,
    localizacaoSimulada: z.boolean(), resultadoGeoDispositivo: ResultadoGeo, foraDaOrdem: z.boolean(),
  }) }),
  Base.extend({ tipo: z.literal('PONTO_JUSTIFICADO'), dados: z.object({
    rondaId: z.string().uuid(), pontoRondaId: z.string().uuid(), motivo: MotivoJustificativa,
    descricao: z.string().min(10).max(1000), justificadaEmDispositivo: z.string().datetime(), localizacao: Localizacao,
  }) }),
  Base.extend({ tipo: z.literal('OCORRENCIA_REGISTRADA'), dados: z.object({
    rondaId: z.string().uuid(), tipoOcorrenciaId: z.string().uuid(), gravidade: Gravidade,
    descricao: z.string().max(2000).nullable(), predioId: z.string().uuid(),
    andarId: z.string().uuid().nullable(), setorId: z.string().uuid().nullable(), pontoRondaId: z.string().uuid().nullable(),
    registradaEmDispositivo: z.string().datetime(), localizacao: Localizacao, localizacaoSimulada: z.boolean(),
    fotos: z.array(z.object({ fotoId: z.string().uuid(), sha256: z.string().length(64), tamanhoBytes: z.number().int() })).max(5),
  }) }),
  Base.extend({ tipo: z.literal('RONDA_FINALIZADA'), dados: z.object({
    rondaId: z.string().uuid(), finalizadaEmDispositivo: z.string().datetime(), localizacao: Localizacao,
    finalizadaComPendencias: z.boolean(),
  }) }),
]);
```

Resultado por evento:

```ts
type ResultadoSincronizacao =
  | { id: string; resultado: 'ACEITO' | 'DUPLICADO' }
  | { id: string; resultado: 'REJEITADO'; codigo: string; mensagem: string };
```

Os códigos de rejeição estão em [06 · Processamento no servidor](06-sincronizacao-online-first.md#5-processamento-no-servidor).

## 8. Contratos do painel

### `GET /painel/resumo?data=2026-11-04`

```json
{
  "data": "2026-11-04",
  "atualizadoEm": "2026-11-04T12:00:30.000Z",
  "rondas": {
    "agendadas": 4, "emAndamento": 2, "atrasadas": 1, "concluidas": 18,
    "incompletas": 2, "naoRealizadas": 1, "canceladas": 0
  },
  "alertas": {
    "visitasPendentesRevisao": 3,
    "leiturasInvalidasOuReplay": 1,
    "ocorrenciasAbertasAltaOuCritica": 2,
    "notificacoesFalhas": 0
  },
  "listas": {
    "atrasadas": [ { "id": "...", "roteiro": "Noturna P1 e P2", "vigilante": "Vig-01", "atrasoMin": 12 } ],
    "ocorrenciasRecentes": [ { "id": "...", "tipo": "Vazamento de água", "gravidade": "ALTA", "predio": "P1", "recebidoEmServidor": "..." } ]
  }
}
```

O painel consulta este endpoint a cada 30 s (CA16.4). A resposta usa `Cache-Control: no-store`.

### `GET /rondas/{id}`

Traz a ronda, os pontos copiados (`ronda_ponto`) com a situação de cada um e a **linha do tempo** ordenada pelo horário do servidor:

```json
{
  "id": "...",
  "status": "INCOMPLETA",
  "temVisitasRejeitadas": false,
  "inicioPrevisto": "...", "fimPrevisto": "...",
  "iniciadaEmDispositivo": "...", "iniciadaRecebidoEmServidor": "...",
  "finalizadaEmDispositivo": "...", "finalizadaRecebidoEmServidor": "...",
  "encerramento": null,
  "pontos": [
    { "pontoRondaId": "...", "nome": "Corredor norte", "ordem": 1, "obrigatorio": true, "situacao": "VISITADO" },
    { "pontoRondaId": "...", "nome": "Almoxarifado", "ordem": 2, "obrigatorio": true, "situacao": "JUSTIFICADO" }
  ],
  "linhaDoTempo": [
    { "tipo": "INICIO", "emDispositivo": "...", "recebidoEmServidor": "...", "localizacao": { } },
    { "tipo": "VISITA", "id": "...", "ponto": "Corredor norte", "emDispositivo": "...", "recebidoEmServidor": "...",
      "resultadoGeo": "DENTRO_AREA", "validacaoTag": "VALIDA", "statusRevisao": "NAO_REQUER", "foraDaOrdem": false,
      "recebidoAposEncerramento": false, "desvioRelogioMs": 591 },
    { "tipo": "JUSTIFICATIVA", "id": "...", "ponto": "Almoxarifado", "motivo": "ACESSO_BLOQUEADO", "descricao": "..." },
    { "tipo": "OCORRENCIA", "id": "...", "tipoOcorrencia": "Porta ou janela aberta", "gravidade": "MEDIA" },
    { "tipo": "FIM", "emDispositivo": "...", "recebidoEmServidor": "...", "finalizadaComPendencias": true }
  ]
}
```

`situacao` de um ponto: `PENDENTE`, `VISITADO`, `VISITA_SINALIZADA`, `VISITA_INVALIDA` (leitura `INVALIDA`/`REPLAY` sem leitura válida), `JUSTIFICADO`.

### `POST /visitas/{id}/revisao`

```json
{ "decisao": "REJEITADA", "observacao": "Leitura feita a 300 m do ponto, confirmado com o vigilante." }
```

- `decisao`: `ACEITA` ou `REJEITADA`. Observação obrigatória (mínimo 10 caracteres) para `REJEITADA`.
- `409 VISITA_JA_REVISADA` se outro coordenador revisou antes (E2 do UC15).
- `422 VISITA_NAO_PENDENTE` se a visita não está `PENDENTE`.

### `POST /ocorrencias/{id}/status`

```json
{ "statusNovo": "EM_ATENDIMENTO", "comentario": "Equipe de manutenção acionada" }
```

Transições permitidas: `ABERTA → EM_ATENDIMENTO`, `ABERTA → ARQUIVADA`, `EM_ATENDIMENTO → RESOLVIDA`, `RESOLVIDA → ARQUIVADA`. Outras: `422 TRANSICAO_INVALIDA`. Comentário obrigatório para `RESOLVIDA` e `ARQUIVADA`.

### `GET /ocorrencias/{id}/fotos/{fotoId}/url`

```json
{ "url": "https://<dominio-institucional>/fotos/...?X-Amz-Signature=...", "expiraEm": "2026-11-04T12:05:30.000Z", "miniaturaUrl": "..." }
```

Cada chamada grava auditoria `VISUALIZAR_FOTO`. O Caddy encaminha `/fotos/*` ao MinIO; o bucket não é público.

### `POST /rondas/{id}/encerramento`

```json
{ "motivo": "Vigilante deslocado para atendimento" }
```

Só para ronda `EM_ANDAMENTO`. Resultado: `INCOMPLETA` com `encerramento_motivo` e `encerrada_por_id` (RN09).

## 9. Cadastros

Os cadastros seguem um padrão único:

| Operação | Rota | Observação |
|---|---|---|
| Listar | `GET /{recurso}?ativo=true&busca=&pagina=` | `ativo` padrão `true`; `ativo=todos` mostra também os inativos |
| Criar | `POST /{recurso}` | Auditoria `CRIAR` |
| Ler | `GET /{recurso}/{id}` | Devolve `ETag` |
| Alterar | `PATCH /{recurso}/{id}` com `If-Match` | Auditoria `ATUALIZAR` com antes e depois |
| Desativar | `POST /{recurso}/{id}/desativacao` com `{ "motivo": "..." }` | Motivo obrigatório. Auditoria `DESATIVAR` |
| Reativar | `POST /{recurso}/{id}/reativacao` | Auditoria `REATIVAR` |

Exemplo, `POST /predios`:

```json
{ "campusId": "...", "codigo": "P1", "nome": "Prédio 1", "latitude": -21.785412, "longitude": -46.561230, "raioGeofenceM": 80 }
```

Validações: latitude entre −90 e 90, longitude entre −180 e 180, raio de 1 a 2000 m, código único no campus (`409 CODIGO_DUPLICADO`). Desativar um ponto usado em roteiro ativo responde `409 PONTO_EM_ROTEIRO_ATIVO` com a lista de roteiros (CA19.5).

## 10. Permissões (RBAC)

A autorização é sempre aplicada na API, com dois guards: **papel** (o que pode) e **escopo** (sobre quais dados). O app e o painel apenas escondem o que o usuário não pode fazer.

| Escopo | Regra |
|---|---|
| `VIGILANTE` | Somente as próprias rondas e registros, no próprio campus |
| `COORDENADOR` | Todo o próprio campus |
| `RESPONSAVEL` | Prédios e setores de `responsavel_local` (um responsável por prédio vê todos os setores do prédio) |
| `ADMINISTRADOR` | Todo o próprio campus. Um administrador com `campus_id` da reitoria (configuração da instalação) pode ser global |

| Ação | V | C | R | A |
|---|---|---|---|---|
| Entrar no app | ✓ | — | — | ✓ (modo instalação) |
| Entrar no painel | — | ✓ | ✓ | ✓ |
| Ver as próprias rondas e enviar eventos | ✓ | — | — | — |
| Vincular e substituir tags | — | — | — | ✓ |
| Manter cadastros (locais, pontos, tipos, responsáveis, regras) | — | consulta | — | ✓ |
| Manter usuários e revogar aparelhos | — | — | — | ✓ |
| Criar roteiros e agendas, ronda avulsa, cancelar | — | ✓ | — | consulta |
| Encerramento administrativo | — | ✓ | — | — |
| Painel do dia e histórico | — | ✓ (campus) | ✓ (locais) | — |
| Revisar visitas sinalizadas | — | ✓ | — | — |
| Ver ocorrências e fotos | — | ✓ | ✓ (locais) | — |
| Mudar status de ocorrência | — | ✓ | — | — |
| Ver status das notificações | — | ✓ | — | ✓ |
| Consultar a auditoria | — | — | — | ✓ |

O `ADMINISTRADOR` não vê rondas, ocorrências nem fotos pelo painel (separação de funções e minimização). Um campus que precise de outro arranjo registra a decisão num ADR.

Implementação (ilustrativa):

```ts
@Post(':id/revisao')
@Papeis('COORDENADOR')
@Escopo('visita')            // carrega a visita e confere o campus do usuário
@Auditar('REVISAR_VISITA')
revisar(@Param('id') id: string, @Body() corpo: RevisaoVisitaDto, @UsuarioAtual() u: Usuario) {
  return this.visitas.revisar(id, corpo, u);
}
```

Todo endpoint novo exige teste de integração com pelo menos um papel sem permissão e um usuário fora do escopo (DoD).

## 11. Limites e proteção

| Item | Limite |
|---|---|
| Login | 5 tentativas por minuto por IP + matrícula; bloqueio progressivo (1, 5, 15 min) |
| Refresh | 30 por minuto por sessão |
| Sincronização | 60 lotes por minuto por dispositivo |
| Fotos | 30 uploads por minuto por dispositivo, até 2 MB cada |
| Demais rotas autenticadas | 300 requisições por minuto por usuário |
| Corpo JSON | 512 KB |
| Tempo máximo de requisição | 30 s (fotos: 60 s) |

Respostas `429` trazem `Retry-After`. Os contadores ficam no Redis.

Cabeçalhos de segurança (aplicados pelo Caddy e pela API): `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy` restritiva no painel, CORS liberado apenas para a origem do painel.

## 12. Versionamento e compatibilidade

- O prefixo `/api/v1` só muda com quebra de contrato que não possa ser absorvida.
- Mudanças compatíveis (campo novo opcional na resposta, novo endpoint, novo valor de `codigo`) entram sem nova versão. O app e o painel ignoram campos desconhecidos.
- Campos não são removidos nem mudam de significado em `/v1`. Um campo obsoleto é marcado `deprecated` no OpenAPI e mantido até nenhuma versão do app em uso depender dele.
- A API mantém uma **versão mínima do app** (`VERSAO_MINIMA_APP`). Abaixo dela, responde `426` em todas as rotas, exceto `POST /sincronizacao/eventos`, que continua aceitando eventos de versões antigas por 30 dias para que nada se perca.
- Mudanças que quebram o banco local do app seguem o padrão `feat(mobile)!:` com `BREAKING CHANGE:` ([Fluxo Git](15-fluxo-git-e-contribuicao.md#5-commits)).

## 13. OpenAPI e Swagger UI

| Item | Como |
|---|---|
| Geração | `@nestjs/swagger` com `nestjs-zod` gera o documento OpenAPI 3.1 a partir dos controllers e dos schemas zod de `@painkiller/shared` |
| Publicação | `GET /api/docs` (Swagger UI) e `GET /api/docs/openapi.json`, habilitados em local e homologação; desabilitados em produção |
| CI | O job `contrato` gera o documento, valida com Spectral e falha se alguma rota não tiver resposta de erro documentada ou se o documento divergir do arquivo versionado `apps/api/openapi.json` |
| Cliente | O painel usa tipos gerados a partir do OpenAPI (`openapi-typescript`) para as rotas que não usam diretamente os schemas compartilhados |
| Exemplos | Cada rota tem exemplos de requisição e resposta com dados fictícios |
