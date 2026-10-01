# Documentação do Guardião IFSULDEMINAS

> Projeto **PainKiller** · equipe **G.E.I.C.I.S** · versão da documentação: 1.0 (outubro/2026). Voltar ao [README do repositório](../README.md).

Esta pasta reúne toda a documentação do produto, da arquitetura e do processo. Ela é **viva**: qualquer PR que mude comportamento, contrato ou decisão deve atualizar o documento correspondente.

## Por onde começar

| Se você é… | Leia nesta ordem |
|---|---|
| **Novo no time** | [01 Visão](01-visao-do-produto.md) → [04 Arquitetura](04-arquitetura.md) → [13 Scrum](13-processo-scrum.md) → [15 Fluxo Git](15-fluxo-git-e-contribuicao.md) |
| **Dev mobile** | [08 App mobile](08-app-mobile.md) → [09 UX e design system](09-ux-e-design-system.md) → [06 Sincronização](06-sincronizacao-online-first.md) → [11 Segurança](11-seguranca-e-lgpd.md) |
| **Dev back-end** | [04 Arquitetura](04-arquitetura.md) → [05 Modelo de dados](05-modelo-de-dados.md) → [07 API](07-api.md) → [06 Sincronização](06-sincronizacao-online-first.md) → [11 Segurança](11-seguranca-e-lgpd.md) |
| **Dev do painel web** | [10 Painel web](10-painel-web.md) → [09 UX e design system](09-ux-e-design-system.md) → [07 API](07-api.md) |
| **Product Owner / Coordenação** | [01 Visão](01-visao-do-produto.md) → [02 Requisitos](02-requisitos.md) → [03 Casos de uso](03-casos-de-uso.md) → [14 Backlog e roadmap](14-backlog-e-roadmap.md) |
| **Infraestrutura / TI do campus** | [16 Implantação](16-implantacao-e-infraestrutura.md) → [11 Segurança e LGPD](11-seguranca-e-lgpd.md) → [04 Arquitetura](04-arquitetura.md) |
| **QA / testes** | [12 Estratégia de testes](12-estrategia-de-testes.md) → [02 Requisitos](02-requisitos.md) → [06 Sincronização](06-sincronizacao-online-first.md) |

## Mapa da documentação

### Produto
| Documento | Conteúdo |
|---|---|
| [01 — Visão do produto](01-visao-do-produto.md) | Problema, objetivos e métricas, personas, jornada do vigilante, escopo da V1 e visão de plataforma |
| [02 — Requisitos](02-requisitos.md) | RF01–RF19, RNF01–RNF14, regras de negócio RN01–RN19, critérios de aceitação, máquinas de estado e matriz de rastreabilidade |
| [03 — Casos de uso](03-casos-de-uso.md) | Atores, diagramas de casos de uso, UC01–UC21 e o fluxo completo de uma ronda |
| [Glossário](glossario.md) | Termos do domínio, técnicos e do Scrum |

### Arquitetura e back-end
| Documento | Conteúdo |
|---|---|
| [04 — Arquitetura](04-arquitetura.md) | Drivers de qualidade, C4 (contexto, containers e componentes), eventos de domínio, evolução modular e riscos |
| [05 — Modelo de dados](05-modelo-de-dados.md) | Diagramas ER (`nucleo`, `vigilancia` e banco local), dicionário de dados, índices, permissões e retenção |
| [06 — Sincronização online-first](06-sincronizacao-online-first.md) | Caminho único de escrita, fila cifrada, idempotência, backoff, horários e cenários de falha |
| [07 — API](07-api.md) | Convenções REST, autenticação, erros RFC 9457, endpoints, contratos e matriz RBAC |
| [ADRs](adr/README.md) | As 14 decisões de arquitetura registradas, com alternativas e consequências |

### Interfaces
| Documento | Conteúdo |
|---|---|
| [08 — App mobile](08-app-mobile.md) | React Native + Expo, estrutura de pastas, **componentização (Atomic Design)**, NFC, localização, câmera e estado |
| [09 — UX e design system](09-ux-e-design-system.md) | **Regra dos 2 toques**, wireframes, feedback, design tokens, inventário de componentes e acessibilidade |
| [10 — Painel web](10-painel-web.md) | Rotas, telas, componentes, filtros, mapa e atualização |

### Qualidade e segurança
| Documento | Conteúdo |
|---|---|
| [11 — Segurança e LGPD](11-seguranca-e-lgpd.md) | Modelo de ameaças (STRIDE), OWASP MASVS/ASVS, NFC SUN, autenticação, auditoria e LGPD |
| [12 — Estratégia de testes](12-estrategia-de-testes.md) | Pirâmide, testes de sincronização, NFC e localização, testes de campo e de usabilidade, gates de qualidade |

### Processo e operação
| Documento | Conteúdo |
|---|---|
| [13 — Processo Scrum](13-processo-scrum.md) | Papéis, eventos, quadro, Definition of Ready, Definition of Done e métricas |
| [14 — Backlog e roadmap](14-backlog-e-roadmap.md) | Épicos, histórias HU-001–HU-044, plano de sprints, releases e módulos futuros |
| [15 — Fluxo Git e contribuição](15-fluxo-git-e-contribuicao.md) | Branches, commits, PRs, releases, hotfix e proteções do repositório |
| [16 — Implantação e infraestrutura](16-implantacao-e-infraestrutura.md) | Ambientes, Docker, CI/CD, builds do app, backups, monitoramento e instalação das tags NFC |

## Convenções de identificadores

| Prefixo | Significado | Onde é definido |
|---|---|---|
| `RF` | Requisito funcional | [02 — Requisitos](02-requisitos.md) |
| `RNF` | Requisito não funcional | [02 — Requisitos](02-requisitos.md) |
| `RN` | Regra de negócio | [02 — Requisitos](02-requisitos.md#regras-de-negócio) |
| `UC` | Caso de uso | [03 — Casos de uso](03-casos-de-uso.md) |
| `EP` | Épico | [14 — Backlog](14-backlog-e-roadmap.md) |
| `HU` | História de usuário / tarefa técnica | [14 — Backlog](14-backlog-e-roadmap.md) |
| `ADR` | Decisão de arquitetura | [adr/](adr/README.md) |

## Diagramas

Todos os diagramas estão em **[Mermaid](https://mermaid.js.org/)**, dentro dos próprios arquivos Markdown, e o GitHub os renderiza automaticamente. Para editar, use o [Mermaid Live Editor](https://mermaid.live) ou a extensão *Markdown Preview Mermaid Support* do VS Code. Mantenha os diagramas no texto, sem imagens exportadas, para que possam ser revisados nos PRs.

## Como manter esta documentação

- Mudou uma regra de negócio, endpoint, tabela ou tela? Atualize o documento **no mesmo PR**.
- Decisão de arquitetura nova ou revertida? Crie um ADR a partir do [modelo](adr/0000-modelo.md).
- Requisito novo? Dê o próximo ID livre e atualize a matriz de rastreabilidade em [02](02-requisitos.md).
- Escreva em português do Brasil, com frases curtas e sem jargão desnecessário.
