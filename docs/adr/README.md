# Registros de decisão de arquitetura (ADRs)

Parte da [documentação do Guardião](../README.md).

Um ADR (*Architecture Decision Record*) registra uma decisão de arquitetura importante: o contexto, a decisão, as alternativas consideradas e as consequências. Os ADRs explicam **por que** o sistema é como é, para que ninguém precise adivinhar daqui a um ano.

## Índice

| ADR | Título | Situação | Data |
|---|---|---|---|
| [0001](0001-monorepo-pnpm-turborepo.md) | Monorepo com pnpm workspaces e Turborepo | Aceita | 01/10/2026 |
| [0002](0002-app-react-native-expo-development-build.md) | App em React Native com Expo (development build) | Aceita | 01/10/2026 |
| [0003](0003-api-nestjs-monolito-modular.md) | API em NestJS como monólito modular | Aceita | 01/10/2026 |
| [0004](0004-postgresql-schemas-por-modulo-prisma.md) | PostgreSQL com um schema por módulo e Prisma | Aceita | 01/10/2026 |
| [0005](0005-online-first-fila-local-outbox.md) | Online-first com fila local (outbox) e caminho único de escrita | Aceita | 01/10/2026 |
| [0006](0006-armazenamento-local-cifrado.md) | Armazenamento local cifrado (SQLCipher e AES-256-GCM) | Aceita | 01/10/2026 |
| [0007](0007-tags-nfc-ntag424-dna-sun.md) | Tags NFC NTAG 424 DNA com SUN validado no servidor | **Proposta** | 01/10/2026 |
| [0008](0008-uuidv7-gerado-no-cliente.md) | UUIDv7 gerado no cliente como identificador | Aceita | 01/10/2026 |
| [0009](0009-atomic-design-design-tokens.md) | Atomic Design com design tokens compartilhados | Aceita | 01/10/2026 |
| [0010](0010-painel-web-react-vite-spa.md) | Painel web como SPA em React + Vite | Aceita | 01/10/2026 |
| [0011](0011-validacao-geografica-sinaliza.md) | Validação geográfica que sinaliza em vez de bloquear | Aceita | 01/10/2026 |
| [0012](0012-autenticacao-jwt-refresh-biometria.md) | Autenticação com JWT curto, refresh rotativo e biometria local | Aceita | 01/10/2026 |
| [0013](0013-filas-jobs-bullmq-redis.md) | Filas e jobs com BullMQ e Redis | Aceita | 01/10/2026 |
| [0014](0014-fotos-armazenamento-objetos-minio.md) | Fotos em armazenamento de objetos (MinIO) | Aceita | 01/10/2026 |

## Situações possíveis

| Situação | Significado |
|---|---|
| Proposta | Em discussão ou aguardando uma condição externa (ex.: orçamento). Pode ser seguida provisoriamente, com a alternativa registrada |
| Aceita | Vale para o projeto |
| Rejeitada | Discutida e não adotada; mantida para registro |
| Substituída | Trocada por outro ADR, indicado no campo "Substituída por" |
| Obsoleta | Deixou de se aplicar (ex.: o componente foi removido) |

## Como propor um ADR

1. Copie o [modelo](0000-modelo.md) para `NNNN-titulo-curto-com-hifens.md`, com o próximo número livre.
2. Preencha com situação **Proposta** e abra um PR `docs/adr-NNNN-...` para `develop`.
3. Discuta no PR. Decisões que afetam o produto (custo, prazo, experiência do vigilante) passam pelo PO.
4. O mantenedor faz o merge com a situação **Aceita** (ou **Rejeitada**) e atualiza este índice.
5. Um ADR aceito **não é editado** para mudar a decisão: crie um novo ADR que o substitua e marque o antigo como **Substituída**. Correções de texto e links são permitidas.

Quando criar um ADR: escolha de tecnologia estrutural, padrão que atravessa vários módulos, decisão difícil de reverter, ou qualquer decisão que alguém poderia questionar depois ("por que não usamos X?").
