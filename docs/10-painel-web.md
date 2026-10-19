# Painel web

Parte da [documentação do Guardião](README.md).

Este documento descreve o painel web usado por coordenadores, responsáveis e administradores: stack, estrutura de pastas, rotas e menus por papel, cada tela com seus dados e ações, mapa, fotos, atualização dos dados, autenticação, testes e build. A escolha de uma SPA com React + Vite está no [ADR-0010](adr/0010-painel-web-react-vite-spa.md). As regras visuais e os componentes compartilhados estão em [09-ux-e-design-system.md](09-ux-e-design-system.md).

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack e estrutura](#2-stack-e-estrutura)
3. [Rotas e menu por papel](#3-rotas-e-menu-por-papel)
4. [Telas](#4-telas)
5. [Mapa](#5-mapa)
6. [Fotos](#6-fotos)
7. [Dados, cache e atualização](#7-dados-cache-e-atualização)
8. [Autenticação no painel](#8-autenticação-no-painel)
9. [Filtros, URLs e exportação](#9-filtros-urls-e-exportação)
10. [Testes](#10-testes)
11. [Build e publicação](#11-build-e-publicação)

---

## 1. Visão geral

| Item | Valor |
|---|---|
| Pasta | `apps/web` |
| Usuários | `COORDENADOR`, `RESPONSAVEL`, `ADMINISTRADOR` (o `VIGILANTE` é recusado, CA01.6) |
| Endereço | `https://<dominio-institucional>/` (produção), `http://localhost:5173` (local) |
| Navegadores | Versões atuais de Chrome, Edge e Firefox; Safari recente. Sem suporte a Internet Explorer |
| Tela | Desktop de 1280 px como referência; responsivo até 360 px para consulta |
| Tema | Claro por padrão, escuro opcional |
| Idioma e fuso | pt-BR, horários em America/Sao_Paulo |

## 2. Stack e estrutura

| Necessidade | Escolha |
|---|---|
| Base | React + Vite + TypeScript estrito |
| Rotas | React Router (modo de dados, com *loaders* para pré-carregar consultas) |
| Dados do servidor | TanStack Query |
| Formulários | React Hook Form + resolvers zod com os schemas de `@painkiller/shared` |
| Componentes | shadcn/ui (Radix + Tailwind CSS), sobre o preset de `@painkiller/design-tokens` |
| Tabelas | TanStack Table |
| Mapas | Leaflet (via `react-leaflet`) |
| Datas | `date-fns` + `date-fns-tz` |
| Testes | Vitest + Testing Library, Playwright + axe |
| Catálogo | Storybook |

```
apps/web/
├── index.html
├── src/
│   ├── main.tsx
│   ├── rotas.tsx                 # árvore de rotas e guardas por papel
│   ├── paginas/                  # uma pasta por rota; só composição
│   │   ├── login/
│   │   ├── painel-do-dia/
│   │   ├── rondas/               # lista e detalhe
│   │   ├── ocorrencias/          # lista e detalhe
│   │   ├── visitas-sinalizadas/
│   │   ├── planejamento/         # roteiros, agendas, rondas avulsas
│   │   ├── cadastros/            # locais, pontos e tags, usuários, dispositivos...
│   │   ├── auditoria/
│   │   └── perfil/
│   ├── features/                 # hooks de consulta e mutação por área
│   ├── componentes/
│   │   ├── ui/                   # componentes gerados do shadcn/ui
│   │   └── guardiao/             # moléculas e organismos próprios (selos, mapa, linha do tempo)
│   ├── api/                      # cliente HTTP, refresh de token, tipos do OpenAPI
│   ├── sessao/                   # contexto de autenticação e papéis
│   └── textos/
├── e2e/                          # Playwright
└── vite.config.ts
```

As mesmas regras de camada do app valem aqui: componentes sem regra de negócio, páginas sem lógica, chamadas HTTP só em `src/api`.

## 3. Rotas e menu por papel

| Rota | Tela | C | R | A | HU |
|---|---|---|---|---|---|
| `/login` | Login | ✓ | ✓ | ✓ | HU-006 |
| `/` | Painel do dia | ✓ | ✓ (seus locais) | → `/cadastros/locais` | HU-034 |
| `/rondas` | Histórico de rondas | ✓ | ✓ | — | HU-036 |
| `/rondas/:id` | Detalhe da ronda | ✓ | ✓ | — | HU-035 |
| `/ocorrencias` | Lista de ocorrências | ✓ | ✓ | — | HU-025, HU-036 |
| `/ocorrencias/:id` | Detalhe da ocorrência | ✓ | ✓ (consulta) | — | HU-025 |
| `/visitas-sinalizadas` | Revisão de visitas | ✓ | — | — | HU-040 |
| `/planejamento/roteiros` · `/planejamento/roteiros/:id` | Roteiros | ✓ | — | consulta | HU-012 |
| `/planejamento/agendas` | Agendas recorrentes | ✓ | — | — | HU-013 |
| `/planejamento/rondas-avulsas` | Ronda avulsa e cancelamento | ✓ | — | — | HU-014 |
| `/cadastros/locais` | Campus, prédios, andares, setores | consulta | — | ✓ | HU-009 |
| `/cadastros/pontos` | Pontos de ronda e tags | consulta | — | ✓ | HU-010 |
| `/cadastros/usuarios` | Usuários | — | — | ✓ | HU-007 |
| `/cadastros/dispositivos` | Aparelhos e revogação | — | — | ✓ | HU-007 |
| `/cadastros/responsaveis` | Responsáveis por local | — | — | ✓ | HU-011 |
| `/cadastros/tipos-ocorrencia` | Tipos de ocorrência | consulta | — | ✓ | HU-011 |
| `/cadastros/notificacoes` | Regra de notificação | — | — | ✓ | HU-027 |
| `/cadastros/campus` | Configuração do campus | consulta | — | ✓ | HU-009 |
| `/auditoria` | Trilha de auditoria | — | — | ✓ | HU-038 |
| `/perfil` | Troca de senha, tema, aviso de privacidade | ✓ | ✓ | ✓ | HU-007, HU-044 |

Menu lateral:

| Papel | Itens |
|---|---|
| `COORDENADOR` | Painel do dia · Rondas · Ocorrências · Visitas sinalizadas (com contador) · Planejamento · Cadastros (consulta) |
| `RESPONSAVEL` | Painel do dia · Rondas · Ocorrências |
| `ADMINISTRADOR` | Cadastros · Usuários e aparelhos · Notificações · Auditoria |

A guarda de rota esconde o que o papel não pode ver, mas a proteção real é a da API ([07 · Permissões](07-api.md#10-permissões-rbac)). Acessar uma rota proibida pelo endereço mostra "Você não tem acesso a esta página".

## 4. Telas

### 4.1 Painel do dia (`/`)

```
┌─────────────┬──────────────────────────────────────────────────────────────┐
│ GUARDIÃO    │ Painel do dia · qua 04/11/2026          Atualizado às 12:00:30│
│             ├──────────────────────────────────────────────────────────────┤
│ ▸ Painel    │ ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐ │
│   Rondas    │ │   18   ││   2    ││   1    ││   2    ││   1    ││   4    │ │
│   Ocorrên.  │ │Concluí.││Em and. ││Atrasad.││Incompl.││Não real││Agendad.│ │
│   Visitas 3 │ └────────┘└────────┘└────────┘└────────┘└────────┘└────────┘ │
│   Planej.   │                                                              │
│   Cadastros │ PRECISA DE ATENÇÃO                                           │
│             │ ⚠ 3 visitas aguardando revisão                    Revisar → │
│             │ ⚠ 1 leitura de tag inválida ou repetida             Ver →   │
│             │ ⚠ 2 ocorrências ALTA/CRÍTICA abertas                Ver →   │
│             │                                                              │
│             │ RONDAS ATRASADAS                                             │
│             │ Noturna P1 e P2 · Vig-01 · 12 min de atraso  [Encerrar]      │
│             │                                                              │
│             │ RONDAS DE HOJE                       [Filtro: todos status ▾]│
│             │ 22:00 Noturna P1 e P2   Vig-01  CONCLUÍDA   8/8   ✓          │
│             │ 23:30 Externa estac.    Vig-02  EM ANDAM.   3/6              │
│             │ ...                                                          │
│             │                                                              │
│             │ OCORRÊNCIAS RECENTES                                         │
│             │ 02:10 Vazamento de água  ALTA   P1 · Térreo  ABERTA          │
└─────────────┴──────────────────────────────────────────────────────────────┘
```

| Item | Detalhe |
|---|---|
| Dados | `GET /painel/resumo?data=` e `GET /rondas?data=` |
| Atualização | A cada 30 s, sem recarregar a página (CA16.4); o horário "Atualizado às" mostra a última resposta |
| "Dia" | Do início ao fim do dia local; rondas que cruzam a meia-noite aparecem no dia do `inicio_previsto` |
| Atrasada | `EM_ANDAMENTO` com `fim_previsto` no passado (indicador derivado, RN09); contada em "Atrasadas" e não em "Em andamento" |
| Ações | Encerrar ronda atrasada (coordenador, com motivo); links para listas filtradas |
| Responsável | Só vê os indicadores dos seus locais (HU-034) e não tem ações |

### 4.2 Histórico de rondas (`/rondas`)

- Filtros: período, vigilante, prédio, andar, setor, roteiro, status, "com visitas sinalizadas", "com visitas rejeitadas".
- Colunas: data e janela, roteiro, vigilante, status (selo), pontos visitados/obrigatórios, ocorrências, início e fim (servidor, com o horário do aparelho ao lado).
- Paginação de 20 itens, com total (CA17.1); ordenação padrão pelo horário do servidor (CA17.3).

### 4.3 Detalhe da ronda (`/rondas/:id`)

| Bloco | Conteúdo |
|---|---|
| Cabeçalho | Roteiro, vigilante, aparelho, janela, status, indicadores (atrasada, com visitas rejeitadas, recebida após encerramento) |
| Pontos | Lista dos pontos copiados na geração (`ronda_ponto`) com a situação de cada um |
| Linha do tempo | Início, visitas, justificativas, ocorrências e fim, ordenados pelo horário do servidor, com `DoisHorarios`, selos de resultado geo, validação da tag e revisão (HU-035) |
| Mapa | Leituras, círculos de tolerância dos pontos e geofence dos prédios ([seção 5](#5-mapa)) |
| Ações (coordenador) | Encerramento administrativo (ronda em andamento), atalho para revisar visitas sinalizadas desta ronda |
| Auditoria | Link "Ver na auditoria" (somente administrador) |

Leituras sem localização aparecem em lista ao lado do mapa (HU-035). Visitas recebidas depois do encerramento ficam destacadas.

### 4.4 Ocorrências (`/ocorrencias` e `/ocorrencias/:id`)

- Lista com filtros de período, tipo, gravidade, status, prédio, andar, setor e vigilante (CA17.2).
- Detalhe: tipo, gravidade, status, local, vigilante, aparelho, `DoisHorarios` (registrada no aparelho e recebida no servidor, CA14.2), descrição, mapa com a posição, galeria de fotos, histórico de status, status das notificações (destinatário, canal, enviada ou falhou com o erro).
- Ação do coordenador: mudar status com comentário (transições do [diagrama de estados](02-requisitos.md#diagramas-de-estado)). Comentário obrigatório para `RESOLVIDA` e `ARQUIVADA`.
- Fotos ainda não recebidas aparecem como "Foto ainda não enviada pelo aparelho" (usando `quantidade_fotos_prevista`).

### 4.5 Visitas sinalizadas (`/visitas-sinalizadas`)

```
┌──────────────────────────────┬────────────────────────────────────────────┐
│ PENDENTES (3)   [Filtros ▾]  │ Corredor norte · P1 · Térreo               │
│                              │ Vig-01 · Noturna P1 e P2 · 04/11 22:14     │
│ ● Corredor norte  FORA_AREA  │ Motivo: FORA DA ÁREA (148 m, precisão 20 m)│
│   Vig-01 · 22:14             │ ┌────────────────────────────────────────┐ │
│ ● Escada leste    REPLAY     │ │              [ mapa ]                  │ │
│   Vig-02 · 23:41             │ │   ◯ raio do ponto   • posição lida     │ │
│ ● Portaria        SEM LOCAL. │ └────────────────────────────────────────┘ │
│   Vig-01 · 22:31             │ Tag: NTAG 424 DNA · VÁLIDA · contador 1832 │
│                              │ Aparelho: 22:14:03 · Servidor: 22:14:04    │
│                              │ Observação                                 │
│                              │ [                                        ] │
│                              │ [ ACEITAR ]  [ REJEITAR ]                  │
└──────────────────────────────┴────────────────────────────────────────────┘
```

- Dados: `GET /visitas?statusRevisao=PENDENTE` com filtros de motivo, prédio, vigilante e período.
- Motivos possíveis: `FORA_AREA`, `INDETERMINADO`, `SEM_LOCALIZACAO`, `LOCALIZACAO_SIMULADA`, `TAG_INVALIDA`, `REPLAY`, `DESVIO_RELOGIO`.
- REJEITAR exige observação de pelo menos 10 caracteres (E1 do UC15). Revisão concorrente mostra a decisão do outro coordenador (E2).
- Atalhos de teclado: `J`/`K` para navegar, `A` para aceitar, `R` para rejeitar (com foco na observação).

### 4.6 Planejamento

| Tela | Conteúdo e regras |
|---|---|
| Roteiros | Lista e editor: nome, descrição, duração estimada, `exige_ordem`; seleção de pontos por prédio/andar/setor com busca; ordenação por arrastar **e** por botões ↑↓ (acessível por teclado); obrigatório/opcional por ponto. Alertas: "Inclua pelo menos um ponto obrigatório", "Ponto sem tag ativa" (HU-012) |
| Agendas | Roteiro, vigilante, dias da semana, hora de início, duração da janela, vigência. Pré-visualização das próximas 7 rondas que serão geradas (HU-013) |
| Rondas avulsas | Criar ronda para um vigilante numa janela; cancelar ronda `AGENDADA` com motivo. Ronda em andamento oferece o encerramento administrativo em vez do cancelamento (HU-014) |

### 4.7 Cadastros

Todas as telas de cadastro seguem o mesmo padrão: tabela com busca e filtro "ativos/inativos/todos"; formulário em painel lateral; botão **Desativar** com diálogo de motivo obrigatório; botão **Reativar** nos inativos (HU-039). Coordenadores veem as telas sem os botões de edição (CA19.4).

| Tela | Particularidades |
|---|---|
| Locais | Árvore campus → prédio → andar → setor. Prédio com mapa para clicar o centro e ajustar o raio da geofence (CA19.1) |
| Pontos e tags | Ponto com referência própria opcional (mapa) e raio de tolerância (sugerido a partir do prédio). Tag ativa exibida com UID, tipo e data de instalação; histórico de tags do ponto. O vínculo de tags é feito no app (modo instalação); o painel permite marcar tag como `EXTRAVIADA` ou `INATIVA` com motivo |
| Usuários | Nome, matrícula, e-mail, campus, papel, telefone (opcional). Redefinir senha gera senha temporária exibida uma única vez |
| Dispositivos | Modelo, plataforma, versão do app, último usuário, último acesso, integridade informada. **Revogar** com motivo (HU-007) |
| Responsáveis | Usuário `RESPONSAVEL` + prédio ou setor + preferências de e-mail e WhatsApp |
| Tipos de ocorrência | Nome, gravidade padrão, ordem de exibição, ícone |
| Notificações | Gravidade mínima, notificar coordenadores, notificar responsáveis; canal WhatsApp desabilitado com "Disponível a partir da V1.1" (HU-027) |
| Campus | Política geográfica, precisão máxima, tolerância de início, inatividade, limite de desvio de relógio |

### 4.8 Auditoria (`/auditoria`)

- Filtros: entidade, id da entidade, usuário, ação e período (CA18.5).
- Lista do mais recente para o mais antigo pelo horário do servidor, com paginação por cursor.
- Detalhe com "antes" e "depois" lado a lado e os campos alterados destacados (HU-038).
- Faixa no topo com o resultado da última verificação da cadeia: "Cadeia íntegra até o registro 18.342 (verificada hoje às 03:30)" ou o primeiro registro inconsistente.

## 5. Mapa

| Item | Decisão |
|---|---|
| Biblioteca | Leaflet com `react-leaflet` |
| Camada base | Tiles do OpenStreetMap, com a atribuição exigida. A URL dos tiles é configurável (`VITE_MAPA_TILES_URL`) para trocar por um provedor institucional ou um cache próprio (pendência AP06 em [04](04-arquitetura.md#11-premissas-e-pendências)) |
| Elementos | Marcador da leitura (cor pelo resultado geo), círculo da precisão informada, círculo do raio de tolerância do ponto, círculo da geofence do prédio, linha opcional ligando as leituras na ordem do servidor |
| Privacidade | Mapas só existem no painel; o app não carrega tiles. Coordenadas de leituras nunca são exportadas fora do painel na V1 |
| Plano de corte | Se o mapa sair (nível 2 do [plano de corte](14-backlog-e-roadmap.md#11-plano-de-corte)), a linha do tempo mostra coordenadas, precisão, distância e resultado em texto |

## 6. Fotos

- A galeria pede `GET /ocorrencias/{id}/fotos/{fotoId}/url` só quando a foto entra na tela (carregamento sob demanda). Cada pedido gera auditoria `VISUALIZAR_FOTO` (RN12).
- A URL expira em 5 minutos. Ao expirar, a galeria pede uma nova ao abrir a foto de novo.
- As miniaturas usam a versão de 320 px gerada pelo worker.
- As fotos não podem ser baixadas por um botão do painel na V1 (o navegador permite salvar a imagem aberta; isso fica registrado na auditoria pelo acesso).
- A página de ocorrência envia `Referrer-Policy: no-referrer` e as imagens são servidas com `Cache-Control: private, max-age=300`.

## 7. Dados, cache e atualização

| Dado | Estratégia no TanStack Query |
|---|---|
| Painel do dia | `refetchInterval: 30_000`, `refetchOnWindowFocus: true` |
| Listas e histórico | `staleTime: 30_000`; nova busca ao mudar filtros |
| Detalhe da ronda em andamento | `refetchInterval: 30_000` enquanto o status for `EM_ANDAMENTO` |
| Visitas sinalizadas | `refetchInterval: 60_000`; invalidação depois de cada revisão |
| Cadastros | `staleTime: 5 min`; invalidação depois de cada mutação |
| Sessão (`/auth/eu`) | Carregada no início; recarregada depois do refresh |

- Mutações com `If-Match` mostram "Este registro foi alterado por outra pessoa. Recarregue para ver a versão atual." quando a API responde `412`.
- Na V1.1, o polling do Painel do dia será substituído por SSE (`GET /painel/eventos`), mantendo o polling como fallback.

## 8. Autenticação no painel

- Login em `/login` com matrícula e senha. Depois do login, o access token fica **só em memória** e o refresh fica em cookie `HttpOnly`, `Secure`, `SameSite=Strict`, restrito a `/api/v1/auth` ([07 · Autenticação](07-api.md#2-autenticação-e-sessão)).
- Ao recarregar a página, o painel chama `POST /auth/refresh` para obter um novo access token. Sem cookie válido, vai para `/login`.
- Duas abas: o refresh é coordenado por `BroadcastChannel` para evitar que duas abas usem o mesmo refresh token ao mesmo tempo (o que seria detectado como reuso e revogaria a família).
- Depois de 30 minutos sem interação, o painel faz logout: revoga a sessão no servidor (`POST /auth/logout`) e volta para `/login`.
- `deveTrocarSenha = true` leva direto a `/perfil` com o formulário de troca de senha.
- Content Security Policy restritiva: `default-src 'self'`; `img-src 'self' data: <tiles>`; `connect-src 'self'`; sem `unsafe-inline` em scripts.

## 9. Filtros, URLs e exportação

- Todo filtro fica na URL (`/rondas?de=2026-11-01&ate=2026-11-07&predioId=...`), para o coordenador salvar ou compartilhar uma consulta.
- O link do e-mail de ocorrência é `/ocorrencias/:id`; sem sessão, o painel leva ao login e volta ao link depois.
- **Exportação CSV/PDF fica para a V1.1** ([01 · Fora do escopo](01-visao-do-produto.md#fora-do-escopo-da-v1)). Na V1, a impressão do navegador do detalhe da ronda e da ocorrência tem folha de estilo própria (`@media print`), sem menu lateral.

## 10. Testes

| Tipo | Ferramenta | O que cobre |
|---|---|---|
| Unitário e componentes | Vitest + Testing Library | Hooks de `features`, selos, formulários, guardas de rota |
| E2E | Playwright contra a API em ambiente de teste com seeds | Login por papel, Painel do dia, revisão de visita, mudança de status, desativação com motivo, auditoria |
| Acessibilidade | `@axe-core/playwright` | Sem violações sérias ou críticas nas telas principais |
| Visual | Storybook | Estados dos componentes próprios |

## 11. Build e publicação

- `pnpm --filter web build` gera arquivos estáticos em `apps/web/dist`.
- Variáveis de build (`VITE_API_URL`, `VITE_MAPA_TILES_URL`, `VITE_AMBIENTE`) não contêm segredos.
- Em produção, o Caddy serve o `dist` com fallback para `index.html` (rotas da SPA), cache longo para arquivos com hash e `no-cache` para o `index.html` ([16](16-implantacao-e-infraestrutura.md)).
- A versão do painel aparece no rodapé e acompanha a tag do repositório.
