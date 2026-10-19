# ADR-0010: Painel web como SPA em React + Vite

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RF16, RF17, RF19, RNF12 · HU-006, HU-034 a HU-036, HU-038, HU-040 · [ADR-0001](0001-monorepo-pnpm-turborepo.md), [ADR-0009](0009-atomic-design-design-tokens.md) |

## Contexto

O painel atende coordenadores, responsáveis e administradores, todos autenticados. Não há páginas públicas nem necessidade de SEO. Ele consome a mesma API do app e precisa compartilhar schemas zod, tipos e tokens do monorepo. A operação deve ser simples: uma VM com Caddy, sem um servidor Node a mais só para renderizar páginas.

## Decisão

O painel será uma **SPA (Single Page Application) em React + Vite**, em TypeScript, com:

- React Router para as rotas e TanStack Query para os dados do servidor (polling de 30 s no Painel do dia na V1, SSE na V1.1);
- Tailwind CSS + shadcn/ui sobre o preset de `@painkiller/design-tokens`;
- React Hook Form com os schemas zod de `@painkiller/shared`;
- Leaflet para mapas;
- build em arquivos estáticos servidos pelo **Caddy** no mesmo domínio da API (sem CORS em produção além da própria origem).

Detalhes em [10-painel-web.md](../10-painel-web.md).

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Next.js (SSR/RSC) | Ecossistema grande, SSR | Servidor Node adicional para operar; SSR sem benefício para um painel autenticado; mais complexidade de cache e de autenticação | Desproporcional |
| Painel administrativo pronto (ex.: React Admin, AdminJS) | CRUD rápido | Telas de domínio (linha do tempo, revisão com mapa, Painel do dia) fogem do padrão CRUD; visual difícil de alinhar aos tokens | O CRUD é a menor parte do painel |
| Angular | Estrutura forte | Outra stack em relação ao app (React) | Perde o compartilhamento de conhecimento e de padrões |
| Renderização no servidor pela própria API (templates) | Um processo só | Mistura responsabilidades; sem reaproveitar componentes React | Fere a separação de camadas |

## Consequências

**Positivas**

- Operação simples: o painel é um diretório de arquivos estáticos.
- Mesma linguagem de componentes (React) e mesmos contratos do app.
- Desenvolvimento rápido com o servidor do Vite.

**Negativas e riscos**

- O primeiro carregamento baixa o JavaScript do painel inteiro. Mitigação: divisão de código por rota.
- Access token em memória exige refresh ao recarregar a página (cookie `HttpOnly`), com cuidado para várias abas ([10 · Autenticação](../10-painel-web.md#8-autenticação-no-painel)).

**O que muda no dia a dia**

- `pnpm --filter web dev` para desenvolver; `pnpm --filter web build` gera o `dist` publicado pelo Caddy.

## Referências

- [Vite](https://vite.dev/) · [TanStack Query](https://tanstack.com/query) · [React Router](https://reactrouter.com/)
