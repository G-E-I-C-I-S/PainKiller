# App Guardião (`apps/mobile`)

App do vigilante: rondas com NFC, justificativas, ocorrências com fotos e envio online-first. Especificação em [docs/08-app-mobile.md](../../docs/08-app-mobile.md) e [docs/09-ux-e-design-system.md](../../docs/09-ux-e-design-system.md).

## Modo local (teste sem servidor)

Enquanto a API não existe, o app funciona sozinho no aparelho:

1. Na tela de login, deixe **Servidor** em branco.
2. Entre com `vigilante` / `1234` (vigilante) ou `admin` / `1234` (administrador).
3. O app cria um campus de teste com 2 prédios, 6 pontos e 2 rondas que começam agora (uma livre, uma com ordem). **Criar ronda de teste** na Início gera novas.
4. Os registros ficam na fila cifrada do aparelho; o envio só acontece com um servidor configurado.

### Testar com as suas tags / cartões RFID

O app lê qualquer tag NFC de 13,56 MHz que o celular reconheça (NTAG, MIFARE Classic/Ultralight, cartões e chaveiros que vêm com módulos RC522). Ele usa o **UID** da tag; se a tag tiver uma URL SUN (NTAG 424 DNA), ela é repassada ao servidor.

1. Entre como `admin`, vá em **⚙ → Instalação de tags**.
2. Encoste a tag, escolha o ponto e toque em **VINCULAR** (opcional: gravar a sua posição atual como local do ponto, para testar a validação de área).
3. Encoste de novo para o teste de leitura.
4. Volte, inicie uma ronda e encoste as tags: vibração + ✓ + som.

Tags de 125 kHz (EM4100, chaveiros de portaria antigos) **não** são lidas por celular. Módulos RC522/PN532 são leitores para Arduino/ESP; o celular faz o papel do leitor, então use os cartões/chaveiros que vieram com eles.

Sem tags à mão: o botão **📶 Simular leitura** (só em dev/homologação) dispara a leitura de qualquer tag do pacote.

## Rodar e gerar o APK

```bash
npm install
npm test                # regras de domínio
npm run typecheck
npx expo prebuild -p android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Variáveis: `APP_AMBIENTE` (`desenvolvimento` | `homologacao` | `producao`) e `APP_API_URL` (URL padrão da API). O APK de teste é assinado com a chave de debug; o de produção vai pelo EAS (`eas.json`, HU-043).

## Atualização automática (sem reinstalar APK)

Igual ao NewLife: ao abrir, o app procura uma versão nova em `https://g-e-i-c-i-s.github.io/PainKiller/updates/android/manifest.json`, baixa mostrando a rodinha de progresso, reinicia sozinho e mostra "App atualizado!" com as novidades uma vez. Durante uma ronda em andamento ele baixa em silêncio e aplica na próxima abertura.

Como publicar uma atualização:

1. Acrescente a versão **no topo** de `src/features/novidades.ts`.
2. Faça merge na `main`. O workflow `.github/workflows/atualizacao-app.yml` roda os testes, gera a atualização (`scripts/publicar-atualizacao.mjs`) e publica no GitHub Pages.
3. Pronto: os celulares pegam na próxima vez que abrirem o app.

Só JS/telas/textos/imagens vão por esse caminho. **Mudou algo nativo** (lib nova com código nativo, permissão, plugin no `app.config.ts`)? Aumente `runtimeVersion` e `version` no `app.config.ts` e gere APK novo. Um APK só recebe atualizações do mesmo `runtimeVersion`.

O manifesto é estático, então o `expo-updates` recebe um patch (`patches/expo-updates+*.patch`, aplicado pelo `postinstall`) para aceitar resposta sem o header `expo-protocol-version`.

## O que esta versão faz

- Login (API ou local), desbloqueio por biometria/PIN, bloqueio por 10 min de inatividade ou em segundo plano, aviso de privacidade.
- Início com próxima ronda e rondas do turno (janela, tolerância, atrasada, cancelada).
- Execução: leitura NFC contínua em modo leitor (Android), progresso, agrupamento por prédio/andar, ordem com "PRÓXIMO", releitura ignorada por 3 s, sobreposição de ✓, vibração e som.
- Localização só nos 5 eventos, com tempo máximo de 5 s e classificação geo (dentro/fora/indeterminado/sem posição); política `SINALIZAR` ou `BLOQUEAR`.
- Justificativa (motivo + 10 caracteres), ocorrência expressa com até 5 fotos (redimensionadas, sem EXIF, SHA-256), finalização com pendências e resumo.
- Banco SQLite cifrado (SQLCipher) com a chave no `expo-secure-store`; fotos guardadas dentro do banco cifrado.
- Fila de eventos com UUIDv7, envio em lotes de 50, backoff, upload de fotos depois do aceite, atualização do pacote offline (ETag) e das rondas. Contratos de [docs/07-api.md](../../docs/07-api.md).
- Modo instalação de tags e tela de diagnóstico (exporta a fila) para o administrador.
- Telas no layout aprovado (`Telas.pdf`): Ler ponto (NFC ou QR Code), Ponto registrado com checklist do local, ocorrência com tipos em grade e "Resolvido no local", finalização com motivo dos pontos não lidos e observação geral.

## Diferenças em relação à documentação (a resolver)

- Sem Drizzle/Zustand/Storybook/Maestro ainda: consultas SQL diretas com um notificador de mudanças (`useConsulta`).
- Fotos cifradas pelo SQLCipher (dentro do banco) em vez de AES-GCM em arquivo com `react-native-quick-crypto`.
- Componentes em arquivos por nível (`src/ui/atomos.tsx` etc.), sem pacote `@painkiller/design-tokens` separado.
- Eventos e campos novos que a API precisa aceitar: `PONTO_CONFERIDO` (checklist do local: `rondaId`, `pontoRondaId`, `visitaId`, `itens[{item, ok}]`, `conferidoEmDispositivo`), `OCORRENCIA_REGISTRADA.detalheLocal` e `.resolvidoNoLocal`, `RONDA_FINALIZADA.observacao`.
- "Tag com problema?" abre a justificativa do ponto (motivo "Tag danificada ou ausente") em vez de marcar por código digitado, para manter a regra de que ponto só conta com leitura (RF08).
- Gravidade na ocorrência mostra Baixa/Média/Alta, como nas telas; `CRITICA` continua válida no contrato.
- O contrato `PONTO_VISITADO` exige `uidHex` com 14 dígitos (7 bytes). Cartões MIFARE Classic têm UID de 4 bytes (8 dígitos): a API precisa aceitar os dois.
