# ADR-0002: App em React Native com Expo (development build)

| | |
|---|---|
| **Situação** | Aceita |
| **Data** | 01/10/2026 |
| **Decisores** | Equipe G.E.I.C.I.S |
| **Relacionados** | RF05, RNF08, RNF10, RNF11 · HU-001, HU-018, HU-043 · [ADR-0001](0001-monorepo-pnpm-turborepo.md), [ADR-0006](0006-armazenamento-local-cifrado.md) |

## Contexto

O app do vigilante precisa ler tags NFC (inclusive NTAG 424 DNA por ISO-DEP), usar câmera, localização, biometria, armazenamento seguro e banco local cifrado. A V1 tem como alvo Android com NFC, mas iOS não deve ser descartado. A equipe já trabalha com TypeScript e React, e o prazo é curto. O NFC exige módulo nativo, que não roda no Expo Go.

## Decisão

O app será feito em **React Native com Expo**, usando **development builds** (`expo-dev-client`) e builds na nuvem com **EAS Build**, em TypeScript estrito, com Expo Router.

- A geração dos projetos nativos é contínua (*prebuild*): as pastas `android/` e `ios/` não são versionadas e a configuração nativa fica em `app.config.ts` e em plugins de configuração.
- Módulos nativos de terceiros entram por plugin de configuração (ex.: `react-native-nfc-manager`).
- A versão do Expo SDK é fixada na Sprint 0 e só muda depois da V1.

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que não |
|---|---|---|---|
| Android nativo (Kotlin) | Acesso total ao NFC e ao sistema, melhor desempenho | Outra linguagem e outra base de código; sem reaproveitar tipos com API e painel; iOS seria outro app | Custo e prazo; perde o monorepo TypeScript |
| Flutter | Bom desempenho, um código para Android e iOS | Dart; sem compartilhar tipos e regras com a API e o painel | Mesmo motivo |
| React Native sem Expo (CLI puro) | Controle total do nativo | Mais manutenção de build e de atualização | O Expo com *prebuild* já permite módulos nativos com menos trabalho |
| PWA | Sem instalação | Web NFC só no Chrome Android, sem ISO-DEP para NTAG 424 DNA; armazenamento cifrado limitado | Não atende RF05 e RNF04 |
| Expo Go | Zero build | Não carrega módulos nativos de NFC | Inviável |

## Consequências

**Positivas**

- Um só idioma (TypeScript) e os mesmos schemas e regras de `@painkiller/shared`.
- EAS Build gera APK e AAB assinados sem exigir Android Studio em todas as máquinas.
- iOS continua possível com o mesmo código (1 toque a mais na leitura NFC, RE06).

**Negativas e riscos**

- Cada integrante precisa instalar um *development build* no aparelho; o Expo Go não serve.
- Dependência do ecossistema Expo e de bibliotecas de terceiros para NFC; mudanças de SDK podem quebrar o build (RT11).
- Builds na nuvem do EAS têm fila e cota no plano gratuito. Mitigação: builds locais com `npx expo run:android` quando necessário.

**O que muda no dia a dia**

- Desenvolvimento com `pnpm --filter mobile start` e o *development build* instalado.
- Builds de teste das sprints com o perfil `preview`; produção com `production` ([16](../16-implantacao-e-infraestrutura.md#7-builds-e-distribuição-do-app)).

## Referências

- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) · [EAS Build](https://docs.expo.dev/build/introduction/)
- [react-native-nfc-manager](https://github.com/revtel/react-native-nfc-manager)
- [08 · App mobile](../08-app-mobile.md)
