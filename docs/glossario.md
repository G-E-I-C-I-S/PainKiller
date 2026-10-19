# Glossário

Parte da [documentação do Guardião](README.md).

Termos do domínio da vigilância patrimonial, termos técnicos e termos do processo Scrum usados na documentação do Guardião IFSULDEMINAS. Cada termo traz a categoria entre parênteses: **domínio**, **técnico**, **segurança e LGPD** ou **Scrum**. Nomes entre crases (`assim`) são identificadores canônicos usados no código, na API e no banco.

**Índice:** [A](#a) · [B](#b) · [C](#c) · [D](#d) · [E](#e) · [F](#f) · [G](#g) · [H](#h) · [I](#i) · [J](#j) · [L](#l) · [M](#m) · [N](#n) · [O](#o) · [P](#p) · [R](#r) · [S](#s) · [T](#t) · [U](#u) · [V](#v)

## A

- **Access token** (técnico) — Token JWT de curta duração (15 minutos) enviado em cada requisição à API para identificar o usuário. É renovado com o *refresh token*. Ver [Segurança e LGPD](11-seguranca-e-lgpd.md).
- **Administrador** (domínio) — Papel `ADMINISTRADOR`: TI ou gestão do sistema. Mantém cadastros, usuários, dispositivos e configurações, usa o modo instalação de tags no app e consulta a auditoria. Ver *Papéis*.
- **ADR** (técnico) — *Architecture Decision Record*, registro curto de uma decisão de arquitetura, com contexto, alternativas e consequências. Ver [ADRs](adr/README.md).
- **Agenda de ronda** (domínio) — Regra de recorrência que atribui um roteiro a um vigilante em certos dias da semana, com hora de início, duração da janela e vigência (`agenda_ronda`). O agendador gera as rondas a partir das agendas.
- **Agendador de tarefas** (técnico) — Processo `worker` da API que executa jobs com BullMQ: gera as rondas das agendas (00:05 e 12:05), marca rondas `NAO_REALIZADA` a cada 5 minutos e processa as filas de notificações e de fotos.
- **Andar** (domínio) — Nível de um prédio (`andar`), com nome e número de nível. Pontos de ronda e setores podem estar vinculados a um andar.
- **Argon2id** (segurança e LGPD) — Algoritmo de *hash* de senhas resistente a ataques por força bruta com GPU. As senhas nunca são guardadas em texto puro.
- **ASVS** (segurança e LGPD) — *Application Security Verification Standard*, padrão da OWASP com requisitos de segurança verificáveis para aplicações web e APIs. Referência para a API do Guardião.
- **Atomic Design** (técnico) — Método de organização de interfaces em átomos, moléculas, organismos, templates e páginas. Base da componentização do app e do painel (RNF12). Ver [UX e design system](09-ux-e-design-system.md).
- **Atrasada** (domínio) — Indicador derivado, exibido no painel, de uma ronda `EM_ANDAMENTO` depois de `fim_previsto`. Não é um status da ronda (RN09).

## B

- **Backlog do produto** (Scrum) — Lista ordenada de tudo o que pode ser feito no produto, mantida pelo PO. No Guardião, é organizada em épicos e histórias no GitHub Projects. Ver [Backlog e roadmap](14-backlog-e-roadmap.md).
- **Backoff** (técnico) — Espera crescente entre novas tentativas de envio depois de erro temporário: 5 s, 15 s, 1 min, 5 min e 15 min (teto), com variação aleatória (*jitter*) para evitar que vários aparelhos reenviem ao mesmo tempo.
- **Biometria** (segurança e LGPD) — Desbloqueio do app com impressão digital, reconhecimento facial ou PIN do aparelho, depois do primeiro login (RN18). O app não acessa nem guarda dados biométricos: quem verifica é o sistema operacional.
- **BullMQ** (técnico) — Biblioteca de filas e jobs para Node.js baseada em Redis, usada pelo worker para notificações, processamento de fotos e agendamento ([ADR-0013](adr/0013-filas-jobs-bullmq-redis.md)).
- **Burndown** (Scrum) — Gráfico do trabalho restante (em story points) ao longo da sprint. Ajuda a perceber cedo se a meta da sprint está em risco.

## C

- **Caminho único de escrita** (técnico) — Decisão de que toda ação do app grava primeiro no banco local cifrado e enfileira um evento na mesma transação, com ou sem internet. Online e offline usam o mesmo código ([ADR-0005](adr/0005-online-first-fila-local-outbox.md)).
- **Campus** (domínio) — Unidade do IFSULDEMINAS (`campus`). Agrupa prédios, usuários, roteiros e configurações próprias (`configuracao_campus`), como política geográfica, tolerância de início e regras de notificação.
- **CMAC** (segurança e LGPD) — *Cipher-based Message Authentication Code*. Código de autenticação calculado pela tag NTAG 424 DNA a cada leitura e verificado pelo servidor para comprovar que a leitura veio da tag original (RN07).
- **Contador SUN** (segurança e LGPD) — Número incrementado pela tag NTAG 424 DNA a cada leitura e incluído na mensagem SUN. Um contador já visto para a mesma tag indica `REPLAY` (`contador_sun`).
- **Conventional Commits** (técnico) — Padrão de mensagens de commit (`tipo(escopo): descrição`), usado em português no projeto, por exemplo `feat(mobile): leitura automática de tag NFC (HU-018)`. Ver [Fluxo Git e contribuição](15-fluxo-git-e-contribuicao.md).
- **Coordenador** (domínio) — Papel `COORDENADOR`: coordenador da vigilância do campus. Planeja rondas, acompanha o painel completo do campus, revisa visitas sinalizadas, trata ocorrências e recebe notificações.
- **Critério de aceitação** (Scrum) — Condição objetiva, no formato Dado / Quando / Então, que uma história ou requisito precisa cumprir para ser aceito. Ver [Requisitos](02-requisitos.md#critérios-de-aceitação).

## D

- **Daily** (Scrum) — Reunião diária de 15 minutos (presencial ou assíncrona) para o time inspecionar o progresso rumo à meta da sprint e ajustar o plano do dia.
- **Definition of Done (DoD)** (Scrum) — Lista de critérios que todo item precisa cumprir para ser considerado pronto (por exemplo: testes, revisão, documentação, regra dos 2 toques no app). Ver [Processo Scrum](13-processo-scrum.md).
- **Definition of Ready (DoR)** (Scrum) — Lista de critérios que uma história precisa cumprir para entrar numa sprint (por exemplo: critérios de aceitação claros, estimada, sem dependências bloqueantes).
- **Desativação lógica** (domínio) — Forma de "remover" um cadastro sem excluí-lo: o registro recebe `ativo = false` e um motivo, sai das listas de seleção, continua no histórico e pode ser reativado (RN14).
- **Design tokens** (técnico) — Valores nomeados de cores, tipografia, espaçamentos e raios compartilhados entre app e painel (`@painkiller/design-tokens`). Ver [UX e design system](09-ux-e-design-system.md).
- **Desvio de relógio** (técnico) — Diferença estimada entre o horário do servidor e o do aparelho (`desvio_relogio_ms = servidor − aparelho`). Acima de 5 minutos, o registro é sinalizado (RN15).
- **Development build** (técnico) — Versão do app Expo compilada com módulos nativos próprios (via `expo-dev-client`), necessária porque a leitura NFC não funciona no Expo Go ([ADR-0002](adr/0002-app-react-native-expo-development-build.md)).
- **Dispositivo** (domínio) — Aparelho registrado no sistema (`dispositivo`), identificado pelo identificador de instalação do app. A sessão é vinculada ao dispositivo, que pode ser revogado remotamente.
- **DoD** — Ver *Definition of Done*.
- **DoR** — Ver *Definition of Ready*.
- **DPO** — Ver *Encarregado de Dados*.

## E

- **Encarregado de Dados (DPO)** (segurança e LGPD) — Pessoa indicada pela instituição para atuar como canal de comunicação entre o controlador, os titulares e a ANPD, conforme a LGPD. No projeto, valida a base legal, o aviso de privacidade e a política de retenção.
- **Encerramento administrativo** (domínio) — Ação do coordenador que encerra uma ronda em andamento (normalmente atrasada), com motivo. A ronda passa a `INCOMPLETA`, e eventos que chegarem depois são aceitos e marcados (RN09).
- **Épico** (Scrum) — Agrupamento de histórias com um objetivo comum (EP01 a EP11). Ver [Backlog e roadmap](14-backlog-e-roadmap.md).
- **ETag** (técnico) — Identificador de versão de um recurso HTTP. O app usa a ETag do pacote offline para baixar os dados de referência só quando mudam.
- **Evento de domínio** (técnico) — Notificação interna da API de que algo relevante aconteceu (por exemplo, `OcorrenciaRegistrada`, `VisitaSinalizada`, `RondaNaoRealizada`), que outros módulos podem assinar sem acoplamento direto.
- **Evento de sincronização** (técnico) — Registro enviado pelo app ao servidor para cada ação (`TipoEvento`: `RONDA_INICIADA`, `PONTO_VISITADO`, `PONTO_JUSTIFICADO`, `OCORRENCIA_REGISTRADA`, `RONDA_FINALIZADA`). Tem id UUIDv7 gerado no aparelho e fica registrado no servidor em `evento_sincronizacao`.
- **Expo** (técnico) — Plataforma e conjunto de bibliotecas para desenvolver apps React Native, com builds na nuvem (EAS Build). Ver [App mobile](08-app-mobile.md).

## F

- **Feature flag** (técnico) — Configuração que liga ou desliga uma funcionalidade sem novo deploy. O canal de WhatsApp fica pronto na V1, mas desligado por feature flag.
- **Fila de eventos** (técnico) — Tabela local `fila_eventos` do app, onde ficam os eventos até a confirmação do servidor. Ver *Outbox*.

## G

- **Geofence** (domínio) — Área virtual em torno de um ponto ou prédio, definida por coordenadas e raio (`raio_tolerancia_m` do ponto, `raio_geofence_m` do prédio), usada na validação geográfica da leitura NFC (RN06).
- **Gravidade** (domínio) — Nível de criticidade de uma ocorrência (`Gravidade`): `BAIXA` (verde), `MEDIA` (amarelo), `ALTA` (laranja) e `CRITICA` (vermelho). Define quem é notificado (RN13).

## H

- **Hash encadeado** (segurança e LGPD) — Técnica em que cada registro de auditoria guarda o SHA-256 do registro anterior somado ao próprio conteúdo. Qualquer alteração quebra a cadeia e é detectável (`hash_anterior`, `hash`).
- **Haversine** (técnico) — Fórmula que calcula a distância entre dois pontos na superfície da Terra a partir de latitude e longitude. Usada na validação geográfica (RN06).
- **História de usuário (HU)** (Scrum) — Descrição curta de uma necessidade do ponto de vista de quem usa o sistema, com critérios de aceitação e estimativa (HU-001 a HU-044).

## I

- **Idempotência** (técnico) — Propriedade de uma operação que produz o mesmo resultado se repetida. Reenviar um evento ou uma foto já recebidos não duplica dados: o servidor responde `DUPLICADO` (RNF05).
- **Incremento** (Scrum) — Soma de todo o trabalho pronto (que atende ao DoD) ao fim de uma sprint, demonstrado na Sprint Review.

## J

- **Janela da ronda** (domínio) — Intervalo em que a ronda pode ser iniciada: `[inicio_previsto − tolerancia_inicio_min, fim_previsto]`. A tolerância padrão é de 30 minutos (RN02).
- **Justificativa** (domínio) — Registro do motivo pelo qual um ponto não pôde ser vistoriado, com `MotivoJustificativa` e descrição de pelo menos 10 caracteres. Não conta como visita (RN10).
- **JWT** (técnico) — *JSON Web Token*, formato de token assinado usado como access token na API.

## L

- **LGPD** (segurança e LGPD) — Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018). No Guardião, localização e fotos são dados pessoais. Ver [Segurança e LGPD](11-seguranca-e-lgpd.md).
- **Localização simulada** (segurança e LGPD) — Posição falsa fornecida por um app de *mock location* no Android. Quando detectada, a visita é sempre sinalizada (`localizacao_simulada = true`, RN06).

## M

- **MASTG** (segurança e LGPD) — *Mobile Application Security Testing Guide*, guia da OWASP com os testes que verificam os controles do MASVS.
- **MASVS** (segurança e LGPD) — *Mobile Application Security Verification Standard*, padrão da OWASP de segurança para apps móveis. O Guardião segue o nível L2 para armazenamento, criptografia e autenticação (RNF11). Na versão 2 do padrão, os níveis L1, L2 e R passaram a ser descritos como perfis de teste no MASTG.
- **MinIO** (técnico) — Servidor de armazenamento de objetos compatível com a API S3, usado para as fotos (bucket `guardiao-fotos`) ([ADR-0014](adr/0014-fotos-armazenamento-objetos-minio.md)).
- **Modo instalação** (domínio) — Tela do app, exclusiva do `ADMINISTRADOR`, para vincular uma tag NFC física a um ponto de ronda em campo (UC19).
- **Monólito modular** (técnico) — API implantada como uma única aplicação, mas dividida em módulos com fronteiras claras (núcleo e vigilância), que se comunicam por serviços públicos e eventos de domínio ([ADR-0003](adr/0003-api-nestjs-monolito-modular.md)).
- **Monorepo** (técnico) — Repositório único com o app, a API, o painel e os pacotes compartilhados, gerenciado com pnpm workspaces e Turborepo ([ADR-0001](adr/0001-monorepo-pnpm-turborepo.md)).
- **MoSCoW** (Scrum) — Técnica de priorização em *Must* (obrigatório), *Should* (importante), *Could* (desejável) e *Won't* (fora agora).
- **Motor de sincronização** (técnico) — Componente do app (`MotorSincronizacao`) que envia os eventos da fila em lotes, trata respostas, aplica backoff e faz o upload das fotos. Ver [Sincronização online-first](06-sincronizacao-online-first.md).

## N

- **NDEF** (técnico) — *NFC Data Exchange Format*, formato padrão das mensagens gravadas em tags NFC. Na NTAG 424 DNA, a mensagem NDEF é uma URL com os dados SUN.
- **NFC** (técnico) — *Near Field Communication*, comunicação sem fio de curtíssimo alcance (poucos centímetros). Usada para comprovar a presença do vigilante no ponto.
- **NTAG 424 DNA** (segurança e LGPD) — Tag NFC da NXP com criptografia AES-128 e suporte a SUN, que gera uma mensagem autenticada diferente a cada leitura e dificulta a clonagem (`NTAG424_DNA`). Ver [ADR-0007](adr/0007-tags-nfc-ntag424-dna-sun.md) (em proposta).
- **NTAG215** (técnico) — Tag NFC comum, sem criptografia, aceita como alternativa legada (`NTAG215_LEGADA`), com trava de escrita. As leituras recebem `validacao_tag = NAO_VERIFICAVEL`.

## O

- **Ocorrência** (domínio) — Irregularidade registrada pelo vigilante durante a ronda, com tipo, gravidade, local, descrição opcional, até 5 fotos, horários e localização (`ocorrencia`). Passa pelos status `ABERTA`, `EM_ATENDIMENTO`, `RESOLVIDA` e `ARQUIVADA`.
- **Ocorrência expressa** (domínio) — Fluxo de registro de ocorrência em 3 toques: **OCORRÊNCIA** → foto → **ENVIAR**, com tipo, gravidade e local pré-preenchidos.
- **Online-first** (técnico) — Estratégia em que o app envia os dados imediatamente quando há conexão e, sem conexão, guarda cifrado no aparelho e envia automaticamente depois (RNF01, RNF02). Ver [Sincronização online-first](06-sincronizacao-online-first.md).
- **OpenAPI** (técnico) — Especificação padrão para descrever APIs REST. A API do Guardião publica o contrato em OpenAPI 3.1, com Swagger UI em homologação (RNF13). Ver [API](07-api.md).
- **Outbox** (técnico) — Padrão em que a gravação dos dados e o registro do evento a enviar acontecem na mesma transação, numa fila local (`fila_eventos`). Garante que nenhuma ação fique sem envio ([ADR-0005](adr/0005-online-first-fila-local-outbox.md)).
- **OWASP** (segurança e LGPD) — *Open Worldwide Application Security Project*, comunidade aberta que mantém padrões como MASVS, MASTG, ASVS e API Security Top 10.

## P

- **Pacote offline** (técnico) — Conjunto de dados de referência do campus (prédios, andares, setores, pontos, tags sem segredos, tipos de ocorrência e configurações) baixado no login e a cada abertura online, para o app funcionar sem internet.
- **Papéis** (domínio) — Perfis de acesso (`PapelUsuario`): `VIGILANTE`, `COORDENADOR`, `RESPONSAVEL` e `ADMINISTRADOR`. Definem o que cada usuário pode fazer (ver *RBAC*).
- **Piloto assistido** (domínio) — Uso real do sistema por vigilantes de um campus, com acompanhamento da equipe, na Sprint 5 (09/11 a 13/11/2026), antes da V1.0 em produção.
- **Planning poker** (Scrum) — Técnica de estimativa em que cada membro do time escolhe uma carta (1, 2, 3, 5, 8, 13) e as diferenças são discutidas até o consenso.
- **PO (Product Owner)** (Scrum) — Responsável por maximizar o valor do produto e ordenar o backlog. No projeto, o papel está **a definir**, com sugestão de um representante da Coordenação de Vigilância.
- **Política geográfica** (domínio) — Configuração do campus (`PoliticaGeo`) que define o que acontece com uma leitura fora da área: `SINALIZAR` (padrão, registra e marca para revisão) ou `BLOQUEAR` (recusa a leitura) ([ADR-0011](adr/0011-validacao-geografica-sinaliza.md)).
- **Ponto de ronda** (domínio) — Local físico que deve ser vistoriado (por exemplo, um corredor, uma porta ou uma sala), vinculado a um prédio e, opcionalmente, a um andar e a um setor, com uma tag NFC instalada (`ponto_ronda`).
- **Ponto obrigatório** (domínio) — Ponto do roteiro marcado com `obrigatorio = true`. Só ele conta para a conclusão da ronda (RN08).
- **Precisão** (técnico) — Raio estimado de erro da posição informada pelo aparelho, em metros (`precisao_m`). Precisão pior que `precisao_maxima_m` (padrão 100 m) gera resultado `INDETERMINADO` (RN06).
- **Prédio** (domínio) — Edificação de um campus (`predio`), com código, coordenadas e raio de geofence. Agrupa andares, setores e pontos de ronda.

## R

- **RBAC** (segurança e LGPD) — *Role-Based Access Control*, controle de acesso baseado em papéis. No Guardião, é aplicado na API com escopo por campus e, para o `RESPONSAVEL`, por local. O app nunca é a fonte de verdade de permissões.
- **Refinamento** (Scrum) — Encontro semanal (quarta-feira, 45 minutos) para detalhar, dividir e estimar as histórias das próximas sprints.
- **Refresh token** (segurança e LGPD) — Token de longa duração (30 dias) usado só para obter um novo access token. É rotativo: cada uso gera um novo. Se um refresh token já usado for reapresentado (reuso), toda a família de tokens é revogada.
- **Regra dos 2 toques** (domínio) — Requisito de que iniciar ronda, registrar ponto e finalizar ronda completa exijam no máximo 2 toques a partir da tela Início. A leitura NFC é automática no Android (RNF10).
- **Release Candidate** (Scrum) — Versão candidata à publicação, com todo o escopo previsto, sujeita a validação final. A RC da V1 está prevista para 06/11/2026.
- **Replay** (segurança e LGPD) — Reapresentação de uma leitura de tag já usada, como a cópia de uma URL SUN. Detectado pelo contador repetido (`validacao_tag = REPLAY`), não conta para a conclusão (RN07).
- **Responsável** (domínio) — Papel `RESPONSAVEL`: responsável por prédio ou setor. Consulta o painel restrito aos seus locais e recebe notificações das ocorrências desses locais (`responsavel_local`).
- **Resultado geográfico** (domínio) — Classificação da posição na leitura (`ResultadoGeo`): `DENTRO_AREA`, `FORA_AREA`, `INDETERMINADO` ou `SEM_LOCALIZACAO` (RN06).
- **Retrospectiva** (Scrum) — Encontro ao fim da sprint (sexta-feira, 30 minutos) em que o time avalia como trabalhou e define melhorias.
- **Revisão de visita** (domínio) — Análise, pelo coordenador, de uma visita sinalizada, com decisão `ACEITA` ou `REJEITADA` e observação (`StatusRevisaoVisita`, UC15).
- **Revogação de dispositivo** (segurança e LGPD) — Bloqueio remoto de um aparelho pelo administrador, com motivo. Encerra as sessões vinculadas e impede novos acessos daquele aparelho.
- **RFC 9457** (técnico) — Padrão de respostas de erro em APIs HTTP (`application/problem+json`), usado pela API do Guardião.
- **Ronda** (domínio) — Execução de um roteiro por um vigilante numa janela de horário (`ronda`). Status (`StatusRonda`): `AGENDADA`, `EM_ANDAMENTO`, `CONCLUIDA`, `INCOMPLETA`, `NAO_REALIZADA` e `CANCELADA`. Ver [Requisitos](02-requisitos.md#diagramas-de-estado).
- **Roteiro** (domínio) — Sequência planejada de pontos de ronda, com ordem, obrigatoriedade e duração estimada (`roteiro`, `roteiro_ponto`). Pode exigir ordem de passagem (`exige_ordem`).

## S

- **Schema** (técnico) — Agrupamento de tabelas no PostgreSQL. O Guardião usa `nucleo` (compartilhado com módulos futuros) e `vigilancia` (módulo da V1). Ver [Modelo de dados](05-modelo-de-dados.md).
- **Scrum** (Scrum) — Framework ágil com sprints curtas, papéis (PO, SM e desenvolvedores), eventos e artefatos definidos. No projeto, as sprints são de 1 semana. Ver [Processo Scrum](13-processo-scrum.md).
- **Setor** (domínio) — Divisão funcional de um prédio (por exemplo, um laboratório ou uma secretaria), opcionalmente ligada a um andar (`setor`).
- **Sincronização** (técnico) — Envio dos eventos e fotos da fila local ao servidor e confirmação de cada um, sem perdas e sem duplicidade (UC11).
- **SM (Scrum Master)** (Scrum) — Responsável por promover o Scrum, remover impedimentos e ajudar o time a melhorar. No projeto, o papel está **a definir**.
- **Sprint** (Scrum) — Ciclo fixo de trabalho (1 semana no projeto) que produz um incremento utilizável.
- **Sprint Planning** (Scrum) — Encontro de início da sprint (segunda-feira, 1h30) que define a meta e as histórias da sprint.
- **Sprint Review** (Scrum) — Encontro de fim da sprint (sexta-feira, 45 minutos) com demonstração do incremento ao PO e à Coordenação, de preferência com um vigilante a partir da Sprint 2.
- **SQLCipher** (segurança e LGPD) — Extensão do SQLite que cifra o arquivo do banco inteiro com AES-256. Protege os dados locais do app ([ADR-0006](adr/0006-armazenamento-local-cifrado.md)).
- **Story point** (Scrum) — Unidade relativa de esforço e complexidade de uma história, na sequência de Fibonacci (1, 2, 3, 5, 8, 13).
- **SUN** (segurança e LGPD) — *Secure Unique NFC*, recurso da NTAG 424 DNA que gera, a cada leitura, uma mensagem com dados cifrados, contador e CMAC. O servidor valida a mensagem para comprovar que a tag é a original (RN07).

## T

- **Tag NFC** (domínio) — Etiqueta NFC instalada num ponto de ronda (`tag_nfc`). Status (`StatusTagNfc`): `ATIVA`, `INATIVA`, `SUBSTITUIDA` e `EXTRAVIADA`. Cada ponto tem no máximo uma tag `ATIVA`.
- **Tipo de ocorrência** (domínio) — Categoria da ocorrência (`tipo_ocorrencia`), com gravidade padrão. Lista inicial: porta ou janela aberta, dano ao patrimônio, vazamento de água, iluminação com defeito, equipamento ligado indevidamente, pessoa ou veículo suspeito, princípio de incêndio ou fumaça e outro.
- **Trilha de auditoria** (segurança e LGPD) — Registro append-only (`registro_auditoria`) das principais ações: quem, quando (horário do servidor), de qual aparelho, o que mudou (antes e depois), com hash encadeado (RF18, RN14).
- **Turno** (domínio) — Período de trabalho do vigilante. Pode cruzar a meia-noite. A tela Início mostra as rondas do turno corrente.

## U

- **UID** (técnico) — Identificador único gravado de fábrica na tag NFC (`uid_hex`).
- **URL assinada** (segurança e LGPD) — Endereço temporário (5 minutos) gerado pelo servidor para exibir uma foto do armazenamento de objetos sem expor credenciais. Todo acesso gera auditoria `VISUALIZAR_FOTO`.
- **UUIDv7** (técnico) — Identificador universal único ordenável por tempo. É gerado no aparelho para os registros criados no app, o que permite gravar offline e reenviar sem duplicar ([ADR-0008](adr/0008-uuidv7-gerado-no-cliente.md)).

## V

- **Velocidade** (Scrum) — Quantidade de story points concluídos por sprint. Usada para planejar as próximas sprints.
- **Vigilante** (domínio) — Papel `VIGILANTE`: vigilante patrimonial que executa as rondas pelo app.
- **Visita** (domínio) — Registro da passagem do vigilante por um ponto, criado somente por leitura NFC (`visita_ponto`). Guarda ponto, tag, vigilante, aparelho, horários, localização, resultado geográfico e validação da tag.
- **Visita sinalizada** (domínio) — Visita marcada para revisão do coordenador (`status_revisao = PENDENTE`) por resultado geográfico diferente de `DENTRO_AREA`, localização simulada ou tag `INVALIDA` ou `REPLAY` (RN06, RN07).
