# Changelog

Todas as mudanças relevantes do projeto são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). As regras de versão estão em [docs/15-fluxo-git-e-contribuicao.md](docs/15-fluxo-git-e-contribuicao.md#8-versionamento).

## [Não lançado]

### Adicionado

- Documentação inicial do projeto: visão do produto, requisitos (RF01–RF19, RNF01–RNF14, RN01–RN19), casos de uso, arquitetura (C4), 14 ADRs, modelo de dados, estratégia online-first, contrato da API, app mobile e componentização, UX e design system, painel web, segurança e LGPD, estratégia de testes, processo Scrum, backlog (HU-001–HU-044), fluxo Git e implantação.
- Configuração do repositório: `.gitignore`, `.gitattributes`, `.editorconfig`, `CODEOWNERS`, templates de issue e de pull request, política de segurança.
- Modelo de ADR (`docs/adr/0000-modelo.md`) e índice de ADRs com o processo para propor decisões.
- Endpoints de reenvio de notificação e de verificação da cadeia de auditoria sob demanda no contrato da API.

### Corrigido

- Os documentos 01 a 14, 16, o glossário e os ADRs, citados no índice mas ausentes no commit inicial, foram incluídos. A arquitetura (04) estava incompleta e foi concluída (C4, eventos de domínio, sequências, evolução, stack e riscos).
- Textos das histórias HU-005, HU-019, HU-021 e HU-024 alinhados aos critérios de aceitação e à tabela de textos da interface.
- Pendências do backlog resolvidas no modelo de dados: cópia dos pontos por ronda (`ronda_ponto`), registro de leituras `REPLAY` (`leitura_sun`), índice parcial de visitas válidas e registro da ciência do aviso de privacidade.
- RN04 e RN07 descrevem as restrições reais do banco (índice parcial e tabela `leitura_sun`).
- Links genéricos para o índice de ADRs trocados pelos arquivos de cada decisão; label `status:triagem`, usado pelos templates de issue, documentado no processo Scrum.
